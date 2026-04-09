import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';

export default function DashboardAdmin() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>SCR-005 — Dashboard Admin</Text>
      {/* TODO: implémenter selon SSD ContribApp RDC */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: Colors.textPrimary,
    fontSize: 16,
  },
});
