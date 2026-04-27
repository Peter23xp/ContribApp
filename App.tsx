/**
 * App.tsx — v3.0
 * Firebase Auth supprimé. Session gérée via AsyncStorage + Firestore (initSession).
 * initEmailJS() initialisé au démarrage pour l'envoi d'OTP.
 */
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from './src/stores/authStore';
import { Colors } from './src/constants/colors';
import { initEmailJS } from './src/config/emailjs';
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
    // Initialiser EmailJS pour l'envoi d'OTP par email
    initEmailJS();

    // Initialiser la session : lit AsyncStorage + vérifie le token dans Firestore
    useAuthStore.getState().initSession().catch((error) => {
      console.error('[App] Impossible d\'initialiser la session:', error);
    });
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
