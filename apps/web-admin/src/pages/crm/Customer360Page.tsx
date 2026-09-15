import React, { useState } from 'react';
import { apiRequest } from '../../services/api';

export default function Customer360Page({ customerId, onBack, triggerAlert }: { customerId: string; onBack: () => void; triggerAlert?: (msg: string, isErr?: boolean) => void }) {
  const [c360, setC360] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'customcakes' | 'loyalty' | 'activities' | 'segments'>('overview');

  // Modals state
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [activityType, setActivityType] = useState('CALL');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  const [showRedeemLoyalty, setShowRedeemLoyalty] = useState(false);
  const [redeemPoints, setRedeemPoints] = useState(50);

  const fetchC360 = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest(`/crm/customers/${customerId}/360`);
      setC360(res);
    } catch (err: any) {
      const errMsg = err?.message || 'Failed to load Customer 360 profile';
      setError(errMsg);
      if (triggerAlert) triggerAlert(errMsg, true);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchC360();
  }, [customerId]);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || submitting) return;
    try {
      setSubmitting(true);
      await apiRequest(`/crm/customers/${customerId}/activities`, 'POST', { activityType, subject: subject.trim(), description: description.trim() });
      if (triggerAlert) triggerAlert('Activity logged successfully!');
      setShowLogActivity(false);
      setSubject('');
      setDescription('');
      fetchC360();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to log activity', true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemLoyalty = async (e: React.FormEvent) => {
    e.preventDefault();
    const available = c360?.profile?.ledgerPointsBalance || 0;
    if (redeemPoints <= 0 || redeemPoints > available) {
      if (triggerAlert) triggerAlert(`Please enter a point value between 1 and ${available}`, true);
      return;
    }
    if (submitting) return;

    try {
      setSubmitting(true);
      await apiRequest(`/crm/loyalty/redeem`, 'POST', { customerId, points: Number(redeemPoints) });
      if (triggerAlert) triggerAlert(`Redeemed ${redeemPoints} loyalty points successfully!`);
      setShowRedeemLoyalty(false);
      fetchC360();
    } catch (err: any) {
      if (triggerAlert) triggerAlert(err.message || 'Failed to redeem points', true);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ height: 40, width: 200, background: '#e2e8f0', borderRadius: 6, animation: 'pulse 1.5s infinite ease-in-out' }} />
        <div className="glass-panel" style={{ height: 140, background: '#f8fafc' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel" style={{ height: 90, background: '#f1f5f9' }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !c360) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <h3 style={{ color: '#ef4444', margin: '0 0 8px', fontSize: 18 }}>Unable to load Customer 360 Profile</h3>
        <p style={{ color: '#64748b', margin: '0 0 16px', fontSize: 14 }}>{error || 'Customer profile not found or access restricted by branch permissions.'}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onBack} style={{ padding: '8px 16px', background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}>Back to Directory</button>
          <button onClick={fetchC360} className="btn-primary" style={{ background: '#2563eb' }}>↻ Retry Loading</button>
        </div>
      </div>
    );
  }

  const { profile, intelligence, addresses, segments, recentSalesOrders, customCakes, loyaltyLedger, activityTimeline } = c360;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #cbd5e1', borderRadius: 6, padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          ← Back to Customer Directory
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowLogActivity(true)} className="btn-primary" style={{ background: '#2563eb' }}>
            + Log Activity
          </button>
          <button onClick={() => setShowRedeemLoyalty(true)} className="btn-primary" style={{ background: '#b45309' }}>
            ⭐ Redeem Points
          </button>
        </div>
      </div>

      {/* Customer Header Card */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 26, fontWeight: 700 }}>
              {(profile.fullName || 'C')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{profile.fullName || 'Anonymous Customer'}</h2>
                <span style={{ padding: '4px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: intelligence?.healthStatus === 'HEALTHY' ? '#dcfce7' : '#fee2e2', color: intelligence?.healthStatus === 'HEALTHY' ? '#166534' : '#991b1b' }}>
                  {intelligence?.healthStatus || 'HEALTHY'}
                </span>
              </div>
              <div style={{ fontSize: 14, color: '#64748b', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span>📞 {profile.phone}</span>
                {profile.email && <span>✉️ {profile.email}</span>}
                <span>📅 Customer since: {new Date(profile.createdAt).toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {segments?.map((seg: any) => (
              <span key={seg.id} style={{ padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>
                {seg.code}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Intelligence Metric Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div className="glass-panel" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>RFM Score & Segment</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#d97706', marginTop: 6 }}>
            {intelligence?.rfm?.recency || 1}-{intelligence?.rfm?.frequency || 1}-{intelligence?.rfm?.monetary || 1}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#b45309', marginTop: 2 }}>
            {intelligence?.rfm?.segment || 'NEW_CUSTOMER'}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Customer Health Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: (intelligence?.healthScore ?? 100) >= 80 ? '#10b981' : '#ef4444', marginTop: 6 }}>
            {intelligence?.healthScore ?? 100} / 100
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Status: {intelligence?.healthStatus}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Customer Lifetime Value</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2563eb', marginTop: 6 }}>
            ₹{Number(intelligence?.lifetimeValue || 0).toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Total Orders: {intelligence?.totalOrdersCount || 0}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Loyalty Ledger Balance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#059669', marginTop: 6 }}>
            {(profile.ledgerPointsBalance || 0).toLocaleString()} pts
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            Profile Points: {profile.loyaltyPoints || 0}
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div style={{ borderBottom: '2px solid #e2e8f0', display: 'flex', gap: 24, overflowX: 'auto' }}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'orders', label: `Sales Orders (${recentSalesOrders?.length || 0})` },
          { id: 'customcakes', label: `Custom Cakes (${customCakes?.length || 0})` },
          { id: 'loyalty', label: `Loyalty Ledger (${loyaltyLedger?.length || 0})` },
          { id: 'activities', label: `Activity Timeline (${activityTimeline?.length || 0})` },
          { id: 'segments', label: `Segments (${segments?.length || 0})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            style={{
              padding: '12px 4px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === t.id ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab === t.id ? '#2563eb' : '#64748b',
              fontWeight: activeTab === t.id ? 700 : 500,
              fontSize: 14,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="glass-panel" style={{ padding: 24 }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Profile & Personal Details</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                <div><strong>Full Name:</strong> {profile.fullName}</div>
                <div><strong>Phone Number:</strong> {profile.phone}</div>
                <div><strong>Email:</strong> {profile.email || '—'}</div>
                <div><strong>Customer Type:</strong> {profile.customerType || 'RETAIL'}</div>
                <div><strong>Birthday:</strong> {profile.birthday ? new Date(profile.birthday).toLocaleDateString('en-IN') : '—'}</div>
                <div><strong>Anniversary:</strong> {profile.anniversary ? new Date(profile.anniversary).toLocaleDateString('en-IN') : '—'}</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Saved Delivery Addresses</h3>
              {(!addresses || addresses.length === 0) ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: 8 }}>
                  No saved delivery addresses recorded
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {addresses.map((addr: any) => (
                    <div key={addr.id} style={{ padding: 12, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{addr.label} {addr.isDefault && <span style={{ color: '#2563eb' }}>(Default)</span>}</div>
                      <div style={{ color: '#64748b', marginTop: 4 }}>{addr.address}, {addr.city}, {addr.state} - {addr.pincode}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Commercial Sales Orders</h3>
            {(!recentSalesOrders || recentSalesOrders.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}>shopping_bag</span>
                No commercial sales orders placed by this customer yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Order #</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Grand Total</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSalesOrders.map((so: any) => (
                      <tr key={so.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, fontFamily: 'monospace' }}>{so.orderNumber}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>₹{Number(so.grandTotal).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: so.status === 'COMPLETED' ? '#dcfce7' : '#fef3c7', color: so.status === 'COMPLETED' ? '#166534' : '#92400e' }}>
                            {so.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>{new Date(so.createdAt).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'customcakes' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Custom Cake Domain Orders</h3>
            {(!customCakes || customCakes.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}>cake</span>
                No custom cake orders recorded for this customer yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Flavour & Spec</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Weight</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Quote Amount</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Scheduled Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customCakes.map((cc: any) => (
                      <tr key={cc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>🎂 {cc.flavour}</td>
                        <td style={{ padding: '12px 14px' }}>{cc.weight} kg</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600 }}>₹{Number(cc.quoteAmount || 0).toLocaleString('en-IN')}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#e0e7ff', color: '#3730a3' }}>
                            {cc.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>
                          {cc.scheduledAt ? new Date(cc.scheduledAt).toLocaleDateString('en-IN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Immutable Loyalty Transaction Ledger</h3>
            {(!loyaltyLedger || loyaltyLedger.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}>star</span>
                No loyalty ledger transactions recorded yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Type</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Points</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Notes</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12 }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loyaltyLedger.map((tx: any) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: tx.points > 0 ? '#dcfce7' : '#fee2e2', color: tx.points > 0 ? '#166534' : '#991b1b' }}>
                            {tx.type}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, color: tx.points > 0 ? '#10b981' : '#ef4444' }}>
                          {tx.points > 0 ? `+${tx.points}` : tx.points}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>{tx.notes || '—'}</td>
                        <td style={{ padding: '12px 14px', color: '#64748b', fontSize: 13 }}>{new Date(tx.createdAt).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activities' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>CRM Interaction Timeline</h3>
              <button onClick={() => setShowLogActivity(true)} className="btn-primary" style={{ background: '#2563eb', padding: '6px 16px', fontSize: 13 }}>+ Log Activity</button>
            </div>
            {(!activityTimeline || activityTimeline.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 36, display: 'block', marginBottom: 8, opacity: 0.5 }}>forum</span>
                No CRM interactions logged. Click <strong>+ Log Activity</strong> to record calls, notes, or complaints.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {activityTimeline.map((act: any) => (
                  <div key={act.id} style={{ padding: 14, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{act.subject}</div>
                      <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: act.activityType === 'COMPLAINT' ? '#fee2e2' : '#e0e7ff', color: act.activityType === 'COMPLAINT' ? '#991b1b' : '#3730a3' }}>
                        {act.activityType}
                      </span>
                    </div>
                    {act.description && <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{act.description}</div>}
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>{new Date(act.createdAt).toLocaleString('en-IN')}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'segments' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Dynamic Assigned Segment Tags</h3>
            {(!segments || segments.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>No segment tags currently assigned to this customer</div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {segments.map((seg: any) => (
                  <div key={seg.id} style={{ padding: '12px 20px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                    <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 15 }}>{seg.name}</div>
                    <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2, fontFamily: 'monospace' }}>{seg.code}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log Activity Modal */}
      {showLogActivity && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: 450, padding: 24, background: '#fff' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Log CRM Customer Activity</h3>
            <form onSubmit={handleCreateActivity} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Activity Type</label>
                <select value={activityType} onChange={(e) => setActivityType(e.target.value)} disabled={submitting}>
                  <option value="CALL">Call</option>
                  <option value="NOTE">Note</option>
                  <option value="EMAIL">Email</option>
                  <option value="WHATSAPP">WhatsApp</option>
                  <option value="COMPLAINT">Complaint</option>
                  <option value="FEEDBACK">Feedback</option>
                </select>
              </div>

              <div>
                <label>Subject *</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} required placeholder="e.g. Birthday cake inquiry" disabled={submitting} />
              </div>

              <div>
                <label>Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }} placeholder="Customer notes..." disabled={submitting} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowLogActivity(false)} disabled={submitting} style={{ padding: '8px 16px', background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ background: '#2563eb', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Saving...' : 'Save Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redeem Loyalty Modal */}
      {showRedeemLoyalty && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: 400, padding: 24, background: '#fff' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Redeem Loyalty Points</h3>
            <form onSubmit={handleRedeemLoyalty} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Points to Redeem (Available Ledger Balance: {profile.ledgerPointsBalance || 0})</label>
                <input type="number" min={1} max={profile.ledgerPointsBalance || 9999} value={redeemPoints} onChange={(e) => setRedeemPoints(Number(e.target.value))} required disabled={submitting} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button type="button" onClick={() => setShowRedeemLoyalty(false)} disabled={submitting} style={{ padding: '8px 16px', background: 'none', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ background: '#b45309', opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Processing...' : 'Confirm Redemption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
