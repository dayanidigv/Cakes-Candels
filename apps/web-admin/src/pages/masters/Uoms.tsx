import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Name</label><input type="text" required value={formState.name} onChange={e=>setFormState({...formState, name: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '100px' }}><label>Symbol</label><input type="text" required value={formState.symbol} onChange={e=>setFormState({...formState, symbol: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Base Unit ID (Optional)</label><input type="text" value={formState.baseUnitId || ''} onChange={e=>setFormState({...formState, baseUnitId: e.target.value})} placeholder="UUID of Base Unit" /></div>
    <div style={{ flex: 1, minWidth: '100px' }}><label>Multiplier</label><input type="number" step="0.0001" value={formState.conversionFactor || 1} onChange={e=>setFormState({...formState, conversionFactor: Number(e.target.value)})} /></div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '40px' }}><input type="checkbox" checked={formState.allowDecimal} onChange={e=>setFormState({...formState, allowDecimal: e.target.checked})} style={{ width: 'auto' }} /> Allow Decimal</div>
    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function Uoms({ triggerAlert }: any) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'symbol', label: 'Symbol' },
    { key: 'baseUnitId', label: 'Base Unit ID' },
    { key: 'conversionFactor', label: 'Multiplier' },
    { key: 'allowDecimal', label: 'Allow Decimal', render: (r: any) => r.allowDecimal ? 'Yes' : 'No' }
  ];
  return <MasterDataPage title="Units of Measure" endpoint="masters/uom" columns={columns} FormComponent={Form} emptyFormState={{ name: '', symbol: '', baseUnitId: '', conversionFactor: 1, allowDecimal: true }} triggerAlert={triggerAlert} />;
}
