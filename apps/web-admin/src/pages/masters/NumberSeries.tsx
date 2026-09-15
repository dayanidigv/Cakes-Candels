import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { SearchInput } from '../../components/common/SearchInput';
import { Pagination } from '../../components/common/Pagination';
import { LoadingState } from '../../components/common/LoadingState';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { MasterForm } from '../../components/masters/MasterForm';
import { FormField } from '../../components/common/FormField';
import { StatusBadge } from '../../components/masters/StatusBadge';
import { BranchSelect } from '../../components/masters/MasterSelect';

export default function NumberSeries({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { documentType: '', prefix: '', currentNumber: 0, length: 6, suffix: '', branchId: '', isActive: true };
  const [formState, setFormState] = useState(emptyForm);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/number-series?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(res.items || []);
      setPagination({ page: res.page, limit: res.limit, total: res.total });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load number series');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/masters/number-series/${editingId}`, 'PATCH', formState);
        triggerAlert('Number Series updated successfully');
      } else {
        await apiRequest(`/masters/number-series`, 'POST', formState);
        triggerAlert('Number Series created successfully');
      }
      setIsFormOpen(false);
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message || 'Validation failed', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await apiRequest(`/masters/number-series/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Number Series deleted');
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const generatePreview = (f: any) => {
    const numStr = String(f.currentNumber + 1).padStart(f.length || 6, '0');
    return `${f.prefix || ''}${numStr}${f.suffix || ''}`;
  };

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <PageHeader 
        title="Number Series" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Series</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search series..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Number Series' : 'New Number Series'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <FormField label="Document Type" required>
            <input type="text" required value={formState.documentType} onChange={e => setFormState({...formState, documentType: e.target.value.toUpperCase()})} placeholder="e.g. PO" />
          </FormField>
          <FormField label="Prefix" required>
            <input type="text" required value={formState.prefix} onChange={e => setFormState({...formState, prefix: e.target.value.toUpperCase()})} placeholder="e.g. PO-" />
          </FormField>
          <FormField label="Suffix">
            <input type="text" value={formState.suffix || ''} onChange={e => setFormState({...formState, suffix: e.target.value})} placeholder="e.g. -26" />
          </FormField>
          <FormField label="Current Number" required>
            <input type="number" min="0" required value={formState.currentNumber} onChange={e => setFormState({...formState, currentNumber: Number(e.target.value)})} />
          </FormField>
          <FormField label="Length" required>
            <input type="number" min="3" max="10" required value={formState.length} onChange={e => setFormState({...formState, length: Number(e.target.value)})} />
          </FormField>
          <FormField label="Branch">
            <BranchSelect value={formState.branchId || ''} onChange={(v: string) => setFormState({...formState, branchId: v})} placeholder="All Branches" />
          </FormField>
          <FormField label="Status">
            <select value={formState.isActive ? 'true' : 'false'} onChange={e => setFormState({...formState, isActive: e.target.value === 'true'})}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
          
          <div style={{ gridColumn: '1 / -1', background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', marginTop: '8px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Live Preview (Next Number)</label>
            <div style={{ fontSize: '24px', fontFamily: 'monospace', color: 'var(--color-primary)', letterSpacing: '2px' }}>
              {generatePreview(formState)}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px' }}>Preview is UI-only. Final generation occurs transactionally on the server.</div>
          </div>
        </MasterForm>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => loadData(1)} />
      ) : loading ? (
        <LoadingState message="Loading number series..." />
      ) : data.length === 0 ? (
        <EmptyState title="No series found" message="Create your first number series." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Document Type</th>
                <th style={{ padding: '12px' }}>Prefix</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Current Number</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Length</th>
                <th style={{ padding: '12px' }}>Branch</th>
                <th style={{ padding: '12px' }}>Preview</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{row.documentType}</td>
                  <td style={{ padding: '12px' }}>{row.prefix}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.currentNumber}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.length}</td>
                  <td style={{ padding: '12px' }}>{row.branch?.name || 'All Branches'}</td>
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--color-primary)' }}>{generatePreview(row)}</td>
                  <td style={{ padding: '12px' }}><StatusBadge active={row.isActive} /></td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button onClick={() => { setFormState(row); setEditingId(row.id); setIsFormOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                      <button onClick={() => setDeleteConfirmId(row.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={(p: number) => loadData(p)} />
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmDialog 
          title="Delete Number Series"
          message="Are you sure you want to deactivate this series? Sequence generation will be halted."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
