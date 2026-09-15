import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { useCartStore } from '../stores/useCartStore';
import { api } from '../services/api';

export function CheckoutPage() {
  const { items, subtotal, updateQuantity, removeItem, clearCart, customer } = useCartStore();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [form, setForm] = useState({
    name: customer?.fullName || '',
    phone: customer?.phone || '',
    address: '',
    paymentMode: 'UPI'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const payload = {
        idempotencyKey: `WEB-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        branchId: '10f75d9e-75ad-4b13-92ea-be9dbaf958b5', // Default branch for MVP
        paymentMode: form.paymentMode,
        items: items.map(i => ({
          variantId: i.variantId || i.productId,
          quantity: i.quantity,
        }))
      };
      
      const result = await api.createOrder(payload);
      
      setSuccess(`Order placed successfully! Reference: ${result.order?.orderNumber}`);
      clearCart();
    } catch (err: any) {
      setError(err.message || 'Failed to place order.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container" style={{ padding: '100px 20px', minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ fontSize: 64, color: 'var(--color-success)', marginBottom: 24 }}>🎂</div>
        <h2 style={{ fontSize: 32, marginBottom: 16 }}>{success}</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Thank you for ordering from Cakes & Candles. Your delicious treats will be on their way soon!</p>
        <button className="btn btn-primary" onClick={() => navigate('/products')}>Continue Shopping</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '60px 20px', minHeight: '60vh' }}>
      <h1 style={{ fontSize: 36, fontWeight: 800, marginBottom: 40 }}>Checkout</h1>
      
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Your cart is empty.</p>
          <button className="btn btn-primary" onClick={() => navigate('/products')}>Browse Cakes</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
          
          {/* Left: Cart Items */}
          <div style={{ flex: '1 1 500px' }}>
            <h3 style={{ marginBottom: 20 }}>Order Summary</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: 16, border: '1px solid var(--border-light)', padding: 16, borderRadius: 12 }}>
                  <div style={{ width: 80, height: 80, background: 'var(--bg-muted)', borderRadius: 8, overflow: 'hidden' }}>
                    {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ fontSize: 32, textAlign: 'center', lineHeight: '80px', opacity: 0.2 }}>🎂</div>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.name}</div>
                    <div style={{ color: 'var(--color-primary)', fontWeight: 700, marginTop: 4 }}>₹{item.price}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: 6, overflow: 'hidden' }}>
                        <button onClick={() => updateQuantity(item.id, item.quantity - 1)} style={{ padding: '4px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}>-</button>
                        <span style={{ padding: '4px 12px', background: 'var(--bg-muted)', fontSize: 14 }}>{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '4px 12px', background: 'transparent', border: 'none', cursor: 'pointer' }}>+</button>
                      </div>
                      <button onClick={() => removeItem(item.id)} style={{ padding: 8, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    ₹{item.price * item.quantity}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Checkout Form */}
          <div style={{ flex: '1 1 300px', background: 'var(--bg-card)', border: '1px solid var(--border-light)', padding: 32, borderRadius: 12, height: 'fit-content' }}>
            <h3 style={{ marginBottom: 24 }}>Delivery Details</h3>
            
            {error && <div style={{ background: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Full Name</label>
                <input required name="name" value={form.name} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)' }} placeholder="John Doe" />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Phone Number</label>
                <input required name="phone" value={form.phone} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)' }} placeholder="+91 9876543210" />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Delivery Address</label>
                <textarea required name="address" value={form.address} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)', minHeight: 80, resize: 'vertical' }} placeholder="123 Bakery Lane, Sweet City" />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Payment Method</label>
                <select required name="paymentMode" value={form.paymentMode} onChange={handleChange} style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-light)', background: '#fff' }}>
                  <option value="UPI">UPI</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="COD">Cash on Delivery</option>
                </select>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 16, paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>₹{subtotal().toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 800, marginTop: 16 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--color-primary)' }}>₹{subtotal().toFixed(2)}</span>
                </div>
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ marginTop: 16, padding: 16, fontSize: 16 }} disabled={loading}>
                {loading ? 'Processing...' : 'Place Order'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
