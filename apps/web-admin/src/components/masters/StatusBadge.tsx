import React from 'react';

export const StatusBadge = ({ active }: { active: boolean }) => (
  <span style={{ 
    display: 'inline-flex', 
    alignItems: 'center', 
    padding: '4px 10px', 
    borderRadius: '12px', 
    fontSize: '11px', 
    fontWeight: 600, 
    background: active ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
    color: active ? '#10b981' : '#ef4444',
    border: `1px solid ${active ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
  }}>
    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? '#10b981' : '#ef4444', marginRight: '6px' }}></span>
    {active ? 'Active' : 'Inactive'}
  </span>
);
