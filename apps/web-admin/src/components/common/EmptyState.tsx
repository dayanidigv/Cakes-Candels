import React from 'react';

export const EmptyState = ({ title = 'No records found', message = '', action }: { title?: string, message?: string, action?: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', color: 'var(--color-text-muted)', textAlign: 'center', background: 'var(--bg-surface)', borderRadius: '12px', border: '1px dashed var(--color-border-dark)' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>inventory_2</span>
    <h3 style={{ margin: '0 0 8px 0', color: 'var(--color-text-primary)' }}>{title}</h3>
    {message && <p style={{ margin: '0 0 24px 0', fontSize: '14px' }}>{message}</p>}
    {action && <div>{action}</div>}
  </div>
);
