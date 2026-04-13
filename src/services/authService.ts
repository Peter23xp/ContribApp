import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as db from './database';

// ─── Types ────────────────────────────────────────────────────────────────────
export type MobileOperator = 'airtel' | 'orange' | 'mpesa' | 'mtn';
export type UserRole = 'admin' | 'treasurer' | 'member' | 'auditor';

export interface RegisterPayload {
  full_name: string;
  phone: string;       // ex: +243970000000
  operator: MobileOperator;
  pin_hash: string;
}

export interface LoginPayload {
  phone: string;
  pin_hash: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    full_name: string;
    phone: string;
    operator: MobileOperator;
    profile_photo_url?: string;
  };
  role: UserRole;
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────

export const register = async (payload: RegisterPayload): Promise<{ success: boolean }> => {
  // Vérifier si le numéro existe déjà
  const existing = db.findUserByPhone(payload.phone);
  if (existing) throw new Error('PHONE_ALREADY_EXISTS');

  // Générer un ID unique
  const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  db.createUser({ id, ...payload });

  // Générer et sauvegarder un OTP
  const code = db.generateOTP();
  db.saveOTP(payload.phone, code, 'register');

  return { success: true };
};

// ─── VERIFY OTP ───────────────────────────────────────────────────────────────

export const verifyOTP = async (phone: string, otp_code: string): Promise<AuthResponse> => {
  const result = db.verifyOTPCode(phone, otp_code);

  if (!result.valid) {
    throw new Error(result.reason ?? 'INVALID_OTP');
  }

  // Marquer l'utilisateur comme vérifié
  db.markUserAsVerified(phone);

  const user = db.findUserByPhone(phone);
  if (!user) throw new Error('USER_NOT_FOUND');

  // Générer des tokens locaux
  const access_token = 'access_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const refresh_token = 'refresh_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  // Persistance des tokens
  await SecureStore.setItemAsync('access_token', access_token);
  await SecureStore.setItemAsync('refresh_token', refresh_token);

  return {
    access_token,
    refresh_token,
    user: {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      operator: user.operator,
      profile_photo_url: user.profile_photo_url ?? undefined,
    },
    role: (user.role as UserRole) ?? 'member',
  };
};

// ─── RESEND OTP ───────────────────────────────────────────────────────────────

export const resendOTP = async (phone: string): Promise<{ expires_in: number }> => {
  const user = db.findUserByPhone(phone);
  if (!user) throw new Error('USER_NOT_FOUND');

  const code = db.generateOTP();
  db.saveOTP(phone, code, 'resend');

  return { expires_in: 120 };
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────

export const login = async (payload: LoginPayload): Promise<AuthResponse> => {
  const user = db.findUserByPhone(payload.phone);

  if (!user) throw new Error('INVALID_CREDENTIALS');
  if (user.pin_hash !== payload.pin_hash) throw new Error('INVALID_CREDENTIALS');
  if (!user.is_verified) throw new Error('NOT_VERIFIED');

  // Générer des tokens locaux
  const access_token = 'access_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const refresh_token = 'refresh_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  await SecureStore.setItemAsync('access_token', access_token);
  await SecureStore.setItemAsync('refresh_token', refresh_token);

  return {
    access_token,
    refresh_token,
    user: {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      operator: user.operator,
      profile_photo_url: user.profile_photo_url ?? undefined,
    },
    role: (user.role as UserRole) ?? 'member',
  };
};

// ─── BIOMETRIC LOGIN ──────────────────────────────────────────────────────────

export const loginWithBiometric = async (phone: string, _biometric_token: string): Promise<AuthResponse> => {
  const user = db.findUserByPhone(phone);
  if (!user) throw new Error('INVALID_CREDENTIALS');

  // Générer des tokens locaux
  const access_token = 'access_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const refresh_token = 'refresh_' + Date.now() + '_' + Math.random().toString(36).slice(2);

  await SecureStore.setItemAsync('access_token', access_token);
  await SecureStore.setItemAsync('refresh_token', refresh_token);

  return {
    access_token,
    refresh_token,
    user: {
      id: user.id,
      full_name: user.full_name,
      phone: user.phone,
      operator: user.operator,
    },
    role: (user.role as UserRole) ?? 'member',
  };
};

// ─── LOGOUT ───────────────────────────────────────────────────────────────────

export const logout = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');
  } catch {
    // silencieux
  }
};

// ─── HASH PIN ─────────────────────────────────────────────────────────────────

export const hashPIN = async (pin: string): Promise<string> => {
  return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
};
