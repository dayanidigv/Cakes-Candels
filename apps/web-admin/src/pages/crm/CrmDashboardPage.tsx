import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export default function CrmDashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = () => {
    setLoading(true);
    setError(null);
    apiRequest('/crm/dashboard')
      .then((data) => setStats(data))
      .catch((err: any) => setError(err?.message || 'Failed to load CRM Dashboard statistics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ height: 28, width: 250, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s infinite ease-in-out' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="glass-panel" style={{ height: 100, background: '#f1f5f9', borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', margin: '0 0 8px', fontSize: 18 }}>Unable to load CRM Dashboard</h3>
        <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: 14 }}>{error}</p>
        <button onClick={fetchDashboard} className="btn-primary" style={{ background: '#2563eb' }}>
          ↻ Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>CRM & Customer Intelligence</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Real-time customer metrics, health breakdown, and loyalty insights</p>
        </div>
        <button onClick={fetchDashboard} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          ↻ Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Customers</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#0f172a' }}>{(stats?.totalCustomers || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>● Scoped Active Database</div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Champions / VIP</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#d97706' }}>{(stats?.championsCount || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>👑 RFM Top Spend</div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Healthy Accounts</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#10b981' }}>{(stats?.healthyCount || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#10b981', marginTop: 4 }}>Score 80-100</div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>At-Risk Accounts</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#ef4444' }}>{(stats?.atRiskCount || 0).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4 }}>Needs re-engagement</div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Customer Spend (CLV)</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: '#2563eb' }}>₹{(stats?.totalClv || 0).toLocaleString('en-IN')}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Commercial Sales Sum</div>
        </div>

        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Loyalty Balance</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8, color: '#b45309' }}>{(stats?.totalLoyaltyPoints || 0).toLocaleString()} pts</div>
          <div style={{ fontSize: 12, color: '#b45309', marginTop: 4 }}>Immutable Ledger Balance</div>
        </div>
      </div>

      {/* Activity Timeline Feed */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Customer Activities</h3>
        {(!stats?.recentActivities || stats.recentActivities.length === 0) ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.5 }}>forum</span>
            No CRM activities logged yet. Interactions will appear here in real-time.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.recentActivities.map((act: any) => (
              <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: act.activityType === 'COMPLAINT' ? '#ef4444' : '#2563eb' }}>
                    {act.activityType === 'COMPLAINT' ? 'warning' : 'forum'}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{act.customerName} — {act.subject}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{act.activityType}</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(act.createdAt).toLocaleString('en-IN')}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
