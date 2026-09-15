import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px' }}>
    <div><label>Supplier Code *</label><input type="text" required value={formState.code} onChange={e=>setFormState({...formState, code: e.target.value})} /></div>
    <div><label>Name *</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div><label>Contact Person</label><input type="text" value={formState.contactPerson || ''} onChange={e=>setFormState({...formState, contactPerson: e.target.value})} /></div>
    <div><label>Phone</label><input type="text" value={formState.phone || ''} onChange={e=>setFormState({...formState, phone: e.target.value})} /></div>
    <div><label>Email</label><input type="email" value={formState.email || ''} onChange={e=>setFormState({...formState, email: e.target.value})} /></div>
    <div><label>GST</label><input type="text" value={formState.gst || ''} onChange={e=>setFormState({...formState, gst: e.target.value})} /></div>
    <div><label>PAN</label><input type="text" value={formState.pan || ''} onChange={e=>setFormState({...formState, pan: e.target.value})} /></div>
    <div><label>Credit Limit</label><input type="number" value={formState.creditLimit || 0} onChange={e=>setFormState({...formState, creditLimit: Number(e.target.value)})} /></div>
    <div><label>Opening Bal.</label><input type="number" value={formState.openingBalance || 0} onChange={e=>setFormState({...formState, openingBalance: Number(e.target.value)})} /></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}><input type="checkbox" checked={formState.preferredSupplier} onChange={e=>setFormState({...formState, preferredSupplier: e.target.checked})} style={{ width: 'auto' }} /> Preferred Supplier</div>
    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
      <button type="submit" className="btn-primary" style={{ flex: 1 }}>{isEditing ? 'Update' : 'Create'}</button>
      {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ flex: 1, background: '#555' }}>Cancel</button>}
    </div>
  </form>
);

export default function Suppliers({ triggerAlert }: any) {
  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Supplier Name', render: (row: any) => <span>{row.name} {row.preferredSupplier && '⭐'}</span> },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'phone', label: 'Phone' },
    { key: 'gst', label: 'GST' },
    { key: 'openingBalance', label: 'Balance', render: (row: any) => `₹${row.openingBalance}` }
  ];
  return <MasterDataPage title="Suppliers" endpoint="masters/suppliers" columns={columns} FormComponent={Form} emptyFormState={{ code: '', name: '', contactPerson: '', phone: '', email: '', gst: '', pan: '', creditLimit: 0, openingBalance: 0, preferredSupplier: false }} triggerAlert={triggerAlert} />;
}
