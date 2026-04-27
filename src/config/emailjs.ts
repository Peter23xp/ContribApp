/**
 * emailjs.ts — Configuration EmailJS v1.0
 * Utilisé pour l'envoi d'OTP par email (gratuit jusqu'à 200 emails/mois).
 *
 * SETUP :
 * 1. Créer un compte sur https://www.emailjs.com
 * 2. Connecter un service email (Gmail recommandé) → noter le SERVICE_ID
 * 3. Créer un template avec les variables : {{to_name}}, {{to_email}}, {{otp_code}}, {{expires_in}}
 *    → Sujet : "Votre code de vérification ContribApp — {{otp_code}}"
 *    → noter le TEMPLATE_ID
 * 4. Dans "Account" → noter la PUBLIC_KEY
 * 5. Ajouter dans .env :
 *    EXPO_PUBLIC_EMAILJS_SERVICE_ID=service_xxxxxxx
 *    EXPO_PUBLIC_EMAILJS_TEMPLATE_ID=template_xxxxxxx
 *    EXPO_PUBLIC_EMAILJS_PUBLIC_KEY=xxxxxxxxxxxxxxx
 */
import emailjs from '@emailjs/browser';

/**
 * Initialiser EmailJS avec la clé publique.
 * Appeler cette fonction au démarrage de l'app (dans App.tsx useEffect).
 */
export function initEmailJS(): void {
  const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('[EmailJS] EXPO_PUBLIC_EMAILJS_PUBLIC_KEY non configuré dans .env');
    return;
  }
  emailjs.init(publicKey);
}

export const EMAILJS_CONFIG = {
  serviceId: process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID ?? '',
  templateId: process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID ?? '',
  publicKey: process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY ?? '',
} as const;
