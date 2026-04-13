/**
 * userService.ts — Service de gestion du profil utilisateur
 * 
 * Endpoints :
 *  - GET  /api/v1/users/me           : récupérer le profil complet
 *  - PUT  /api/v1/users/me           : mettre à jour le profil
 *  - PUT  /api/v1/users/me/avatar    : mettre à jour la photo de profil
 *  - PUT  /api/v1/users/me/pin       : changer le code PIN
 *  - PUT  /api/v1/users/me/preferences : mettre à jour les préférences
 */

import type { MobileOperator } from './authService';
import * as db from './database';

// ─── Types ────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  fullName: string;
  phone: string;
  operator: MobileOperator;
  avatar: string | null;
  role: 'admin' | 'treasurer' | 'member' | 'auditor';
  preferences: UserPreferences;
  biometricEnabled: boolean;
  lastLogin: {
    date: string;  // ISO 8601
    city: string;
  } | null;
}

export interface UserPreferences {
  pushEnabled: boolean;
  smsReminders: boolean;
  smsConfirmation: boolean;
  monthlyReport: boolean;
  language: 'fr' | 'en';
  currency: 'CDF' | 'USD';
}

export interface UpdateProfilePayload {
  fullName?: string;
  phone?: string;
  operator?: MobileOperator;
}

export interface UpdatePINPayload {
  currentPin: string;
  newPin: string;
}

// ─── GET USER PROFILE ─────────────────────────────────────────

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    // Mode local : récupérer depuis la DB locale
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    // Récupérer les préférences (ou valeurs par défaut)
    const prefs = db.getUserPreferences(user.id) ?? {
      pushEnabled: true,
      smsReminders: true,
      smsConfirmation: false,
      monthlyReport: true,
      language: 'fr' as const,
      currency: 'CDF' as const,
    };

    return {
      id: user.id,
      fullName: user.full_name,
      phone: user.phone,
      operator: user.operator as MobileOperator,
      avatar: user.profile_photo_url ?? null,
      role: (user.role as any) ?? 'member',
      preferences: prefs,
      biometricEnabled: user.biometric_enabled ?? false,
      lastLogin: user.last_login ? {
        date: user.last_login,
        city: 'Kinshasa',  // Mock pour le moment
      } : null,
    };
  } catch (error) {
    console.error('[userService] getUserProfile error:', error);
    throw error;
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────

export const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    // Mettre à jour dans la DB locale
    db.updateUser(user.id, {
      full_name: payload.fullName,
      phone: payload.phone,
      operator: payload.operator,
    });

    // Retourner le profil mis à jour
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updateProfile error:', error);
    throw error;
  }
};

// ─── UPDATE AVATAR ────────────────────────────────────────────

export const updateAvatar = async (avatarUri: string): Promise<{ avatarUrl: string }> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    // En mode local, on stocke juste l'URI
    db.updateUser(user.id, {
      profile_photo_url: avatarUri,
    });

    return { avatarUrl: avatarUri };
  } catch (error) {
    console.error('[userService] updateAvatar error:', error);
    throw error;
  }
};

// ─── DELETE AVATAR ────────────────────────────────────────────

export const deleteAvatar = async (): Promise<void> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    db.updateUser(user.id, {
      profile_photo_url: null,
    });
  } catch (error) {
    console.error('[userService] deleteAvatar error:', error);
    throw error;
  }
};

// ─── UPDATE PIN ───────────────────────────────────────────────

export const updatePIN = async (payload: UpdatePINPayload): Promise<void> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    // Vérifier le PIN actuel
    if (user.pin_hash !== payload.currentPin) {
      throw new Error('INVALID_CURRENT_PIN');
    }

    // Mettre à jour le PIN
    db.updateUser(user.id, {
      pin_hash: payload.newPin,
    });
  } catch (error) {
    console.error('[userService] updatePIN error:', error);
    throw error;
  }
};

// ─── UPDATE PREFERENCES ───────────────────────────────────────

export const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<UserProfile> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    // Récupérer les préférences actuelles
    const currentPrefs = db.getUserPreferences(user.id) ?? {
      pushEnabled: true,
      smsReminders: true,
      smsConfirmation: false,
      monthlyReport: true,
      language: 'fr' as const,
      currency: 'CDF' as const,
    };

    // Fusionner avec les nouvelles préférences
    const updatedPrefs = { ...currentPrefs, ...preferences };

    // Sauvegarder
    db.updateUserPreferences(user.id, updatedPrefs);

    // Retourner le profil mis à jour
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updatePreferences error:', error);
    throw error;
  }
};

// ─── TOGGLE BIOMETRIC ─────────────────────────────────────────

export const toggleBiometric = async (enabled: boolean): Promise<void> => {
  try {
    const user = db.getCurrentUser();
    if (!user) throw new Error('USER_NOT_FOUND');

    db.updateUser(user.id, {
      biometric_enabled: enabled,
    });
  } catch (error) {
    console.error('[userService] toggleBiometric error:', error);
    throw error;
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  try {
    // En mode local, pas d'appel API
    // En production, appeler POST /api/v1/auth/logout
    console.log('[userService] logout');
  } catch (error) {
    console.error('[userService] logout error:', error);
    throw error;
  }
};
