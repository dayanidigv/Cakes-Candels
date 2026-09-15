const API_BASE = 'http://localhost:3000/api';
const DEV_TOKEN = 'SUPER_ADMIN_TOKEN_99999999999999999999999999999999';

export const apiRequest = async (path: string, method = 'GET', body?: any) => {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Dev-Token': DEV_TOKEN,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || `HTTP Error ${response.status}`);
  }
  return data.data;
};

// Product catalog
export const getProducts = (categoryId?: string) =>
  apiRequest(`/products${categoryId ? `?categoryId=${categoryId}` : ''}`);

export const getCategories = () => apiRequest('/categories');

// Customer lookup
export const getCustomerByPhone = (phone: string) =>
  apiRequest(`/crm/customers/phone/${phone}`).catch(() => null);

// POS Checkout
export const createSalesOrder = (orderData: any) =>
  apiRequest('/sales/orders', 'POST', orderData);

// POS Register
export const openRegister = (locationId: string, openingBalance: number) =>
  apiRequest('/finance/cash-registers/open', 'POST', { locationId, openingBalance });

export const closeRegister = (registerId: string, closingBalance: number, notes?: string) =>
  apiRequest(`/finance/cash-registers/${registerId}/close`, 'PATCH', { closingBalance, notes });
