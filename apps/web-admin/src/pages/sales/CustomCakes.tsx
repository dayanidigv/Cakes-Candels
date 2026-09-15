// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

const STATUS_COLORS = {
  DRAFT: { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
  QUOTED: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  ADVANCE_PENDING: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  CONFIRMED: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  SCHEDULED: { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  IN_PRODUCTION: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  BAKING: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
  ICING: { bg: 'rgba(217,119,6,0.15)', color: '#fbbf24' },
  DECORATION: { bg: 'rgba(217,119,6,0.15)', color: '#fbbf24' },
  QC: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  QC_FAILED: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  READY: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  DISPATCHED: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  DELIVERED: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
  CANCELLED: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
  REJECTED: { bg: 'rgba(239,68,68,0.15)', color: '#f87171' },
};

const PIPELINE_STAGES = [
  'QUOTED', 'ADVANCE_PENDING', 'CONFIRMED', 'SCHEDULED', 'IN_PRODUCTION',
  'BAKING', 'ICING', 'DECORATION', 'QC', 'READY', 'DISPATCHED', 'DELIVERED', 'COMPLETED',
];

function StatusBadge({ status }) {
  const cfg = STATUS_COLORS[status] || { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' };
  return (
    <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
      {status}
    </span>
  );
}

function BookingModal({ branches, onClose, onSuccess }) {
  const [form, setForm] = useState({
    customerName: '', mobileNumber: '', branchId: branches[0]?.id || '',
    cakeType: '1', flavor: '', weightKg: 1.0, eggless: false,
    creamType: '', specialInstructions: '', deliveryDatetime: '', deliveryType: 'PICKUP',
    quoteAmount: 0, advancePayment: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const minWeights = { '1': 1.0, '2': 1.5, '3': 3.0 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('/custom-cakes', 'POST', { ...form, weightKg: Number(form.weightKg), quoteAmount: Number(form.quoteAmount), advancePayment: Number(form.advancePayment) });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create order');
    } finally { setLoading(false); }
  };

  const inputStyle = { background: 'var(--color-border)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '9px 12px', color: 'var(--color-text-primary)', fontSize: 14, width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 32, width: 560, maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--color-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>🎂 Book Custom Cake</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}><label>Customer Name *</label><input style={inputStyle} value={form.customerName} onChange={e => setForm({...form, customerName: e.target.value})} required /></div>
          <div><label>Mobile Number *</label><input style={inputStyle} value={form.mobileNumber} onChange={e => setForm({...form, mobileNumber: e.target.value})} required pattern="[0-9]{10}" placeholder="10-digit number" /></div>
          <div>
            <label>Branch *</label>
            <select style={inputStyle} value={form.branchId} onChange={e => setForm({...form, branchId: e.target.value})}>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label>Cake Layers *</label>
            <select style={inputStyle} value={form.cakeType} onChange={e => setForm({...form, cakeType: e.target.value, weightKg: minWeights[e.target.value]})}>
              <option value="1">1 Layer (min 1.0 kg)</option>
              <option value="2">2 Layer (min 1.5 kg)</option>
              <option value="3">3 Layer (min 3.0 kg)</option>
            </select>
          </div>
          <div>
            <label>Weight (kg) * — Min: {minWeights[form.cakeType]} kg</label>
            <input type="number" style={inputStyle} value={form.weightKg} min={minWeights[form.cakeType]} max={25} step={0.5} onChange={e => setForm({...form, weightKg: Number(e.target.value)})} required />
          </div>
          <div><label>Flavor *</label><input style={inputStyle} value={form.flavor} onChange={e => setForm({...form, flavor: e.target.value})} placeholder="e.g. Chocolate Fudge" required /></div>
          <div><label>Cream Type</label><input style={inputStyle} value={form.creamType} onChange={e => setForm({...form, creamType: e.target.value})} placeholder="e.g. Whipped, Fondant" /></div>
          <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="eggless" checked={form.eggless} onChange={e => setForm({...form, eggless: e.target.checked})} style={{ width: 'auto' }} />
            <label htmlFor="eggless" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, color: form.eggless ? '#ef4444' : 'inherit' }}>⚠ Eggless Order</label>
          </div>
          <div>
            <label>Delivery Date & Time *</label>
            <input type="datetime-local" style={inputStyle} value={form.deliveryDatetime} onChange={e => setForm({...form, deliveryDatetime: e.target.value})} required />
          </div>
          <div>
            <label>Delivery Type</label>
            <select style={inputStyle} value={form.deliveryType} onChange={e => setForm({...form, deliveryType: e.target.value})}>
              <option value="PICKUP">Pickup</option>
              <option value="DELIVERY">Home Delivery</option>
            </select>
          </div>
          <div>
            <label>Quote Amount (₹) *</label>
            <input type="number" style={inputStyle} value={form.quoteAmount} onChange={e => setForm({...form, quoteAmount: Number(e.target.value)})} min={0.01} step={0.01} required />
          </div>
          <div>
            <label>Advance Payment (₹) *</label>
            <input type="number" style={inputStyle} value={form.advancePayment} onChange={e => setForm({...form, advancePayment: Number(e.target.value)})} min={0} max={form.quoteAmount || undefined} required />
          </div>
          <div style={{ gridColumn: '1/-1' }}><label>Special Instructions</label><textarea style={{...inputStyle, resize: 'vertical'}} rows={3} value={form.specialInstructions} onChange={e => setForm({...form, specialInstructions: e.target.value})} placeholder="Design notes, inscription text, etc." /></div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ padding: '10px 24px' }}>{loading ? 'Booking...' : 'Book Order'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CustomCakes({ triggerAlert }) {
  const [orders, setOrders] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeStage, setActiveStage] = useState('');
  const [pipelineSummary, setPipelineSummary] = useState({});

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [ordersRes, branchesRes, summaryRes] = await Promise.all([
        apiRequest('/custom-cakes').catch(() => []),
        apiRequest('/branches').catch(() => []),
        apiRequest('/custom-cakes/pipeline/summary').catch(() => ({})),
      ]);
      setOrders(Array.isArray(ordersRes) ? ordersRes : ordersRes?.items || []);
      setBranches(Array.isArray(branchesRes) ? branchesRes : branchesRes?.items || []);
      setPipelineSummary(summaryRes || {});
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdvance = async (id) => {
    try {
      await apiRequest(`/custom-cakes/${id}/advance`, 'PATCH', {});
      triggerAlert('Order advanced to next stage', false);
      fetchAll();
    } catch (err) { triggerAlert(err.message || 'Failed', true); }
  };

  const filteredOrders = activeStage ? orders.filter(o => o.status === activeStage) : orders;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Custom Cake Orders</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Manage bespoke cake pipeline from booking to delivery</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Book Custom Cake</button>
      </div>

      {/* Pipeline Summary */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {[{ id: '', label: 'All Orders' }, ...PIPELINE_STAGES.map(s => ({ id: s, label: s }))].map(stage => (
          <button
            key={stage.id}
            onClick={() => setActiveStage(stage.id)}
            style={{
              padding: '8px 16px', borderRadius: 100, whiteSpace: 'nowrap', cursor: 'pointer',
              border: `1px solid ${activeStage === stage.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: activeStage === stage.id ? 'var(--color-primary)' : 'transparent',
              color: activeStage === stage.id ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
            }}
          >
            {stage.label}{pipelineSummary[stage.id] ? ` (${pipelineSummary[stage.id]})` : ''}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--bg-surface-hover)' }}>
                  {['Order #', 'Customer', 'Flavor / Details', 'Weight', 'Delivery', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>No orders found</td></tr>
                ) : filteredOrders.map(order => (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '14px 16px', fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>{order.salesOrder?.orderNumber}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{order.salesOrder?.customer?.fullName || 'Unknown'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{order.salesOrder?.customer?.phone}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{order.flavour} — {order.layers} Layer</div>
                      {order.specialInstructions && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{order.specialInstructions.slice(0, 60)}...</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 600 }}>{order.weight} kg</td>
                    <td style={{ padding: '14px 16px', fontSize: 13 }}>
                      <div>{new Date(order.scheduledAt).toLocaleDateString('en-IN')}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{new Date(order.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {order.deliveryOrPickup}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}><StatusBadge status={order.status} /></td>
                    <td style={{ padding: '14px 16px' }}>
                      {!['COMPLETED', 'CANCELLED', 'REJECTED', 'QC_FAILED'].includes(order.status) && (
                        <button className="btn-primary" onClick={() => handleAdvance(order.id)} style={{ padding: '6px 14px', fontSize: 12 }}>
                          → Advance
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && branches.length > 0 && (
        <BookingModal
          branches={branches}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchAll(); triggerAlert('Custom cake booked successfully'); }}
        />
      )}
    </div>
  );
}
