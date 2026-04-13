import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '../../constants/colors';

interface Props {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  onEditPress?: (() => void) | null;
}

export function GroupInfoRow({ icon, label, value, onEditPress }: Props) {
  return (
    <View style={s.container}>
      <View style={s.leftContent}>
        <MaterialCommunityIcons name={icon} size={20} color={Colors.textMuted} style={s.icon} />
        <Text style={s.label}>{label}</Text>
      </View>
      
      <View style={s.rightContent}>
        <Text style={s.value}>{value}</Text>
        {onEditPress && (
          <TouchableOpacity onPress={onEditPress} style={s.editButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="pencil" size={18} color={Colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surfaceContainerLowest,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.outlineVariant + '40',
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  icon: {
    width: 24,
    textAlign: 'center',
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  value: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    color: Colors.onSurface,
    textAlign: 'right',
    flexShrink: 1,
  },
  editButton: {
    padding: 4,
    marginLeft: 4,
  },
});
