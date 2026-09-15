import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <FormField label="Role Name" required>
      <input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} />
    </FormField>
    <FormField label="Role Type" required>
      <select required value={formState.type} onChange={e=>setFormState({...formState, type: e.target.value})}>
        <option value="SUPER_ADMIN">Super Admin</option>
        <option value="FACTORY_MANAGER">Factory Manager</option>
        <option value="BRANCH_MANAGER">Branch Manager</option>
        <option value="POS_OPERATOR">POS Operator</option>
        <option value="LOGISTICS_COORDINATOR">Logistics Coordinator</option>
      </select>
    </FormField>
    <FormField label="Description">
      <input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} />
    </FormField>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
      <input type="checkbox" checked={formState.isActive} onChange={e=>setFormState({...formState, isActive: e.target.checked})} style={{ width: 'auto' }} /> Active
    </div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Roles({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Active', render: (r: any) => r.isActive ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="Roles & Permissions" endpoint="roles" columns={columns} FormComponent={Form} emptyFormState={{ name: '', type: 'POS_OPERATOR', description: '', isActive: true }} triggerAlert={triggerAlert} />;
}
