import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export default function CrmSegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegments = () => {
    setLoading(true);
    setError(null);
    apiRequest('/crm/segments')
      .then((res) => setSegments(Array.isArray(res) ? res : []))
      .catch((err: any) => setError(err?.message || 'Failed to load customer segments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSegments();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Rule-Driven Customer Segments</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Automated rule-driven customer segment classifications</p>
        </div>
        <button onClick={fetchSegments} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
          ↻ Refresh Segments
        </button>
      </div>

      {error ? (
        <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: '#ef4444', margin: '0 0 12px' }}>{error}</p>
          <button onClick={fetchSegments} className="btn-primary" style={{ background: '#2563eb' }}>↻ Retry Loading</button>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading segments...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Segment Name</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Code</th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '14px 20px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Mapped Customers</th>
                </tr>
              </thead>
              <tbody>
                {segments.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No customer segments found</td></tr>
                ) : segments.map((seg) => (
                  <tr key={seg.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600, fontSize: 15 }}>{seg.name}</td>
                    <td style={{ padding: '16px 20px', fontFamily: 'monospace', color: '#2563eb', fontWeight: 600 }}>{seg.code}</td>
                    <td style={{ padding: '16px 20px', color: '#64748b', fontSize: 14 }}>{seg.description || 'Rule-driven customer group'}</td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                      <span style={{ padding: '4px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
                        {seg._count?.customers || 0} Customers
                      </span>
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
