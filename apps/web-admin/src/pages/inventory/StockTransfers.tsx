import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000/api';
const HEADERS = { 'Content-Type': 'application/json', 'x-dev-token': 'CC-Dev-Token-2026' };

interface Transfer {
  id: string;
  transferNumber: string;
  status: string;
  fromLocation: { name: string; type: string };
  toLocation: { name: string; type: string };
  createdAt: string;
  items: Array<{ id: string; variant: { name: string; sku: string }; quantityRequested: number; quantityReceived: number | null }>;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  REQUESTED:  { bg: '#1e3a5f', color: '#93c5fd' },
  IN_TRANSIT: { bg: '#3b2f00', color: '#fcd34d' },
  RECEIVED:   { bg: '#14532d', color: '#86efac' },
  REJECTED:   { bg: '#7f1d1d', color: '#fca5a5' },
  CANCELLED:  { bg: '#1f2937', color: '#9ca3af' },
};

const StockTransfers: React.FC<{ triggerAlert: (msg: string, isError?: boolean) => void }> = ({ triggerAlert }) => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ fromLocationId: '', toLocationId: '', notes: '', items: [{ variantId: '', quantityRequested: '' }] });

  const fetch_ = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API}/inventory/transfers${params}`, { headers: HEADERS });
      const json = await res.json();
      if (json.success) setTransfers(json.data.items);
    } catch { triggerAlert('Failed to load transfers.', true); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetch_(); }, [statusFilter]);

  const dispatchTransfer = async (id: string) => {
    if (!confirm('Dispatch this transfer? Stock will be deducted from source.')) return;
    const res = await fetch(`${API}/inventory/transfers/${id}/dispatch`, { method: 'PATCH', headers: HEADERS });
    const json = await res.json();
    if (json.success) { triggerAlert('Transfer dispatched!'); fetch_(); }
    else triggerAlert(json.message || 'Error', true);
  };

  const submitCreate = async () => {
    const payload = {
      fromLocationId: form.fromLocationId,
      toLocationId: form.toLocationId,
      notes: form.notes,
      items: form.items.filter(i => i.variantId && i.quantityRequested).map(i => ({
        variantId: i.variantId,
        quantityRequested: Number(i.quantityRequested),
      })),
    };
    const res = await fetch(`${API}/inventory/transfers`, { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
    const json = await res.json();
    if (json.success) { triggerAlert('Transfer request created!'); setCreating(false); fetch_(); }
    else triggerAlert(json.message || 'Error', true);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🚚 Stock Transfers</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>Request → Dispatch → Receive pipeline</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-text-primary)', fontSize: 14 }}>
            <option value="">All Status</option>
            {['REQUESTED','IN_TRANSIT','RECEIVED','REJECTED','CANCELLED'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={() => setCreating(true)} style={{ padding: '8px 16px' }}>
            + New Transfer
          </button>
        </div>
      </div>

      {/* Create Form */}
      {creating && (
        <div style={{ background: 'var(--color-border)', borderRadius: 12, padding: 24, marginBottom: 24, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginTop: 0 }}>New Stock Transfer Request</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label>From Location ID</label>
              <input value={form.fromLocationId} onChange={e => setForm(f => ({...f, fromLocationId: e.target.value}))} placeholder="Branch UUID" />
            </div>
            <div>
              <label>To Location ID</label>
              <input value={form.toLocationId} onChange={e => setForm(f => ({...f, toLocationId: e.target.value}))} placeholder="Branch UUID" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label>Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="Optional notes" />
          </div>
          <h4 style={{ marginBottom: 8 }}>Items</h4>
          {form.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 8 }}>
              <input value={item.variantId} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? {...x, variantId: e.target.value} : x) }))} placeholder="Variant UUID" />
              <input value={item.quantityRequested} onChange={e => setForm(f => ({ ...f, items: f.items.map((x, j) => j === i ? {...x, quantityRequested: e.target.value} : x) }))} placeholder="Quantity" type="number" />
              <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, j) => j !== i) }))} style={{ background: '#7f1d1d', color: '#fca5a5', border: 'none', borderRadius: 6, padding: '0 12px', cursor: 'pointer' }}>✕</button>
            </div>
          ))}
          <button onClick={() => setForm(f => ({ ...f, items: [...f.items, { variantId: '', quantityRequested: '' }] }))} style={{ background: 'transparent', color: '#0bb5aa', border: '1px dashed #0bb5aa', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', marginBottom: 16 }}>
            + Add Item
          </button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn-primary" onClick={submitCreate} style={{ padding: '8px 20px' }}>Create Request</button>
            <button onClick={() => setCreating(false)} style={{ background: 'transparent', color: 'var(--color-text-secondary)', border: '1px solid #444', borderRadius: 6, padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading…</div>
      ) : transfers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>No transfers found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {transfers.map(t => {
            const sc = STATUS_COLORS[t.status] || STATUS_COLORS.CANCELLED;
            return (
              <div key={t.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 20, border: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 16, fontFamily: 'monospace' }}>{t.transferNumber}</span>
                      <span style={{ background: sc.bg, color: sc.color, padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>{t.status}</span>
                    </div>
                    <div style={{ fontSize: 14, color: '#aaa' }}>
                      <strong style={{ color: 'var(--color-text-primary)' }}>{t.fromLocation.name}</strong> → <strong style={{ color: 'var(--color-text-primary)' }}>{t.toLocation.name}</strong>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {t.items.map(item => (
                        <span key={item.id} style={{ fontSize: 13, background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: 6 }}>
                          {item.variant.name} × {Number(item.quantityRequested).toFixed(2)}
                          {item.quantityReceived != null && <> (rcvd: {Number(item.quantityReceived).toFixed(2)})</>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {t.status === 'REQUESTED' && (
                      <button className="btn-primary" onClick={() => dispatchTransfer(t.id)} style={{ padding: '6px 14px', fontSize: 13 }}>
                        🚚 Dispatch
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StockTransfers;
