import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <div style={{ flex: 1, minWidth: '200px' }}><label>Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '200px' }}><label>Description</label><input type="text" value={formState.description || ''} onChange={e=>setFormState({...formState, description: e.target.value})} /></div>
    <div style={{ width: '100px' }}><label>Icon</label><input type="text" value={formState.icon || ''} onChange={e=>setFormState({...formState, icon: e.target.value})} placeholder="emoji" /></div>
    <div style={{ width: '100px' }}><label>Color</label><input type="color" value={formState.color || 'var(--color-text-primary)fff'} onChange={e=>setFormState({...formState, color: e.target.value})} style={{ height: '40px', padding: 0 }} /></div>
    <div style={{ width: '100px' }}><label>Order</label><input type="number" value={formState.displayOrder || 0} onChange={e=>setFormState({...formState, displayOrder: Number(e.target.value)})} /></div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Categories({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Category Name', render: (row: any) => <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%', background: row.color, textAlign: 'center', lineHeight: '24px' }}>{row.icon}</span> {row.name}</span> },
    { key: 'description', label: 'Description' },
    { key: 'displayOrder', label: 'Display Order' }
  ];
  return <MasterDataPage title="Categories" endpoint="masters/categories" columns={columns} FormComponent={Form} emptyFormState={{ name: '', description: '', icon: '', color: '#333333', displayOrder: 0 }} triggerAlert={triggerAlert} />;
}
