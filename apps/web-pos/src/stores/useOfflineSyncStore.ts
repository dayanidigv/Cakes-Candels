import { create } from 'zustand';

export interface QueuedTransaction {
  idempotencyKey: string;
  branchId: string;
  customerId?: string;
  paymentMode: string;
  loyaltyPointsRedeemed?: number;
  items: Array<{ variantId: string; quantity: number }>;
  queuedAt: string;
  status: 'PENDING' | 'SYNCING' | 'FAILED';
  error?: string;
}

interface OfflineSyncState {
  queue: QueuedTransaction[];
  isOnline: boolean;
  isSyncing: boolean;
  enqueue: (transaction: Omit<QueuedTransaction, 'status' | 'queuedAt'>) => void;
  dequeue: (idempotencyKey: string) => void;
  updateStatus: (idempotencyKey: string, status: QueuedTransaction['status'], error?: string) => void;
  setOnlineStatus: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  syncAll: () => Promise<void>;
  loadQueue: () => void;
}

const STORAGE_KEY = 'cc_erp_offline_queue';

export const useOfflineSyncStore = create<OfflineSyncState>((set, get) => ({
  queue: [],
  isOnline: navigator.onLine,
  isSyncing: false,

  loadQueue: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ queue: JSON.parse(stored) });
      }
    } catch (e) {
      console.error('Failed to load offline queue', e);
    }
  },

  enqueue: (transaction) => {
    const newTx: QueuedTransaction = {
      ...transaction,
      status: 'PENDING',
      queuedAt: new Date().toISOString()
    };
    
    set((state) => {
      const newQueue = [...state.queue, newTx];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
      return { queue: newQueue };
    });
    
    // Attempt auto-sync if online
    if (get().isOnline) {
      get().syncAll();
    }
  },

  dequeue: (idempotencyKey) => {
    set((state) => {
      const newQueue = state.queue.filter(tx => tx.idempotencyKey !== idempotencyKey);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
      return { queue: newQueue };
    });
  },

  updateStatus: (idempotencyKey, status, error) => {
    set((state) => {
      const newQueue = state.queue.map(tx => 
        tx.idempotencyKey === idempotencyKey ? { ...tx, status, error } : tx
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
      return { queue: newQueue };
    });
  },

  setOnlineStatus: (status) => {
    set({ isOnline: status });
    if (status) {
      get().syncAll();
    }
  },

  setSyncing: (status) => set({ isSyncing: status }),

  syncAll: async () => {
    const { queue, isOnline, isSyncing, setSyncing, updateStatus, dequeue } = get();
    
    if (!isOnline || isSyncing || queue.length === 0) return;
    
    setSyncing(true);
    
    // Process sequentially to avoid race conditions
    for (const tx of queue) {
      if (tx.status === 'SYNCING') continue;
      
      updateStatus(tx.idempotencyKey, 'SYNCING');
      
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('http://localhost:3000/api/sales/billing/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            idempotencyKey: tx.idempotencyKey,
            branchId: tx.branchId,
            customerId: tx.customerId,
            paymentMode: tx.paymentMode,
            loyaltyPointsRedeemed: tx.loyaltyPointsRedeemed,
            items: tx.items,
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          dequeue(tx.idempotencyKey);
        } else {
          updateStatus(tx.idempotencyKey, 'FAILED', data.message || 'Unknown error');
        }
      } catch (error: any) {
        updateStatus(tx.idempotencyKey, 'FAILED', error.message || 'Network error');
      }
    }
    
    setSyncing(false);
  }
}));

// Setup network listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => useOfflineSyncStore.getState().setOnlineStatus(true));
  window.addEventListener('offline', () => useOfflineSyncStore.getState().setOnlineStatus(false));
  
  // Initial load
  useOfflineSyncStore.getState().loadQueue();
}
