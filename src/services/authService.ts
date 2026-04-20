/**
 * authService.ts — Service d'authentification v2.0
 *
 * ARCHITECTURE :
 * - Firebase Auth Phone pour OTP (inscription et reset PIN)
 * - PIN haché (SHA-256 + sel) stocké dans Firestore users/{uid}.pin_hash
 * - Collection temporaire pending_registrations pendant le flux d'inscription
 * - AUCUNE référence à SQLite, SecureStore, ou USE_LOCAL_DB
 */
import {
  signInWithPhoneNumber,
  signOut,
  ConfirmationResult,
  PhoneAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, getDocs, updateDoc,
  query, collection, where, serverTimestamp,
  deleteDoc, Timestamp,
} from 'firebase/firestore';
import * as Crypto from 'expo-crypto';
import { auth, db } from '../config/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MobileOperator = 'airtel' | 'orange' | 'mpesa' | 'mtn';
export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface AuthResponse {
  uid: string;
  fullName: string;
  phone: string;
  operator: MobileOperator;
  role: UserRole;
  groupId?: string;
  profilePhotoUrl?: string | null;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;         // +243XXXXXXXXX
  operator: MobileOperator;
  pin: string;           // 4-6 chiffres — sera haché avant tout stockage
  photoUri?: string | null;
}

export interface LoginPayload {
  phone: string;
  pin: string;
}

// ─── État en mémoire (session OTP en cours) ───────────────────────────────────
// ConfirmationResult de Firebase (n'existe pas sur tous les cas FirebaseRecaptcha)
let _pendingConfirmation: ConfirmationResult | null = null;
let _verificationId: string | null = null;  // pour compatibilité FirebaseRecaptcha WebView

// ─── hashPIN ──────────────────────────────────────────────────────────────────

const PIN_SALT = 'contributapp_rdc_salt_2026';

/**
 * Hache le PIN avec SHA-256 + sel fixe.
 * Le PIN en clair ne quitte JAMAIS l'appareil.
 */
export async function hashPIN(pin: string): Promise<string> {
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + PIN_SALT
  );
}

// Pour compatibilité avec les composants existants (FirebaseRecaptcha WebView)
export function setVerificationId(id: string) {
  _verificationId = id;
}
export function getVerificationId(): string | null {
  return _verificationId;
}

// ─── INSCRIPTION ──────────────────────────────────────────────────────────────

/**
 * FLUX D'INSCRIPTION :
 * 1. Vérifier que le numéro n'est pas déjà inscrit
 * 2. Hacher le PIN → pending_registrations/{hash(phone)} dans Firestore
 * 3. Envoyer l'OTP Firebase (ou via WebView FirebaseRecaptcha)
 */
export async function register(payload: RegisterPayload): Promise<void> {
  // Étape 1 : Vérifier doublon
  const existing = await getDocs(
    query(collection(db, 'users'),
      where('phone', '==', payload.phone),
      where('is_verified', '==', true))
  );
  if (!existing.empty) throw new Error('PHONE_ALREADY_EXISTS');

  // Étape 2 : Hacher le PIN, stocker temporairement dans Firestore
  const pinHash = await hashPIN(payload.pin);
  const phoneHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, payload.phone
  );
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await setDoc(doc(db, 'pending_registrations', phoneHash), {
    full_name: payload.fullName,
    phone: payload.phone,
    operator: payload.operator,
    pin_hash: pinHash,
    photo_uri: payload.photoUri ?? null,
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
  });

  // Étape 3 : Envoyer OTP
  // Si FirebaseRecaptcha WebView est utilisé, il appellera setVerificationId()
  // après son envoi indépendant — ici on tente aussi signInWithPhoneNumber
  try {
    _pendingConfirmation = await signInWithPhoneNumber(auth, payload.phone);
  } catch (err: any) {
    // Si c'est le WebView qui gère l'OTP, l'erreur ici est normale
    // On continue sans _pendingConfirmation — verifyOTP utilisera _verificationId
    if (err.code !== 'auth/too-many-requests' && err.code !== 'auth/invalid-phone-number') {
      console.warn('[authService] signInWithPhoneNumber échoué, fallback WebView:', err.code);
    } else {
      await deleteDoc(doc(db, 'pending_registrations', phoneHash));
      if (err.code === 'auth/too-many-requests') throw new Error('TOO_MANY_ATTEMPTS');
      throw new Error('INVALID_PHONE');
    }
  }
}

// ─── VÉRIFICATION OTP ─────────────────────────────────────────────────────────

/**
 * FLUX DE VÉRIFICATION :
 * 1. Confirmer l'OTP (via ConfirmationResult OU via PhoneAuthProvider + verificationId WebView)
 * 2. Récupérer pending_registrations/{hash(phone)}
 * 3. Créer users/{uid} avec pin_hash définitif
 * 4. Supprimer pending_registrations
 */
export async function verifyOTP(
  phone: string,
  otpCode: string,
  isResetPhase = false
): Promise<AuthResponse> {
  let uid: string;

  try {
    if (_pendingConfirmation) {
      // Flux direct Firebase
      const cred = await _pendingConfirmation.confirm(otpCode);
      uid = cred.user.uid;
    } else if (_verificationId) {
      // Flux WebView FirebaseRecaptcha
      const credential = PhoneAuthProvider.credential(_verificationId, otpCode);
      const cred = await signInWithCredential(auth, credential);
      uid = cred.user.uid;
    } else {
      throw new Error('NO_PENDING_OTP');
    }
  } catch (err: any) {
    if (err.message === 'NO_PENDING_OTP') throw err;
    if (err.code === 'auth/invalid-verification-code') throw new Error('INVALID_OTP');
    if (err.code === 'auth/code-expired') throw new Error('OTP_EXPIRED');
    throw new Error('OTP_VERIFY_FAILED');
  }

  // Reset PIN
  if (isResetPhase) {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
    const d = userDoc.data();
    _pendingConfirmation = null;
    _verificationId = null;
    return {
      uid, fullName: d.full_name, phone: d.phone,
      operator: d.operator, role: d.role || 'member',
      groupId: d.active_group_id,
    };
  }

  // Inscription : récupérer données temporaires
  const phoneHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, phone
  );
  const pendingDoc = await getDoc(doc(db, 'pending_registrations', phoneHash));
  if (!pendingDoc.exists()) throw new Error('REGISTRATION_DATA_NOT_FOUND');

  const pd = pendingDoc.data();
  if (new Date() > pd.expires_at.toDate()) {
    await deleteDoc(doc(db, 'pending_registrations', phoneHash));
    throw new Error('REGISTRATION_EXPIRED');
  }

  // Upload photo si présente
  let profilePhotoUrl: string | null = null;
  if (pd.photo_uri) {
    try {
      const storageService = await import('./storageService');
      profilePhotoUrl = await storageService.uploadProfilePhoto(pd.photo_uri);
    } catch (e) {
      console.warn('[authService] Photo upload échoué, on continue:', e);
    }
  }

  // Créer le document utilisateur définitif
  await setDoc(doc(db, 'users', uid), {
    uid,
    full_name: pd.full_name,
    phone: pd.phone,
    operator: pd.operator,
    profile_photo_url: profilePhotoUrl,
    is_verified: true,
    pin_hash: pd.pin_hash,       // PIN haché transféré définitivement ici
    login_attempts: 0,
    locked_until: null,
    biometric_enabled: false,
    fcm_token: null,
    role: 'member',
    preferences: {
      language: 'fr',
      currency_display: 'CDF',
      push_enabled: false,
      sms_reminders: true,
      sms_confirmation: true,
      monthly_report: false,
      biometric_payment_confirm: false,
    },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Nettoyer
  await deleteDoc(doc(db, 'pending_registrations', phoneHash));
  _pendingConfirmation = null;
  _verificationId = null;

  return {
    uid,
    fullName: pd.full_name,
    phone: pd.phone,
    operator: pd.operator,
    role: 'member',
    profilePhotoUrl,
  };
}

// ─── RENVOI OTP ───────────────────────────────────────────────────────────────

export async function resendOTP(phone: string): Promise<void> {
  try {
    _pendingConfirmation = await signInWithPhoneNumber(auth, phone);
  } catch (err: any) {
    if (err.code === 'auth/too-many-requests') throw new Error('TOO_MANY_ATTEMPTS');
    throw new Error('OTP_SEND_FAILED');
  }
}

// ─── CONNEXION PAR PIN ────────────────────────────────────────────────────────

/**
 * FLUX DE CONNEXION :
 * 1. Chercher l'utilisateur par téléphone dans Firestore
 * 2. Vérifier blocage (locked_until)
 * 3. Comparer pin_hash Firestore avec le hash du PIN saisi
 * 4. Incrémenter tentatives / bloquer après 5 échecs
 * 5. Succès : reset compteur + last_login
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const snap = await getDocs(
    query(collection(db, 'users'),
      where('phone', '==', payload.phone),
      where('is_verified', '==', true))
  );
  if (snap.empty) throw new Error('USER_NOT_FOUND');

  const userDoc = snap.docs[0];
  const ud = userDoc.data();
  const uid = userDoc.id;

  // Vérifier blocage
  if (ud.locked_until) {
    const lockedUntil: Date = ud.locked_until.toDate();
    if (new Date() < lockedUntil) {
      const mins = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
      throw new Error(`ACCOUNT_LOCKED:${mins}`);
    }
    await updateDoc(doc(db, 'users', uid), { locked_until: null, login_attempts: 0 });
  }

  // Comparer le PIN
  const inputHash = await hashPIN(payload.pin);
  if (inputHash !== ud.pin_hash) {
    const attempts = (ud.login_attempts || 0) + 1;
    const update: any = { login_attempts: attempts };
    if (attempts >= 5) {
      update.locked_until = Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000));
      await updateDoc(doc(db, 'users', uid), update);
      throw new Error('ACCOUNT_LOCKED:30');
    }
    await updateDoc(doc(db, 'users', uid), update);
    throw new Error(`INVALID_CREDENTIALS:${5 - attempts}`);
  }

  // Succès
  await updateDoc(doc(db, 'users', uid), {
    login_attempts: 0,
    locked_until: null,
    last_login: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  return {
    uid,
    fullName: ud.full_name,
    phone: ud.phone,
    operator: ud.operator,
    role: ud.role || 'member',
    groupId: ud.active_group_id,
    profilePhotoUrl: ud.profile_photo_url,
  };
}

// ─── BIOMÉTRIE ────────────────────────────────────────────────────────────────

export async function loginWithBiometric(phone: string, _token: string): Promise<AuthResponse> {
  if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
  const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  const ud = userDoc.data();
  return {
    uid: auth.currentUser.uid,
    fullName: ud.full_name,
    phone: ud.phone,
    operator: ud.operator,
    role: ud.role || 'member',
    groupId: ud.active_group_id,
  };
}

// ─── CHANGEMENT DE PIN ────────────────────────────────────────────────────────

export async function changePin(uid: string, oldPin: string, newPin: string): Promise<void> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  const ud = userDoc.data();
  if (await hashPIN(oldPin) !== ud.pin_hash) throw new Error('INVALID_OLD_PIN');
  await updateDoc(doc(db, 'users', uid), {
    pin_hash: await hashPIN(newPin),
    updated_at: serverTimestamp(),
  });
}

// ─── RESET PIN (via OTP) ──────────────────────────────────────────────────────

export async function resetPIN(phone: string, newPin: string): Promise<{ success: boolean }> {
  const pinHash = await hashPIN(newPin);
  const snap = await getDocs(
    query(collection(db, 'users'), where('phone', '==', phone))
  );
  if (snap.empty) throw new Error('USER_NOT_FOUND');
  await updateDoc(doc(db, 'users', snap.docs[0].id), {
    pin_hash: pinHash,
    login_attempts: 0,
    locked_until: null,
    updated_at: serverTimestamp(),
  });
  return { success: true };
}

// ─── DÉCONNEXION ──────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try { await signOut(auth); } catch (e) {}
}

export async function logoutAllDevices(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    force_logout_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  await logout();
}

// ─── PROFIL ───────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<Record<string, any>> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  // Ne JAMAIS retourner pin_hash
  const { pin_hash, ...safeData } = userDoc.data();
  return safeData;
}

export async function updateUserProfile(uid: string, data: Record<string, any>): Promise<void> {
  // Interdire la mise à jour de pin_hash via cette fonction
  const { pin_hash, ...safeData } = data;
  await updateDoc(doc(db, 'users', uid), {
    ...safeData,
    updated_at: serverTimestamp(),
  });
}

export async function updatePushToken(userId: string, token: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), {
    fcm_token: token,
    updated_at: serverTimestamp(),
  });
}

export async function getCurrentUser() {
  return auth.currentUser;
}
