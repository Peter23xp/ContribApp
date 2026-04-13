import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Colors } from '../../constants/colors';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  style?: ViewStyle;
  variant?: 'solid' | 'outline' | 'text';
}

export function AppButton({ title, onPress, disabled, loading, loadingText, style, variant = 'solid' }: Props) {
  const isOutline = variant === 'outline';
  return (
    <TouchableOpacity 
      style={[styles.button, isOutline && styles.outline, disabled && styles.disabled, style]} 
      onPress={onPress} 
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <ActivityIndicator color={isOutline ? Colors.primary : "#FFF"} style={{marginRight: 8}} />
          <Text style={[styles.text, isOutline && styles.textOutline]}>{loadingText || title}</Text>
        </>
      ) : (
        <Text style={[styles.text, isOutline && styles.textOutline]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 16, // Légèrement plus haut pour le standard
    borderRadius: 12, // Radius.lg standardisé
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    // Ajout ombre standard
    shadowColor: Colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    backgroundColor: Colors.surfaceContainerHigh, // #D5ECF8
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontFamily: 'Manrope_700Bold', // Fonts.headline
    color: '#FFF',
    fontSize: 17,
  },
  textOutline: {
    color: Colors.primary,
  }
});
