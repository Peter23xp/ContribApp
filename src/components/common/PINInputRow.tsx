/**
 * PINInputRow.tsx — Composant partagé Module 06
 * 
 * Champ de saisie PIN avec :
 *  - Label flottant (style AppInput)
 *  - 6 points masqués (clavier numérique uniquement)
 *  - Bouton œil pour afficher/masquer
 *  - Message d'erreur sous le champ
 * 
 * Réutilise la logique du champ PIN de SCR-002 (OTPScreen)
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

// ─── Types ───────────────────────────────────────────────────

interface Props {
  label:        string;
  value:        string;
  onChange:     (value: string) => void;
  showToggle?:  boolean;
  error?:       string | null;
  disabled?:    boolean;
}

// ─── Composant principal ─────────────────────────────────────

export function PINInputRow({
  label,
  value,
  onChange,
  showToggle = true,
  error,
  disabled = false,
}: Props) {
  const [isVisible, setIsVisible] = useState(false);

  const toggleVisibility = () => setIsVisible(prev => !prev);

  return (
    <View style={s.container}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inputWrapper, error ? s.inputError : null]}>
        <TextInput
          style={s.input}
          value={value}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={6}
          secureTextEntry={!isVisible}
          placeholderTextColor={Colors.textMuted}
          placeholder="••••••"
          editable={!disabled}
        />
        {showToggle && (
          <TouchableOpacity
            onPress={toggleVisibility}
            style={s.eyeButton}
            activeOpacity={0.6}
            disabled={disabled}
          >
            <Ionicons
              name={isVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={disabled ? Colors.textMuted : Colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={s.errorText}>{error}</Text>}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 6,
    color: Colors.textPrimary,
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    backgroundColor: Colors.card,
    height: 48,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  input: {
    flex: 1,
    color: Colors.textPrimary,
    fontFamily: Fonts.body,
    fontSize: 16,
    letterSpacing: 4,  // espacement entre les caractères pour effet "points"
    height: '100%',
  },
  eyeButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 12,
    marginTop: 4,
    fontFamily: Fonts.body,
  },
});
