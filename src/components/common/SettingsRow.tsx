/**
 * SettingsRow.tsx — Composant partagé Module 06
 * 
 * Ligne de paramètre polyvalente avec 4 types :
 *  - 'navigate'    : icône + label + chevron (›) — navigation
 *  - 'toggle'      : icône + label + Switch natif
 *  - 'destructive' : label rouge centré — actions critiques
 *  - 'info'        : icône + label + valeur en gris — lecture seule
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Fonts } from '../../constants/colors';

// ─── Types ───────────────────────────────────────────────────

type SettingsRowType = 'navigate' | 'toggle' | 'destructive' | 'info';

interface Props {
  icon?:      keyof typeof Ionicons.glyphMap;
  label:      string;
  type:       SettingsRowType;
  value?:     boolean | string | null;
  onPress?:   (val?: any) => void | Promise<void>;
  disabled?:  boolean;
  subtitle?:  string;
}

// ─── Composant principal ─────────────────────────────────────

export function SettingsRow({
  icon,
  label,
  type,
  value,
  onPress,
  disabled = false,
  subtitle,
}: Props) {
  // ── Type 'destructive' : label rouge centré, pas d'icône ──
  if (type === 'destructive') {
    return (
      <TouchableOpacity
        style={[s.row, s.rowDestructive, disabled && s.rowDisabled]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.6}
      >
        <Text style={s.labelDestructive}>{label}</Text>
        <View style={s.separator} />
      </TouchableOpacity>
    );
  }

  // ── Type 'info' : non touchable, affiche valeur à droite ──
  if (type === 'info') {
    return (
      <View style={[s.row, disabled && s.rowDisabled]}>
        {icon && (
          <Ionicons
            name={icon}
            size={22}
            color={disabled ? Colors.textMuted : Colors.onSurfaceVariant}
            style={s.icon}
          />
        )}
        <View style={s.textWrap}>
          <Text style={s.label}>{label}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        </View>
        {value && (
          <Text style={s.valueText}>{String(value)}</Text>
        )}
        <View style={s.separator} />
      </View>
    );
  }

  // ── Type 'toggle' : Switch natif à droite ──
  if (type === 'toggle') {
    return (
      <View style={[s.row, disabled && s.rowDisabled]}>
        {icon && (
          <Ionicons
            name={icon}
            size={22}
            color={disabled ? Colors.textMuted : Colors.onSurfaceVariant}
            style={s.icon}
          />
        )}
        <View style={s.textWrap}>
          <Text style={s.label}>{label}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        </View>
        <Switch
          value={Boolean(value)}
          onValueChange={onPress}
          disabled={disabled}
          trackColor={{ false: Colors.outlineVariant, true: Colors.secondaryContainer }}
          thumbColor={value ? Colors.secondary : Colors.surfaceContainerHigh}
          ios_backgroundColor={Colors.outlineVariant}
        />
        <View style={s.separator} />
      </View>
    );
  }

  // ── Type 'navigate' : chevron à droite, toute la ligne touchable ──
  return (
    <TouchableOpacity
      style={[s.row, disabled && s.rowDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={22}
          color={disabled ? Colors.textMuted : Colors.onSurfaceVariant}
          style={s.icon}
        />
      )}
      <View style={s.textWrap}>
        <Text style={s.label}>{label}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={Colors.textMuted}
      />
      <View style={s.separator} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    minHeight: 56,
    gap: 12,
  },
  rowDisabled: { opacity: 0.4 },
  rowDestructive: {
    justifyContent: 'center',
    paddingVertical: 16,
  },

  icon: {
    width: 24,
  },

  textWrap: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.onSurface,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 14,
  },

  labelDestructive: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    color: Colors.error,
    textAlign: 'center',
  },

  valueText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  separator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant + '50',
  },
});
