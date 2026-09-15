import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px' }}>
    <div style={{ flex: 1 }}><label>Brand Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div style={{ flex: 2 }}><label>Description</label><input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} /></div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Brands({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Brand Name' },
    { key: 'description', label: 'Description' }
  ];
  return <MasterDataPage title="Brands" endpoint="masters/brands" columns={columns} FormComponent={Form} emptyFormState={{ name: '', description: '' }} triggerAlert={triggerAlert} />;
}
