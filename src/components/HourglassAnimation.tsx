import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * HourglassAnimation — Composant d'animation sablier
 * Utilisé dans la Hero Card "EN VÉRIFICATION" du MemberDashboardScreen.
 * - Icône "hourglass" (Ionicons) de taille 52px, couleur #9B59B6
 * - Animation en boucle : rotation 0° → 180° → 0° (flip vertical) toutes les 2 secondes
 */
export default function HourglassAnimation() {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.delay(500),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="hourglass-outline" size={52} color="#9B59B6" />
    </Animated.View>
  );
}
