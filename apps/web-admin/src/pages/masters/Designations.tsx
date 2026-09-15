import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>

    <div style={{ flex: 1, minWidth: '200px' }}><label>Title</label><input type="text" required value={formState.title} onChange={e=>setFormState({...formState, title: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Department</label><input type="text" value={formState.department || ''} onChange={e=>setFormState({...formState, department: e.target.value})} /></div>
    <div style={{ flex: 2, minWidth: '200px' }}><label>Description</label><input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} /></div>

    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Designations({ triggerAlert }: any) {
  const columns = [{ key: 'title', label: 'Title' }, { key: 'department', label: 'Department' }];
  return <MasterDataPage title="Designations" endpoint="masters/designations" columns={columns} FormComponent={Form} emptyFormState={{ title: '', department: '', description: '' }} triggerAlert={triggerAlert} />;
}
