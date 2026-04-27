/**
 * authService.ts — v3.0
 *
 * ARCHITECTURE v3 :
 * - Numéro de téléphone = username (identifiant unique)
 * - PIN à 6 chiffres = mot de passe (haché SHA-256 + sel côté client)
 * - Email = canal de réception OTP (via EmailJS)
 * - Firebase Auth supprimé — sessions gérées via AsyncStorage + Firestore
 * - UID généré côté client (SHA-256 du téléphone + timestamp + random)
 * - sessionToken stocké dans Firestore users/{uid}.active_session_token
 *   pour la déconnexion multi-appareils
 *
 * AUCUNE référence à Firebase Auth, SecureStore, SQLite, phone_directory, login_sessions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {
  doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, collection, where, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import * as otpService from './otpService';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SESSION_KEY = '@contributapp_session';
const PIN_SALT = 'contributapp_rdc_pin_salt_2026';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MobileOperator = 'airtel' | 'orange' | 'mpesa' | 'mtn';
export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface LocalSession {
  uid: string;
  phone: string;
  fullName: string;
  operator: string;
  email: string;
  role: 'admin' | 'treasurer' | 'member';
  groupId: string | null;
  sessionToken: string;
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  phone: string;          // +243XXXXXXXXX — identifiant unique (username)
  email: string;          // pour recevoir les OTP
  operator: MobileOperator;
  pin: string;            // 6 chiffres — sera haché
}

export interface LoginPayload {
  phone: string;          // username
  pin: string;            // 6 chiffres
}

export interface AuthResponse {
  uid: string;
  fullName: string;
  phone: string;
  email: string;
  operator: string;
  role: 'admin' | 'treasurer' | 'member';
  groupId: string | null;
}

// ─── Session locale (AsyncStorage) ───────────────────────────────────────────

export async function getLocalSession(): Promise<LocalSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveLocalSession(session: LocalSession): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearLocalSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

/** Hache le PIN avec sel fixe. Le PIN en clair ne quitte JAMAIS l'appareil. */
export async function hashPIN(pin: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + PIN_SALT
  );
}

/** Génère un token de session unique (64 caractères hex) */
async function generateSessionToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── INSCRIPTION ──────────────────────────────────────────────────────────────

/**
 * ÉTAPE 1 D'INSCRIPTION :
 * 1. Vérifier l'unicité du numéro (query Firestore users.phone)
 * 2. Vérifier l'unicité de l'email (query Firestore users.email)
 * 3. Hacher le PIN
 * 4. Stocker dans pending_registrations/{hash(phone)}
 * 5. Envoyer l'OTP par email via otpService
 */
export async function register(payload: RegisterPayload): Promise<void> {
  const normalizedEmail = payload.email.toLowerCase().trim();

  // 1. Vérifier unicité du numéro
  const phoneQuery = query(
    collection(db, 'users'),
    where('phone', '==', payload.phone)
  );
  const phoneSnap = await getDocs(phoneQuery);
  if (!phoneSnap.empty) throw new Error('PHONE_ALREADY_EXISTS');

  // 2. Vérifier unicité de l'email
  const emailQuery = query(
    collection(db, 'users'),
    where('email', '==', normalizedEmail)
  );
  const emailSnap = await getDocs(emailQuery);
  if (!emailSnap.empty) throw new Error('EMAIL_ALREADY_EXISTS');

  // 3. Hacher le PIN
  const pinHash = await hashPIN(payload.pin);

  // 4. Stocker temporairement dans Firestore (TTL : 15 minutes)
  const phoneHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload.phone
  );
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await setDoc(doc(db, 'pending_registrations', phoneHash), {
    full_name: payload.fullName,
    phone: payload.phone,
    email: normalizedEmail,
    operator: payload.operator,
    pin_hash: pinHash,
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
  });

  // 5. Envoyer l'OTP par email
  try {
    await otpService.sendOTP(
      normalizedEmail,
      payload.phone,
      payload.fullName,
      'registration'
    );
  } catch (err) {
    // Nettoyer si l'envoi échoue
    await deleteDoc(doc(db, 'pending_registrations', phoneHash));
    throw err;
  }
}

/**
 * ÉTAPE 2 D'INSCRIPTION — Vérification OTP :
 * 1. Vérifier l'OTP via otpService.verifyOTP()
 * 2. Récupérer les données depuis pending_registrations
 * 3. Générer un UID unique côté client
 * 4. Créer users/{uid} dans Firestore
 * 5. Nettoyer les documents temporaires
 * 6. Créer et sauvegarder la session locale
 * 7. Retourner AuthResponse
 */
export async function verifyRegistrationOTP(
  phone: string,
  otpCode: string
): Promise<AuthResponse> {
  // 1. Vérifier l'OTP
  await otpService.verifyOTP(phone, 'registration', otpCode);

  // 2. Récupérer les données temporaires
  const phoneHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    phone
  );
  const pendingDoc = await getDoc(doc(db, 'pending_registrations', phoneHash));
  if (!pendingDoc.exists()) throw new Error('REGISTRATION_DATA_EXPIRED');

  const pending = pendingDoc.data();

  // Vérifier expiration
  if (new Date() > pending.expires_at.toDate()) {
    await deleteDoc(doc(db, 'pending_registrations', phoneHash));
    throw new Error('REGISTRATION_EXPIRED');
  }

  // 3. Générer un UID unique
  const uid = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    phone + Date.now().toString() + Math.random().toString()
  );

  // 4. Générer le token de session
  const sessionToken = await generateSessionToken();

  // 5. Créer le document utilisateur dans Firestore
  await setDoc(doc(db, 'users', uid), {
    uid,
    full_name: pending.full_name,
    phone: pending.phone,
    email: pending.email,
    operator: pending.operator,
    profile_photo_url: null,
    pin_hash: pending.pin_hash,
    role: 'member',
    active_group_id: null,
    login_attempts: 0,
    locked_until: null,
    biometric_enabled: false,
    fcm_token: null,
    active_session_token: sessionToken,
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

  // 6. Nettoyer les documents temporaires
  await deleteDoc(doc(db, 'pending_registrations', phoneHash));
  await otpService.cleanupOTP(phone, 'registration');

  // 7. Sauvegarder la session locale
  const session: LocalSession = {
    uid,
    phone: pending.phone,
    fullName: pending.full_name,
    operator: pending.operator,
    email: pending.email,
    role: 'member',
    groupId: null,
    sessionToken,
    createdAt: new Date().toISOString(),
  };
  await saveLocalSession(session);

  return {
    uid,
    fullName: pending.full_name,
    phone: pending.phone,
    email: pending.email,
    operator: pending.operator,
    role: 'member',
    groupId: null,
  };
}

// ─── CONNEXION ────────────────────────────────────────────────────────────────

/**
 * CONNEXION avec numéro (username) + PIN :
 * 1. Chercher l'utilisateur par numéro de téléphone dans Firestore
 * 2. Vérifier si le compte est bloqué
 * 3. Comparer le PIN haché
 * 4. Succès → générer nouveau token session + sauvegarder localement
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const q = query(
    collection(db, 'users'),
    where('phone', '==', payload.phone)
  );
  const snap = await getDocs(q);

  if (snap.empty) throw new Error('USER_NOT_FOUND');

  const userDoc = snap.docs[0];
  const userData = userDoc.data();
  const uid = userDoc.id;

  // Vérifier le blocage
  if (userData.locked_until) {
    const lockedUntil = userData.locked_until.toDate();
    if (new Date() < lockedUntil) {
      const minutesLeft = Math.ceil(
        (lockedUntil.getTime() - Date.now()) / 60000
      );
      throw new Error(`ACCOUNT_LOCKED:${minutesLeft}`);
    }
    // Débloquer si le temps est écoulé
    await updateDoc(doc(db, 'users', uid), {
      locked_until: null,
      login_attempts: 0,
    });
  }

  // Vérifier le PIN
  const inputPinHash = await hashPIN(payload.pin);
  if (inputPinHash !== userData.pin_hash) {
    const attempts = (userData.login_attempts || 0) + 1;
    const updateData: Record<string, any> = { login_attempts: attempts };
    if (attempts >= 5) {
      const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      updateData.locked_until = Timestamp.fromDate(lockUntil);
      await updateDoc(doc(db, 'users', uid), updateData);
      throw new Error('ACCOUNT_LOCKED:30');
    }
    await updateDoc(doc(db, 'users', uid), updateData);
    throw new Error(`INVALID_CREDENTIALS:${5 - attempts}`);
  }

  // Succès — nouveau token session
  const sessionToken = await generateSessionToken();
  await updateDoc(doc(db, 'users', uid), {
    login_attempts: 0,
    locked_until: null,
    active_session_token: sessionToken,
    last_login: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // Sauvegarder session locale
  const session: LocalSession = {
    uid,
    phone: userData.phone,
    fullName: userData.full_name,
    operator: userData.operator,
    email: userData.email,
    role: userData.role || 'member',
    groupId: userData.active_group_id || null,
    sessionToken,
    createdAt: new Date().toISOString(),
  };
  await saveLocalSession(session);

  return {
    uid,
    fullName: userData.full_name,
    phone: userData.phone,
    email: userData.email,
    operator: userData.operator,
    role: userData.role || 'member',
    groupId: userData.active_group_id || null,
  };
}

// ─── RESET PIN ────────────────────────────────────────────────────────────────

/** Envoie un OTP par email pour réinitialiser le PIN */
export async function requestPinReset(phone: string): Promise<void> {
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('USER_NOT_FOUND');
  const userData = snap.docs[0].data();
  await otpService.sendOTP(
    userData.email,
    phone,
    userData.full_name,
    'pin_reset'
  );
}

/** Confirme le code OTP et applique le nouveau PIN */
export async function confirmPinReset(
  phone: string,
  otpCode: string,
  newPin: string
): Promise<void> {
  await otpService.verifyOTP(phone, 'pin_reset', otpCode);
  const q = query(collection(db, 'users'), where('phone', '==', phone));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('USER_NOT_FOUND');
  const uid = snap.docs[0].id;
  const newPinHash = await hashPIN(newPin);
  await updateDoc(doc(db, 'users', uid), {
    pin_hash: newPinHash,
    login_attempts: 0,
    locked_until: null,
    updated_at: serverTimestamp(),
  });
  await otpService.cleanupOTP(phone, 'pin_reset');
}

// ─── CHANGEMENT DE PIN ────────────────────────────────────────────────────────

export async function changePin(
  uid: string,
  oldPin: string,
  newPin: string
): Promise<void> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  const userData = userDoc.data();
  const oldPinHash = await hashPIN(oldPin);
  if (oldPinHash !== userData.pin_hash) throw new Error('INVALID_OLD_PIN');
  const newPinHash = await hashPIN(newPin);
  await updateDoc(doc(db, 'users', uid), {
    pin_hash: newPinHash,
    updated_at: serverTimestamp(),
  });
}

// ─── DÉCONNEXION ──────────────────────────────────────────────────────────────

/** Déconnecte l'utilisateur : révoque le token session + efface la session locale */
export async function logout(uid?: string): Promise<void> {
  if (uid) {
    try {
      await updateDoc(doc(db, 'users', uid), {
        active_session_token: null,
      });
    } catch { /* ignorer les erreurs réseau lors de la déconnexion */ }
  }
  await clearLocalSession();
}

/** Déconnecter tous les appareils (token révoqué + force_logout_at) */
export async function logoutAllDevices(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    active_session_token: null,
    force_logout_at: serverTimestamp(),
  });
  await clearLocalSession();
}

// ─── PROFIL ───────────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<Record<string, any>> {
  const userDoc = await getDoc(doc(db, 'users', uid));
  if (!userDoc.exists()) throw new Error('USER_NOT_FOUND');
  // Ne JAMAIS retourner pin_hash
  const { pin_hash, ...safeData } = userDoc.data();
  return safeData;
}

export async function updateUserProfile(
  uid: string,
  data: Record<string, any>
): Promise<void> {
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
