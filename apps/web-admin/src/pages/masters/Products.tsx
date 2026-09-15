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
import { CategorySelect, BrandSelect, TaxRuleSelect, UomSelect } from '../../components/masters/MasterSelect';

export default function Products({ triggerAlert }: any) {
  const [data, setData] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const emptyForm = { 
    type: 'VARIANT_PARENT', 
    name: '', 
    description: '', 
    categoryId: '', 
    brandId: '', 
    taxRuleId: '', 
    uomId: '', 
    isPerishable: true, 
    shelfLifeDays: 30,
    isActive: true,
    variants: [
      { sku: '', barcode: '', name: 'Default', costPrice: 0, mrp: 0, sellingPrice: 0 }
    ]
  };
  
  const [formState, setFormState] = useState(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const loadData = async (page = 1, term = search) => {
    try {
      setLoading(true);
      const res = await apiRequest(`/masters/products?page=${page}&limit=${pagination.limit}&search=${term}`);
      setData(Array.isArray(res) ? res : (res.items || []));
      setPagination({ page: res.page || 1, limit: res.limit || 10, total: res.total || res.length || 0 });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(1, search); }, [search]);

  const handleExpand = (id: string) => {
    if (expandedRow === id) {
      setExpandedRow(null);
    } else {
      setExpandedRow(id);
    }
  };

  const handleAddVariant = () => {
    setFormState({
      ...formState,
      variants: [...formState.variants, { sku: '', barcode: '', name: '', costPrice: 0, mrp: 0, sellingPrice: 0 }]
    });
  };

  const handleRemoveVariant = (index: number) => {
    const newVariants = [...formState.variants];
    newVariants.splice(index, 1);
    setFormState({ ...formState, variants: newVariants });
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    const newVariants = [...formState.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormState({ ...formState, variants: newVariants });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await apiRequest(`/masters/products/${editingId}`, 'PATCH', {
          name: formState.name,
          description: formState.description,
          isActive: formState.isActive
        });
        triggerAlert('Product updated successfully');
      } else {
        await apiRequest(`/masters/products`, 'POST', formState);
        triggerAlert('Product created successfully');
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
      await apiRequest(`/masters/products/${deleteConfirmId}`, 'DELETE');
      triggerAlert('Product deleted');
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
        title="Product Master" 
        action={<button onClick={() => { setFormState(emptyForm); setEditingId(null); setIsFormOpen(true); }} className="btn-primary">+ Add Product</button>} 
      />

      <div style={{ marginBottom: '24px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." />
      </div>

      {isFormOpen && (
        <MasterForm 
          title={editingId ? 'Edit Product (Base Info Only)' : 'New Product & Variants'}
          isEditing={!!editingId}
          isSubmitting={isSubmitting}
          onCancel={() => setIsFormOpen(false)}
          onSubmit={handleSubmit}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <FormField label="Product Name" required>
              <input type="text" required value={formState.name} onChange={e => setFormState({...formState, name: e.target.value})} />
            </FormField>
            
            <FormField label="Category" required>
              <CategorySelect required value={formState.categoryId} onChange={(v: string) => setFormState({...formState, categoryId: v})} disabled={!!editingId} />
            </FormField>

            <FormField label="Brand">
              <BrandSelect value={formState.brandId} onChange={(v: string) => setFormState({...formState, brandId: v})} disabled={!!editingId} />
            </FormField>

            <FormField label="Tax Rule" required>
              <TaxRuleSelect required value={formState.taxRuleId} onChange={(v: string) => setFormState({...formState, taxRuleId: v})} disabled={!!editingId} />
            </FormField>

            <FormField label="Base UOM" required>
              <UomSelect required value={formState.uomId} onChange={(v: string) => setFormState({...formState, uomId: v})} disabled={!!editingId} />
            </FormField>

            <FormField label="Description">
              <input type="text" value={formState.description || ''} onChange={e => setFormState({...formState, description: e.target.value})} />
            </FormField>
          </div>

          <FormField label="Status">
            <select value={formState.isActive ? 'true' : 'false'} onChange={e => setFormState({...formState, isActive: e.target.value === 'true'})}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>

          {!editingId && (
            <div style={{ marginTop: '30px', padding: '20px', background: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '15px' }}>Product Variants</h4>
                <button type="button" onClick={handleAddVariant} className="btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }}>+ Add Variant</button>
              </div>

              {formState.variants.map((v, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 40px', gap: '12px', alignItems: 'end', marginBottom: '16px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Variant Name / Label</label>
                    <input type="text" value={v.name} onChange={e => handleVariantChange(i, 'name', e.target.value)} required placeholder="e.g. 1KG Vanilla" style={{ margin: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>SKU</label>
                    <input type="text" value={v.sku} onChange={e => handleVariantChange(i, 'sku', e.target.value)} required placeholder="Unique SKU" style={{ margin: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Cost Price</label>
                    <input type="number" min="0" step="0.01" value={v.costPrice} onChange={e => handleVariantChange(i, 'costPrice', Number(e.target.value))} required style={{ margin: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>MRP</label>
                    <input type="number" min="0" step="0.01" value={v.mrp} onChange={e => handleVariantChange(i, 'mrp', Number(e.target.value))} required style={{ margin: 0 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Selling Price</label>
                    <input type="number" min="0" step="0.01" value={v.sellingPrice} onChange={e => handleVariantChange(i, 'sellingPrice', Number(e.target.value))} required style={{ margin: 0 }} />
                  </div>
                  {formState.variants.length > 1 && (
                    <button type="button" onClick={() => handleRemoveVariant(i)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '10px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </MasterForm>
      )}

      {error ? (
        <ErrorState message={error} onRetry={() => loadData(1)} />
      ) : loading ? (
        <LoadingState message="Loading products..." />
      ) : data.length === 0 ? (
        <EmptyState title="No products found" message="Create your first product to get started." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                <th style={{ padding: '12px' }}>Product</th>
                <th style={{ padding: '12px' }}>Category</th>
                <th style={{ padding: '12px' }}>Brand</th>
                <th style={{ padding: '12px' }}>Variants</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => (
                <React.Fragment key={row.id}>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{row.type}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{row.category?.name}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{row.brand?.name || '-'}</td>
                    <td style={{ padding: '12px' }}>{row.variants?.length || 0}</td>
                    <td style={{ padding: '12px' }}><StatusBadge active={row.isActive} /></td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleExpand(row.id)} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{expandedRow === row.id ? 'Hide Variants' : 'View Variants'}</button>
                        <button onClick={() => { setFormState(row); setEditingId(row.id); setIsFormOpen(true); }} style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span></button>
                        <button onClick={() => setDeleteConfirmId(row.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><span className="material-symbols-outlined" style={{ fontSize: '18px' }}>delete</span></button>
                      </div>
                    </td>
                  </tr>
                  {expandedRow === row.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0 }}>
                        <div style={{ background: 'var(--bg-app)', padding: '20px', borderBottom: '1px solid var(--color-border)' }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px' }}>Variants</h4>
                          {row.variants?.length === 0 ? (
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>No variants found.</div>
                          ) : (
                            <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>SKU</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Name</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Cost</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>MRP</th>
                                  <th style={{ padding: '8px', textAlign: 'left' }}>Selling</th>
                                </tr>
                              </thead>
                              <tbody>
                                {row.variants.map((v: any) => (
                                  <tr key={v.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                    <td style={{ padding: '8px', fontWeight: 600 }}>{v.sku}</td>
                                    <td style={{ padding: '8px' }}>{v.name}</td>
                                    <td style={{ padding: '8px' }}>₹{v.pricing?.[0]?.costPrice || '0.00'}</td>
                                    <td style={{ padding: '8px' }}>₹{v.pricing?.[0]?.mrp || '0.00'}</td>
                                    <td style={{ padding: '8px' }}>₹{v.pricing?.[0]?.sellingPrice || '0.00'}</td>
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
          title="Delete Product"
          message="Are you sure you want to deactivate this product? This will also deactivate all its variants."
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirmId(null)}
          isDestructive
        />
      )}
    </div>
  );
}
