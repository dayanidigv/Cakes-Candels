import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';
import { BranchSelect } from '../components/masters/MasterSelect';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <FormField label="Branch" required>
      <BranchSelect required value={formState.branchId} onChange={(v: string) => setFormState({...formState, branchId: v})} disabled={isEditing} />
    </FormField>
    <FormField label="Register Name" required>
      <input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} />
    </FormField>
    <FormField label="Device Identifier" required>
      <input type="text" required value={formState.deviceIdentifier} onChange={e=>setFormState({...formState, deviceIdentifier: e.target.value})} placeholder="e.g. MAC Address" />
    </FormField>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
      <input type="checkbox" checked={formState.isActive} onChange={e=>setFormState({...formState, isActive: e.target.checked})} style={{ width: 'auto' }} /> Active
    </div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Registers({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'branch', label: 'Branch', render: (r: any) => r.branch?.name },
    { key: 'deviceIdentifier', label: 'Device Identifier' },
    { key: 'isActive', label: 'Active', render: (r: any) => r.isActive ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="POS Registers" endpoint="pos-registers" columns={columns} FormComponent={Form} emptyFormState={{ branchId: '', name: '', deviceIdentifier: '', isActive: true }} triggerAlert={triggerAlert} />;
}
