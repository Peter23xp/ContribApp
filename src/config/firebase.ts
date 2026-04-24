/**
 * firebase.ts — Configuration Firebase v2.0
 * Architecture : 100% Firebase + Cloudflare R2 (SQLite supprimé)
 * Persistance Auth via AsyncStorage (recommandé Expo)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Évite la double initialisation en hot-reload Expo
let app;
let isNewApp = false;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  isNewApp = true;
} else {
  app = getApp();
}

// Auth avec persistance AsyncStorage — évite la reconnexion après fermeture
export const auth = isNewApp
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  : getAuth(app);

// Utilise la détection auto du long polling pour éviter les erreurs de timeout ou de stream RPC sur Expo
export const db = isNewApp
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  : getFirestore(app);

export default app;
