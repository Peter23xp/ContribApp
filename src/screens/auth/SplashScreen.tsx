import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../stores/authStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type AuthStackParamList = {
  Splash: undefined;
  Login: undefined;
};

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Splash'>;
};

export default function SplashScreen({ navigation }: Props) {
  const loadFromStorage = useAuthStore(state => state.loadFromStorage);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Démarrer les animations visuelles
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    // La barre de progression
    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 1500,
      useNativeDriver: false,
    }).start();

    const bootSequence = async () => {
      try {
        // 2. Attendre 500ms
        await new Promise(resolve => setTimeout(resolve, 500));

        // 3. Appeler loadFromStorage()
        await loadFromStorage();

        // 4. Attendre que la barre soit à 100% (soit encore ~1000ms)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 5. Si l'utilisateur n'est pas authentifié, aller au Login.
        // Si authentifié, AppNavigator bascule automatiquement vers les Tabs.
        const authState = useAuthStore.getState();
        if (!authState.isAuthenticated) {
          navigation.replace('Login');
        }
        // Si authentifié, ne rien faire — AppNavigator affichera
        // automatiquement AppTabNavigator via le flag isAuthenticated.
      } catch (error) {
        navigation.replace('Login');
      }
    };

    bootSequence();
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%']
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>💰</Text>
        </View>
        
        <Text style={styles.title}>ContribApp RDC</Text>
        <Text style={styles.subtitle}>Vos contributions, en toute transparence</Text>
      </Animated.View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBarBackground}>
          <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 50,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 24,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
});
