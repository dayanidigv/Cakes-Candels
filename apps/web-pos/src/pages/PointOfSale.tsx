import React, { useState, useEffect, useRef } from 'react';
import { POSLayout } from '../layouts/POSLayout';
import { ProductCard } from '../components/catalog/ProductCard';
import { CartItem } from '../components/cart/CartItem';
import { CheckoutModal } from '../components/modals/CheckoutModal';
import { useCartStore } from '../stores/useCartStore';
import { getProducts, getCategories, getCustomerByPhone } from '../services/api';

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts, remove }: { toasts: any[]; remove: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type} fade-in`} onClick={() => remove(t.id)} style={{ cursor: 'pointer' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: t.type === 'success' ? 'var(--color-success)' : t.type === 'error' ? 'var(--color-danger)' : 'var(--color-warning)' }}>
            {t.type === 'success' ? 'check_circle' : t.type === 'error' ? 'error' : 'warning'}
          </span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
            {t.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{t.message}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Success Modal ──────────────────────────────────────────────────────────────
function SuccessModal({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
      <div className="slide-up" style={{ background: '#FFFFFF', borderRadius: '24px', padding: 48, maxWidth: 440, width: '90%', boxShadow: '0 24px 48px rgba(0,0,0,0.1)', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E6FFF8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--color-success)' }}>check_circle</span>
        </div>
        
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 16px 0', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Sale Completed</h2>
        
        <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: '16px', padding: '24px', marginBottom: '32px' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>INVOICE</div>
          <div style={{ fontFamily: 'monospace', fontSize: 20, color: 'var(--color-primary)', fontWeight: 700, marginBottom: 16 }}>
            {invoice?.invoiceNumber || 'CC-MBR-2026-000123'}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, textAlign: 'left', borderTop: '1px solid #E2E8F0', paddingTop: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Amount Paid</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>₹{invoice?.amount?.toFixed(2) || '0.00'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Method</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{invoice?.paymentMethod || 'UPI'}</div>
            </div>
          </div>
        </div>

        {invoice?.loyaltyPointsEarned > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#D97706', background: '#FFFBEB', padding: '12px', borderRadius: '12px', fontWeight: 600, marginBottom: 32 }}>
            <span className="material-symbols-outlined">star</span>
            {invoice.customerName || 'Customer'} earned {invoice.loyaltyPointsEarned} points!
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-ghost" style={{ flex: 1, padding: 16, borderRadius: 12, border: '2px solid #E2E8F0' }}>
            PRINT
          </button>
          <button id="new-sale-btn" className="btn-primary" onClick={onClose} style={{ flex: 2, padding: 16, borderRadius: 12, fontSize: 16, fontWeight: 700 }}>
            NEW SALE
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Discount Modal ─────────────────────────────────────────────────────────────
function DiscountModal({ onClose }: { onClose: () => void }) {
  const { applyDiscount, items } = useCartStore();
  const [discountType, setDiscountType] = useState<'PERCENT' | 'AMOUNT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number | ''>('');
  const [selectedItem, setSelectedItem] = useState<string>('ALL');
  const [needsApproval, setNeedsApproval] = useState(false);

  const handleApply = () => {
    const val = Number(discountValue);
    if (!val || val <= 0) return;

    if (discountType === 'PERCENT' && val > 10) {
      setNeedsApproval(true);
      return;
    }

    if (selectedItem === 'ALL') {
      items.forEach(item => {
        const itemDiscount = discountType === 'PERCENT' ? (item.price * item.quantity * val) / 100 : val / items.length;
        applyDiscount(item.id, itemDiscount);
      });
    } else {
      const item = items.find(i => i.id === selectedItem);
      if (item) {
        const itemDiscount = discountType === 'PERCENT' ? (item.price * item.quantity * val) / 100 : val;
        applyDiscount(item.id, itemDiscount);
      }
    }
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 1000 }}>
      <div className="slide-up" style={{ background: '#FFFFFF', width: '400px', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Apply Discount</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>DISCOUNT TYPE</label>
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <button onClick={() => setDiscountType('PERCENT')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${discountType === 'PERCENT' ? 'var(--color-primary)' : '#E2E8F0'}`, background: discountType === 'PERCENT' ? '#FFF0F5' : '#FFFFFF', color: discountType === 'PERCENT' ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Percentage (%)</button>
            <button onClick={() => setDiscountType('AMOUNT')} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: `2px solid ${discountType === 'AMOUNT' ? 'var(--color-primary)' : '#E2E8F0'}`, background: discountType === 'AMOUNT' ? '#FFF0F5' : '#FFFFFF', color: discountType === 'AMOUNT' ? 'var(--color-primary)' : 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer' }}>Amount (₹)</button>
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>VALUE</label>
          <div style={{ position: 'relative', marginBottom: 24 }}>
            <span style={{ position: 'absolute', left: 16, top: 14, color: 'var(--text-muted)', fontWeight: 600 }}>{discountType === 'PERCENT' ? '%' : '₹'}</span>
            <input 
              type="number" 
              value={discountValue} 
              onChange={e => { setDiscountValue(Number(e.target.value)); setNeedsApproval(false); }}
              style={{ width: '100%', padding: '14px 16px 14px 40px', fontSize: 16, borderRadius: '8px', border: '1px solid #E2E8F0' }} 
              placeholder="0"
            />
          </div>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>APPLY TO</label>
          <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} style={{ width: '100%', padding: '14px 16px', fontSize: 14, borderRadius: '8px', border: '1px solid #E2E8F0', marginBottom: 24, background: '#FFFFFF' }}>
            <option value="ALL">Entire Cart</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>

          {needsApproval && (
            <div className="fade-in" style={{ padding: 16, background: '#FFFBEB', border: '1px solid #FEF3C7', borderRadius: '8px', marginBottom: 24, display: 'flex', gap: 12 }}>
              <span className="material-symbols-outlined" style={{ color: '#F59E0B' }}>warning</span>
              <div>
                <div style={{ fontWeight: 700, color: '#B45309', fontSize: 14 }}>Manager Approval Required</div>
                <div style={{ fontSize: 13, color: '#D97706', marginTop: 4 }}>Discounts above 10% require authorization.</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid #F1F5F9' }}>
          {needsApproval ? (
            <button className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '8px', background: '#F59E0B' }}>Request Authorization</button>
          ) : (
            <button className="btn-primary" onClick={handleApply} style={{ width: '100%', padding: '16px', borderRadius: '8px' }}>Apply Discount</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Customer Panel ─────────────────────────────────────────────────────────────
function CustomerPanel() {
  const { customer, setCustomer, setLoyaltyRedemption, loyaltyRedemption } = useCartStore();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');

  const lookup = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    setShowNew(false);
    try {
      const data = await getCustomerByPhone(phone);
      if (data) {
        // Mocking advanced data if missing
        if (!data.lastPurchaseDate) data.lastPurchaseDate = new Date().toISOString();
        if (data.totalSpent === undefined) data.totalSpent = Math.floor(Math.random() * 5000);
        setCustomer(data);
      } else {
        setCustomer(null);
        setShowNew(true);
      }
    } catch { 
      setCustomer(null); 
      setShowNew(true);
    }
    finally { setLoading(false); }
  };

  const handleRegister = () => {
    // Optimistically register and set customer
    if (!newName) return;
    const newCust = {
      id: `cust-${Date.now()}`,
      phone,
      fullName: newName,
      segment: 'BRONZE',
      loyaltyPoints: 0,
      totalSpent: 0
    };
    setCustomer(newCust);
    setShowNew(false);
  };

  const segmentColor: Record<string, string> = { VIP: '#fbbf24', GOLD: '#d97706', SILVER: '#94a3b8', BRONZE: '#b45309' };

  return (
    <div style={{ background: '#FFFFFF' }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>CUSTOMER</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: '12px', top: '10px', color: '#CBD5E1', fontSize: '20px' }}>call</span>
          <input
            id="customer-phone"
            type="tel"
            value={phone}
            onChange={e => { setPhone(e.target.value); setShowNew(false); }}
            onKeyDown={e => e.key === 'Enter' && lookup()}
            placeholder="+91 Phone number"
            style={{ 
              fontSize: '14px', 
              padding: '12px 12px 12px 40px', 
              border: '1px solid #F1F5F9',
              borderRadius: '8px',
              width: '100%',
              background: '#FFFFFF'
            }}
          />
        </div>
        <button 
          onClick={lookup} 
          disabled={loading || phone.length < 10} 
          style={{ 
            background: phone.length >= 10 ? 'var(--color-primary)' : '#E2E8F0', 
            border: 'none', 
            borderRadius: '8px', 
            color: '#fff', 
            width: '44px', 
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: phone.length >= 10 ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s'
          }}
        >
          {loading ? '...' : <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>}
        </button>
      </div>

      {showNew && !customer && (
        <div className="fade-in" style={{ marginTop: 16, padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px dashed #CBD5E1' }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>Customer not found. Quick register?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="Full Name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              style={{ flex: 1, padding: '10px 12px', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: 13 }}
            />
            <button onClick={handleRegister} className="btn-primary" style={{ padding: '0 16px', borderRadius: '6px', fontSize: 13 }}>Add</button>
          </div>
        </div>
      )}

      {customer && (
        <div className="fade-in" style={{ marginTop: 16, padding: 16, background: '#FFF0F5', borderRadius: 12, border: '1px solid #FCE7F3' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {customer.fullName || 'Customer'}
                <span className="badge" style={{ background: `${segmentColor[customer.segment]}22`, color: segmentColor[customer.segment], fontWeight: 800, fontSize: 10, padding: '2px 6px' }}>
                  {customer.segment}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{customer.phone}</div>
            </div>
            
            <button 
              onClick={() => { setCustomer(null); setPhone(''); }} 
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: '1px dashed #FCE7F3' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Total Spent</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>₹{customer.totalSpent?.toFixed(2) || '0.00'}</div>
            </div>
            {customer.lastPurchaseDate && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Last Visit</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{new Date(customer.lastPurchaseDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fbbf24' }}>star</span>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{customer.loyaltyPoints} points available</span>
          </div>
          
          {customer.loyaltyPoints > 0 && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="number"
                min={0}
                max={customer.loyaltyPoints}
                value={loyaltyRedemption || ''}
                onChange={e => setLoyaltyRedemption(Math.min(Number(e.target.value), customer.loyaltyPoints))}
                placeholder="Redeem points"
                style={{ fontSize: 13, padding: '8px 12px', border: '1px solid #FCE7F3', borderRadius: '6px', flex: 1 }}
              />
              <span style={{ fontSize: 14, color: 'var(--color-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>= ₹{loyaltyRedemption}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const DEMO_CATEGORIES = [
  { id: 'cat-1', name: 'Cakes' },
  { id: 'cat-2', name: 'Pastries' },
  { id: 'cat-3', name: 'Breads' },
  { id: 'cat-4', name: 'Snacks' },
];

const DEMO_PRODUCTS = [
  { id: 'p1', variantId: 'v1', name: 'Black Forest Cake', sku: 'FG-BFC-01', price: 550, categoryId: 'cat-1', stockQuantity: 7 },
  { id: 'p2', variantId: 'v2', name: 'Red Velvet Cake', sku: 'FG-RVC-01', price: 650, categoryId: 'cat-1', stockQuantity: 3 },
  { id: 'p3', variantId: 'v3', name: 'Truffle Cake ½KG', sku: 'FG-TRF-01', price: 480, categoryId: 'cat-1', stockQuantity: 12 },
  { id: 'p4', variantId: 'v4', name: 'Butterscotch Cake', sku: 'FG-BSC-01', price: 420, categoryId: 'cat-1', stockQuantity: 0 },
  { id: 'p5', variantId: 'v5', name: 'Pineapple Cake', sku: 'FG-PNC-01', price: 380, categoryId: 'cat-1', stockQuantity: 5 },
  { id: 'p6', variantId: 'v6', name: 'Chocolate Pastry', sku: 'FG-CHP-01', price: 90, categoryId: 'cat-2', stockQuantity: 24 },
  { id: 'p7', variantId: 'v7', name: 'Blueberry Muffin', sku: 'FG-BLM-01', price: 75, categoryId: 'cat-2', stockQuantity: 0 },
  { id: 'p8', variantId: 'v8', name: 'Cheese Croissant', sku: 'FG-CHC-01', price: 120, categoryId: 'cat-2', stockQuantity: 15 },
  { id: 'p9', variantId: 'v9', name: 'Garlic Bread', sku: 'FG-GBR-01', price: 65, categoryId: 'cat-3', stockQuantity: 8 },
  { id: 'p10', variantId: 'v10', name: 'Brown Bread Loaf', sku: 'FG-BBL-01', price: 55, categoryId: 'cat-3', stockQuantity: 10 },
  { id: 'p11', variantId: 'v11', name: 'Veg Puff', sku: 'FG-VPF-01', price: 35, categoryId: 'cat-4', stockQuantity: 40 },
  { id: 'p12', variantId: 'v12', name: 'Samosa', sku: 'FG-SAM-01', price: 25, categoryId: 'cat-4', stockQuantity: 50 },
];

export const PointOfSale: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [successInvoice, setSuccessInvoice] = useState<any>(null);
  const toastId = useRef(0);
  
  const { items, addItem, updateQuantity, removeItem, clearCart, subtotal, netTotal, discountTotal, loyaltyValue, taxTotal, customer } = useCartStore();

  const showToast = (title: string, message = '', type: 'success' | 'error' | 'warning' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const removeToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
        setProducts(Array.isArray(prods) ? prods : prods?.items || []);
        setCategories(Array.isArray(cats) ? cats : cats?.items || []);
      } catch (e) {
        setProducts(DEMO_PRODUCTS);
        setCategories(DEMO_CATEGORIES);
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const filteredProducts = products.filter(p => {
    const name = (p.name || p.variantName || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    const matchSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || sku.includes(searchQuery.toLowerCase());
    const matchCat = !activeCategory || p.categoryId === activeCategory || p.category?.id === activeCategory;
    return matchSearch && matchCat;
  });

  const handleAddToCart = (product: any) => {
    addItem({
      id: product.variantId || product.id,
      productId: product.id,
      variantId: product.variantId,
      name: product.name || product.variantName,
      sku: product.sku || '',
      price: Number(product.price || product.retailPrice || 0),
      taxPct: 5,
      imageUrl: product.imageUrl,
      maxQuantity: product.stockQuantity ?? 10,
    });
    showToast(`${product.name || product.variantName} added`, '', 'success');
  };

  return (
    <POSLayout>
      {/* LEFT: Catalog */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-app)' }}>
        
        {/* Search & Filter Bar */}
        <div style={{ padding: '24px 32px 16px', display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '16px', top: '12px', color: 'var(--text-muted)' }}>search</span>
            <input 
              type="text" 
              placeholder="Search products, SKUs..." 
              style={{ 
                padding: '12px 16px 12px 48px', 
                background: '#FFFFFF', 
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                width: '100%',
                fontSize: '15px'
              }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
            {[{ id: '', name: 'All' }, ...categories].map(cat => (
              <button
                key={cat.id || 'all'}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '24px',
                  background: activeCategory === cat.id ? 'var(--color-primary)' : '#FFFFFF',
                  color: activeCategory === cat.id ? '#FFFFFF' : 'var(--text-primary)',
                  border: `1px solid ${activeCategory === cat.id ? 'var(--color-primary)' : '#E2E8F0'}`,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '15px',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 32px 32px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              <div className="spinner" style={{ marginRight: 12 }} /> Loading products...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>inventory_2</span>
              <p>No products found in this category.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
              {filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  id={product.variantId || product.id}
                  name={product.name || product.variantName}
                  price={Number(product.price || product.retailPrice || 0)}
                  category={product.categoryId || product.category?.name || 'Uncategorized'}
                  imageUrl={product.imageUrl}
                  stockQuantity={product.stockQuantity ?? 10} 
                  onClick={() => handleAddToCart(product)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div style={{ 
        width: '420px', 
        background: '#FFFFFF', 
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.02)'
      }}>
        {/* Customer Panel */}
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid #F1F5F9' }}>
          <CustomerPanel />
        </div>

        {/* Cart Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CART • {items.length} ITEMS</h2>
          <button 
            className="btn-ghost" 
            onClick={clearCart}
            disabled={items.length === 0}
            style={{ padding: '4px 12px', fontSize: '13px', color: 'var(--color-primary)', borderColor: '#FCE7F3', background: '#FDF2F8' }}
          >
            Clear All
          </button>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {items.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2, color: 'var(--color-primary)' }}>shopping_cart</span>
              <p>Cart is empty</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map(item => (
                <CartItem
                  key={item.id}
                  {...item}
                  onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
                  onDecrease={() => updateQuantity(item.id, item.quantity - 1)}
                  onRemove={() => removeItem(item.id)}
                  onNoteChange={(note) => useCartStore.getState().updateNote(item.id, note)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cart Footer / Totals */}
        <div style={{ padding: '24px', borderTop: '1px solid #F1F5F9', background: '#FFFFFF' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <span>Subtotal</span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>₹{subtotal().toFixed(2)}</span>
            </div>
            {discountTotal() > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <span>Discount</span><span style={{ color: '#10b981', fontWeight: 500 }}>- ₹{discountTotal().toFixed(2)}</span>
              </div>
            )}
            {loyaltyValue() > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
                <span>Loyalty Points</span><span style={{ color: '#fbbf24', fontWeight: 500 }}>- ₹{loyaltyValue().toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-secondary)' }}>
              <span>Tax (GST 5%)</span><span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>₹{taxTotal().toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              color: 'var(--text-primary)', fontSize: '18px', fontWeight: 800, 
              marginTop: '12px', background: '#FFF0F5', padding: '16px', borderRadius: '12px' 
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Total Payable</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>* Verified by server at checkout</span>
              </div>
              <span style={{ color: 'var(--color-primary)', fontSize: '22px' }}>₹{netTotal().toFixed(2)}</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button 
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              disabled={items.length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>pause_circle</span>
              HOLD
            </button>
            <button 
              onClick={() => setShowDiscount(true)}
              style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: 'var(--text-secondary)', fontWeight: 700, fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              disabled={items.length === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>sell</span>
              DISCOUNT
            </button>
          </div>
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '18px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }}
            disabled={items.length === 0}
            onClick={() => setShowCheckout(true)}
          >
            <span className="material-symbols-outlined">payments</span>
            PAYMENT
          </button>
        </div>
      </div>

      {/* Modals */}
      {showDiscount && <DiscountModal onClose={() => setShowDiscount(false)} />}
      {showCheckout && (
        <CheckoutModal 
          total={netTotal()}
          items={items}
          onClose={() => setShowCheckout(false)}
          onSuccess={(method) => {
            console.log('CheckoutModal onSuccess called with:', method);
            window.localStorage.setItem('DEBUG_ON_SUCCESS', 'called_with_' + method);
            document.title = 'SUCCESS_MODAL_CALLED';
            const finalTotal = netTotal() || 0;
            const pts = Math.floor(finalTotal / 10) || 0;
            
            const invoiceData = { 
              invoiceNumber: `CC-INV-${Date.now()}`, 
              amount: finalTotal,
              paymentMethod: method,
              customerName: customer?.fullName || customer?.phone || 'Customer',
              loyaltyPointsEarned: pts 
            };
            
            window.localStorage.setItem('DEBUG_INVOICE', JSON.stringify(invoiceData));
            
            setShowCheckout(false);
            setSuccessInvoice(invoiceData);
          }}
        />
      )}

      {successInvoice && (
        <>
          <div id="debug-success-modal-is-true" style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999, background: 'red', color: 'white', padding: 20 }}>
            DEBUG: SuccessInvoice is SET! {JSON.stringify(successInvoice)}
          </div>
          <SuccessModal invoice={successInvoice} onClose={() => { setSuccessInvoice(null); clearCart(); }} />
        </>
      )}
      
      <Toast toasts={toasts} remove={removeToast} />
    </POSLayout>
  );
};
