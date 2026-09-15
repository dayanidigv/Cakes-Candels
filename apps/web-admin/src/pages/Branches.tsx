import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';
import { OrganizationSelect } from '../components/masters/MasterSelect';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px' }}>
    <FormField label="Organization" required>
      <OrganizationSelect required value={formState.organizationId} onChange={(v: string) => setFormState({...formState, organizationId: v})} disabled={isEditing} />
    </FormField>
    <FormField label="Branch Name" required>
      <input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} />
    </FormField>
    <FormField label="Location Type" required>
      <select required value={formState.type} onChange={e=>setFormState({...formState, type: e.target.value})}>
        <option value="RETAIL_BRANCH">Retail Branch</option>
        <option value="FACTORY">Factory</option>
        <option value="TRANSIT_HUB">Transit Hub</option>
      </select>
    </FormField>
    <FormField label="Address" required>
      <input type="text" required value={formState.address} onChange={e=>setFormState({...formState, address: e.target.value})} />
    </FormField>
    <FormField label="Phone">
      <input type="text" value={formState.phone || ''} onChange={e=>setFormState({...formState, phone: e.target.value})} />
    </FormField>
    <FormField label="GSTIN">
      <input type="text" value={formState.gstin || ''} onChange={e=>setFormState({...formState, gstin: e.target.value})} />
    </FormField>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}>
      <input type="checkbox" checked={formState.isActive} onChange={e=>setFormState({...formState, isActive: e.target.checked})} style={{ width: 'auto' }} /> Active
    </div>
    <div style={{ gridColumn: '2 / 4', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
      {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
      <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    </div>
  </form>
);

export default function Branches({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'organization', label: 'Organization', render: (r: any) => r.organization?.name },
    { key: 'type', label: 'Type' },
    { key: 'phone', label: 'Phone' },
    { key: 'isActive', label: 'Active', render: (r: any) => r.isActive ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="Branches" endpoint="branches" columns={columns} FormComponent={Form} emptyFormState={{ organizationId: '', name: '', type: 'RETAIL_BRANCH', address: '', phone: '', gstin: '', isActive: true }} triggerAlert={triggerAlert} />;
}
