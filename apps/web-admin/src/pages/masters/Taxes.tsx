import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Tax Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '100px' }}><label>Rate (%)</label><input type="number" step="0.01" required value={formState.rate} onChange={e=>setFormState({...formState, rate: Number(e.target.value)})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>HSN Code</label><input type="text" value={formState.hsn || ''} onChange={e=>setFormState({...formState, hsn: e.target.value})} /></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}><input type="checkbox" checked={formState.isDefault} onChange={e=>setFormState({...formState, isDefault: e.target.checked})} style={{ width: 'auto' }} /> Default</div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Taxes({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name', render: (r: any) => <span>{r.name} {r.isDefault && '✔️'}</span> },
    { key: 'rate', label: 'Rate (%)' },
    { key: 'hsn', label: 'HSN' }
  ];
  return <MasterDataPage title="Tax Rules" endpoint="masters/tax-rule" columns={columns} FormComponent={Form} emptyFormState={{ name: '', rate: 0, hsn: '', isDefault: false }} triggerAlert={triggerAlert} />;
}
