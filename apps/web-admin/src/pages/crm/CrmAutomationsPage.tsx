import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export default function CrmAutomationsPage({ triggerAlert }: { triggerAlert?: (msg: string, isErr?: boolean) => void }) {
  const [automations, setAutomations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAutomations = () => {
    setLoading(true);
    setError(null);
    apiRequest('/crm/automations')
      .then((res) => setAutomations(Array.isArray(res) ? res : []))
      .catch((err: any) => setError(err?.message || 'Failed to load marketing automations'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Event-Driven Marketing Automations</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Automated triggers and execution runs for customer campaigns</p>
        </div>
        <button onClick={fetchAutomations} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          ↻ Refresh Automations
        </button>
      </div>

      {error ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#ef4444', margin: '0 0 12px' }}>{error}</p>
          <button onClick={fetchAutomations} className="btn-primary" style={{ background: '#2563eb' }}>↻ Retry Loading</button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading automations...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Rule Name</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Event Trigger</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Action Type</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Recent Runs</th>
                </tr>
              </thead>
              <tbody>
                {automations.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No automations configured</td></tr>
                ) : automations.map((auto) => (
                  <tr key={auto.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600, fontSize: 15 }}>{auto.name}</td>
                    <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>{auto.eventType}</td>
                    <td style={{ padding: '16px 20px', color: '#059669', fontWeight: 600 }}>{auto.actionType}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: auto.isActive ? '#dcfce7' : '#fee2e2', color: auto.isActive ? '#166534' : '#991b1b' }}>
                        {auto.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontSize: 13, color: '#64748b' }}>
                      {auto.runs?.length || 0} executions
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
