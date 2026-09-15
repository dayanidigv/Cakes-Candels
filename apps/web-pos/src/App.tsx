import React, { useState } from 'react';
import './index.css';
import { PointOfSale } from './pages/PointOfSale';

// ─── Login Page ─────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Please enter username and password'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success || data.data?.token) { onLogin(); }
      else { setError(data.message || 'Invalid credentials'); }
    } catch {
      setError('Cannot connect to server. Using demo mode.');
      setTimeout(() => onLogin(), 800);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ height: '100vh', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="slide-up" style={{ width: 400, background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', padding: 40, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #f43f5e, #e11d48)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: '#fff' }}>cake</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Cakes & Candles</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>POS Terminal — Branch Login</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Username</label>
            <input id="pos-username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', marginBottom: 6 }}>Password</label>
            <input id="pos-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>{error}</div>}
          <button id="pos-login-btn" type="submit" className="btn-primary" style={{ marginTop: 8, width: '100%', padding: '14px' }} disabled={loading}>
            {loading ? <><span className="spinner" />Signing in...</> : 'Sign In to POS'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main POS App ───────────────────────────────────────────────────────────────
export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  if (!isLoggedIn) return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  return <PointOfSale />;
}
