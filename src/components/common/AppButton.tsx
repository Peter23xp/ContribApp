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
}

export function AppButton({ title, onPress, disabled, loading, loadingText, style }: Props) {
  return (
    <TouchableOpacity 
      style={[styles.button, disabled && styles.disabled, style]} 
      onPress={onPress} 
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <ActivityIndicator color="#FFF" style={{marginRight: 8}} />
          <Text style={styles.text}>{loadingText || title}</Text>
        </>
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#A5D6A7', // Grisé pour désactivé
  },
  text: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
