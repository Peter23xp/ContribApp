import { init } from '@emailjs/react-native';

export function initEmailJS(): void {
  const publicKey = process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('[EmailJS] EXPO_PUBLIC_EMAILJS_PUBLIC_KEY non configuré dans .env');
    return;
  }
  init({ publicKey });
}

export const EMAILJS_CONFIG = {
  serviceId:  process.env.EXPO_PUBLIC_EMAILJS_SERVICE_ID   ?? '',
  templateId: process.env.EXPO_PUBLIC_EMAILJS_TEMPLATE_ID  ?? '',
  publicKey:  process.env.EXPO_PUBLIC_EMAILJS_PUBLIC_KEY   ?? '',
  privateKey: process.env.EXPO_PUBLIC_EMAILJS_PRIVATE_KEY  ?? '',
} as const;
