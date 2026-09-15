import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useOfflineSyncStore } from '../stores/useOfflineSyncStore';

export const POSLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuthStore();
  const { isOnline, queue, isSyncing } = useOfflineSyncStore();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Header */}
      <header style={{
        height: '72px',
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#FFF5F7',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 28 }}>cake</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '24px', letterSpacing: '0.5px', color: 'var(--color-primary)' }}>Cakes & Candles</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--color-primary)' }}>storefront</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user?.branchName || 'Main Branch'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          {/* Offline Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isOnline ? (
              <span className="badge badge-success" style={{ padding: '8px 16px', borderRadius: 24, fontSize: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>wifi</span>
                Online
              </span>
            ) : (
              <span className="badge badge-danger" style={{ padding: '8px 16px', borderRadius: 24, fontSize: 14 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>wifi_off</span>
                Offline
              </span>
            )}
            
            {queue.length > 0 && (
              <span className="badge badge-warning" style={{ padding: '8px 16px', borderRadius: 24, fontSize: 14, animation: isSyncing ? 'pulse 1s infinite' : 'none' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sync</span>
                {queue.length} Pending
              </span>
            )}
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--border)' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 16 }}>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {time.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          <div style={{ width: '1px', height: '32px', background: 'var(--border)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#FFF5F7',
                color: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18
              }}>
                {user?.name?.charAt(0) || 'C'}
              </div>
              <span style={{ fontWeight: 600, fontSize: 16 }}>{user?.name || 'Cashier'}</span>
            </div>
            
            <button 
              className="btn-ghost" 
              onClick={logout}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: 24, color: 'var(--color-danger)', borderColor: '#fee2e2', background: '#fef2f2', fontWeight: 600 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>logout</span>
              Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
        {children}
      </main>

      {/* Decorative Footer */}
      <footer style={{
        height: '80px',
        background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 1440 320\'%3E%3Cpath fill=\'%23f9a8d4\' fill-opacity=\'1\' d=\'M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,197.3C672,192,768,160,864,154.7C960,149,1056,171,1152,176C1248,181,1344,171,1392,165.3L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z\'%3E%3C/path%3E%3C/svg%3E")',
        backgroundSize: 'cover',
        backgroundPosition: 'bottom',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>favorite</span>
          <span style={{ fontFamily: '"Brush Script MT", cursive', fontSize: 24, fontStyle: 'italic', fontWeight: 500 }}>Baked with love, lit with joy.</span>
        </div>
      </footer>
    </div>
  );
};
