import React from 'react';

export const LoadingState = ({ message = 'Loading...' }: { message?: string }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
    <span className="material-symbols-outlined" style={{ fontSize: '32px', animation: 'spin 1s linear infinite', marginBottom: '16px' }}>sync</span>
    <span>{message}</span>
    <style>{`
      @keyframes spin { 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
);
