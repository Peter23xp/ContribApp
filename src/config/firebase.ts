/**
 * firebase.ts — Configuration Firebase v2.0
 * Architecture : 100% Firebase + Cloudflare R2 (SQLite supprimé)
 * Persistance Auth via AsyncStorage (recommandé Expo)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth avec persistance AsyncStorage — évite la reconnexion après fermeture
// initializeAuth est appelé une seule fois (si app est neuf), sinon getAuth()
export const auth = getApps().length === 1
  ? initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  : getAuth(app);

export const db = getFirestore(app);
export default app;
