/**
 * App.tsx — v2.0
 * SQLite supprimé. Firebase est l'unique source de données.
 * initFirebaseListener() démarre le listener onAuthStateChanged au boot.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/stores/authStore';
import { Colors } from './src/constants/colors';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';

export default function App() {
  const isLoading = useAuthStore((s) => s.isLoading);

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    // Initialiser le listener Firebase Auth — gère la persistance de session
    useAuthStore.getState().loadPersistedSession().catch((error) => {
      console.error('[App] Impossible de restaurer la session:', error);
    });
    const unsubscribe = useAuthStore.getState().initFirebaseListener();
    return () => unsubscribe();
  }, []);

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <Toast />
    </SafeAreaProvider>
  );
}
