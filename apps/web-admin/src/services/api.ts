const API_BASE = 'http://localhost:3000/api';
// Use the dev token matching dev-token.guard.ts in the backend
const DEV_TOKEN = 'CC-Dev-Token-2026';

export const apiRequest = async (path: string, method = 'GET', body?: any) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Dev-Token': DEV_TOKEN
      },
      body: body ? JSON.stringify(body) : undefined
    });

    const data = await response.json();
    
    if (!response.ok || !data.success) {
      throw new Error(data.message || `HTTP Error ${response.status}`);
    }

    return data.data;
  } catch (err: any) {
    console.error(err);
    throw err;
  }
};
