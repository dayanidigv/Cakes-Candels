import { useSyncExternalStore } from 'react';
import { getAuthState, subscribeAuth } from '../services/authState';

export function useAuth() {
  return useSyncExternalStore(subscribeAuth, getAuthState);
}
