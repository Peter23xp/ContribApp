/**
 * firebase.ts — Configuration Firebase (React Native / Expo)
 * 
 * Utilise initializeAuth avec getReactNativePersistence pour
 * que la session Auth persiste entre les relances de l'app.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
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

// Évite la réinitialisation en mode hot-reload Expo
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth avec persistence React Native (AsyncStorage)
let auth: ReturnType<typeof initializeAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (e) {
  // En hot-reload, initializeAuth peut lancer si le auth a déjà été initialisé
  auth = getAuth(app) as any;
}

export { auth };
export const db = getFirestore(app);
export default app;
