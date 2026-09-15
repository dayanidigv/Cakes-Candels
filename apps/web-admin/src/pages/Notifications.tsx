import React, { useState } from 'react';

interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  timestamp: string;
  isRead: boolean;
}

const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<SystemNotification[]>([
    { id: '1', title: 'Low Stock Alert: Whole Milk 1L', message: 'Current stock in Branch B1 is below reorder threshold (10 units left).', type: 'WARNING', timestamp: new Date().toISOString(), isRead: false },
    { id: '2', title: 'GL Expense Posted', message: 'Expense #EXP-2026-0004 for Dairy Best Ltd has been posted to General Ledger.', type: 'SUCCESS', timestamp: new Date(Date.now() - 1800000).toISOString(), isRead: false },
    { id: '3', title: 'Shift Roster Conflict Detected', message: 'Employee EMP-004 is scheduled for overlapping shifts on 2026-09-05.', type: 'ALERT', timestamp: new Date(Date.now() - 3600000).toISOString(), isRead: true },
    { id: '4', title: 'System Backup Completed', message: 'Database snapshot migration backup completed successfully.', type: 'INFO', timestamp: new Date(Date.now() - 86400000).toISOString(), isRead: true },
  ]);

  const markAllRead = () => {
    setNotifications(n => n.map(item => ({ ...item, isRead: true })));
  };

  const TYPE_STYLES = {
    INFO: { icon: 'info', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)' },
    SUCCESS: { icon: 'check_circle', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.1)' },
    WARNING: { icon: 'warning', color: '#facc15', bg: 'rgba(250, 204, 21, 0.1)' },
    ALERT: { icon: 'error', color: '#f87171', bg: 'rgba(248, 113, 113, 0.1)' },
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>🔔 System Notifications</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>
            Real-time alerts, operational events, and system broadcasts
          </p>
        </div>
        <button className="btn-primary" onClick={markAllRead} style={{ padding: '8px 16px' }}>
          ✓ Mark All as Read
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notifications.map(n => {
          const style = TYPE_STYLES[n.type];
          return (
            <div
              key={n.id}
              style={{
                background: n.isRead ? 'rgba(255,255,255,0.02)' : style.bg,
                borderRadius: 12,
                padding: '16px 20px',
                border: `1px solid ${n.isRead ? 'var(--color-border)' : style.color}`,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                transition: 'all 0.2s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ color: style.color, fontSize: 24, marginTop: 2 }}>
                {style.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)' }}>{n.title}</h4>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{n.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
