import { getToken, logout } from './authState';

const API_BASE = 'http://localhost:3000/api';

export const apiRequest = async (path: string, method = 'GET', body?: any) => {
  try {
    const token = getToken();
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();

    if (response.status === 401) {
      logout();
    }
    if (!response.ok || !data.success) {
      throw new Error(data.message || `HTTP Error ${response.status}`);
    }

    return data.data;
  } catch (err: any) {
    console.error(err);
    throw err;
  }
};
