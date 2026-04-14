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
import { getLocalDB, USE_LOCAL_DB } from '../config/database';
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

export const getUserProfile = async (userIdStr?: string): Promise<UserProfile> => {
  try {
    if (USE_LOCAL_DB) {
      const dbLocal = getLocalDB();
      // En mode dev local, on prend le dernier user vérifié
      const user = await dbLocal.getFirstAsync<any>('SELECT * FROM users WHERE is_verified = 1 ORDER BY created_at DESC LIMIT 1');
      if (!user) throw new Error('USER_NOT_FOUND');

      return {
        id: user.uid,
        fullName: user.full_name,
        phone: user.phone,
        operator: user.operator as MobileOperator,
        avatar: user.profile_photo_url ?? null,
        role: user.role ?? 'member',
        preferences: {
          pushEnabled: true,
          smsReminders: true,
          smsConfirmation: false,
          monthlyReport: true,
          language: 'fr',
          currency: 'CDF',
        },
        biometricEnabled: false,
        lastLogin: null,
      };
    }

    // FIREBASE MODE
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
      biometricEnabled: false,
      lastLogin: null,
    };
  } catch (error) {
    console.error('[userService] getUserProfile error:', error);
    throw error;
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────

export const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
  try {
    if (USE_LOCAL_DB) {
      const dbLocal = getLocalDB();
      const user = await dbLocal.getFirstAsync<any>('SELECT * FROM users WHERE is_verified = 1 ORDER BY created_at DESC LIMIT 1');
      if (!user) throw new Error('USER_NOT_FOUND');
      
      const updates: string[] = [];
      const values: any[] = [];
      if (payload.fullName) { updates.push('full_name = ?'); values.push(payload.fullName); }
      if (payload.phone) { updates.push('phone = ?'); values.push(payload.phone); }
      if (payload.operator) { updates.push('operator = ?'); values.push(payload.operator); }
      
      if (updates.length > 0) {
        values.push(user.uid);
        await dbLocal.runAsync(`UPDATE users SET ${updates.join(', ')} WHERE uid = ?`, values);
      }
      return await getUserProfile();
    }

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
    if (USE_LOCAL_DB) {
      const dbLocal = getLocalDB();
      const user = await dbLocal.getFirstAsync<any>('SELECT * FROM users WHERE is_verified = 1 ORDER BY created_at DESC LIMIT 1');
      if (!user) throw new Error('USER_NOT_FOUND');
      await dbLocal.runAsync(`UPDATE users SET profile_photo_url = ? WHERE uid = ?`, [avatarUri, user.uid]);
      return { avatarUrl: avatarUri };
    }

    if (!auth.currentUser) throw new Error('USER_NOT_FOUND');
    await updateDoc(doc(db, 'users', auth.currentUser.uid), { profile_photo_url: avatarUri });
    return { avatarUrl: avatarUri };
  } catch (error) {
    console.error('[userService] updateAvatar error:', error);
    throw error;
  }
};

// ─── DELETE AVATAR ────────────────────────────────────────────

export const deleteAvatar = async (): Promise<void> => {
  try {
     if (USE_LOCAL_DB) {
      const dbLocal = getLocalDB();
      const user = await dbLocal.getFirstAsync<any>('SELECT * FROM users WHERE is_verified = 1 ORDER BY created_at DESC LIMIT 1');
      if (!user) throw new Error('USER_NOT_FOUND');
      await dbLocal.runAsync(`UPDATE users SET profile_photo_url = NULL WHERE uid = ?`, [user.uid]);
      return;
    }

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
     // TODO: Implement PIN update properly with hash verification later
     console.log('[userService] updatePIN non implémenté complètement');
  } catch (error) {
    console.error('[userService] updatePIN error:', error);
    throw error;
  }
};

// ─── UPDATE PREFERENCES ───────────────────────────────────────

export const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<UserProfile> => {
  try {
    if (USE_LOCAL_DB) {
       // Mock pour le dev local (non persistant pour le moment dans ce hotfix)
       return await getUserProfile();
    }

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
     console.log('[userService] toggleBiometric', enabled);
  } catch (error) {
    console.error('[userService] toggleBiometric error:', error);
    throw error;
  }
};

// ─── LOGOUT ───────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  try {
    // handled in authService and authStore mostly
    console.log('[userService] logout');
  } catch (error) {
    console.error('[userService] logout error:', error);
    throw error;
  }
};

