/**
 * userService.ts - Service de gestion du profil utilisateur (Firebase-only)
 */
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { MobileOperator } from './authService';
import { auth, db } from '../config/firebase';
import { useAuthStore } from '../stores/authStore';

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

type FirestorePreferences = {
  push_enabled?: boolean;
  sms_reminders?: boolean;
  sms_confirmation?: boolean;
  monthly_report?: boolean;
  language?: 'fr' | 'en';
  currency_display?: 'CDF' | 'USD';
  pushEnabled?: boolean;
  smsReminders?: boolean;
  smsConfirmation?: boolean;
  monthlyReport?: boolean;
  currency?: 'CDF' | 'USD';
};

function resolveCurrentUid(): string {
  const firebaseUid = auth.currentUser?.uid;
  if (firebaseUid) return firebaseUid;

  const storedUid = useAuthStore.getState().user?.id;
  if (storedUid) return storedUid;

  throw new Error('NOT_AUTHENTICATED');
}

function mapPreferences(preferences?: FirestorePreferences): UserPreferences {
  return {
    pushEnabled: preferences?.pushEnabled ?? preferences?.push_enabled ?? false,
    smsReminders: preferences?.smsReminders ?? preferences?.sms_reminders ?? true,
    smsConfirmation: preferences?.smsConfirmation ?? preferences?.sms_confirmation ?? true,
    monthlyReport: preferences?.monthlyReport ?? preferences?.monthly_report ?? false,
    language: preferences?.language ?? 'fr',
    currency: preferences?.currency ?? preferences?.currency_display ?? 'CDF',
  };
}

function mapLastLogin(lastLogin: any): UserProfile['lastLogin'] {
  if (!lastLogin) return null;

  if (typeof lastLogin.toDate === 'function') {
    return {
      date: lastLogin.toDate().toISOString(),
      city: '',
    };
  }

  return {
    date: typeof lastLogin.date === 'string' ? lastLogin.date : new Date().toISOString(),
    city: typeof lastLogin.city === 'string' ? lastLogin.city : '',
  };
}

export const getUserProfile = async (): Promise<UserProfile> => {
  try {
    const uid = resolveCurrentUid();
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');

    const data = userDoc.data();

    return {
      id: uid,
      fullName: data.full_name ?? '',
      phone: data.phone ?? '',
      operator: data.operator,
      avatar: data.profile_photo_url || null,
      role: data.role || 'member',
      preferences: mapPreferences(data.preferences),
      biometricEnabled: data.biometric_enabled || false,
      lastLogin: mapLastLogin(data.last_login),
    };
  } catch (error) {
    console.error('[userService] getUserProfile error:', error);
    throw error;
  }
};

export const updateProfile = async (payload: UpdateProfilePayload): Promise<UserProfile> => {
  try {
    const uid = resolveCurrentUid();
    const updateData: Record<string, unknown> = {};

    if (payload.fullName) updateData.full_name = payload.fullName;
    if (payload.phone) updateData.phone = payload.phone;
    if (payload.operator) updateData.operator = payload.operator;

    await updateDoc(doc(db, 'users', uid), updateData);
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updateProfile error:', error);
    throw error;
  }
};

export const updateAvatar = async (avatarUri: string): Promise<{ avatarUrl: string }> => {
  try {
    const uid = resolveCurrentUid();

    let finalUrl = avatarUri;
    try {
      const storageService = await import('./storageService');
      finalUrl = await storageService.uploadProfilePhoto(avatarUri);
    } catch (err) {
      console.warn("[userService] Upload R2 a echoue, on garde l'URI locale", err);
    }

    await updateDoc(doc(db, 'users', uid), { profile_photo_url: finalUrl });
    return { avatarUrl: finalUrl };
  } catch (error) {
    console.error('[userService] updateAvatar error:', error);
    throw error;
  }
};

export const deleteAvatar = async (): Promise<void> => {
  try {
    const uid = resolveCurrentUid();
    await updateDoc(doc(db, 'users', uid), { profile_photo_url: null });
  } catch (error) {
    console.error('[userService] deleteAvatar error:', error);
    throw error;
  }
};

export const updatePIN = async (_payload: UpdatePINPayload): Promise<void> => {
  try {
    console.log('[userService] updatePIN not implemented yet');
  } catch (error) {
    console.error('[userService] updatePIN error:', error);
    throw error;
  }
};

export const updatePreferences = async (preferences: Partial<UserPreferences>): Promise<UserProfile> => {
  try {
    const uid = resolveCurrentUid();
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    const data = userDoc.data();

    const newPrefs = {
      ...(data?.preferences || {}),
      ...(preferences.pushEnabled !== undefined ? { push_enabled: preferences.pushEnabled } : {}),
      ...(preferences.smsReminders !== undefined ? { sms_reminders: preferences.smsReminders } : {}),
      ...(preferences.smsConfirmation !== undefined ? { sms_confirmation: preferences.smsConfirmation } : {}),
      ...(preferences.monthlyReport !== undefined ? { monthly_report: preferences.monthlyReport } : {}),
      ...(preferences.language !== undefined ? { language: preferences.language } : {}),
      ...(preferences.currency !== undefined ? { currency_display: preferences.currency } : {}),
    };

    await updateDoc(userDocRef, { preferences: newPrefs });
    return await getUserProfile();
  } catch (error) {
    console.error('[userService] updatePreferences error:', error);
    throw error;
  }
};

export const toggleBiometric = async (enabled: boolean): Promise<void> => {
  try {
    const uid = resolveCurrentUid();
    await updateDoc(doc(db, 'users', uid), { biometric_enabled: enabled });
  } catch (error) {
    console.error('[userService] toggleBiometric error:', error);
    throw error;
  }
};

export const logout = async (): Promise<void> => {
  try {
    await import('./authService').then((m) => m.logout());
  } catch (error) {
    console.error('[userService] logout error:', error);
    throw error;
  }
};
