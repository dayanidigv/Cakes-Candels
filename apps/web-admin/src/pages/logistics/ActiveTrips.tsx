// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

const STATUS_STEPS = ['PACKED', 'DISPATCHED', 'ON_THE_WAY', 'REACHED_BRANCH', 'RECEIVED'];

const STATUS_CONFIG = {
  PACKED: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', icon: 'inventory_2' },
  DISPATCHED: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', icon: 'local_shipping' },
  ON_THE_WAY: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: 'directions_car' },
  REACHED_BRANCH: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', icon: 'location_on' },
  RECEIVED: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: 'check_circle' },
};

function ProgressBar({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STATUS_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: i <= idx ? 'var(--color-success)' : 'var(--color-border)', flexShrink: 0 }} />
          {i < STATUS_STEPS.length - 1 && (
            <div style={{ flex: 1, height: 2, background: i < idx ? 'var(--color-success)' : 'var(--color-border)', minWidth: 16 }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ActiveTrips({ triggerAlert }) {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchDispatches = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/logistics/dispatches${filter ? `?status=${filter}` : ''}`).catch(() => []);
      setDispatches(Array.isArray(res) ? res : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchDispatches(); }, [filter]);

  const handleAdvance = async (id) => {
    try {
      await apiRequest(`/logistics/dispatches/${id}/advance`, 'PATCH', {});
      triggerAlert('Dispatch status advanced');
      fetchDispatches();
    } catch (err) { triggerAlert(err.message || 'Failed', true); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Active Dispatch Trips</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Live transit tracking from factory to branches</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['', ...STATUS_STEPS].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '6px 14px', borderRadius: 100, border: `1px solid ${filter === s ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filter === s ? 'var(--color-primary)' : 'transparent', color: filter === s ? '#fff' : 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {loading ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>Loading dispatches...</div>
        ) : dispatches.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 48, display: 'block', opacity: 0.3, marginBottom: 8 }}>local_shipping</span>
            No dispatches found
          </div>
        ) : dispatches.map(d => {
          const cfg = STATUS_CONFIG[d.status] || STATUS_CONFIG.PACKED;
          return (
            <div key={d.id} className="glass-panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>DISPATCH</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{d.fromBranch?.name || 'Factory'}</span>
                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>arrow_forward</span>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>{d.toBranch?.name || 'Branch'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                    Driver: {d.driver?.name || '—'} · Vehicle: {d.vehicle?.plateNumber || d.vehicle?.name || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{cfg.icon}</span>
                    {d.status}
                  </span>
                  {d.expectedDeliveryAt && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      ETA: {new Date(d.expectedDeliveryAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ marginBottom: 16 }}>
                <ProgressBar status={d.status} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  {STATUS_STEPS.map(s => (
                    <div key={s} style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.replace(/_/g, ' ')}</div>
                  ))}
                </div>
              </div>

              {/* Items */}
              {d.items && d.items.length > 0 && (
                <div style={{ background: 'var(--bg-surface-hover)', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 13 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{d.items.length} item(s):</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {d.items.map(item => (
                      <span key={item.id} style={{ padding: '3px 10px', background: 'var(--color-border)', borderRadius: 100, fontSize: 12 }}>
                        {item.variant?.product?.name || item.variant?.name || 'Item'} × {item.quantityDispatched}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {d.status !== 'RECEIVED' && (
                <button className="btn-primary" onClick={() => handleAdvance(d.id)} style={{ fontSize: 13 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                  Advance to: {STATUS_STEPS[STATUS_STEPS.indexOf(d.status) + 1] || '—'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
