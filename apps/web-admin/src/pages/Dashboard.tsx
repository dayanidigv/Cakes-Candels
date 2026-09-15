// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// Mock data is now fetched from the API

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await apiRequest('/dashboard/overview');
        setData(response);
      } catch (err) {
        console.error('Failed to fetch dashboard', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div style={{ padding: '40px' }}><LoadingState message="Loading Dashboard..." /></div>;
  if (!data) return <div style={{ padding: '40px' }}><ErrorState message="Failed to load dashboard data." /></div>;

  const { metrics, recentRecipes, topSuppliers, activeVehicles, workflows, numberSeries, activityLog, sparklineData, attributeData, pieData } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--color-text-primary)' }}>ERP Dashboard</h1>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '6px 12px', background: 'var(--bg-surface)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-text-muted)', marginRight: '8px' }}>calendar_today</span>
            <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Last 30 Days</span>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-text-muted)', marginLeft: '8px' }}>expand_more</span>
            <span style={{ color: 'var(--color-text-muted)', fontSize: '14px', marginLeft: '12px', borderLeft: '1px solid var(--color-border)', paddingLeft: '12px' }}>vs. Prev. 30 Days</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '6px 12px', background: 'var(--bg-surface)', width: '280px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-text-muted)', marginRight: '8px' }}>search</span>
            <input type="text" placeholder="Search records, modules, or people..." style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px' }} />
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Master Data Overview</h2>
      
      {/* Top Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
        
        {/* RECIPES CARD */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
              <span className="material-symbols-outlined">menu_book</span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Recipes</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginTop: '4px' }}>{metrics.recipes}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>Total Recipes</div>
            </div>
            <div style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>+3%</div>
          </div>
          <div style={{ height: '60px', marginTop: '16px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line type="monotone" dataKey="v" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentRecipes.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img src={r.img} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{r.action}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>chevron_right</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '16px', textAlign: 'right', fontSize: '12px', color: 'var(--color-text-muted)', cursor: 'pointer' }}>All recipes &rarr;</div>
        </div>

        {/* SUPPLIERS CARD */}
        <div className="glass-panel" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                <span className="material-symbols-outlined">local_shipping</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Suppliers</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginTop: '4px' }}>{metrics.suppliers}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>Active</div>
              </div>
            </div>
          </div>
          
          {/* Fake Map */}
          <div style={{ position: 'relative', height: '120px', background: '#e2e8f0', backgroundImage: 'url("https://www.transparenttextures.com/patterns/cubes.png")', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ position: 'absolute', top: '8px', left: '8px', right: '8px', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--shadow-sm)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--color-text-muted)' }}>search</span>
              <input type="text" placeholder="Search map" style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%' }} />
            </div>
            {/* Map markers mock */}
            <span className="material-symbols-outlined" style={{ position: 'absolute', top: '50px', left: '40px', color: '#ef4444' }}>location_on</span>
            <span className="material-symbols-outlined" style={{ position: 'absolute', top: '80px', left: '140px', color: '#3b82f6' }}>location_on</span>
            <span className="material-symbols-outlined" style={{ position: 'absolute', top: '40px', left: '200px', color: '#f59e0b' }}>location_on</span>
          </div>

          <div style={{ padding: '16px 20px', flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px' }}>Top Performing Suppliers</div>
            {topSuppliers.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                <span>{s.name}</span>
                <span style={{ fontWeight: 600 }}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COL 3 & 4 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* VEHICLES */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ffedd5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ea580c' }}>
                <span className="material-symbols-outlined">directions_car</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Active Vehicles</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', marginTop: '2px' }}>In-Service Vehicles</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Trucks</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>20</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Vans</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>12</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Total</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{metrics.vehicles}</div>
              </div>
            </div>
            <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)' }}>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Current Location</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Driver</th>
                  <th style={{ padding: '6px 8px', fontWeight: 600 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {activeVehicles.map((v, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px' }}>{v.loc}</td>
                    <td style={{ padding: '8px' }}>{v.driver}</td>
                    <td style={{ padding: '8px' }}><button style={{ background: 'transparent', border: '1px solid #94a3b8', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#0f172a', cursor: 'pointer' }}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* WORKFLOWS */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777' }}>
                <span className="material-symbols-outlined">account_tree</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Workflows</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginTop: '4px' }}>{metrics.workflows}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>3 In Progress</div>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700 }}>3</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workflows.map((w, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', borderTop: i > 0 ? '1px solid var(--color-border)' : 'none', paddingTop: i > 0 ? '12px' : 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{w.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img src={w.img} alt="" style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Status<br/><span style={{ color: 'var(--color-text-primary)' }}>{w.stat}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* PRODUCT ATTRIBUTES */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
                <span className="material-symbols-outlined">tune</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Product Attributes</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginTop: '4px' }}>{metrics.attributes}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>Attribute Sets</div>
              </div>
            </div>
            <div style={{ height: '80px', marginBottom: '16px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attributeData}>
                  <Bar dataKey="a" stackId="a" fill="#0ea5e9" />
                  <Bar dataKey="b" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="c" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-primary)' }}>
              <span>Top Used Attribute Types</span><span style={{ fontWeight: 600 }}>20</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-primary)' }}>
              <span>Attribute Types</span><span style={{ fontWeight: 600 }}>12</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-text-primary)' }}>
              <span>Attribute Types</span><span style={{ fontWeight: 600 }}>4</span>
            </div>
          </div>

          {/* NUMBER SERIES */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                <span className="material-symbols-outlined">pin</span>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Number Series</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1, marginTop: '4px' }}>{metrics.numberSeries}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-primary)' }}>Configs</div>
              </div>
            </div>
            <table style={{ width: '100%', fontSize: '11px', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-app)', color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '4px' }}>Current Available Range</th>
                  <th style={{ padding: '4px' }}>Status</th>
                  <th style={{ padding: '4px' }}>Last Used</th>
                </tr>
              </thead>
              <tbody>
                {numberSeries.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '6px 4px', fontWeight: 500 }}>{s.name} <span style={{ color: 'var(--color-text-muted)' }}>{s.range}</span></td>
                    <td style={{ padding: '6px 4px' }}>{s.stat}</td>
                    <td style={{ padding: '6px 4px' }}>{s.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        
        {/* RECENT ACTIVITY LOG */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Recent Activity Log</h3>
          <table style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-app)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, borderRadius: '6px 0 0 6px' }}>User</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Action</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Target Entity</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, borderRadius: '0 6px 6px 0' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.map((log, i) => (
                <tr key={i} style={{ borderBottom: i < activityLog.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={log.img} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
                    <span style={{ fontWeight: 600 }}>{log.user}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>{log.action}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.target}</td>
                  <td style={{ padding: '12px 16px', color: '#2563eb' }}>{log.time} Target I...</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* WORKFLOW STATUS OVERVIEW */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px' }}>Workflow Status Overview</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '160px' }}>
            <div style={{ width: '160px', height: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pieData.map((entry, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 500 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }}></div>
                  {entry.name}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
