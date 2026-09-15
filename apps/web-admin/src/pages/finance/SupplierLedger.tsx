// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';

export default function SupplierLedger({ triggerAlert }) {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiRequest('/finance/supplier-ledger').then(data => {
      setLedger(Array.isArray(data) ? data : data?.items || []);
    }).catch(() => setLedger([])).finally(() => setLoading(false));
  }, []);

  const filtered = search ? ledger.filter(s => (s.supplierName || '').toLowerCase().includes(search.toLowerCase())) : ledger;

  const totalOutstanding = filtered.reduce((sum, s) => sum + (s.outstanding || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Supplier Ledger</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 4 }}>Outstanding vendor payables and payment tracking</p>
        </div>
        <div style={{ padding: '12px 20px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', borderRadius: 10, color: '#fff' }}>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.85 }}>Total Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>₹{totalOutstanding.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--color-text-muted)' }}>search</span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..." style={{ paddingLeft: 38, width: '100%', padding: '10px 14px 10px 38px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 14, background: 'var(--bg-surface)' }} />
      </div>

      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>Loading...</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--bg-surface-hover)' }}>
                  {['Supplier', 'GSTIN', 'Invoiced', 'Paid', 'Outstanding', 'Pending Orders', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-secondary)' }}>No supplier data found</td></tr>
                ) : filtered.map(s => (
                  <tr key={s.supplierId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700 }}>{s.supplierName}</div>
                      {s.phone && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.phone}</div>}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.gstin || '—'}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>₹{Number(s.totalInvoiced || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: '#10b981' }}>₹{Number(s.totalPaid || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: s.outstanding > 0 ? '#ef4444' : '#10b981' }}>
                      ₹{Number(s.outstanding || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.pendingOrders > 0 ? (
                        <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: 12, fontWeight: 600 }}>{s.pendingOrders} pending</span>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 100, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontSize: 12, fontWeight: 600 }}>All settled</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.outstanding > 0 && (
                        <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12 }} onClick={() => triggerAlert(`Release payment to ${s.supplierName} — feature requires accounting integration`, true)}>
                          Release Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
