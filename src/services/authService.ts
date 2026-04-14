/**
 * authService.ts — Service d'authentification Firebase-only
 * 
 * Gère : inscription, OTP, login, logout, reset PIN.
 * Toute la logique SQLite a été supprimée.
 */
import {
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
} from 'firebase/auth';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { auth, db } from '../config/firebase';

export type MobileOperator = 'airtel' | 'orange' | 'mpesa' | 'mtn';
export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface RegisterPayload {
  full_name: string;
  phone: string;
  operator: MobileOperator;
  pin: string;
  photoUri?: string | null;
}

export interface LoginPayload {
  phone: string;
  pin: string;
}

export interface AuthResponse {
  user: {
    id: string;
    full_name: string;
    phone: string;
    operator: MobileOperator;
    profile_photo_url?: string;
  };
  role: UserRole;
}

let _confirmationResult: ConfirmationResult | null = null;

export async function hashPIN(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

// ─── INSCRIPTION ──────────────────────────────────────────────

export async function register(payload: RegisterPayload): Promise<{ success: boolean }> {
  const pin_hash = await hashPIN(payload.pin);

  try {
    await SecureStore.setItemAsync('pending_registration', JSON.stringify({
      full_name: payload.full_name,
      phone: payload.phone,
      operator: payload.operator,
      pin_hash,
      photoUri: payload.photoUri ?? null
    }));
    await SecureStore.setItemAsync('pin_hash', pin_hash);

    _confirmationResult = await signInWithPhoneNumber(auth, payload.phone) as any;
    return { success: true };
  } catch (err: any) {
    if (err.code === 'auth/phone-number-already-exists') throw new Error('PHONE_ALREADY_EXISTS');
    if (err.code === 'auth/too-many-requests') throw new Error('TOO_MANY_ATTEMPTS');
    throw new Error('NETWORK_ERROR: ' + err.message);
  }
}

// ─── VÉRIFICATION OTP ─────────────────────────────────────────

export async function verifyOTP(phone: string, otp_code: string, isResetPhase = false): Promise<AuthResponse> {
  let data: any = null;
  
  if (!isResetPhase) {
    const pendingData = await SecureStore.getItemAsync('pending_registration');
    if (!pendingData) throw new Error('NO_PENDING_REGISTRATION');
    data = JSON.parse(pendingData);
  }

  try {
    if (!_confirmationResult) throw new Error('OTP_NOT_SENT');
    const credential = await _confirmationResult.confirm(otp_code);
    const uid = credential.user.uid;
    
    if (isResetPhase) {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
      const uData = userDoc.data();
      return {
        user: { id: uid, full_name: uData.full_name, phone: uData.phone, operator: uData.operator, profile_photo_url: uData.profile_photo_url },
        role: uData.role as UserRole || 'member'
      };
    }

    let profilePhotoUrl = null;
    
    // Upload de la photo de profil vers Cloudflare R2
    if (data && data.photoUri) {
      try {
        const storageService = await import('./storageService');
        profilePhotoUrl = await storageService.uploadProfilePhoto(data.photoUri);
        console.log('[authService] Photo uploadée sur R2:', profilePhotoUrl);
      } catch (err) {
        console.error('[authService] Échec upload photo R2, on ignore', err);
      }
    }

    await setDoc(doc(db, 'users', uid), {
      uid,
      full_name: data.full_name,
      phone: data.phone,
      operator: data.operator,
      profile_photo_url: profilePhotoUrl,
      role: 'member',
      is_verified: true,
      created_at: serverTimestamp(),
      preferences: {
        language: 'fr',
        currency: 'CDF',
        pushEnabled: true,
        smsReminders: true,
        smsConfirmation: false,
        monthlyReport: true,
      }
    });

    await SecureStore.deleteItemAsync('pending_registration');

    return {
      user: {
        id: uid,
        full_name: data.full_name,
        phone: data.phone,
        operator: data.operator,
        profile_photo_url: profilePhotoUrl ?? undefined,
      },
      role: 'member',
    };
  } catch (error) {
    throw new Error('INVALID_OTP');
  }
}

// ─── RENVOYER OTP ─────────────────────────────────────────────

export async function resendOTP(phone: string): Promise<{ success: boolean; expires_in?: number }> {
  try {
    _confirmationResult = await signInWithPhoneNumber(auth, phone) as any;
    return { success: true, expires_in: 120 };
  } catch (error: any) {
    throw new Error('NETWORK_ERROR: ' + error.message);
  }
}

// ─── CONNEXION ────────────────────────────────────────────────

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const pin_hash = await hashPIN(payload.pin);

  // Vérifier le PIN via SecureStore
  const storedHash = await SecureStore.getItemAsync('pin_hash');
  if (!storedHash || storedHash !== pin_hash) throw new Error('INVALID_CREDENTIALS');
  
  if (!auth.currentUser) {
    // L'utilisateur n'a pas de session Firebase active.
    // Chercher par téléphone dans Firestore.
    const q = query(collection(db, 'users'), where('phone', '==', payload.phone));
    const snap = await getDocs(q);
    if (snap.empty) throw new Error('USER_NOT_FOUND');
    
    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    return {
      user: {
        id: userDoc.id,
        full_name: userData.full_name,
        phone: userData.phone,
        operator: userData.operator,
        profile_photo_url: userData.profile_photo_url,
      },
      role: userData.role || 'member',
    };
  }
  
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  
  const userData = userDoc.data();
  return {
    user: {
      id: auth.currentUser.uid,
      full_name: userData.full_name,
      phone: userData.phone,
      operator: userData.operator,
      profile_photo_url: userData.profile_photo_url,
    },
    role: userData.role || 'member',
  };
}

// ─── BIOMÉTRIE ────────────────────────────────────────────────

export async function loginWithBiometric(phone: string, biometricToken: string): Promise<AuthResponse> {
  if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
  
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  
  const userData = userDoc.data();
  return {
    user: {
      id: auth.currentUser.uid,
      full_name: userData.full_name,
      phone: userData.phone,
      operator: userData.operator,
      profile_photo_url: userData.profile_photo_url,
    },
    role: userData.role || 'member',
  };
}

// ─── DÉCONNEXION ──────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch(e) {}
  await SecureStore.deleteItemAsync('pending_registration');
}

// ─── PUSH TOKEN ───────────────────────────────────────────────

export async function updatePushToken(userId: string, token: string) {
  await updateDoc(doc(db, 'users', userId), {
    push_token: token,
    updated_at: serverTimestamp(),
  });
}

// ─── RESET PIN ────────────────────────────────────────────────

export async function resetPIN(phone: string, newPin: string): Promise<{ success: boolean }> {
  const pin_hash = await hashPIN(newPin);

  // Mettre à jour dans SecureStore
  await SecureStore.setItemAsync('pin_hash', pin_hash);

  // Mettre à jour dans Firestore
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('USER_NOT_FOUND');
  
  const userId = snap.docs[0].id;
  await updateDoc(doc(db, 'users', userId), { pin_hash, updated_at: serverTimestamp() });
  
  return { success: true };
}

// ─── CURRENT USER ─────────────────────────────────────────────

export async function getCurrentUser() {
  return auth.currentUser;
}
