import React from 'react';
import { useMasterOptions } from '../../hooks/useMasterOptions';

export const MasterSelect = ({ endpoint, value, onChange, placeholder = 'Select...', disabled = false }: any) => {
  const { options, loading, error, retry } = useMasterOptions(endpoint);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '13px', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }}>sync</span>
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '13px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
        Failed to load options
        <button type="button" onClick={retry} style={{ background: 'none', border: 'none', color: '#ef4444', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Retry</button>
      </div>
    );
  }

  return (
    <select 
      value={value || ''} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      style={{ opacity: disabled ? 0.6 : 1 }}
    >
      <option value="">{placeholder}</option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

export const UomSelect = (props: any) => <MasterSelect endpoint="masters/uoms" placeholder="Select Unit of Measure ▼" {...props} />;
export const SupplierSelect = (props: any) => <MasterSelect endpoint="masters/suppliers" placeholder="Select Supplier ▼" {...props} />;
export const RoleSelect = (props: any) => <MasterSelect endpoint="roles" placeholder="Select Role ▼" {...props} />;
export const BranchSelect = (props: any) => <MasterSelect endpoint="branches" placeholder="Select Branch ▼" {...props} />;
export const TaxRuleSelect = (props: any) => <MasterSelect endpoint="masters/tax-rule" placeholder="Select Tax Rule ▼" {...props} />;
export const CategorySelect = (props: any) => <MasterSelect endpoint="masters/categories" placeholder="Select Category ▼" {...props} />;
export const BrandSelect = (props: any) => <MasterSelect endpoint="masters/brands" placeholder="Select Brand ▼" {...props} />;
export const OrganizationSelect = (props: any) => <MasterSelect endpoint="organizations" placeholder="Select Organization ▼" {...props} />;
