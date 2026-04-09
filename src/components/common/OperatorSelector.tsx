import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { OPERATORS } from '../../constants/operators';

interface Props {
  value: string | null;
  onChange: (opId: any) => void;
}

export function OperatorSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {OPERATORS.map((op: any) => {
        const isSelected = value === op.id;
        return (
          <TouchableOpacity 
            key={op.id} 
            onPress={() => onChange(op.id)}
            style={[
              styles.tile, 
              isSelected ? { borderColor: op.color, backgroundColor: op.color + '10' } : {}
            ]}
          >
            <Image source={op.logo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.name} numberOfLines={1}>{op.name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  tile: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  logo: { width: 30, height: 30, marginBottom: 4 },
  name: { fontSize: 12, fontWeight: '500', textAlign: 'center' }
});
