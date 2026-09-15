// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

const STATUS_CONFIG = {
  OPEN: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  CLOSED: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
};

export default function CashRegisters({ triggerAlert }) {
  const [registers, setRegisters] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOpen, setShowOpen] = useState(false);
  const [closeTarget, setCloseTarget] = useState(null);
  const [openForm, setOpenForm] = useState({ locationId: '', openingBalance: 0 });
  const [closeForm, setCloseForm] = useState({ closingBalance: 0, notes: '' });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [regs, brs] = await Promise.all([
        apiRequest('/finance/cash-registers').catch(() => []),
        apiRequest('/branches').catch(() => []),
      ]);
      setRegisters(Array.isArray(regs) ? regs : regs?.items || []);
      setBranches(Array.isArray(brs) ? brs : brs?.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleOpen = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/finance/cash-registers/open', 'POST', { ...openForm, openingBalance: Number(openForm.openingBalance) });
      setShowOpen(false);
      triggerAlert('Register opened successfully');
      fetchAll();
    } catch (err) { triggerAlert(err.message, true); }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/finance/cash-registers/${closeTarget.id}/close`, 'PATCH', { closingBalance: Number(closeForm.closingBalance), notes: closeForm.notes });
      setCloseTarget(null);
      triggerAlert('Register closed and reconciled');
      fetchAll();
    } catch (err) { triggerAlert(err.message, true); }
  };

  const inputStyle = { background: 'var(--bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', color: 'var(--color-text-primary)', fontSize: 14, width: '100%' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Cash Registers</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Open/close POS registers and view reconciliation history</p>
        </div>
        <button className="btn-primary" onClick={() => setShowOpen(true)}>+ Open Register</button>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--bg-surface-hover)' }}>
                  {['Branch', 'Status', 'Opened At', 'Opening Balance', 'Closing Balance', 'Variance', 'Operator', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registers.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>No registers found</td></tr>
                ) : registers.map(r => {
                  const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.CLOSED;
                  const variance = r.variance !== null ? Number(r.variance) : null;
                  return (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{r.branch?.name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{r.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>{new Date(r.openedAt).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>₹{Number(r.openingBalance).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '12px 16px', color: r.closingBalance ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                        {r.closingBalance ? `₹${Number(r.closingBalance).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: variance === null ? 'var(--color-text-muted)' : Math.abs(variance) < 50 ? '#10b981' : '#ef4444' }}>
                        {variance !== null ? `${variance >= 0 ? '+' : ''}₹${variance.toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13 }}>{r.openedBy?.name || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {r.status === 'OPEN' && (
                          <button className="btn-primary" onClick={() => { setCloseTarget(r); setCloseForm({ closingBalance: Number(r.openingBalance), notes: '' }); }} style={{ padding: '6px 14px', fontSize: 12, background: '#ef4444' }}>
                            Close Register
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Register Modal */}
      {showOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 32, width: 400, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 20, fontSize: 16, fontWeight: 700 }}>Open POS Register</h3>
            <form onSubmit={handleOpen} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Branch</label>
                <select style={inputStyle} value={openForm.locationId} onChange={e => setOpenForm({...openForm, locationId: e.target.value})} required>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label>Opening Cash Balance (₹)</label>
                <input type="number" style={inputStyle} value={openForm.openingBalance} min={0} onChange={e => setOpenForm({...openForm, openingBalance: Number(e.target.value)})} required />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowOpen(false)} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary">Open Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Register Modal */}
      {closeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 32, width: 400, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 4, fontSize: 16, fontWeight: 700 }}>Close Register — {closeTarget.branch?.name}</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginBottom: 20 }}>Opening balance: ₹{Number(closeTarget.openingBalance).toLocaleString('en-IN')}</p>
            <form onSubmit={handleClose} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Closing Cash Count (₹)</label>
                <input type="number" style={inputStyle} value={closeForm.closingBalance} min={0} onChange={e => setCloseForm({...closeForm, closingBalance: Number(e.target.value)})} required />
              </div>
              <div style={{ padding: 12, borderRadius: 8, background: Math.abs(closeForm.closingBalance - Number(closeTarget.openingBalance)) < 50 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${Math.abs(closeForm.closingBalance - Number(closeTarget.openingBalance)) < 50 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>Variance: {closeForm.closingBalance >= Number(closeTarget.openingBalance) ? '+' : ''}₹{(closeForm.closingBalance - Number(closeTarget.openingBalance)).toFixed(2)}</div>
              </div>
              <div>
                <label>Notes (optional)</label>
                <textarea style={{...inputStyle, resize: 'vertical'}} rows={2} value={closeForm.notes} onChange={e => setCloseForm({...closeForm, notes: e.target.value})} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setCloseTarget(null)} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ background: '#ef4444' }}>Close & Reconcile</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
