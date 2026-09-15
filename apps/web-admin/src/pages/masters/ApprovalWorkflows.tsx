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
import { RoleSelect } from '../../components/masters/MasterSelect';

export default function ApprovalWorkflows({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { moduleName: '', description: '', isActive: true };
  const [formState, setFormState] = useState(emptyForm);
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const emptyStep = { stepOrder: 1, requiredRoleId: '' };
  const [stepFormState, setStepFormState] = useState(emptyStep);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/approval-workflows?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(res.items || []);
      setPagination({ page: res.page, limit: res.limit, total: res.total });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const loadSteps = async (workflowId: string) => {
    try {
      setLoadingSteps(true);
      const res = await apiRequest(`/masters/approval-workflows/${workflowId}`);
      setSteps(res.steps || []);
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setLoadingSteps(false);
    }
  };

  const handleExpand = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
      setSteps([]);
      setIsStepFormOpen(false);
    } else {
      setExpandedRow(id);
      loadSteps(id);
      setIsStepFormOpen(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/masters/approval-workflows/${editingId}`, 'PATCH', formState);
        triggerAlert('Workflow updated successfully');
      } else {
        await apiRequest(`/masters/approval-workflows`, 'POST', formState);
        triggerAlert('Workflow created successfully');
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
      await apiRequest(`/masters/approval-workflows/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Workflow deleted');
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleStepSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedRow) return;
    setIsSubmitting(true);
    try {
      await apiRequest(`/masters/approval-workflows/${expandedRow}/steps`, 'POST', stepFormState);
      triggerAlert('Step added successfully');
      setIsStepFormOpen(false);
      loadSteps(expandedRow);
      loadData(pagination.page); // Refresh count
    } catch (err: any) {
      triggerAlert(err.message || 'Failed to add step', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveStep = async (stepId: string) => {
    if (!expandedRow || !confirm('Are you sure you want to remove this step?')) return;
    try {
      await apiRequest(`/masters/approval-workflows/${expandedRow}/steps/${stepId}`, 'DELETE');
      triggerAlert('Step removed');
      loadSteps(expandedRow);
      loadData(pagination.page);
    } catch (err: any) {
      triggerAlert(err.message, true);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <PageHeader 
        title="Approval Workflows" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Workflow</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search workflows..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Workflow' : 'New Workflow'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <FormField label="Module Name" required>
            <input type="text" required value={formState.moduleName} onChange={e => setFormState({...formState, moduleName: e.target.value})} placeholder="e.g. Wastage" />
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
        <LoadingState message="Loading workflows..." />
      ) : data.length === 0 ? (
        <EmptyState title="No workflows found" message="Create your first workflow." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Module Name</th>
                <th style={{ padding: '12px' }}>Description</th>
                <th style={{ padding: '12px', textAlign: 'center' }}>Step Count</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>{row.moduleName}</td>
                    <td style={{ padding: '12px' }}>{row.description}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{row._count?.steps || 0}</td>
                    <td style={{ padding: '12px' }}><StatusBadge active={row.isActive} /></td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button onClick={() => handleExpand(row.id)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{expandedRow === row.id ? 'Hide Steps' : 'View Steps'}</button>
                        <button onClick={() => { setFormState(row); setEditingId(row.id); setIsFormOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                        <button onClick={() => setDeleteConfirmId(row.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === row.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <div style={{ background: 'var(--bg-app)', padding: '24px', borderBottom: '1px solid var(--color-border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                            <div>
                              <h4 style={{ margin: '0 0 8px 0' }}>Approval Steps</h4>
                              {row.isActive && <div style={{ color: '#ef4444', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span> Active workflows cannot be modified.</div>}
                            </div>
                            {!row.isActive && !isStepFormOpen && <button onClick={() => { setStepFormState({ stepOrder: (steps.length || 0) + 1, requiredRoleId: '' }); setIsStepFormOpen(true); }} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>+ Add Step</button>}
                          </div>
                          
                          {loadingSteps ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>Loading steps...</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: isStepFormOpen ? '24px' : '0' }}>
                              {steps.sort((a, b) => a.stepOrder - b.stepOrder).map((s, i) => (
                                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-surface)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--color-border-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold' }}>{s.stepOrder}</div>
                                  <div style={{ width: '30px', borderTop: '2px dashed rgba(255,255,255,0.2)' }}></div>
                                  <div style={{ flex: 1, fontWeight: 600 }}>{s.requiredRole?.name || s.requiredRoleId}</div>
                                  {!row.isActive && <button onClick={() => handleRemoveStep(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}><span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span></button>}
                                </div>
                              ))}
                              {steps.length === 0 && !isStepFormOpen && <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No steps defined. Workflow is inactive.</div>}
                            </div>
                          )}

                          {isStepFormOpen && !row.isActive && (
                            <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                              <h5 style={{ margin: '0 0 16px 0' }}>Add Step</h5>
                              <form onSubmit={handleStepSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                                <div style={{ width: '80px' }}>
                                  <FormField label="Order" required>
                                    <input type="number" min="1" required value={stepFormState.stepOrder} onChange={e => setStepFormState({...stepFormState, stepOrder: Number(e.target.value)})} />
                                  </FormField>
                                </div>
                                <div style={{ flex: 1 }}>
                                  <FormField label="Required Role" required>
                                    <RoleSelect required value={stepFormState.requiredRoleId} onChange={(v: string) => setStepFormState({...stepFormState, requiredRoleId: v})} />
                                  </FormField>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                  <button type="button" onClick={() => setIsStepFormOpen(false)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                                  <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ padding: '8px 16px' }}>{isSubmitting ? 'Saving...' : 'Save Step'}</button>
                                </div>
                              </form>
                            </div>
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
          title="Delete Workflow"
          message="Are you sure you want to deactivate this workflow? Any active approvals will be affected."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
