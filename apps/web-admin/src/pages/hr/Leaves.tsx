// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

export default function LeaveManagement({ triggerAlert }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/hr/leaves${filter ? `?status=${filter}` : ''}`).catch(() => []);
      setLeaves(Array.isArray(res) ? res : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchLeaves(); }, [filter]);

  const handleApprove = async (id) => {
    try {
      await apiRequest(`/hr/leaves/${id}/approve`, 'PATCH');
      triggerAlert('Leave approved');
      fetchLeaves();
    } catch (err) { triggerAlert(err.message, true); }
  };

  const handleReject = async (id) => {
    if (!window.confirm('Reject this leave request?')) return;
    try {
      await apiRequest(`/hr/leaves/${id}/reject`, 'PATCH');
      triggerAlert('Leave rejected');
      fetchLeaves();
    } catch (err) { triggerAlert(err.message, true); }
  };

  const statusConfig = {
    PENDING: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    APPROVED: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    REJECTED: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  };

  const daysDiff = (start, end) => Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Leave Requests</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '7px 16px', borderRadius: 100, border: `1px solid ${filter === s ? 'var(--color-primary)' : 'var(--color-border)'}`, background: filter === s ? 'var(--color-primary)' : 'transparent', color: filter === s ? '#fff' : 'var(--color-text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--bg-surface-hover)' }}>
                {['Employee', 'Type', 'From', 'To', 'Days', 'Reason', 'Status', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaves.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>No leave requests found</td></tr>
              ) : leaves.map(l => {
                const cfg = statusConfig[l.status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{l.user?.name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{l.user?.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600 }}>{l.type}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{new Date(l.startDate).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{new Date(l.endDate).toLocaleDateString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{daysDiff(l.startDate, l.endDate)} days</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--color-text-secondary)', maxWidth: 200 }}>{l.reason}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{l.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {l.status === 'PENDING' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleApprove(l.id)} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12, background: '#10b981' }}>✓ Approve</button>
                          <button onClick={() => handleReject(l.id)} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12, background: '#ef4444' }}>✕ Reject</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
