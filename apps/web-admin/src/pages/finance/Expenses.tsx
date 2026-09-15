import React, { useState, useEffect } from 'react';
import {
  expenseApi,
  Expense,
  ExpenseStatus,
  ExpensePaymentType,
  TaxType,
  ExpenseAccount,
  ExpenseSupplier,
  ExpenseBranch,
  JournalEntry,
  ExpenseCategoryMapping,
} from '../../services/expenseApi';
import { apiRequest } from '../../services/api';

const TAX_RATE_MAP: Record<TaxType, { label: string; rate: number }> = {
  NONE: { label: '0% (Exempt/None)', rate: 0 },
  GST_5: { label: '5% GST', rate: 0.05 },
  GST_12: { label: '12% GST', rate: 0.12 },
  GST_18: { label: '18% GST', rate: 0.18 },
  GST_28: { label: '28% GST', rate: 0.28 },
};

const STATUS_BADGES: Record<ExpenseStatus, { label: string; bg: string; color: string; icon: string }> = {
  DRAFT: { label: 'DRAFT', bg: '#334155', color: '#94a3b8', icon: 'edit_note' },
  SUBMITTED: { label: 'SUBMITTED', bg: '#1e3a5f', color: '#60a5fa', icon: 'send' },
  APPROVED: { label: 'APPROVED', bg: '#3b2f00', color: '#fbbf24', icon: 'verified' },
  POSTED: { label: 'POSTED (GL)', bg: '#064e3b', color: '#34d399', icon: 'account_balance' },
  REJECTED: { label: 'REJECTED', bg: '#7f1d1d', color: '#fca5a5', icon: 'cancel' },
  CANCELLED: { label: 'CANCELLED', bg: '#4c1d95', color: '#c084fc', icon: 'do_not_disturb' },
};

export default function Expenses({ triggerAlert }: { triggerAlert?: (msg: string, isError?: boolean) => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [branches, setBranches] = useState<ExpenseBranch[]>([]);
  const [suppliers, setSuppliers] = useState<ExpenseSupplier[]>([]);
  const [accounts, setAccounts] = useState<ExpenseAccount[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<ExpenseCategoryMapping[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<ExpensePaymentType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPostingModal, setShowPostingModal] = useState<Expense | null>(null);
  const [showRejectionModal, setShowRejectionModal] = useState<Expense | null>(null);
  const [showReversalModal, setShowReversalModal] = useState<Expense | null>(null);
  const [showJournalDrawer, setShowJournalDrawer] = useState<JournalEntry | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState<Expense | null>(null);

  // Action mutation state
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reversalReason, setReversalReason] = useState('');

  // Create Form State
  const [form, setForm] = useState({
    expenseDate: new Date().toISOString().split('T')[0],
    branchId: '',
    description: '',
    supplierId: '',
    invoiceNumber: '',
    categoryId: '',
    baseAmount: '',
    taxType: 'GST_18' as TaxType,
    paymentType: 'BANK_TRANSFER' as ExpensePaymentType,
    expenseAccountId: '',
    paymentAccountId: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');

  const fetchMasterData = async () => {
    try {
      const [brRes, supRes, accRes, catRes] = await Promise.all([
        apiRequest('/branches').catch(() => []),
        apiRequest('/masters/suppliers').catch(() => []),
        expenseApi.getAccounts().catch(() => []),
        expenseApi.getCategoryMappings().catch(() => []),
      ]);

      const loadedBranches = Array.isArray(brRes) ? brRes : brRes?.items || [];
      const loadedSuppliers = Array.isArray(supRes) ? supRes : supRes?.items || [];
      
      setBranches(loadedBranches);
      setSuppliers(loadedSuppliers);
      setAccounts(accRes);
      setCategoryMappings(catRes);

      if (loadedBranches.length > 0 && !form.branchId) {
        setForm(f => ({ ...f, branchId: loadedBranches[0].id }));
      }
      if (accRes.length > 0) {
        const defaultExpAcc = accRes.find(a => a.type === 'EXPENSE')?.id || accRes[0].id;
        const defaultPayAcc = accRes.find(a => a.type === 'ASSET' || a.type === 'LIABILITY')?.id || accRes[0].id;
        setForm(f => ({
          ...f,
          expenseAccountId: f.expenseAccountId || defaultExpAcc,
          paymentAccountId: f.paymentAccountId || defaultPayAcc,
        }));
      }
    } catch (err: any) {
      console.error('Error loading master data:', err);
    }
  };

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const [expResult, sumRes] = await Promise.all([
        expenseApi.getExpenses({
          page,
          limit,
          status: statusFilter || undefined,
          branchId: branchFilter || undefined,
          supplierId: supplierFilter || undefined,
          paymentType: paymentTypeFilter || undefined,
          search: searchQuery || undefined,
        }),
        expenseApi.getExpenseSummary(branchFilter || undefined).catch(() => ({})),
      ]);

      setExpenses(expResult.items || []);
      setTotalRecords(expResult.meta?.total || 0);
      setTotalPages(expResult.meta?.totalPages || 1);
      setSummary(sumRes || {});
    } catch (err: any) {
      const msg = err.message || 'Failed to load expenses';
      if (triggerAlert) triggerAlert(msg, true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    loadExpenses();
  }, [page, statusFilter, branchFilter, supplierFilter, paymentTypeFilter, searchQuery]);

  // Handle Category selection auto-suggest
  const handleCategoryChange = (catId: string) => {
    setForm(f => {
      const next = { ...f, categoryId: catId };
      const match = categoryMappings.find(c => c.id === catId || c.categoryName === catId);
      if (match) {
        if (match.expenseAccountId) next.expenseAccountId = match.expenseAccountId;
        if (match.defaultTaxType) next.taxType = match.defaultTaxType;
      }
      return next;
    });
  };

  // Presentation Live Tax Preview
  const baseNum = Number(form.baseAmount) || 0;
  const taxRate = TAX_RATE_MAP[form.taxType]?.rate || 0;
  const previewTax = baseNum * taxRate;
  const previewTotal = baseNum + previewTax;

  // ─── WORKFLOW ACTIONS ────────────────────────────────────────────────────────

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.branchId) { setFormError('Branch is required'); return; }
    if (!form.description.trim()) { setFormError('Description is required'); return; }
    if (baseNum <= 0) { setFormError('Base amount must be greater than zero'); return; }
    if (!form.expenseAccountId) { setFormError('Expense Account is required'); return; }
    if (!form.paymentAccountId) { setFormError('Payment Account is required'); return; }

    setActionLoading(true);
    try {
      const created = await expenseApi.createExpense({
        expenseDate: form.expenseDate,
        branchId: form.branchId,
        description: form.description,
        supplierId: form.supplierId || undefined,
        invoiceNumber: form.invoiceNumber || undefined,
        categoryId: form.categoryId || undefined,
        baseAmount: baseNum,
        taxType: form.taxType,
        paymentType: form.paymentType,
        expenseAccountId: form.expenseAccountId,
        paymentAccountId: form.paymentAccountId,
        notes: form.notes || undefined,
      });

      setShowCreateModal(false);
      if (triggerAlert) triggerAlert(`Expense #${created.expenseNumber} created in DRAFT status!`);
      loadExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to create expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitExpense = async (exp: Expense) => {
    if (!confirm(`Submit Expense #${exp.expenseNumber} for approval?`)) return;
    setActionLoading(true);
    try {
      const updated = await expenseApi.submitExpense(exp.id);
      if (triggerAlert) triggerAlert(`Expense #${updated.expenseNumber} submitted for approval!`);
      loadExpenses();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to submit expense', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveExpense = async (exp: Expense) => {
    if (!confirm(`Approve Expense #${exp.expenseNumber}?`)) return;
    setActionLoading(true);
    try {
      const updated = await expenseApi.approveExpense(exp.id);
      if (triggerAlert) triggerAlert(`Expense #${updated.expenseNumber} approved successfully!`);
      loadExpenses();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to approve expense', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectExpense = async () => {
    if (!showRejectionModal) return;
    if (!rejectionReason.trim()) {
      if (triggerAlert) triggerAlert('Rejection reason is required', true);
      return;
    }
    setActionLoading(true);
    try {
      const updated = await expenseApi.rejectExpense(showRejectionModal.id, rejectionReason.trim());
      setShowRejectionModal(null);
      setRejectionReason('');
      if (triggerAlert) triggerAlert(`Expense #${updated.expenseNumber} rejected.`);
      loadExpenses();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to reject expense', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePostExpense = async () => {
    if (!showPostingModal) return;
    setActionLoading(true);
    try {
      const res = await expenseApi.postExpense(showPostingModal.id);
      setShowPostingModal(null);
      if (triggerAlert) triggerAlert(`Expense #${res.expense.expenseNumber} posted to GL (Journal #${res.journal?.journalNumber || 'Posted'})!`);
      loadExpenses();
      if (res.journal) {
        setShowJournalDrawer(res.journal);
      }
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to post expense to GL', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelExpense = async () => {
    if (!showReversalModal) return;
    if (!reversalReason.trim()) {
      if (triggerAlert) triggerAlert('Cancellation/Reversal reason is required', true);
      return;
    }
    setActionLoading(true);
    try {
      const res = await expenseApi.cancelExpense(showReversalModal.id, reversalReason.trim());
      setShowReversalModal(null);
      setReversalReason('');
      if (triggerAlert) {
        triggerAlert(
          res.reversalJournal
            ? `Posted Expense reversed in GL! Counter-Journal #${res.reversalJournal.journalNumber} created.`
            : `Expense cancelled successfully.`
        );
      }
      loadExpenses();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to cancel expense', true);
    } finally {
      setActionLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-surface-hover)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: '10px 14px',
    color: 'var(--color-text-primary)',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>💰 Expense Subledger & Accounting</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4, margin: 0 }}>
            Operational lifecycle: Draft → Submit → Approve → Post to General Ledger → Reverse
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateModal(true)} style={{ padding: '10px 20px', fontSize: 14 }}>
          + New Expense
        </button>
      </div>

      {/* Summary KPI Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 14 }}>
        {(['DRAFT', 'SUBMITTED', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED'] as ExpenseStatus[]).map(st => {
          const cfg = STATUS_BADGES[st];
          const count = summary[st] || 0;
          const isSelected = statusFilter === st;

          return (
            <div
              key={st}
              onClick={() => setStatusFilter(isSelected ? '' : st)}
              style={{
                background: isSelected ? cfg.bg : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isSelected ? cfg.color : 'var(--color-border)'}`,
                borderRadius: 12,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: cfg.color, fontSize: 13, fontWeight: 600 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{cfg.icon}</span>
                <span>{cfg.label}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 8, color: '#ffffff' }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter & Search Toolbar */}
      <div style={{ background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 12, border: '1px solid var(--color-border)', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Search Expense #, Invoice #, Description, Supplier..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, width: 280 }}
        />

        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={{ ...inputStyle, width: 150 }}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_BADGES).map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="">All Branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select value={paymentTypeFilter} onChange={e => setPaymentTypeFilter(e.target.value as any)} style={{ ...inputStyle, width: 150 }}>
          <option value="">All Payment Types</option>
          <option value="CASH">CASH</option>
          <option value="BANK_TRANSFER">BANK TRANSFER</option>
          <option value="UPI">UPI</option>
          <option value="CREDIT">CREDIT</option>
        </select>

        {(statusFilter || branchFilter || supplierFilter || paymentTypeFilter || searchQuery) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setBranchFilter('');
              setSupplierFilter('');
              setPaymentTypeFilter('');
              setSearchQuery('');
            }}
            style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13 }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Expense List Table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid var(--color-border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
            No expense records found matching criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'rgba(0,0,0,0.2)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 14px' }}>Expense #</th>
                  <th style={{ padding: '12px 14px' }}>Date</th>
                  <th style={{ padding: '12px 14px' }}>Branch</th>
                  <th style={{ padding: '12px 14px' }}>Description</th>
                  <th style={{ padding: '12px 14px' }}>Supplier / Vendor</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Base (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>GST Tax (₹)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total (₹)</th>
                  <th style={{ padding: '12px 14px' }}>Payment</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Workflow Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(exp => {
                  const badge = STATUS_BADGES[exp.status] || STATUS_BADGES.DRAFT;
                  return (
                    <tr key={exp.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                        {exp.expenseNumber}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                        {new Date(exp.expenseDate).toLocaleDateString('en-IN')}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                        {exp.branch?.name || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-primary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.description}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--color-text-secondary)' }}>
                        {exp.supplier?.name || '—'}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600 }}>
                        ₹{Number(exp.baseAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', color: '#94a3b8' }}>
                        ₹{Number(exp.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                        ₹{Number(exp.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {exp.paymentType}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{badge.icon}</span>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Workflow Action Buttons */}
                          {exp.status === 'DRAFT' && (
                            <button
                              onClick={() => handleSubmitExpense(exp)}
                              disabled={actionLoading}
                              style={{ background: '#1e3a5f', color: '#60a5fa', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                              Submit
                            </button>
                          )}

                          {exp.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => handleApproveExpense(exp)}
                                disabled={actionLoading}
                                style={{ background: '#14532d', color: '#86efac', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => setShowRejectionModal(exp)}
                                disabled={actionLoading}
                                style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                              >
                                ✕ Reject
                              </button>
                            </>
                          )}

                          {exp.status === 'APPROVED' && (
                            <>
                              <button
                                onClick={() => setShowPostingModal(exp)}
                                disabled={actionLoading}
                                style={{ background: '#064e3b', color: '#34d399', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
                              >
                                ⚡ Post to GL
                              </button>
                              <button
                                onClick={() => setShowReversalModal(exp)}
                                disabled={actionLoading}
                                style={{ background: '#4c1d95', color: '#c084fc', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {exp.status === 'POSTED' && (
                            <>
                              {exp.journalEntry && (
                                <button
                                  onClick={() => setShowJournalDrawer(exp.journalEntry!)}
                                  style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid #38bdf8', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                                >
                                  📖 View Journal
                                </button>
                              )}
                              <button
                                onClick={() => setShowReversalModal(exp)}
                                disabled={actionLoading}
                                style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                              >
                                ↩ Reverse GL
                              </button>
                            </>
                          )}

                          <button
                            onClick={() => setShowAuditDrawer(exp)}
                            style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                            title="Audit Trail"
                          >
                            📜
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server-side Pagination Controls */}
        <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            Showing {expenses.length} of {totalRecords} expenses (Page {page} of {totalPages})
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page <= 1}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: page > 1 ? 'pointer' : 'not-allowed', opacity: page > 1 ? 1 : 0.5 }}
            >
              ← Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--color-text-primary)', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: page < totalPages ? 'pointer' : 'not-allowed', opacity: page < totalPages ? 1 : 0.5 }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* CREATE EXPENSE MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#1e293b', border: '1px solid var(--color-border)', borderRadius: 16, padding: 28, maxWidth: 650, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Log New Expense (DRAFT)</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#fca5a5', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleCreateExpense} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label>Expense Date *</label>
                <input type="date" style={inputStyle} value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} required />
              </div>

              <div>
                <label>Branch / Location *</label>
                <select style={inputStyle} value={form.branchId} onChange={e => setForm({ ...form, branchId: e.target.value })} required>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label>Description *</label>
                <input type="text" style={inputStyle} placeholder="e.g. Factory Electricity Bill - Aug 2026" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>

              <div>
                <label>Supplier / Vendor (Optional)</label>
                <select style={inputStyle} value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })}>
                  <option value="">None / Direct</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label>Invoice # (Optional)</label>
                <input type="text" style={inputStyle} placeholder="e.g. INV-8842" value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} />
              </div>

              <div>
                <label>Category Mapping</label>
                <select style={inputStyle} value={form.categoryId} onChange={e => handleCategoryChange(e.target.value)}>
                  <option value="">Select Category</option>
                  {categoryMappings.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                </select>
              </div>

              <div>
                <label>Tax Treatment (GST)</label>
                <select style={inputStyle} value={form.taxType} onChange={e => setForm({ ...form, taxType: e.target.value as TaxType })}>
                  {Object.entries(TAX_RATE_MAP).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Base Amount (Excl. Tax) *</label>
                <input type="number" step="0.01" style={inputStyle} placeholder="0.00" value={form.baseAmount} onChange={e => setForm({ ...form, baseAmount: e.target.value })} required />
              </div>

              <div>
                <label>Payment Method</label>
                <select style={inputStyle} value={form.paymentType} onChange={e => setForm({ ...form, paymentType: e.target.value as ExpensePaymentType })}>
                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI</option>
                  <option value="CREDIT">CREDIT</option>
                </select>
              </div>

              <div>
                <label>Expense Account (Debit) *</label>
                <select style={inputStyle} value={form.expenseAccountId} onChange={e => setForm({ ...form, expenseAccountId: e.target.value })} required>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Payment Account (Credit) *</label>
                <select style={inputStyle} value={form.paymentAccountId} onChange={e => setForm({ ...form, paymentAccountId: e.target.value })} required>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>

              {/* Presentation Live Tax Preview Card */}
              <div style={{ gridColumn: '1 / -1', background: 'rgba(99, 102, 241, 0.1)', border: '1px dashed #6366f1', padding: 14, borderRadius: 10, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Base Preview</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>₹{baseNum.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Est. Tax ({TAX_RATE_MAP[form.taxType].label})</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#38bdf8' }}>₹{previewTax.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Estimated Total</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#4ade80' }}>₹{previewTotal.toFixed(2)}</div>
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={actionLoading} style={{ padding: '10px 24px' }}>
                  {actionLoading ? 'Creating Draft...' : 'Create Draft Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POSTING CONFIRMATION MODAL */}
      {showPostingModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#0f172a', border: '1px solid #059669', borderRadius: 16, padding: 28, maxWidth: 520, width: '90%' }}>
            <h2 style={{ marginTop: 0, color: '#34d399', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined">account_balance</span>
              Post Expense to General Ledger
            </h2>

            <div style={{ background: 'rgba(5, 150, 105, 0.1)', border: '1px solid rgba(5, 150, 105, 0.3)', borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 13 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                <div><strong>Expense #:</strong> {showPostingModal.expenseNumber}</div>
                <div><strong>Branch:</strong> {showPostingModal.branch?.name}</div>
                <div><strong>Base:</strong> ₹{Number(showPostingModal.baseAmount).toFixed(2)}</div>
                <div><strong>GST Tax:</strong> ₹{Number(showPostingModal.taxAmount).toFixed(2)}</div>
                <div style={{ gridColumn: '1/-1', fontSize: 16, fontWeight: 800, color: '#34d399', marginTop: 4 }}>
                  Total Postable Amount: ₹{Number(showPostingModal.totalAmount).toFixed(2)}
                </div>
              </div>
              <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: 12 }}>
                ⚠️ <strong>Notice:</strong> Posting will create an immutable accounting journal entry in the General Ledger and update account balances.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPostingModal(null)} style={{ padding: '10px 18px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handlePostExpense} disabled={actionLoading} style={{ padding: '10px 24px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {actionLoading ? 'Posting to GL...' : '⚡ Confirm GL Posting'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECTION MODAL */}
      {showRejectionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #ef4444', borderRadius: 16, padding: 24, maxWidth: 450, width: '90%' }}>
            <h3 style={{ marginTop: 0, color: '#fca5a5' }}>Reject Expense #{showRejectionModal.expenseNumber}</h3>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Please provide a mandatory reason for rejecting this expense submission.</p>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
              rows={3}
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowRejectionModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleRejectExpense} disabled={actionLoading || !rejectionReason.trim()} style={{ padding: '8px 20px', background: '#dc2626', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {actionLoading ? 'Rejecting...' : 'Reject Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVERSAL / CANCEL MODAL */}
      {showReversalModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e293b', border: '1px solid #7c3aed', borderRadius: 16, padding: 24, maxWidth: 480, width: '90%' }}>
            <h3 style={{ marginTop: 0, color: '#c084fc' }}>
              {showReversalModal.status === 'POSTED' ? '↩ Reverse Posted Expense in GL' : 'Cancel Unposted Expense'}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>
              {showReversalModal.status === 'POSTED'
                ? 'Reversing a posted expense creates a counter-journal entry in the General Ledger without deleting historical records.'
                : 'Cancelling this expense marks it as CANCELLED.'}
            </p>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 16 }}
              rows={3}
              placeholder="Reason for cancellation/reversal..."
              value={reversalReason}
              onChange={e => setReversalReason(e.target.value)}
              required
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowReversalModal(null)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer' }}>
                Close
              </button>
              <button onClick={handleCancelExpense} disabled={actionLoading || !reversalReason.trim()} style={{ padding: '8px 20px', background: '#7c3aed', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                {actionLoading ? 'Processing...' : showReversalModal.status === 'POSTED' ? 'Confirm GL Reversal' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW GL JOURNAL DRAWER */}
      {showJournalDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#0f172a', width: 550, maxWidth: '100%', height: '100vh', padding: 28, overflowY: 'auto', borderLeft: '1px solid var(--color-border)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid var(--color-border)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-outlined">menu_book</span>
                  Journal #{showJournalDrawer.journalNumber}
                </h2>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>Authoritative General Ledger Posting</span>
              </div>
              <button onClick={() => setShowJournalDrawer(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20, fontSize: 13, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10 }}>
              <div><strong>Posting Date:</strong> {new Date(showJournalDrawer.postingDate).toLocaleDateString('en-IN')}</div>
              <div><strong>Source Type:</strong> {showJournalDrawer.sourceType}</div>
              <div><strong>Status:</strong> <span style={{ color: '#34d399', fontWeight: 700 }}>{showJournalDrawer.status}</span></div>
              <div><strong>Branch:</strong> {showJournalDrawer.branch?.name || '—'}</div>
            </div>

            <h4 style={{ margin: '0 0 12px 0', fontSize: 14 }}>Journal Entry Lines</h4>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, border: '1px solid var(--color-border)', overflow: 'hidden', marginBottom: 20 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Account</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Debit (₹)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Credit (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {showJournalDrawer.lines.map((l, i) => (
                    <tr key={l.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 600 }}>{l.account?.name || 'Account'}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{l.account?.code}</div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: Number(l.debit) > 0 ? 700 : 400, color: Number(l.debit) > 0 ? '#38bdf8' : '#64748b' }}>
                        {Number(l.debit) > 0 ? `₹${Number(l.debit).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: Number(l.credit) > 0 ? 700 : 400, color: Number(l.credit) > 0 ? '#34d399' : '#64748b' }}>
                        {Number(l.credit) > 0 ? `₹${Number(l.credit).toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Balanced Badge */}
            {(() => {
              const totalDebits = showJournalDrawer.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
              const totalCredits = showJournalDrawer.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
              const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

              return (
                <div style={{ background: isBalanced ? 'rgba(5, 150, 105, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${isBalanced ? '#059669' : '#ef4444'}`, padding: 16, borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>Total Debits = Total Credits</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>
                      ₹{totalDebits.toFixed(2)} / ₹{totalCredits.toFixed(2)}
                    </div>
                  </div>
                  <span style={{ background: isBalanced ? '#059669' : '#dc2626', color: '#ffffff', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800 }}>
                    {isBalanced ? 'Balanced ✓' : 'Unbalanced ✕'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* AUDIT & HISTORY DRAWER */}
      {showAuditDrawer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'flex-end', zIndex: 1100, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#1e293b', width: 480, maxWidth: '100%', height: '100vh', padding: 24, overflowY: 'auto', borderLeft: '1px solid var(--color-border)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--color-border)', paddingBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Audit History #{showAuditDrawer.expenseNumber}</h3>
              <button onClick={() => setShowAuditDrawer(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 20 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>CREATED</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{new Date(showAuditDrawer.createdAt).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: '#cbd5e1' }}>User: {showAuditDrawer.createdBy?.name || showAuditDrawer.createdById}</div>
              </div>

              {showAuditDrawer.submittedAt && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 600 }}>SUBMITTED FOR APPROVAL</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{new Date(showAuditDrawer.submittedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>User: {showAuditDrawer.submittedById || 'Admin'}</div>
                </div>
              )}

              {showAuditDrawer.approvedAt && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 600 }}>APPROVED</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{new Date(showAuditDrawer.approvedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>Approver: {showAuditDrawer.approvedById || 'Admin'}</div>
                </div>
              )}

              {showAuditDrawer.postedAt && (
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 10, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 12, color: '#34d399', fontWeight: 600 }}>POSTED TO GL</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 2 }}>{new Date(showAuditDrawer.postedAt).toLocaleString()}</div>
                  <div style={{ fontSize: 12, color: '#cbd5e1' }}>Journal ID: {showAuditDrawer.journalEntryId || '—'}</div>
                </div>
              )}

              {showAuditDrawer.rejectionReason && (
                <div style={{ background: 'rgba(239,68,68,0.1)', padding: 14, borderRadius: 10, border: '1px solid #ef4444' }}>
                  <div style={{ fontSize: 12, color: '#fca5a5', fontWeight: 600 }}>REJECTED</div>
                  <div style={{ fontSize: 13, color: '#ffffff', marginTop: 4 }}>Reason: {showAuditDrawer.rejectionReason}</div>
                </div>
              )}

              {showAuditDrawer.reversalReason && (
                <div style={{ background: 'rgba(124,58,237,0.1)', padding: 14, borderRadius: 10, border: '1px solid #7c3aed' }}>
                  <div style={{ fontSize: 12, color: '#c084fc', fontWeight: 600 }}>REVERSED / CANCELLED</div>
                  <div style={{ fontSize: 13, color: '#ffffff', marginTop: 4 }}>Reason: {showAuditDrawer.reversalReason}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
