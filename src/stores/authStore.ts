import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { USE_LOCAL_DB } from '../config/database';

export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface User {
  id: string;
  full_name: string;
  phone: string;
  operator: string;
  profile_photo_url?: string;
}

interface AuthStore {
  user: User | null;
  role: UserRole | null;
  groupId: string | null;        // ← NOUVEAU : groupe actif de l'utilisateur
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setAuth: (user: User, role: UserRole) => Promise<void>;
  setGroupId: (groupId: string) => void;  // ← NOUVEAU
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  initFirebaseListener: () => () => void;  // ← NOUVEAU
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  role: null,
  groupId: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, role) => {
    // Save to SecureStore for local cache
    await SecureStore.setItemAsync('user_data', JSON.stringify({ user, role }));
    set({ user, role, isAuthenticated: true });
  },

  setGroupId: (groupId) => {
    set({ groupId });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('user_data');
    set({ user: null, role: null, groupId: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const stored = await SecureStore.getItemAsync('user_data');
      if (stored) {
        const { user, role } = JSON.parse(stored);
        set({ user, role, isAuthenticated: true });
      }
    } finally {
      if (USE_LOCAL_DB) {
        set({ isLoading: false });
      }
    }
  },

  initFirebaseListener: () => {
    if (USE_LOCAL_DB) return () => {}; 

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          set({
            user: { id: firebaseUser.uid, ...userData } as User,
            role: userData.role as UserRole,
            isAuthenticated: true,
            isLoading: false,
          });
        }
      } else {
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
      }
    });

    return unsubscribe; 
  },
}));
