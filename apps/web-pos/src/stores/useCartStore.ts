import { create } from 'zustand';

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  discount: number;
  taxPct: number;
  imageUrl?: string;
  maxQuantity?: number;
  note?: string;
}

interface Customer {
  id: string;
  phone: string;
  fullName?: string;
  segment: string;
  loyaltyPoints: number;
  lastPurchaseDate?: string;
  totalSpent?: number;
}

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  loyaltyRedemption: number;
  paymentMode: 'CASH' | 'UPI' | 'CARD' | 'POINTS';

  // Cart actions
  addItem: (item: Omit<CartItem, 'quantity' | 'discount'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  updateNote: (id: string, note: string) => void;
  applyDiscount: (id: string, discount: number) => void;
  clearCart: () => void;

  // Customer
  setCustomer: (customer: Customer | null) => void;
  setLoyaltyRedemption: (points: number) => void;
  setPaymentMode: (mode: 'CASH' | 'UPI' | 'CARD' | 'POINTS') => void;

  // Computed
  subtotal: () => number;
  taxTotal: () => number;
  discountTotal: () => number;
  loyaltyValue: () => number;
  netTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  loyaltyRedemption: 0,
  paymentMode: 'CASH',

  addItem: (item) => set((state) => {
    const existing = state.items.find((i) => i.id === item.id);
    if (existing) {
      const newQty = existing.quantity + 1;
      if (existing.maxQuantity !== undefined && newQty > existing.maxQuantity) {
        return state; // Do not exceed max quantity
      }
      return { items: state.items.map(i => i.id === item.id ? { ...i, quantity: newQty } : i) };
    }
    // Only add if maxQuantity is not 0
    if (item.maxQuantity !== undefined && item.maxQuantity <= 0) return state;
    return { items: [...state.items, { ...item, quantity: 1, discount: 0 }] };
  }),

  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),

  updateQuantity: (id, qty) => set((state) => {
    if (qty <= 0) return { items: state.items.filter(i => i.id !== id) };
    
    return {
      items: state.items.map(i => {
        if (i.id === id) {
          const max = i.maxQuantity !== undefined ? i.maxQuantity : Infinity;
          return { ...i, quantity: Math.min(qty, max) };
        }
        return i;
      })
    };
  }),

  updateNote: (id, note) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, note } : i),
  })),

  applyDiscount: (id, discount) => set((state) => ({
    items: state.items.map(i => i.id === id ? { ...i, discount } : i),
  })),

  clearCart: () => set({ items: [], customer: null, loyaltyRedemption: 0, paymentMode: 'CASH' }),

  setCustomer: (customer) => set({ customer, loyaltyRedemption: 0 }),
  setLoyaltyRedemption: (points) => set((state) => {
    // 1 point = ₹1. Do not allow points to exceed the current subtotal + tax - discount
    const currentSub = state.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const currentDisc = state.items.reduce((sum, i) => sum + i.discount, 0);
    const currentTax = state.items.reduce((sum, i) => sum + ((i.price * i.quantity - i.discount) * i.taxPct / 100), 0);
    const maxRedeemable = currentSub + currentTax - currentDisc;
    
    // Also don't exceed the customer's actual balance
    const custBalance = state.customer?.loyaltyPoints || 0;
    
    return { loyaltyRedemption: Math.min(points, maxRedeemable, custBalance) };
  }),
  setPaymentMode: (mode) => set({ paymentMode: mode }),

  subtotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  },
  taxTotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + ((i.price * i.quantity - i.discount) * i.taxPct / 100), 0);
  },
  discountTotal: () => {
    const { items } = get();
    return items.reduce((sum, i) => sum + i.discount, 0);
  },
  loyaltyValue: () => get().loyaltyRedemption, // 1 point = ₹1
  netTotal: () => {
    const { subtotal, taxTotal, discountTotal, loyaltyValue } = get();
    return Math.max(0, subtotal() + taxTotal() - discountTotal() - loyaltyValue());
  },
}));
