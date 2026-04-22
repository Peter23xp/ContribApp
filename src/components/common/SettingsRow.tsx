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
import { Colors, Fonts, Radius } from '../../constants/colors';

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
        <View style={s.destructiveIconWrap}>
          <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        </View>
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
          <View style={s.iconWrap}>
            <Ionicons
              name={icon}
              size={19}
              color={disabled ? Colors.textMuted : Colors.primary}
              style={s.icon}
            />
          </View>
        )}
        <View style={s.textWrap}>
          <Text style={s.label}>{label}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
        </View>
        {value && (
          <View style={s.valuePill}>
            <Text style={s.valueText}>{String(value)}</Text>
          </View>
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
          <View style={s.iconWrap}>
            <Ionicons
              name={icon}
              size={19}
              color={disabled ? Colors.textMuted : Colors.primary}
              style={s.icon}
            />
          </View>
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
        <View style={s.iconWrap}>
          <Ionicons
            name={icon}
            size={19}
            color={disabled ? Colors.textMuted : Colors.primary}
            style={s.icon}
          />
        </View>
      )}
      <View style={s.textWrap}>
        <Text style={s.label}>{label}</Text>
        {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      </View>
      <View style={s.chevronWrap}>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={Colors.textMuted}
        />
      </View>
      <View style={s.separator} />
    </TouchableOpacity>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    minHeight: 64,
    gap: 12,
  },
  rowDisabled: { opacity: 0.4 },
  rowDestructive: {
    justifyContent: 'center',
    paddingVertical: 16,
  },

  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 19,
  },

  textWrap: {
    flex: 1,
    gap: 4,
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
    flex: 1,
  },

  destructiveIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valuePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
  },
  valueText: {
    fontFamily: Fonts.title,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  chevronWrap: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },

  separator: {
    position: 'absolute',
    bottom: 0,
    left: 72,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.outlineVariant + '50',
  },
});
