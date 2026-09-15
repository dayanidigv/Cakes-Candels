import React from 'react';
import { MasterDataPage } from '../../components/masters/MasterDataPage';

const Form = ({ formState, setFormState, handleSubmit, isEditing, setEditingId, emptyFormState }: any) => (
  <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end', background: 'var(--bg-surface)', padding: '20px', borderRadius: '12px', flexWrap: 'wrap' }}>

    <div style={{ flex: 1, minWidth: '100px' }}><label>Type</label>
      <select value={formState.type} onChange={e=>setFormState({...formState, type: e.target.value})}>
        <option value="EMAIL">Email</option><option value="SMS">SMS</option><option value="WHATSAPP">WhatsApp</option>
      </select>
    </div>
    <div style={{ flex: 1, minWidth: '150px' }}><label>Event Name</label><input type="text" required value={formState.eventName} onChange={e=>setFormState({...formState, eventName: e.target.value})} /></div>
    <div style={{ flex: 1, minWidth: '200px' }}><label>Subject</label><input type="text" value={formState.subject || ''} onChange={e=>setFormState({...formState, subject: e.target.value})} /></div>
    <div style={{ flex: '100%', minWidth: '300px' }}><label>Body Template</label><textarea required value={formState.bodyTemplate} onChange={e=>setFormState({...formState, bodyTemplate: e.target.value})} style={{ width: '100%', background: 'var(--color-border)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '10px' }}></textarea></div>

    <button type="submit" className="btn-primary">{isEditing ? 'Update' : 'Create'}</button>
    {isEditing && <button type="button" onClick={() => { setFormState(emptyFormState); setEditingId(null); }} className="btn-primary" style={{ background: '#555' }}>Cancel</button>}
  </form>
);

export default function NotificationTemplates({ triggerAlert }: any) {
  const columns = [{ key: 'type', label: 'Type' }, { key: 'eventName', label: 'Event' }, { key: 'subject', label: 'Subject' }];
  return <MasterDataPage title="Notification Templates" endpoint="masters/notification-templates" columns={columns} FormComponent={Form} emptyFormState={{ type: 'EMAIL', eventName: '', subject: '', bodyTemplate: '' }} triggerAlert={triggerAlert} />;
}
