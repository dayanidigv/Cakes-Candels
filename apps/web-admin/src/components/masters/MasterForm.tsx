import React from 'react';

export const MasterForm = ({ children, onSubmit, isSubmitting, isEditing, onCancel, title }: any) => (
  <div style={{ background: 'var(--bg-app)', padding: '24px', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '30px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h3 style={{ margin: 0 }}>{title || (isEditing ? 'Edit Record' : 'Create New')}</h3>
      {onCancel && (
        <button type="button" onClick={onCancel} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
        </button>
      )}
    </div>
    <form onSubmit={onSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
        {children}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={isSubmitting} style={{ background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', padding: '10px 20px', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.5 : 1 }}>
            Cancel
          </button>
        )}
        <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
          {isSubmitting && <span className="material-symbols-outlined" style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>sync</span>}
          {isSubmitting ? 'Saving...' : (isEditing ? 'Update Record' : 'Save Record')}
        </button>
      </div>
    </form>
  </div>
);
