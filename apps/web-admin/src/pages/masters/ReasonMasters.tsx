import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>

    <div style={{ flex: 1, minWidth: '150px' }}><label>Type (e.g. DAMAGE)</label><input type="text" required value={formState.type} onChange={e=>setFormState({...formState, type: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Code</label><input type="text" required value={formState.code} onChange={e=>setFormState({...formState, code: e.target.value})} /></div>
    <div style={{ flex: 2, minWidth: '200px' }}><label>Description</label><input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} /></div>

    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function ReasonMasters({ triggerAlert }: any) {
  const columns = [{ key: 'type', label: 'Type' }, { key: 'code', label: 'Code' }, { key: 'description', label: 'Description' }];
  return <MasterDataPage title="Reason Masters" endpoint="masters/reason-masters" columns={columns} FormComponent={Form} emptyFormState={{ type: '', code: '', description: '' }} triggerAlert={triggerAlert} />;
}
