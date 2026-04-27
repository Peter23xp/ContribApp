/**
 * firebase.ts — v3.0
 * Firebase Auth supprimé. Seul Firestore est utilisé.
 * L'authentification est gérée manuellement via Firestore + sessions AsyncStorage.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

let app;
let isNewApp = false;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  isNewApp = true;
} else {
  app = getApp();
}

// Utilise le long polling pour éviter les timeout RPC sur Expo
export const db = isNewApp
  ? initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
  : getFirestore(app);

export default app;

// NOTE : Firebase Auth est supprimé (v3.0).
// Authentification gérée via : Firestore users/{uid} + sessionToken + AsyncStorage.
// PIN haché SHA-256 côté client, jamais stocké en clair.
