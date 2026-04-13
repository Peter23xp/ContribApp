import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initDatabase } from './src/services/database';
import { initLocalDatabase } from './src/config/dbInit';
import { USE_LOCAL_DB } from './src/config/database';
import { useAuthStore } from './src/stores/authStore';
import { Colors } from './src/constants/colors';
import { useFonts, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';

export default function App() {
  const [dbReady, setDbReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    const unsubscribe = useAuthStore.getState().initFirebaseListener();

    if (USE_LOCAL_DB) {
      initLocalDatabase().catch(console.error);
    }
    
    initDatabase()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('[DB] Erreur initialisation:', e);
        setDbReady(true);
      });

    return () => unsubscribe();
  }, []);

  if (!dbReady || !fontsLoaded) {
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
