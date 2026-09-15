import React, { useState, useEffect } from 'react';
import { apiRequest } from '../../services/api';
import Customer360Page from './Customer360Page';

export default function CRMCustomers({ triggerAlert }: { triggerAlert?: (msg: string, isErr?: boolean) => void }) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('');
  const [rfmFilter, setRfmFilter] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCustomers = async (q = search, h = healthFilter, r = rfmFilter, p = page) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (q.trim()) params.set('search', q.trim());
      if (h) params.set('healthStatus', h);
      if (r) params.set('rfmSegment', r);
      params.set('page', String(p));
      params.set('limit', '15');

      const res = await apiRequest(`/crm/customers?${params.toString()}`);
      setCustomers(res.items || []);
      setTotalPages(res.totalPages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch customer directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [healthFilter, rfmFilter, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearch(q);
    setPage(1);
    fetchCustomers(q, healthFilter, rfmFilter, 1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setHealthFilter('');
    setRfmFilter('');
    setPage(1);
    fetchCustomers('', '', '', 1);
  };

  if (selectedCustomerId) {
    return (
      <Customer360Page
        customerId={selectedCustomerId}
        onBack={() => setSelectedCustomerId(null)}
        triggerAlert={triggerAlert}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Customer Directory & 360 Workspace</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Search, filter, and access 360 intelligence profiles</p>
        </div>
        {(search || healthFilter || rfmFilter) && (
          <button onClick={handleClearFilters} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>
            ✕ Clear Filters
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#94a3b8' }}>
            search
          </span>
          <input
            id="crm-customer-search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search customer by name, phone, or email..."
            style={{ paddingLeft: 38, width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14 }}
          />
        </div>

        <select value={healthFilter} onChange={(e) => { setHealthFilter(e.target.value); setPage(1); }} style={{ width: 180 }}>
          <option value="">All Health Statuses</option>
          <option value="HEALTHY">Healthy</option>
          <option value="AT_RISK">At Risk</option>
          <option value="DORMANT">Dormant</option>
          <option value="CHURNED">Churned</option>
        </select>

        <select value={rfmFilter} onChange={(e) => { setRfmFilter(e.target.value); setPage(1); }} style={{ width: 180 }}>
          <option value="">All RFM Segments</option>
          <option value="CHAMPIONS">Champions</option>
          <option value="LOYAL_CUSTOMERS">Loyal Customers</option>
          <option value="POTENTIAL_LOYALISTS">Potential Loyalists</option>
          <option value="AT_RISK">At Risk</option>
          <option value="HIBERNATING">Hibernating</option>
          <option value="LOST">Lost</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-panel" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: '#ef4444', margin: '0 0 12px' }}>{error}</p>
          <button onClick={() => fetchCustomers()} className="btn-primary" style={{ background: '#2563eb' }}>↻ Retry Search</button>
        </div>
      )}

      {/* Customer List Table */}
      {!error && (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading customer profiles...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Customer Name</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Phone</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Health</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>RFM Segment</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Loyalty Balance</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Lifetime Value</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 32, display: 'block', marginBottom: 8, opacity: 0.5 }}>person_search</span>
                      No customers match your search or filter parameters.
                      {(search || healthFilter || rfmFilter) && (
                        <div style={{ marginTop: 12 }}>
                          <button onClick={handleClearFilters} style={{ padding: '6px 14px', background: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Clear Filters</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : customers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    style={{ borderBottom: '1px solid #e2e8f0', cursor: 'pointer' }}
                  >
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#0f172a' }}>{c.fullName || 'Anonymous'}</div>
                      {c.email && <div style={{ fontSize: 12, color: '#64748b' }}>{c.email}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 14 }}>{c.phone}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: c.healthStatus === 'HEALTHY' ? '#dcfce7' : '#fee2e2', color: c.healthStatus === 'HEALTHY' ? '#166534' : '#991b1b' }}>
                        {c.healthStatus || 'HEALTHY'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: '#b45309' }}>
                      {c.rfmSegment || 'NEW_CUSTOMER'}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#059669' }}>
                      {(c.loyaltyPoints || 0).toLocaleString()} pts
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: '#2563eb' }}>
                      ₹{Number(c.lifetimeValue || 0).toLocaleString('en-IN')}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(c.id); }}
                        style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Open 360 View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination Bar */}
      {!error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#64748b' }}>Page {page} of {totalPages}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
