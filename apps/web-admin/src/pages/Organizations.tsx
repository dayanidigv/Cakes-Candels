import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <FormField label="Organization Name" required>
      <input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} />
    </FormField>
    <FormField label="Tax Identifier">
      <input type="text" value={formState.taxIdentifier || ''} onChange={e=>setFormState({...formState, taxIdentifier: e.target.value})} />
    </FormField>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
      <input type="checkbox" checked={formState.isActive} onChange={e=>setFormState({...formState, isActive: e.target.checked})} style={{ width: 'auto' }} /> Active
    </div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Organizations({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'taxIdentifier', label: 'Tax ID' },
    { key: 'isActive', label: 'Active', render: (r: any) => r.isActive ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="Organizations" endpoint="organizations" columns={columns} FormComponent={Form} emptyFormState={{ name: '', taxIdentifier: '', isActive: true }} triggerAlert={triggerAlert} />;
}
