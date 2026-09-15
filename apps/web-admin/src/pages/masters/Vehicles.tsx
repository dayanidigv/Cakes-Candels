import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>

    <div style={{ flex: 1, minWidth: '150px' }}><label>Registration No</label><input type="text" required value={formState.registrationNumber} onChange={e=>setFormState({...formState, registrationNumber: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Driver Name</label><input type="text" value={formState.driverName || ''} onChange={e=>setFormState({...formState, driverName: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Status</label>
      <select value={formState.status || 'ACTIVE'} onChange={e=>setFormState({...formState, status: e.target.value})}>
        <option value="ACTIVE">Active</option><option value="MAINTENANCE">Maintenance</option>
      </select>
    </div>

    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Vehicles({ triggerAlert }: any) {
  const columns = [{ key: 'registrationNumber', label: 'Reg No' }, { key: 'driverName', label: 'Driver' }, { key: 'status', label: 'Status' }];
  return <MasterDataPage title="Vehicles" endpoint="masters/vehicles" columns={columns} FormComponent={Form} emptyFormState={{ registrationNumber: '', capacity: 0, capacityUomId: '', driverName: '', driverPhone: '', status: 'ACTIVE' }} triggerAlert={triggerAlert} />;
}
