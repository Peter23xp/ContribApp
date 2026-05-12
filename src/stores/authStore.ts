/**
 * authStore.ts — v3.0
 * Plus de Firebase Auth — sessions gérées via AsyncStorage + Firestore.
 * SessionToken vérifié au démarrage pour invalidation multi-appareils.
 * pin_hash JAMAIS dans le store, JAMAIS loggué.
 */
import { create } from 'zustand';
import { getLocalSession, clearLocalSession, LocalSession, AuthResponse } from '../services/authService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

interface AuthState {
  uid: string | null;
  user: {
    fullName: string;
    phone: string;
    email: string;
    operator: string;
    profilePhotoUrl: string | null;
  } | null;
  role: 'admin' | 'treasurer' | 'member' | null;       // rôle Firestore réel, ne change jamais
  activeRole: 'admin' | 'treasurer' | 'member' | null;  // rôle utilisé par la navigation
  groupId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  initSession: () => Promise<void>;
  setAuthData: (data: AuthResponse) => void;
  setGroupId: (groupId: string) => void;
  logout: () => Promise<void>;
  switchToMemberMode: () => void;
  restoreRole: () => void;

  // Compatibilité avec les composants existants
  setAuthenticatedUser: (payload: {
    user: { id: string; full_name: string; phone: string; operator: string; profile_photo_url?: string | null };
    role: UserRole;
    groupId?: string | null;
  }) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  uid: null,
  user: null,
  role: null,
  activeRole: null,
  groupId: null,
  isAuthenticated: false,
  isLoading: true,

  /**
   * Initialiser la session au démarrage de l'app :
   * 1. Lire la session locale depuis AsyncStorage
   * 2. Si session trouvée : vérifier la validité du token dans Firestore
   * 3. Si valide : restaurer l'état auth
   * 4. Si invalide (token révoqué sur un autre appareil) : déconnecter
   */
  initSession: async () => {
    try {
      const session = await getLocalSession();

      if (!session) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Vérifier la validité du token dans Firestore
      const userDoc = await getDoc(doc(db, 'users', session.uid));

      if (!userDoc.exists()) {
        await clearLocalSession();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const userData = userDoc.data();

      // Vérifier que le token local correspond au token Firestore
      if (userData.active_session_token !== session.sessionToken) {
        // Session révoquée (déconnexion depuis un autre appareil)
        await clearLocalSession();
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      // Session valide — restaurer l'état (pin_hash JAMAIS dans le store)
      const restoredRole = userData.role || 'member';
      set({
        uid: session.uid,
        user: {
          fullName: userData.full_name,
          phone: userData.phone,
          email: userData.email,
          operator: userData.operator,
          profilePhotoUrl: userData.profile_photo_url ?? null,
        },
        role: restoredRole,
        activeRole: restoredRole,
        groupId: userData.active_group_id || null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // En cas d'erreur réseau : utiliser la session locale sans validation Firestore
      try {
        const session = await getLocalSession();
        if (session) {
          set({
            uid: session.uid,
            user: {
              fullName: session.fullName,
              phone: session.phone,
              email: session.email,
              operator: session.operator,
              profilePhotoUrl: null,
            },
            role: session.role,
            activeRole: session.role,
            groupId: session.groupId,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({ isLoading: false, isAuthenticated: false });
        }
      } catch {
        set({ isLoading: false, isAuthenticated: false });
      }
    }
  },

  setAuthData: (data: AuthResponse) => {
    set({
      uid: data.uid,
      user: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        operator: data.operator,
        profilePhotoUrl: null,
      },
      role: data.role,
      activeRole: data.role,
      groupId: data.groupId,
      isAuthenticated: true,
    });
  },

  setGroupId: (groupId) => set({ groupId }),

  logout: async () => {
    const uid = get().uid;
    try {
      if (uid) {
        await import('../services/authService').then(m => m.logout(uid));
      }
    } catch { /* ignorer les erreurs réseau lors de la déconnexion */ }
    set({
      uid: null,
      user: null,
      role: null,
      activeRole: null,
      groupId: null,
      isAuthenticated: false,
    });
  },

  switchToMemberMode: () => {
    const { role } = get();
    if (role === 'admin' || role === 'treasurer') {
      set({ activeRole: 'member' });
    }
  },

  restoreRole: () => {
    const { role } = get();
    set({ activeRole: role });
  },

  // ── Compatibilité legacy (utilisé par certains écrans existants) ──────────
  setAuthenticatedUser: async ({ user, role, groupId = null }) => {
    const castRole = role as 'admin' | 'treasurer' | 'member';
    set({
      uid: user.id,
      user: {
        fullName: user.full_name,
        phone: user.phone,
        email: '',
        operator: user.operator,
        profilePhotoUrl: user.profile_photo_url ?? null,
      },
      role: castRole,
      activeRole: castRole,
      groupId: groupId ?? null,
      isAuthenticated: true,
      isLoading: false,
    });
  },
}));
