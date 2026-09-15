import React, { useState, useEffect } from 'react';

const API = 'http://localhost:3000/api';

interface StockBalance {
  id: string;
  quantity: number;
  isLowStock: boolean;
  variant: { id: string; name: string; sku: string; reorderLevel: number | null };
  location: { id: string; name: string; type: string };
}

const StockLevels: React.FC<{ triggerAlert: (msg: string, isError?: boolean) => void }> = ({ triggerAlert }) => {
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);

  const fetchBalances = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (locationFilter) params.set('locationId', locationFilter);
      const res = await fetch(`${API}/inventory/stock-levels?${params}`, {
        headers: { 'x-dev-token': 'CC-Dev-Token-2026' },
      });
      const json = await res.json();
      if (json.success) setBalances(json.data);
    } catch {
      triggerAlert('Failed to load stock levels.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBalances(); }, [locationFilter]);

  const displayed = showLowStock ? balances.filter(b => b.isLowStock) : balances;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>📦 Stock Levels</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 14 }}>Real-time stock balances per product and location</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showLowStock}
              onChange={e => setShowLowStock(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            Show Low Stock Only
          </label>
          <button className="btn-primary" onClick={fetchBalances} style={{ padding: '8px 16px' }}>
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-secondary)' }}>Loading stock levels…</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Product</th>
                <th style={{ padding: '10px 12px' }}>SKU</th>
                <th style={{ padding: '10px 12px' }}>Location</th>
                <th style={{ padding: '10px 12px' }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Quantity</th>
                <th style={{ padding: '10px 12px' }}>Reorder Level</th>
                <th style={{ padding: '10px 12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)' }}>
                    {showLowStock ? 'No low stock items.' : 'No stock data found. Post transactions to see balances.'}
                  </td>
                </tr>
              ) : (
                displayed.map(b => (
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{b.variant.name}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{b.variant.sku}</td>
                    <td style={{ padding: '10px 12px' }}>{b.location.name}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        background: b.location.type === 'FACTORY' ? '#1e3a5f' : b.location.type === 'RETAIL_BRANCH' ? '#1e3a2f' : '#3a1e1e',
                        padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
                      }}>
                        {b.location.type}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: b.isLowStock ? '#ef4444' : '#10b981', fontSize: 16 }}>
                      {Number(b.quantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                      {b.variant.reorderLevel != null ? Number(b.variant.reorderLevel).toFixed(2) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.isLowStock ? (
                        <span style={{ background: '#7f1d1d', color: '#fca5a5', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                          ⚠ LOW STOCK
                        </span>
                      ) : (
                        <span style={{ background: '#14532d', color: '#86efac', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                          ✓ OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockLevels;
