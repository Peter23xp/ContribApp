import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

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
  const isText = variant === 'text';
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isOutline && styles.outline,
        isText && styles.textVariant,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <>
          <ActivityIndicator
            color={isOutline || isText ? Colors.primary : Colors.gold}
            style={{ marginRight: 8 }}
          />
          <Text style={[styles.text, (isOutline || isText) && styles.textOutline]}>
            {loadingText || title}
          </Text>
        </>
      ) : (
        <Text style={[styles.text, (isOutline || isText) && styles.textOutline, disabled && styles.textDisabled]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: Radius.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: Colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: Colors.primary,
    shadowOpacity: 0,
    elevation: 0,
  },
  textVariant: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
    paddingVertical: 12,
  },
  disabled: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  text: {
    fontFamily: Fonts.headline,
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  textOutline: {
    color: Colors.primary,
  },
  textDisabled: {
    color: Colors.textMuted,
  },
});
