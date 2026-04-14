/**
 * authStore.ts — Store Zustand pour l'authentification (Firebase-only)
 */
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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
  groupId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  setAuth: (user: User, role: UserRole) => Promise<void>;
  setGroupId: (groupId: string) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  initFirebaseListener: () => () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  role: null,
  groupId: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, role) => {
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
      set({ isLoading: false });
    }
  },

  initFirebaseListener: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            set({
              user: { id: firebaseUser.uid, ...userData } as User,
              role: userData.role as UserRole,
              isAuthenticated: true,
              isLoading: false,
            });
          } else {
            // Utilisateur Firebase sans document Firestore (compte supprimé ou incomplet)
            await SecureStore.deleteItemAsync('user_data');
            set({ user: null, role: null, isAuthenticated: false, isLoading: false });
          }
        } catch (e) {
          set({ isLoading: false });
        }
      } else {
        SecureStore.deleteItemAsync('user_data').catch(() => {});
        set({ user: null, role: null, isAuthenticated: false, isLoading: false });
      }
    });

    return unsubscribe; 
  },
}));
