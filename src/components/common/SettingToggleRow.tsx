/**
 * SettingToggleRow.tsx — Composant partagé Module 04
 * Ligne de paramètre avec Switch natif iOS/Android
 */
import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Colors, Fonts, Radius } from '../../constants/colors';

interface Props {
  title:          string;
  description?:   string;
  value:          boolean;
  onValueChange:  (val: boolean) => void;
  disabled?:      boolean;
}

export function SettingToggleRow({
  title, description, value, onValueChange, disabled = false,
}: Props) {
  return (
    <View style={[s.row, disabled && s.rowDisabled]}>
      <View style={s.textWrap}>
        <Text style={s.title}>{title}</Text>
        {description ? (
          <Text style={s.desc}>{description}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: Colors.outlineVariant, true: Colors.secondaryContainer }}
        thumbColor={value ? Colors.secondary : Colors.surfaceContainerHigh}
        ios_backgroundColor={Colors.outlineVariant}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    gap: 12,
  },
  rowDisabled: { opacity: 0.5 },
  textWrap: { flex: 1, gap: 3 },
  title: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
  },
  desc: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
