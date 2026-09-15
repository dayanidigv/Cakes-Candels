import React from 'react';

export const ErrorState = ({ message = 'An error occurred', onRetry }: { message?: string, onRetry?: () => void }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '32px', marginBottom: '16px' }}>error</span>
    <p style={{ margin: '0 0 16px 0' }}>{message}</p>
    {onRetry && (
      <button onClick={onRetry} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
        Retry
      </button>
    )}
  </div>
);
