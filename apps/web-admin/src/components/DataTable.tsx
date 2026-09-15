import React from 'react';

export const DataTable = ({ columns, data, onEdit, onDelete, pagination, onPageChange, renderCustomRow }: any) => {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
        <thead>
          <tr>
            {columns.map((c: any, i: number) => <th key={i} style={{ padding: '12px', background: 'var(--bg-app)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>{c.label}</th>)}
            <th style={{ padding: '12px', background: 'var(--bg-app)', borderBottom: '1px solid var(--color-border)', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row: any, i: number) => (
            <tr key={row.id || i}>
              {renderCustomRow ? renderCustomRow(row) : columns.map((c: any, j: number) => (
                <td key={j} style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                  {typeof c.render === 'function' ? c.render(row) : String(row[c.key] || '')}
                </td>
              ))}
              {!renderCustomRow && (
                <td style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                  <button onClick={() => onEdit(row)} style={{ background: 'transparent', border: '1px solid var(--color-primary)', color: 'var(--color-primary-hover)', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', marginRight: '8px' }}>Edit</button>
                  <button onClick={() => onDelete(row.id)} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer' }}>Delete</button>
                </td>
              )}
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={columns.length + 1} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>No records found.</td></tr>}
        </tbody>
      </table>
      {pagination && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '8px 0' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--bg-surface)', color: 'var(--color-text-primary)', cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
            <button disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--bg-surface)', color: 'var(--color-text-primary)', cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
};
