// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

export default function Attendance({ triggerAlert }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await apiRequest(`/hr/attendance?date=${date}`).catch(() => []);
      setLogs(Array.isArray(res) ? res : res?.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetch(); }, [date]);

  const statusConfig = { PRESENT: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' }, LATE: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' }, ABSENT: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' } };

  const stats = { present: logs.filter(l => l.status === 'PRESENT').length, late: logs.filter(l => l.status === 'LATE').length, absent: logs.filter(l => l.status === 'ABSENT').length };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Attendance Log</h1>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-surface)' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[{ label: 'Present', val: stats.present, color: '#10b981' }, { label: 'Late', val: stats.late, color: '#f59e0b' }, { label: 'Absent', val: stats.absent, color: '#ef4444' }].map(s => (
          <div key={s.label} className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--bg-surface-hover)' }}>
                {['Employee', 'Shift', 'Clock In', 'Clock Out', 'Hours', 'Status'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>No attendance records for this date</td></tr>
              ) : logs.map(log => {
                const cfg = statusConfig[log.status] || { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' };
                const clockIn = log.clockIn ? new Date(log.clockIn) : null;
                const clockOut = log.clockOut ? new Date(log.clockOut) : null;
                const hours = (clockIn && clockOut) ? ((clockOut - clockIn) / 3600000).toFixed(1) : '—';
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{log.user?.name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{log.user?.email}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{log.shift?.name || '—'}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13 }}>{clockIn ? clockIn.toLocaleTimeString('en-IN') : '—'}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13 }}>{clockOut ? clockOut.toLocaleTimeString('en-IN') : <span style={{ color: 'var(--color-warning)' }}>Still in</span>}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{hours !== '—' ? `${hours}h` : '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{log.status}</span>
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
