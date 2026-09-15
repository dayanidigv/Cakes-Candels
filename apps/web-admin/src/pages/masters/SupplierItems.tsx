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
import { SupplierSelect } from '../../components/masters/MasterSelect';

export default function SupplierItems({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { supplierId: '', itemCode: '', itemName: '', purchasePrice: 0, leadTimeDays: 0, moq: 1, isActive: true };
  const [formState, setFormState] = useState(emptyForm);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/supplier-items?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(res.items || []);
      setPagination({ page: res.page, limit: res.limit, total: res.total });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load supplier items');
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
        await apiRequest(`/masters/supplier-items/${editingId}`, 'PATCH', formState);
        triggerAlert('Supplier Item updated successfully');
      } else {
        await apiRequest(`/masters/supplier-items`, 'POST', formState);
        triggerAlert('Supplier Item created successfully');
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
      await apiRequest(`/masters/supplier-items/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Supplier Item deleted');
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <PageHeader 
        title="Supplier Pricelist" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Item</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search supplier items..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Supplier Item' : 'New Supplier Item'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <FormField label="Supplier" required>
            <SupplierSelect required value={formState.supplierId} onChange={(v: string) => setFormState({...formState, supplierId: v})} />
          </FormField>
          <FormField label="Item Code" required>
            <input type="text" required value={formState.itemCode} onChange={e => setFormState({...formState, itemCode: e.target.value})} />
          </FormField>
          <FormField label="Item Name" required>
            <input type="text" required value={formState.itemName} onChange={e => setFormState({...formState, itemName: e.target.value})} />
          </FormField>
          <FormField label="Purchase Price" required>
            <input type="number" step="0.01" min="0" required value={formState.purchasePrice} onChange={e => setFormState({...formState, purchasePrice: Number(e.target.value)})} />
          </FormField>
          <FormField label="Lead Time (Days)" required>
            <input type="number" min="0" required value={formState.leadTimeDays} onChange={e => setFormState({...formState, leadTimeDays: Number(e.target.value)})} />
          </FormField>
          <FormField label="MOQ" required>
            <input type="number" min="0" required value={formState.moq} onChange={e => setFormState({...formState, moq: Number(e.target.value)})} />
          </FormField>
          <FormField label="Status">
            <select value={formState.isActive ? 'true' : 'false'} onChange={e => setFormState({...formState, isActive: e.target.value === 'true'})}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
        </MasterForm>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => loadData(1)} />
      ) : loading ? (
        <LoadingState message="Loading supplier items..." />
      ) : data.length === 0 ? (
        <EmptyState title="No supplier items found" message="Add your first supplier item." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Supplier</th>
                <th style={{ padding: '12px' }}>Item Code</th>
                <th style={{ padding: '12px' }}>Item Name</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Purchase Price</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>MOQ</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Lead Time</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{row.supplier?.name || row.supplierId}</td>
                  <td style={{ padding: '12px' }}>{row.itemCode}</td>
                  <td style={{ padding: '12px' }}>{row.itemName}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>₹{Number(row.purchasePrice).toFixed(2)}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.moq}</td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>{row.leadTimeDays} days</td>
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
          title="Delete Supplier Item"
          message="Are you sure you want to deactivate this item?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
