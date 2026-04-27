/**
 * otpService.ts — Service OTP v1.0
 * Génération, envoi et vérification des OTP par email via EmailJS.
 * OTP stockés temporairement dans Firestore (collection otp_codes).
 * Le code OTP est haché SHA-256 avant stockage — jamais en clair dans Firestore.
 */
import emailjs from '@emailjs/browser';
import * as Crypto from 'expo-crypto';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { EMAILJS_CONFIG } from '../config/emailjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OTPRecord {
  email: string;
  phone: string;
  code: string;              // SHA-256 du code OTP (JAMAIS en clair)
  purpose: 'registration' | 'login_recovery' | 'pin_reset';
  created_at: Timestamp;
  expires_at: Timestamp;     // created_at + 10 minutes
  attempts: number;          // compteur de tentatives incorrectes
  verified: boolean;         // true une fois le code confirmé
}

// ─── Helpers internes ────────────────────────────────────────────────────────

/** Génère une clé Firestore safe depuis une chaîne arbitraire */
async function hashForKey(input: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input
  );
}

const OTP_SALT = 'otp_salt_contributapp';

/** Génère un code OTP à 6 chiffres cryptographiquement aléatoire */
async function generateOTP(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(4);
  const randomNumber =
    ((randomBytes[0] << 24) |
     (randomBytes[1] << 16) |
     (randomBytes[2] << 8) |
      randomBytes[3]) >>> 0;
  const otp = (randomNumber % 900000) + 100000; // 100000–999999
  return otp.toString();
}

// ─── Fonctions publiques ──────────────────────────────────────────────────────

/**
 * ENVOI OTP :
 * 1. Rate-limit : refus si un OTP a été envoyé il y a moins de 2 minutes
 * 2. Générer un OTP aléatoire et hacher le code (SHA-256)
 * 3. Stocker dans Firestore otp_codes/{docKey} (code haché, jamais en clair)
 * 4. Envoyer l'email via EmailJS
 * 5. Rollback Firestore si l'envoi EmailJS échoue
 */
export async function sendOTP(
  email: string,
  phone: string,
  recipientName: string,
  purpose: OTPRecord['purpose']
): Promise<void> {
  const docKey = await hashForKey(phone + purpose);
  const existingDoc = await getDoc(doc(db, 'otp_codes', docKey));

  if (existingDoc.exists()) {
    const existing = existingDoc.data() as OTPRecord;
    const createdAt = existing.created_at.toDate();
    const minutesAgo = (Date.now() - createdAt.getTime()) / 60000;

    if (minutesAgo < 2) {
      const waitSeconds = Math.ceil(120 - minutesAgo * 60);
      throw new Error(`RATE_LIMIT:${waitSeconds}`);
    }
  }

  // Générer et hacher le code
  const otpCode = await generateOTP();
  const otpHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    otpCode + OTP_SALT
  );

  // Stocker dans Firestore
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await setDoc(doc(db, 'otp_codes', docKey), {
    email,
    phone,
    code: otpHash,
    purpose,
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromDate(expiresAt),
    attempts: 0,
    verified: false,
  } as OTPRecord);

  // Envoyer via EmailJS
  try {
    const isConfigured =
      EMAILJS_CONFIG.serviceId &&
      EMAILJS_CONFIG.templateId &&
      EMAILJS_CONFIG.publicKey;

    if (!isConfigured) {
      // Mode dev sans EmailJS configuré — affiche le code dans la console
      console.warn('[otpService] EmailJS non configuré. Code OTP (dev only):', otpCode);
      return;
    }

    await emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      {
        to_name: recipientName,
        to_email: email,
        otp_code: otpCode,
        expires_in: '10 minutes',
      },
      EMAILJS_CONFIG.publicKey
    );
  } catch (emailError: any) {
    // Rollback : supprimer le document Firestore si l'email échoue
    await deleteDoc(doc(db, 'otp_codes', docKey));

    if (emailError?.status === 422) throw new Error('INVALID_EMAIL');
    if (emailError?.status === 429) throw new Error('EMAILJS_QUOTA_EXCEEDED');
    throw new Error('EMAIL_SEND_FAILED');
  }
}

/**
 * VÉRIFICATION OTP :
 * 1. Récupérer le document depuis Firestore
 * 2. Vérifier l'expiration et les tentatives (max 5)
 * 3. Comparer le hash du code saisi avec le hash stocké
 * 4. Si correct : marquer verified=true
 * 5. Si incorrect : incrémenter attempts et lancer une erreur avec tentatives restantes
 */
export async function verifyOTP(
  phone: string,
  purpose: OTPRecord['purpose'],
  inputCode: string
): Promise<boolean> {
  const docKey = await hashForKey(phone + purpose);
  const otpDoc = await getDoc(doc(db, 'otp_codes', docKey));

  if (!otpDoc.exists()) {
    throw new Error('OTP_NOT_FOUND');
  }

  const otpData = otpDoc.data() as OTPRecord;

  // Vérifier expiration
  if (new Date() > otpData.expires_at.toDate()) {
    await deleteDoc(doc(db, 'otp_codes', docKey));
    throw new Error('OTP_EXPIRED');
  }

  // Vérifier si déjà utilisé
  if (otpData.verified) {
    throw new Error('OTP_ALREADY_USED');
  }

  // Vérifier tentatives max
  if (otpData.attempts >= 5) {
    await deleteDoc(doc(db, 'otp_codes', docKey));
    throw new Error('OTP_MAX_ATTEMPTS');
  }

  // Comparer le hash
  const inputHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    inputCode + OTP_SALT
  );

  if (inputHash !== otpData.code) {
    await updateDoc(doc(db, 'otp_codes', docKey), {
      attempts: otpData.attempts + 1,
    });
    const remaining = 5 - (otpData.attempts + 1);
    throw new Error(`OTP_INVALID:${remaining}`);
  }

  // Succès → marquer comme vérifié
  await updateDoc(doc(db, 'otp_codes', docKey), { verified: true });
  return true;
}

/**
 * Supprimer le document OTP après utilisation complète.
 * Appeler après que l'inscription ou la réinitialisation est terminée.
 */
export async function cleanupOTP(
  phone: string,
  purpose: OTPRecord['purpose']
): Promise<void> {
  const docKey = await hashForKey(phone + purpose);
  await deleteDoc(doc(db, 'otp_codes', docKey));
}
