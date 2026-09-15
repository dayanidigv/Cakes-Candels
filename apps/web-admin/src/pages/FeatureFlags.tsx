import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';
import { BranchSelect } from '../components/masters/MasterSelect';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <FormField label="Key" required>
      <input type="text" required value={formState.key} onChange={e=>setFormState({...formState, key: e.target.value})} disabled={isEditing} />
    </FormField>
    <FormField label="Branch Override (Optional)">
      <BranchSelect value={formState.branchId || ''} onChange={(v: string) => setFormState({...formState, branchId: v})} disabled={isEditing} />
    </FormField>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
      <input type="checkbox" checked={formState.isEnabled} onChange={e=>setFormState({...formState, isEnabled: e.target.checked})} style={{ width: 'auto' }} /> Enabled
    </div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function FeatureFlags({ triggerAlert }: any) {
  const columns = [
    { key: 'key', label: 'Key' },
    { key: 'branch', label: 'Branch', render: (r: any) => r.branch?.name || 'Global (All Branches)' },
    { key: 'isEnabled', label: 'Enabled', render: (r: any) => r.isEnabled ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="Feature Flags" endpoint="feature-flags" columns={columns} FormComponent={Form} emptyFormState={{ key: '', isEnabled: false, branchId: '' }} triggerAlert={triggerAlert} />;
}
