import React, { useState, useEffect } from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';
import { apiRequest } from '../../services/api';

export default function StorageLocations({ triggerAlert }: any) {
  const [branches, setBranches] = useState<any[]>([]);
  useEffect(() => {
    apiRequest('/branches').then(res => setBranches(res)).catch(console.error);
  }, []);

  const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: '150px' }}><label>Branch</label>
        <select required value={formState.branchId} onChange={e=>setFormState({...formState, branchId: e.target.value})}>
          <option value="">Select Branch</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div style={{ flex: 1, minWidth: '150px' }}><label>Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
      <div style={{ flex: 1, minWidth: '150px' }}><label>Code</label><input type="text" value={formState.locationCode || ''} onChange={e=>setFormState({...formState, locationCode: e.target.value})} /></div>
      <div style={{ flex: 1, minWidth: '150px' }}><label>Type</label>
        <select value={formState.temperatureType || ''} onChange={e=>setFormState({...formState, temperatureType: e.target.value})}>
          <option value="AMBIENT">Ambient</option>
          <option value="REFRIGERATED">Refrigerated</option>
          <option value="FROZEN">Frozen</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: '150px' }}><label>Parent ID</label><input type="text" value={formState.parentId || ''} onChange={e=>setFormState({...formState, parentId: e.target.value})} placeholder="Parent Location UUID" /></div>
      <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
      {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
    </form>
  );

  const columns = [
    { key: 'branchId', label: 'Branch', render: (r: any) => branches.find(b => b.id === r.branchId)?.name || r.branchId },
    { key: 'name', label: 'Location Name' },
    { key: 'locationCode', label: 'Code' },
    { key: 'temperatureType', label: 'Type' },
    { key: 'parentId', label: 'Parent ID' }
  ];
  return <MasterDataPage title="Storage Locations" endpoint="masters/storage-locations" columns={columns} FormComponent={Form} emptyFormState={{ branchId: '', name: '', locationCode: '', temperatureType: 'AMBIENT', parentId: '' }} triggerAlert={triggerAlert} />;
}
