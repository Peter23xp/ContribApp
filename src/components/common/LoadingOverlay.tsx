/**
 * LoadingOverlay.tsx — Composant de chargement plein écran
 * 
 * Affiche un spinner centré avec fond semi-transparent.
 */
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Colors, Fonts } from '../../constants/colors';

export function LoadingOverlay() {
  return (
    <View style={styles.overlay}>
      <View style={styles.box}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.text}>Chargement...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  box: {
    alignItems: 'center',
    gap: 16,
  },
  text: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.onSurfaceVariant,
  },
});
