import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type Role = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface User {
  id: string;
  full_name: string;
  phone: string;
  operator: string;
  profile_photo_url?: string;
}

interface AuthStore {
  user: User | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, role: Role, tokens: { access: string; refresh: string }) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, role, tokens) => {
    await SecureStore.setItemAsync('access_token', tokens.access);
    await SecureStore.setItemAsync('refresh_token', tokens.refresh);
    await SecureStore.setItemAsync('user_data', JSON.stringify({ user, role }));
    set({ user, role, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');
    set({ user: null, role: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const stored = await SecureStore.getItemAsync('user_data');
      const token = await SecureStore.getItemAsync('access_token');
      if (stored && token) {
        const { user, role } = JSON.parse(stored);
        set({ user, role: '', isAuthenticated: true });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
