import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { ProductionOrderForm } from './ProductionOrderForm';

export default function ProductionOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/production/orders');
      if (res.success) setOrders(res.data.items);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch production orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStart = async (id: string) => {
    if (!window.confirm('Start production? This will instantly consume raw materials from inventory based on the recipe.')) return;
    try {
      const res = await apiRequest(`/production/orders/${id}/start`, 'PATCH', { notes: 'Started via UI' });
      if (res) fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to start production');
    }
  };

  const handleComplete = async (id: string, targetQuantity: number) => {
    const actualYieldStr = window.prompt('Enter actual yield produced:', targetQuantity.toString());
    if (!actualYieldStr) return;
    const actualYield = Number(actualYieldStr);
    if (isNaN(actualYield) || actualYield <= 0) return alert('Invalid yield quantity');

    try {
      const res = await apiRequest(`/production/orders/${id}/complete`, 'PATCH', { actualYield, notes: 'Completed via UI' });
      if (res) fetchOrders();
    } catch (err: any) {
      alert(err.message || 'Failed to complete production');
    }
  };

  if (loading) return <div style={{ padding: '40px' }}><LoadingState message="Loading Production Orders..." /></div>;
  if (error) return <div style={{ padding: '40px' }}><ErrorState message={error} onRetry={fetchOrders} /></div>;

  return (
    <div className="glass-panel" style={{ padding: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <PageHeader title="Production Orders" />
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Production Order</button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <th style={{ padding: '12px' }}>Order No</th>
              <th style={{ padding: '12px' }}>Status</th>
              <th style={{ padding: '12px' }}>Finished Good</th>
              <th style={{ padding: '12px' }}>Location</th>
              <th style={{ padding: '12px' }}>Target Yield</th>
              <th style={{ padding: '12px' }}>Actual Yield</th>
              <th style={{ padding: '12px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-secondary)' }}>No production orders found</td>
              </tr>
            ) : (
              orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px', fontWeight: 600, fontFamily: 'monospace' }}>{o.orderNumber}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                      background: o.status === 'PLANNED' ? 'rgba(59, 130, 246, 0.2)' : 
                                  o.status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.2)' :
                                  'rgba(16, 185, 129, 0.2)',
                      color: o.status === 'PLANNED' ? '#93c5fd' :
                             o.status === 'IN_PROGRESS' ? '#fcd34d' :
                             '#6ee7b7'
                    }}>
                      {o.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{o.variant.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{o.variant.sku}</div>
                  </td>
                  <td style={{ padding: '12px' }}>{o.location.name}</td>
                  <td style={{ padding: '12px', fontWeight: 600 }}>{Number(o.targetQuantity).toFixed(2)}</td>
                  <td style={{ padding: '12px', color: o.actualYield ? '#10b981' : 'var(--color-text-secondary)' }}>
                    {o.actualYield ? Number(o.actualYield).toFixed(2) : '--'}
                  </td>
                  <td style={{ padding: '12px' }}>
                    {o.status === 'PLANNED' && (
                      <button onClick={() => handleStart(o.id)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        Start (Consume)
                      </button>
                    )}
                    {o.status === 'IN_PROGRESS' && (
                      <button onClick={() => handleComplete(o.id, Number(o.targetQuantity))} className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px', background: '#10b981' }}>
                        Complete (Yield)
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <ProductionOrderForm 
          onClose={() => setShowForm(false)} 
          onSuccess={() => { setShowForm(false); fetchOrders(); }} 
        />
      )}
    </div>
  );
}
