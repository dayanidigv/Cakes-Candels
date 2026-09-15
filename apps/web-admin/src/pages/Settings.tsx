import React from 'react';
import { MasterDataPage } from '../components/masters/MasterDataPage';
import { FormField } from '../components/common/FormField';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <FormField label="Key" required>
      <input type="text" required value={formState.key} onChange={e=>setFormState({...formState, key: e.target.value})} disabled={isEditing} />
    </FormField>
    <FormField label="Value" required>
      <input type="text" required value={formState.value} onChange={e=>setFormState({...formState, value: e.target.value})} />
    </FormField>
    <FormField label="Description">
      <input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} />
    </FormField>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Settings({ triggerAlert }: any) {
  const columns = [
    { key: 'key', label: 'Key' },
    { key: 'value', label: 'Value' },
    { key: 'description', label: 'Description' }
  ];
  return <MasterDataPage title="System Settings" endpoint="settings" columns={columns} FormComponent={Form} emptyFormState={{ key: '', value: '', description: '' }} triggerAlert={triggerAlert} />;
}
