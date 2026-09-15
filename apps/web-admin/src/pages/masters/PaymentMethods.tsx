import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>

    <div style={{ flex: 1, minWidth: '150px' }}><label>Code</label><input type="text" required value={formState.code} onChange={e=>setFormState({...formState, code: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '200px' }}><label>Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}><input type="checkbox" checked={formState.requiresReference} onChange={e=>setFormState({...formState, requiresReference: e.target.checked})} style={{ width: 'auto' }} /> Requires Reference</div>

    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function PaymentMethods({ triggerAlert }: any) {
  const columns = [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }, { key: 'requiresReference', label: 'Req Ref', render: (r: any) => r.requiresReference ? 'Yes' : 'No' }];
  return <MasterDataPage title="Payment Methods" endpoint="masters/payment-methods" columns={columns} FormComponent={Form} emptyFormState={{ code: '', name: '', requiresReference: false }} triggerAlert={triggerAlert} />;
}
