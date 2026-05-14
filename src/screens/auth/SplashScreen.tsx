import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar, Image } from 'react-native';

const LOGO = require('../../../assets/images/logo.png');
import { Colors, Fonts } from '../../constants/colors';
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
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const scaleAnim = useRef(new Animated.Value(0.72)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 100,
      duration: 1600,
      useNativeDriver: false,
    }).start();

    const bootSequence = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await new Promise(resolve => setTimeout(resolve, 1100));
        const authState = useAuthStore.getState();
        if (!authState.isAuthenticated) {
          navigation.replace('Login');
        }
      } catch (error) {
        navigation.replace('Login');
      }
    };

    bootSequence();
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.18],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Background decorative rings */}
      <View style={styles.bgRing1} />
      <View style={styles.bgRing2} />
      <View style={styles.bgRing3} />

      {/* Gold glow behind logo */}
      <Animated.View style={[styles.goldGlow, { opacity: glowOpacity }]} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo mark */}
        <Animated.View style={[styles.logoWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Image source={LOGO} style={styles.logoImage} resizeMode="contain" />
        </Animated.View>

        <View style={styles.textWrap}>
          <Text style={styles.wordMark}>CONTRIB</Text>
          <View style={styles.rdcBadge}>
            <Text style={styles.rdcText}>RDC</Text>
          </View>
        </View>

        <Text style={styles.tagline}>Vos contributions, en toute transparence</Text>
      </Animated.View>

      {/* Progress */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Decorative background rings
  bgRing1: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    top: '50%',
    left: '50%',
    marginTop: -210,
    marginLeft: -210,
  },
  bgRing2: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    top: '50%',
    left: '50%',
    marginTop: -150,
    marginLeft: -150,
  },
  bgRing3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.12)',
    top: '50%',
    left: '50%',
    marginTop: -90,
    marginLeft: -90,
  },

  goldGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.gold,
    top: '50%',
    left: '50%',
    marginTop: -120 - 40,
    marginLeft: -120,
  },

  content: {
    alignItems: 'center',
    marginBottom: 80,
  },

  // Logo
  logoWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 26,
    shadowColor: Colors.gold,
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },

  textWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  wordMark: {
    fontFamily: Fonts.display,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  rdcBadge: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 5,
  },
  rdcText: {
    fontFamily: Fonts.title,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 1,
  },

  tagline: {
    fontFamily: Fonts.body,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  // Progress
  progressContainer: {
    position: 'absolute',
    bottom: 72,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  progressTrack: {
    width: 160,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  loadingText: {
    fontFamily: Fonts.label,
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
