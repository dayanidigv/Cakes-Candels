import React, { useState, useEffect } from 'react';
import { useOfflineSyncStore } from '../../stores/useOfflineSyncStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface CheckoutModalProps {
  total: number;
  items: any[];
  onClose: () => void;
  onSuccess: (method: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ total, items, onClose, onSuccess }) => {
  const [step, setStep] = useState<'SELECT' | 'CASH_INPUT' | 'UPI_WAITING' | 'CARD_WAITING' | 'PROCESSING'>('SELECT');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  
  const { enqueue } = useOfflineSyncStore();
  const { user } = useAuthStore();

  const handleCheckout = async (method: string) => {
    setStep('PROCESSING');
    
    const payload = {
      idempotencyKey: crypto.randomUUID(),
      branchId: user?.branchId || 'default-branch',
      paymentMode: method,
      items: items.map(item => ({
        variantId: item.id,
        quantity: item.quantity
      }))
    };

    // Fast enqueue (if offline it just queues, if online it auto-syncs)
    enqueue(payload);
    
    // Simulate processing for premium UX
    setTimeout(() => {
      onSuccess(method);
    }, 1500);
  };

  const handleCashDenomination = (amount: number) => {
    setCashReceived(amount);
  };

  // Mock UPI/Card success after delay
  useEffect(() => {
    if (step === 'UPI_WAITING' || step === 'CARD_WAITING') {
      const timer = setTimeout(() => {
        handleCheckout(step === 'UPI_WAITING' ? 'UPI' : 'CARD');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease'
    }}>
      <div className="slide-up" style={{
        background: '#FFFFFF',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '540px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '400px'
      }}>
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {step === 'SELECT' ? (
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Payment</h2>
          ) : (
            <button 
              onClick={() => step === 'PROCESSING' ? null : setStep('SELECT')} 
              style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              disabled={step === 'PROCESSING'}
            >
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </button>
          )}
          <button onClick={onClose} disabled={step === 'PROCESSING'} style={{ background: '#F8FAFC', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: step === 'PROCESSING' ? 'not-allowed' : 'pointer' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column' }}>
          
          {step === 'SELECT' && (
            <div className="fade-in">
              <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: '8px' }}>TOTAL PAYABLE</div>
                <div style={{ fontSize: '56px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-2px', lineHeight: 1 }}>
                  ₹{total.toFixed(2)}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => setStep('CASH_INPUT')}
                  style={{ padding: '24px', background: '#FFF0F5', border: '2px solid #FCE7F3', borderRadius: '16px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>payments</span>
                  CASH
                </button>
                <button
                  onClick={() => setStep('UPI_WAITING')}
                  style={{ padding: '24px', background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: '16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>qr_code_scanner</span>
                  UPI
                </button>
                <button
                  onClick={() => setStep('CARD_WAITING')}
                  style={{ padding: '24px', background: '#F8FAFC', border: '2px solid #E2E8F0', borderRadius: '16px', color: 'var(--text-primary)', fontWeight: 700, fontSize: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', transition: 'all 0.2s' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>credit_card</span>
                  CARD
                </button>
                <button
                  style={{ padding: '24px', background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: '16px', color: 'var(--text-muted)', fontWeight: 700, fontSize: '16px', cursor: 'not-allowed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>call_split</span>
                  MIXED
                </button>
              </div>
            </div>
          )}

          {step === 'CASH_INPUT' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 24, borderBottom: '1px dashed #E2E8F0' }}>
                <div style={{ fontSize: 16, color: 'var(--text-secondary)', fontWeight: 600 }}>Amount Due</div>
                <div style={{ fontSize: 24, color: 'var(--text-primary)', fontWeight: 800 }}>₹{total.toFixed(2)}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
                <button onClick={() => handleCashDenomination(500)} className="btn-ghost" style={{ padding: '12px 0', border: '1px solid #E2E8F0' }}>₹500</button>
                <button onClick={() => handleCashDenomination(1000)} className="btn-ghost" style={{ padding: '12px 0', border: '1px solid #E2E8F0' }}>₹1000</button>
                <button onClick={() => handleCashDenomination(2000)} className="btn-ghost" style={{ padding: '12px 0', border: '1px solid #E2E8F0' }}>₹2000</button>
                <button onClick={() => handleCashDenomination(total)} className="btn-ghost" style={{ padding: '12px 0', border: '1px solid var(--color-primary)', color: 'var(--color-primary)', background: '#FFF0F5' }}>Exact</button>
              </div>

              <div style={{ position: 'relative', marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>CASH RECEIVED</label>
                <span style={{ position: 'absolute', left: 16, top: 40, color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 }}>₹</span>
                <input 
                  type="number" 
                  value={cashReceived} 
                  onChange={e => setCashReceived(Number(e.target.value))}
                  style={{ width: '100%', padding: '16px 16px 16px 40px', fontSize: 24, fontWeight: 700, borderRadius: '12px', border: '2px solid #E2E8F0', background: '#F8FAFC' }} 
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'auto', padding: '16px', background: '#F8FAFC', borderRadius: '12px' }}>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 600 }}>Change to give:</div>
                <div style={{ fontSize: 24, color: Number(cashReceived) >= total ? '#10B981' : 'var(--text-muted)', fontWeight: 800 }}>
                  ₹{Number(cashReceived) >= total ? (Number(cashReceived) - total).toFixed(2) : '0.00'}
                </div>
              </div>

              <button 
                className="btn-primary" 
                onClick={() => handleCheckout('CASH')}
                disabled={Number(cashReceived) < total}
                style={{ width: '100%', padding: '20px', fontSize: '18px', borderRadius: '16px', marginTop: 24, boxShadow: 'var(--shadow-md)' }}
              >
                CONFIRM CASH PAYMENT
              </button>
            </div>
          )}

          {step === 'UPI_WAITING' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
              <div style={{ width: 120, height: 120, border: '4px solid #E2E8F0', borderRadius: '16px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--text-muted)' }}>qr_code_2</span>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>₹{total.toFixed(2)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 16 }}>
                <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,13,143,0.2)', borderTopColor: 'var(--color-primary)' }} />
                Waiting for UPI payment...
              </div>
            </div>
          )}

          {step === 'CARD_WAITING' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
              <div style={{ width: 120, height: 120, borderRadius: '50%', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8FAFC' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 64, color: 'var(--text-muted)' }}>contactless</span>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>₹{total.toFixed(2)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)', fontWeight: 600, fontSize: 16 }}>
                <div className="spinner" style={{ width: 16, height: 16, border: '2px solid rgba(255,13,143,0.2)', borderTopColor: 'var(--color-primary)' }} />
                Waiting for card terminal...
              </div>
            </div>
          )}

          {step === 'PROCESSING' && (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' }}>
              <div className="spinner" style={{ width: 64, height: 64, border: '4px solid rgba(255,13,143,0.2)', borderTopColor: 'var(--color-primary)', marginBottom: 24 }} />
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Processing Payment...</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Please do not close this window.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
