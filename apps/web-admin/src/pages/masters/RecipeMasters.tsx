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
import { UomSelect } from '../../components/masters/MasterSelect';

export default function RecipeMasters({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { name: '', description: '', yieldQuantity: 1, uomId: '', isActive: true };
  const [formState, setFormState] = useState(emptyForm);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/recipe-masters?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(res.items || []);
      setPagination({ page: res.page, limit: res.limit, total: res.total });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const loadVersions = async (recipeId: string) => {
    try {
      setLoadingVersions(true);
      const res = await apiRequest(`/masters/recipe-masters/${recipeId}/versions`);
      setVersions(Array.isArray(res) ? res : (res.data || []));
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleExpand = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      setVersions([]);
    } else {
      setExpandedRow(id);
      loadVersions(id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/masters/recipe-masters/${editingId}`, 'PATCH', formState);
        triggerAlert('Recipe updated successfully');
      } else {
        await apiRequest(`/masters/recipe-masters`, 'POST', formState);
        triggerAlert('Recipe created successfully');
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
      await apiRequest(`/masters/recipe-masters/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Recipe deleted');
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
        title="Recipe Masters" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Recipe</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search recipes..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Recipe' : 'New Recipe'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <FormField label="Recipe Name" required>
            <input type="text" required value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} />
          </FormField>
          <FormField label="Yield Quantity" required>
            <input type="number" step="0.001" min="0.001" required value={formState.yieldQuantity} onChange={e => setFormState({...formState, yieldQuantity: Number(e.target.value)})} />
          </FormField>
          <FormField label="Yield UOM" required>
            <UomSelect required value={formState.uomId} onChange={(v: string) => setFormState({...formState, uomId: v})} />
          </FormField>
          <FormField label="Description">
            <input type="text" value={formState.description || ''} onChange={e => setFormState({...formState, description: e.target.value})} />
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
        <LoadingState message="Loading recipes..." />
      ) : data.length === 0 ? (
        <EmptyState title="No recipes found" message="Create your first recipe to get started." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Name</th>
                <th style={{ padding: '12px' }}>Yield</th>
                <th style={{ padding: '12px' }}>Versions</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{row.yieldQuantity} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{row.uom?.name || row.uomId}</span></td>
                    <td style={{ padding: '12px' }}>{row._count?.versions || 0}</td>
                    <td style={{ padding: '12px' }}><StatusBadge active={row.isActive} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleExpand(row.id)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{expandedRow === row.id ? 'Hide Versions' : 'View Versions'}</button>
                        <button onClick={() => { setFormState(row); setEditingId(row.id); setIsFormOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                        <button onClick={() => setDeleteConfirmId(row.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === row.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div style={{ background: 'var(--bg-app)', padding: '20px', borderBottom: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h4 style={{ margin: 0 }}>Versions for {row.name}</h4>
                            <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>+ Create Version</button>
                          </div>
                          {loadingVersions ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loading versions...</div>
                          ) : versions.length === 0 ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No versions found.</div>
                          ) : (
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Version</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Cost Estimate</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Status</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Created</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {versions.map(v => (
                                  <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px' }}>v{v.versionNumber}</td>
                                    <td style={{ padding: '8px' }}>₹{v.costEstimate || '0.00'}</td>
                                    <td style={{ padding: '8px' }}><StatusBadge active={v.isActive} /></td>
                                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{new Date(v.createdAt).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px' }}>
                                      <button style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '12px' }}>View Details</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
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
          title="Delete Recipe"
          message="Are you sure you want to deactivate this recipe?"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
