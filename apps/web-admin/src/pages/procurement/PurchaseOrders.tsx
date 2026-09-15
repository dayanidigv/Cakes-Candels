import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/procurement/po');
      if (res.items) setOrders(res.items);
      else if (res) setOrders(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleApprove = async (id: string) => {
    if (!window.confirm('Approve PO?')) return;
    try {
      await apiRequest(`/procurement/po/${id}/approve`, 'PATCH');
      fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to approve');
    }
  };

  if (loading) return <div style={{ padding: '40px' }}><LoadingState message="Loading POs..." /></div>;
  if (error) return <div style={{ padding: '40px' }}><ErrorState message={error} onRetry={fetchOrders} /></div>;

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <PageHeader title="Purchase Orders" />
        <button className="btn-primary">+ New PO</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <th style={{ padding: '12px' }}>PO Number</th>
              <th style={{ padding: '12px' }}>Supplier</th>
              <th style={{ padding: '12px' }}>Branch</th>
              <th style={{ padding: '12px' }}>Amount</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No POs found</td>
              </tr>
            ) : (
              orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{o.poNumber}</td>
                  <td style={{ padding: '12px' }}>{o.supplier.name}</td>
                  <td style={{ padding: '12px' }}>{o.branch.name}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>${Number(o.totalAmount).toFixed(2)}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                      background: o.status === 'APPROVED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                      color: o.status === 'APPROVED' ? '#6ee7b7' : '#93c5fd'
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {o.status === 'SUBMITTED' && (
                      <button onClick={() => handleApprove(o.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        Approve
                      </button>
                    )}
                    {o.status === 'APPROVED' && (
                      <button className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px', background: '#10b981' }}>
                        Receive GRN
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
