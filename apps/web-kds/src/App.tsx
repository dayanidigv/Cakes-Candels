import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';

const API_BASE = 'http://localhost:3000/api';
const DEV_TOKEN = 'SUPER_ADMIN_TOKEN_99999999999999999999999999999999';

const api = async (path: string, method = 'GET', body?: any) => {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Dev-Token': DEV_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message || 'API Error');
  return data.data;
};

// ─── Status Config ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  PLANNED: { label: 'Planned', color: '#94a3b8', icon: 'schedule' },
  IN_PROGRESS: { label: 'Baking', color: '#f59e0b', icon: 'local_fire_department' },
  DECORATING: { label: 'Decorating', color: '#8b5cf6', icon: 'brush' },
  QC: { label: 'QC Check', color: '#3b82f6', icon: 'fact_check' },
  COMPLETED: { label: 'Done', color: '#10b981', icon: 'check_circle' },
};

// ─── Timer Component ───────────────────────────────────────────────────────────
function Timer({ startedAt }: { startedAt?: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const isLong = mins >= 45;

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: isLong ? '#ef4444' : '#f59e0b', letterSpacing: 1 }}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#94a3b8', icon: 'radio_button_unchecked' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 100, background: `${cfg.color}22`, color: cfg.color, fontSize: 12, fontWeight: 700 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ─── Yield QC Modal ────────────────────────────────────────────────────────────
function YieldQCModal({ order, onClose, onSubmit }: { order: any; onClose: () => void; onSubmit: (actual: number, notes: string) => void }) {
  const [actual, setActual] = useState(order.targetQuantity || 0);
  const [notes, setNotes] = useState('');
  const wastage = Math.max(0, (order.targetQuantity || 0) - actual);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(6px)' }}>
      <div className="fade-in" style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', padding: 40, width: 440, border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Submit Yield & QC</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{order.recipeName || 'Production Run'} · Target: {order.targetQuantity}</div>
          </div>
          <button onClick={onClose} className="kds-btn kds-btn-ghost" style={{ padding: '6px 10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 8 }}>
              Actual Quantity Produced
            </label>
            <input
              id="actual-qty"
              type="number"
              value={actual}
              onChange={e => setActual(Number(e.target.value))}
              min={0}
              max={order.targetQuantity}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '12px 16px', fontSize: 20, fontWeight: 700, width: '100%', outline: 'none' }}
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>{actual}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Passed ✓</div>
            </div>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>{wastage}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Wastage ✗</div>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 8 }}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional QC notes..."
              rows={3}
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '12px', fontSize: 14, width: '100%', outline: 'none', resize: 'vertical' }}
            />
          </div>

          <button id="submit-yield" className="kds-btn kds-btn-success" onClick={() => onSubmit(actual, notes)} style={{ width: '100%', padding: '14px', fontSize: 16, justifyContent: 'center' }}>
            <span className="material-symbols-outlined">fact_check</span>
            Submit Yield & Mark Complete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── KDS Job Card ───────────────────────────────────────────────────────────────
function KDSJobCard({ order, onStartBaking, onStartDecorating, onOpenQC }: {
  order: any;
  onStartBaking: () => void;
  onStartDecorating: () => void;
  onOpenQC: () => void;
}) {
  const isPriority = order.isCustomCake;
  const isEggless = order.eggless;

  return (
    <div
      id={`kds-card-${order.id}`}
      className={`fade-in ${isPriority ? 'priority-card' : ''}`}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: `2px solid ${isPriority ? 'var(--color-gold)' : 'var(--border)'}`,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        boxShadow: isPriority ? 'var(--shadow-glow-gold)' : 'var(--shadow-card)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top: Order ID + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>
            {isPriority ? '🎂 CUSTOM ORDER' : '🏭 PRODUCTION RUN'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>{order.orderNumber || `Run #${order.id?.slice(-4)}`}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={order.status} />
          {['IN_PROGRESS', 'DECORATING'].includes(order.status) && <Timer startedAt={order.startedAt} />}
        </div>
      </div>

      {/* Recipe / Product Info */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{order.recipeName || order.productName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>scale</span>
            Target: <strong style={{ color: 'var(--text-primary)' }}>{order.targetQuantity} {order.isCustomCake ? 'kg' : 'pcs'}</strong>
          </div>
          {order.flavor && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Flavor: <strong style={{ color: 'var(--text-primary)' }}>{order.flavor}</strong>
            </div>
          )}
          {order.deliveryDatetime && (
            <div style={{ fontSize: 12, color: 'var(--color-warning)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
              Due: {new Date(order.deliveryDatetime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>

        {/* EGGLESS ALERT */}
        {isEggless && (
          <div className="eggless-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
            ⚠ EGGLESS — No Egg Ingredients!
          </div>
        )}

        {order.specialInstructions && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(59,130,246,0.1)', borderRadius: 6, padding: '6px 10px', borderLeft: '3px solid #3b82f6' }}>
            📋 {order.specialInstructions}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {order.status === 'PLANNED' && (
          <button id={`start-baking-${order.id}`} className="kds-btn kds-btn-warning" onClick={onStartBaking} style={{ flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>local_fire_department</span>
            Start Baking
          </button>
        )}
        {order.status === 'IN_PROGRESS' && (
          <button id={`start-decorating-${order.id}`} className="kds-btn kds-btn-purple" onClick={onStartDecorating} style={{ flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>brush</span>
            Mark Decorating
          </button>
        )}
        {order.status === 'DECORATING' && (
          <button id={`submit-qc-${order.id}`} className="kds-btn kds-btn-success" onClick={onOpenQC} style={{ flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>fact_check</span>
            Submit Yield & QC
          </button>
        )}
        {order.status === 'QC' && (
          <div style={{ fontSize: 13, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>pending</span>
            Awaiting QC Approval...
          </div>
        )}
        {order.status === 'COMPLETED' && (
          <div style={{ fontSize: 13, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>
            Complete — Dispatch Ready
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Login Page ─────────────────────────────────────────────────────────────────
function KDSLogin({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('');
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
      <div style={{ background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', padding: 40, width: 360, border: '1px solid var(--border)', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>👨‍🍳</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Kitchen Display</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>Cakes & Candles — Factory Terminal</p>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && onLogin()} placeholder="Enter kitchen PIN" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '12px 16px', fontSize: 16, width: '100%', outline: 'none', marginBottom: 16 }} />
        <button id="kds-login-btn" className="kds-btn kds-btn-primary" onClick={onLogin} style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}>
          Access Kitchen Queue
        </button>
      </div>
    </div>
  );
}

// ─── Main KDS App ───────────────────────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [customCakes, setCustomCakes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [qcTarget, setQcTarget] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const refreshInterval = useRef<ReturnType<typeof setInterval>>();

  const fetchData = useCallback(async () => {
    try {
      const [prodOrders, cakes] = await Promise.all([
        api('/production/orders').catch(() => ({ items: [] })),
        api('/custom-cakes?status=BAKING').catch(() => []),
      ]);
      const items = Array.isArray(prodOrders) ? prodOrders : (prodOrders?.items || []);
      setOrders(items.filter((o: any) => !['COMPLETED', 'CANCELLED'].includes(o.status)));
      setCustomCakes(Array.isArray(cakes) ? cakes : []);
      setLastRefresh(new Date());
    } catch {
      setOrders(DEMO_ORDERS);
      setCustomCakes(DEMO_CUSTOM_CAKES);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    // Auto-refresh every 30 seconds
    refreshInterval.current = setInterval(fetchData, 30000);
    return () => { if (refreshInterval.current) clearInterval(refreshInterval.current); };
  }, [isLoggedIn, fetchData]);

  const advanceStatus = async (_orderId: string, endpoint: string) => {
    try {
      await api(endpoint, 'PATCH', { notes: 'Updated via KDS' });
      fetchData();
    } catch { fetchData(); }
  };

  const submitYield = async (actual: number, notes: string) => {
    if (!qcTarget) return;
    try {
      await api(`/production/orders/${qcTarget.id}/complete`, 'PATCH', { actualYield: actual, notes }).catch(() => {});
    } finally { setQcTarget(null); fetchData(); }
  };

  const allJobs = [
    ...customCakes.map(c => ({ ...c, isCustomCake: true, recipeName: `${c.flavor} Cake`, orderNumber: c.orderNumber })),
    ...orders.map(o => ({ ...o, isCustomCake: false, recipeName: o.variant?.name || o.recipeName || 'Production Run' })),
  ].sort((a, b) => {
    // Priority custom cakes first, then by creation date
    if (a.isCustomCake && !b.isCustomCake) return -1;
    if (!a.isCustomCake && b.isCustomCake) return 1;
    return 0;
  });

  const stats = {
    active: allJobs.filter(j => ['IN_PROGRESS', 'DECORATING'].includes(j.status)).length,
    planned: allJobs.filter(j => j.status === 'PLANNED').length,
    qc: allJobs.filter(j => j.status === 'QC').length,
    custom: customCakes.length,
  };

  if (!isLoggedIn) return <KDSLogin onLogin={() => setIsLoggedIn(true)} />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ─── KDS Header ─── */}
      <div style={{ background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 24 }}>🍳</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Kitchen Display System</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Cakes & Candles — Factory Floor</div>
          </div>
        </div>

        {/* Stats Bar */}
        <div style={{ display: 'flex', gap: 16 }}>
          {[
            { label: 'Active', value: stats.active, color: '#f59e0b' },
            { label: 'Planned', value: stats.planned, color: '#3b82f6' },
            { label: 'QC Queue', value: stats.qc, color: '#8b5cf6' },
            { label: 'Custom', value: stats.custom, color: '#d97706' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '6px 14px', background: `${s.color}15`, borderRadius: 8, border: `1px solid ${s.color}40` }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
          Last sync: {lastRefresh.toLocaleTimeString('en-IN')}
          <button className="kds-btn kds-btn-ghost" onClick={fetchData} style={{ padding: '6px 12px', fontSize: 12, marginLeft: 8 }}>Refresh</button>
        </div>
      </div>

      {/* ─── KDS Grid ─── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', gap: 12, color: 'var(--text-secondary)' }}>
            <div className="spinner" /> Loading production queue...
          </div>
        ) : allJobs.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)', gap: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, opacity: 0.3 }}>done_all</span>
            <div style={{ fontSize: 18, fontWeight: 600 }}>All done! No active production orders.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {allJobs.map(order => (
              <KDSJobCard
                key={order.id}
                order={order}
                onStartBaking={() => advanceStatus(order.id, order.isCustomCake
                  ? `/custom-cakes/${order.id}/advance`
                  : `/production/orders/${order.id}/start`
                )}
                onStartDecorating={() => advanceStatus(order.id, `/production/orders/${order.id}/start`)}
                onOpenQC={() => setQcTarget(order)}
              />
            ))}
          </div>
        )}
      </div>

      {qcTarget && (
        <YieldQCModal order={qcTarget} onClose={() => setQcTarget(null)} onSubmit={submitYield} />
      )}
    </div>
  );
}

// ─── Demo Fallback Data ──────────────────────────────────────────────────────────
const DEMO_ORDERS = [
  { id: 'run-001', orderNumber: 'RUN-092', status: 'IN_PROGRESS', recipeName: 'Black Forest Cake', targetQuantity: 50, startedAt: new Date(Date.now() - 35 * 60000).toISOString() },
  { id: 'run-002', orderNumber: 'RUN-093', status: 'PLANNED', recipeName: 'Red Velvet Cake', targetQuantity: 30 },
  { id: 'run-003', orderNumber: 'RUN-094', status: 'DECORATING', recipeName: 'Butterscotch Cake', targetQuantity: 25, startedAt: new Date(Date.now() - 55 * 60000).toISOString() },
  { id: 'run-004', orderNumber: 'RUN-095', status: 'QC', recipeName: 'Pineapple Cake', targetQuantity: 20 },
];

const DEMO_CUSTOM_CAKES = [
  { id: 'cc-001', orderNumber: 'CCO-09204', status: 'IN_PROGRESS', flavor: '3KG Princess', targetQuantity: 3, eggless: true, specialInstructions: 'Extra whipped cream on top. Pink theme.', deliveryDatetime: new Date(Date.now() + 4 * 60 * 60000).toISOString(), startedAt: new Date(Date.now() - 20 * 60000).toISOString() },
  { id: 'cc-002', orderNumber: 'CCO-09205', status: 'PLANNED', flavor: '2KG Chocolate Fudge', targetQuantity: 2, eggless: false, specialInstructions: 'Happy Birthday Rahul inscription.', deliveryDatetime: new Date(Date.now() + 8 * 60 * 60000).toISOString() },
];
