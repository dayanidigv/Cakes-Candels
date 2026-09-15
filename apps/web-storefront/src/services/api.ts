const API_BASE = 'http://localhost:3000/api';

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  // For demo storefront, we use the dev token to bypass ERP permissions
  headers.set('X-Dev-Token', 'CC-Dev-Token-2026');
  
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.message || 'API request failed');
  }
  return data.data;
}

export const api = {
  // Products & Catalog
  getProducts: () => request('/masters/products'),
  getCategories: () => request('/masters/categories'),
  
  // Checkout
  createOrder: (payload: any) => request('/sales/billing/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  
  // Customer Auth (Placeholder for real auth)
  login: (phone: string) => request('/auth/customer/login', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  })
};
