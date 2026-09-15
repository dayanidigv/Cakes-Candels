import React from 'react';

export const FormField = ({ label, error, children, required = false }: any) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
      {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
    </label>
    {children}
    {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px' }}>{error}</div>}
  </div>
);
