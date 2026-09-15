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

export default function ProductAttributes({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { name: '', type: 'TEXT', isActive: true };
  const [formState, setFormState] = useState(emptyForm);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [values, setValues] = useState<any[]>([]);
  const [loadingValues, setLoadingValues] = useState(false);

  const [newValueName, setNewValueName] = useState('');
  const [isAddingValue, setIsAddingValue] = useState(false);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/product-attributes?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(res.items || []);
      setPagination({ page: res.page, limit: res.limit, total: res.total });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load attributes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const loadValues = async (attributeId: string) => {
    try {
      setLoadingValues(true);
      const res = await apiRequest(`/masters/product-attributes/${attributeId}/values`);
      setValues(Array.isArray(res) ? res : (res.data || []));
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setLoadingValues(false);
    }
  };

  const handleExpand = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      setValues([]);
      setNewValueName('');
    } else {
      setExpandedRow(id);
      loadValues(id);
      setNewValueName('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/masters/product-attributes/${editingId}`, 'PATCH', formState);
        triggerAlert('Attribute updated successfully');
      } else {
        await apiRequest(`/masters/product-attributes`, 'POST', formState);
        triggerAlert('Attribute created successfully');
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
      await apiRequest(`/masters/product-attributes/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Attribute deleted');
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleAddValue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedRow || !newValueName.trim()) return;
    setIsAddingValue(true);
    try {
      await apiRequest(`/masters/product-attributes/${expandedRow}/values`, 'POST', { value: newValueName, isActive: true });
      triggerAlert('Value added successfully');
      setNewValueName('');
      loadValues(expandedRow);
      loadData(pagination.page); // Refresh count on main row
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to add value', true);
    } finally {
      setIsAddingValue(false);
    }
  };

  const handleRemoveValue = async (valueId: string) => {
    if (!expandedRow || !confirm('Remove this value?')) return;
    try {
      await apiRequest(`/masters/product-attributes/${expandedRow}/values/${valueId}`, 'DELETE');
      triggerAlert('Value removed');
      loadValues(expandedRow);
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <PageHeader 
        title="Product Attributes" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Attribute</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search attributes..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Attribute' : 'New Attribute'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <FormField label="Attribute Name" required>
            <input type="text" required value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} placeholder="e.g. Flavor" />
          </FormField>
          <FormField label="Type" required>
            <select required value={formState.type} onChange={e => setFormState({...formState, type: e.target.value})}>
              <option value="TEXT">Text</option>
              <option value="COLOR">Color</option>
              <option value="NUMBER">Number</option>
            </select>
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
        <LoadingState message="Loading attributes..." />
      ) : data.length === 0 ? (
        <EmptyState title="No attributes found" message="Create your first attribute." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Attribute Name</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Values</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: '12px' }}>{row.type}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{row._count?.values || 0}</td>
                    <td style={{ padding: '12px' }}><StatusBadge active={row.isActive} /></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleExpand(row.id)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{expandedRow === row.id ? 'Hide Values' : 'View Values'}</button>
                        <button onClick={() => { setFormState(row); setEditingId(row.id); setIsFormOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                        <button onClick={() => setDeleteConfirmId(row.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === row.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div style={{ background: 'var(--bg-app)', padding: '24px', borderBottom: '1px solid var(--color-border)' }}>
                          <h4 style={{ margin: '0 0 16px 0' }}>Attribute Values</h4>
                          
                          {loadingValues ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loading values...</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                              {values.map(v => (
                                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }}></div>
                                  <div style={{ flex: 1, fontWeight: 600 }}>{v.value}</div>
                                  <StatusBadge active={v.isActive} />
                                  <button onClick={() => handleRemoveValue(v.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span></button>
                                </div>
                              ))}
                              {values.length === 0 && <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No values defined.</div>}
                            </div>
                          )}

                          <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <h5 style={{ margin: '0 0 16px 0' }}>Add Value</h5>
                            <form onSubmit={handleAddValue} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                              <div style={{ flex: 1 }}>
                                <FormField label="New Value Name" required>
                                  <input type="text" required value={newValueName} onChange={e => setNewValueName(e.target.value)} placeholder="e.g. Chocolate" />
                                </FormField>
                              </div>
                              <div style={{ marginBottom: '16px' }}>
                                <button type="submit" disabled={isAddingValue || !newValueName.trim()} className="btn-primary" style={{ padding: '8px 16px' }}>{isAddingValue ? 'Adding...' : 'Add Value'}</button>
                              </div>
                            </form>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <Pagination current={pagination.page} total={pagination.total} limit={pagination.limit} onPageChange={(p: number) => loadData(p)} />
        </div>
      )}

      {deleteConfirmId && (
        <ConfirmDialog 
          title="Delete Attribute"
          message="Are you sure you want to deactivate this attribute? All related values will be affected."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
