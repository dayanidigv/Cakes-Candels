export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: string;
  branchId: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
}

const STORAGE_KEY = 'admin-auth';

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { user: null, token: null };
  } catch {
    return { user: null, token: null };
  }
}

let state: AuthState = loadFromStorage();
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeAuth(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function getAuthState() {
  return state;
}

export function login(user: AuthUser, token: string) {
  state = { user, token };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

export function logout() {
  state = { user: null, token: null };
  localStorage.removeItem(STORAGE_KEY);
  emit();
}

export function getToken() {
  return state.token;
}
