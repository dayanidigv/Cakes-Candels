import React from 'react';

export const PageHeader = ({ title, action }: any) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--color-border)' }}>
    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>{title}</h2>
    {action && <div>{action}</div>}
  </div>
);
