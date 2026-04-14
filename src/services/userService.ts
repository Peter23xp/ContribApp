/**
 * userService.ts — Service de gestion du profil utilisateur (Firebase-only)
 */
import type { MobileOperator } from './authService';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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
    date: string;
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
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
    const data = userDoc.data();
    
    return {
      id: auth.currentUser.uid,
      fullName: data.full_name,
      phone: data.phone,
      operator: data.operator,
      avatar: data.profile_photo_url || null,
      role: data.role || 'member',
      preferences: data.preferences || {
        pushEnabled: true,
        smsReminders: true,
        smsConfirmation: false,
        monthlyReport: true,
        language: 'fr',
        currency: 'CDF',
      },
      biometricEnabled: data.biometric_enabled || false,
      lastLogin: data.last_login || null,
    };
  } catch (error) {
    console.error('[userService] getUserProfile error:', error);
    throw error;
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────

export const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
  try {
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    const updateData: any = {};
    if (payload.fullName) updateData.full_name = payload.fullName;
    if (payload.phone) updateData.phone = payload.phone;
    if (payload.operator) updateData.operator = payload.operator;

    await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updateProfile error:', error);
    throw error;
  }
};

// ─── UPDATE AVATAR ────────────────────────────────────────────

export const updateAvatar = async (avatarUri: string): Promise<{ avatarUrl: string }> => {
  try {
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    
    // Upload vers Cloudflare R2
    let finalUrl = avatarUri;
    try {
      const storageService = await import('./storageService');
      finalUrl = await storageService.uploadProfilePhoto(avatarUri);
    } catch (err) {
      console.warn('[userService] Upload R2 échoué, on garde l\'URI locale', err);
    }
    
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { profile_photo_url: finalUrl });
    return { avatarUrl: finalUrl };
  } catch (error) {
    console.error('[userService] updateAvatar error:', error);
    throw error;
  }
};

// ─── DELETE AVATAR ────────────────────────────────────────────

export const deleteAvatar = async (): Promise<void> => {
  try {
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { profile_photo_url: null });
  } catch (error) {
    console.error('[userService] deleteAvatar error:', error);
    throw error;
  }
};

// ─── UPDATE PIN ───────────────────────────────────────────────

export const updatePIN = async (payload: UpdatePINPayload): Promise<void> => {
  try {
    // TODO: Implement PIN update with hash verification
    console.log('[userService] updatePIN non implémenté complètement');
  } catch (error) {
    console.error('[userService] updatePIN error:', error);
    throw error;
  }
};

// ─── UPDATE PREFERENCES ───────────────────────────────────────

export const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<UserProfile> => {
  try {
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    const userDocRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    const data = userDoc.data();
    const newPrefs = { ...(data?.preferences || {}), ...preferences };
    await updateDoc(userDocRef, { preferences: newPrefs });
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updatePreferences error:', error);
    throw error;
  }
};

// ─── TOGGLE BIOMETRIC ─────────────────────────────────────────

export const toggleBiometric = async (enabled: boolean): Promise<void> => {
  try {
    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { biometric_enabled: enabled });
  } catch (error) {
    console.error('[userService] toggleBiometric error:', error);
    throw error;
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  try {
    console.log('[userService] logout');
  } catch (error) {
    console.error('[userService] logout error:', error);
    throw error;
  }
};
