/**
 * PINInputRow.tsx — Composant partagé Module 06 v2.0
 * Champ PIN 6 chiffres avec label, masquage, et état d'erreur raffiné.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface Props {
  label:        string;
  value:        string;
  onChange:     (value: string) => void;
  showToggle?:  boolean;
  error?:       string | null;
  disabled?:    boolean;
}

export function PINInputRow({
  label,
  value,
  onChange,
  showToggle = true,
  error,
  disabled = false,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrapper, error ? s.inputError : disabled ? s.inputDisabled : null]}>
        <TextInput
          style={[s.input, disabled && s.inputTextDisabled]}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry={!isVisible}
          placeholderTextColor={Colors.textMuted}
          placeholder="••••••"
          editable={!disabled}
          selectionColor={Colors.primary}
        />
        {showToggle && (
          <TouchableOpacity
            onPress={() => setIsVisible(prev => !prev)}
            style={s.eyeButton}
            activeOpacity={0.6}
            disabled={disabled}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons
              name={isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={disabled ? Colors.textMuted : Colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <View style={s.errorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={Colors.danger} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginBottom: 18,
  },
  label: {
    marginBottom: 8,
    color: Colors.textPrimary,
    fontFamily: Fonts.headline,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: 14,
    backgroundColor: Colors.surfaceContainerLowest,
    height: 56,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.errorContainer + '40',
  },
  inputDisabled: {
    backgroundColor: Colors.surfaceContainerHigh,
    borderColor: Colors.outlineVariant,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.headline,
    fontSize: 20,
    letterSpacing: 6,
    height: '100%',
  },
  inputTextDisabled: {
    color: Colors.textMuted,
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    fontFamily: Fonts.body,
    flex: 1,
  },
});
