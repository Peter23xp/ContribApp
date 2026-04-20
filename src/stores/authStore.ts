/**
 * authStore.ts — Store Zustand v2.0
 * AUCUNE référence à SecureStore, SQLite, ou USE_LOCAL_DB.
 * Persistance via Firebase onAuthStateChanged + AsyncStorage (géré par Firebase).
 * pin_hash JAMAIS inclus dans le store.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface User {
  id: string;          // = uid Firebase
  full_name: string;
  phone: string;
  operator: string;
  profile_photo_url?: string | null;
}

interface AuthStore {
  user: User | null;
  role: UserRole | null;
  groupId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuthenticatedUser: (payload: { user: User; role: UserRole; groupId?: string | null }) => Promise<void>;
  loadPersistedSession: () => Promise<void>;
  clearSession: () => Promise<void>;
  setGroupId: (groupId: string) => void;
  hydrateCurrentUserProfile: (uid?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  initFirebaseListener: () => () => void;
}

const PROFILE_RETRY_DELAYS_MS = [0, 250, 750, 1500, 2500];
const AUTH_SESSION_KEY = 'auth_session';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  role: null,
  groupId: null,
  isAuthenticated: false,
  isLoading: true,

  setAuthenticatedUser: async ({ user, role, groupId = null }) => {
    await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ user, role, groupId }));
    set({ user, role, groupId, isAuthenticated: true, isLoading: false });
  },

  loadPersistedSession: async () => {
    try {
      const rawSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
      if (!rawSession) {
        set({ isLoading: false });
        return;
      }

      const session = JSON.parse(rawSession) as { user: User; role: UserRole; groupId?: string | null };
      set({
        user: session.user,
        role: session.role,
        groupId: session.groupId ?? null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('[authStore] Impossible de restaurer la session:', error);
      await AsyncStorage.removeItem(AUTH_SESSION_KEY);
      set({ user: null, role: null, groupId: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearSession: async () => {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    set({ user: null, role: null, groupId: null, isAuthenticated: false, isLoading: false });
  },

  setGroupId: (groupId) => set({ groupId }),

  hydrateCurrentUserProfile: async (uidOverride) => {
    const uid = uidOverride ?? auth.currentUser?.uid;

    if (!uid) {
      set({ user: null, role: null, groupId: null, isAuthenticated: false, isLoading: false });
      return false;
    }

    set({ isLoading: true });

    for (const retryDelay of PROFILE_RETRY_DELAYS_MS) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        continue;
      }

      const data = userDoc.data();
      const { pin_hash, ...safeData } = data;

      await get().setAuthenticatedUser({
        user: {
          id: uid,
          full_name: safeData.full_name ?? '',
          phone: safeData.phone ?? '',
          operator: safeData.operator ?? '',
          profile_photo_url: safeData.profile_photo_url ?? null,
        },
        role: (safeData.role as UserRole) ?? 'member',
        groupId: safeData.active_group_id ?? null,
      });

      return true;
    }

    await get().clearSession();
    return false;
  },

  logout: async () => {
    await import('../services/authService').then((m) => m.logout());
    await get().clearSession();
  },

  initFirebaseListener: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          await get().hydrateCurrentUserProfile(firebaseUser.uid);
        } catch (e) {
          console.error('[authStore] Erreur chargement profil:', e);
          await get().clearSession();
        }
      } else {
        if (!get().user) {
          await get().clearSession();
        } else {
          set({ isLoading: false });
        }
      }
    });

    return unsubscribe;
  },
}));
