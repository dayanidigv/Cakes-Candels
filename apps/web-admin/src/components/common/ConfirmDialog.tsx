import React from 'react';

export const ConfirmDialog = ({ title, message, onConfirm, onCancel, confirmText = 'Confirm', isDestructive = false }: any) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
    <div style={{ background: '#1e1e1e', padding: '24px', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid var(--color-border-dark)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>{title}</h3>
      <p style={{ margin: '0 0 24px 0', color: '#aaa', fontSize: '14px', lineHeight: 1.5 }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button onClick={onCancel} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--color-text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ background: isDestructive ? '#ef4444' : 'var(--color-primary)', border: 'none', color: 'var(--color-text-primary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>{confirmText}</button>
      </div>
    </div>
  </div>
);
