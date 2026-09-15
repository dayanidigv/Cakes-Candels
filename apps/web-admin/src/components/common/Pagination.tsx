import React from 'react';

export const Pagination = ({ current, total, limit, onPageChange }: any) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (current - 1) * limit + 1;
  const end = Math.min(current * limit, total);
  
  if (total === 0) return null;
  
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', padding: '16px 0', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
        Showing {start}–{end} of {total}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onPageChange(current - 1)} disabled={current <= 1} style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', color: current <= 1 ? '#555' : 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: current <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', color: 'var(--color-text-muted)', fontSize: '14px' }}>Page {current} of {totalPages}</div>
        <button onClick={() => onPageChange(current + 1)} disabled={current >= totalPages} style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)', color: current >= totalPages ? '#555' : 'var(--color-text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: current >= totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
      </div>
    </div>
  );
};
