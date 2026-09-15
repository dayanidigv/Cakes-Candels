import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000/api';
const HEADERS = { 'Content-Type': 'application/json', 'x-dev-token': 'CC-Dev-Token-2026' };

interface WastageLog {
  id: string;
  logNumber: string;
  quantity: number;
  reasonCode: string;
  notes: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  variant: { name: string; sku: string };
  location: { name: string };
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PENDING:  { bg: '#3b2f00', color: '#fcd34d' },
  APPROVED: { bg: '#14532d', color: '#86efac' },
  REJECTED: { bg: '#7f1d1d', color: '#fca5a5' },
};

const WastageLogs: React.FC<{ triggerAlert: (msg: string, isError?: boolean) => void }> = ({ triggerAlert }) => {
  const [logs, setLogs] = useState<WastageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ variantId: '', locationId: '', quantity: '', reasonCode: 'SPOILAGE', notes: '' });

  const fetch_ = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/inventory/wastage${params}`, { headers: HEADERS });
      const json = await res.json();
      if (json.success) setLogs(json.data.items);
    } catch { triggerAlert('Failed to load wastage logs.', true); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [statusFilter]);

  const approve = async (id: string) => {
    if (!confirm('Approve this wastage? Stock will be written off permanently.')) return;
    const res = await fetch(`${API}/inventory/wastage/${id}/approve`, { method: 'PATCH', headers: HEADERS, body: '{}' });
    const json = await res.json();
    if (json.success) { triggerAlert('Wastage approved and written off.'); fetch_(); }
    else triggerAlert(json.message || 'Error', true);
  };

  const reject = async (id: string) => {
    const note = prompt('Enter rejection reason:');
    if (!note) return;
    const res = await fetch(`${API}/inventory/wastage/${id}/reject`, {
      method: 'PATCH', headers: HEADERS,
      body: JSON.stringify({ rejectionNote: note }),
    });
    const json = await res.json();
    if (json.success) { triggerAlert('Wastage rejected, stock restored.'); fetch_(); }
    else triggerAlert(json.message || 'Error', true);
  };

  const submitCreate = async () => {
    const res = await fetch(`${API}/inventory/wastage`, {
      method: 'POST', headers: HEADERS,
      body: JSON.stringify({ ...form, quantity: Number(form.quantity) }),
    });
    const json = await res.json();
    if (json.success) { triggerAlert('Wastage logged. Awaiting approval.'); setCreating(false); fetch_(); }
    else triggerAlert(json.message || 'Error', true);
  };

  const REASON_CODES = ['SPOILAGE', 'DAMAGED_IN_TRANSIT', 'CUSTOMER_RETURN', 'CONVERSION_WRITE_OFF', 'ADJUSTMENT_VARIANCE', 'EXPIRED', 'THEFT_OR_SHRINKAGE'];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🗑️ Wastage Logs</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>Log → Quarantine → Owner Approval workflow</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-text-primary)', fontSize: 14 }}>
            <option value="">All</option>
            {['PENDING','APPROVED','REJECTED'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-primary" onClick={() => setCreating(true)} style={{ padding: '8px 16px' }}>
            + Log Wastage
          </button>
        </div>
      </div>

      {creating && (
        <div style={{ background: 'var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginTop: 0 }}>Log New Wastage</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label>Variant ID</label><input value={form.variantId} onChange={e => setForm(f => ({...f, variantId: e.target.value}))} placeholder="Variant UUID" /></div>
            <div><label>Location ID</label><input value={form.locationId} onChange={e => setForm(f => ({...f, locationId: e.target.value}))} placeholder="Branch UUID" /></div>
            <div><label>Quantity</label><input type="number" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} placeholder="e.g. 2.5" /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label>Reason Code</label>
              <select value={form.reasonCode} onChange={e => setForm(f => ({...f, reasonCode: e.target.value}))} style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px', color: 'var(--color-text-primary)', width: '100%', marginTop: 5 }}>
                {REASON_CODES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><label>Notes</label><input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Optional notes" /></div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={submitCreate} style={{ padding: '8px 20px' }}>Submit Wastage</button>
            <button onClick={() => setCreating(false)} style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid #444', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>No wastage logs found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.map(log => {
            const sc = STATUS_COLORS[log.status];
            return (
              <div key={log.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{log.logNumber}</span>
                    <span style={{ background: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{log.status}</span>
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                    <strong style={{ color: 'var(--color-text-primary)' }}>{log.variant.name}</strong> ({log.variant.sku}) · {Number(log.quantity).toFixed(2)} units
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {log.location.name} · Reason: <strong>{log.reasonCode}</strong>
                    {log.notes && ` · ${log.notes}`}
                  </div>
                </div>
                {log.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => approve(log.id)} style={{ background: '#14532d', color: '#86efac', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      ✓ Approve
                    </button>
                    <button onClick={() => reject(log.id)} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                      ✕ Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WastageLogs;
