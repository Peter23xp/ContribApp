import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors, Fonts, Radius } from '../../constants/colors';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected ?? true));
    });

    return unsubscribe;
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <MaterialCommunityIcons name="wifi-off" size={16} color="#795501" />
      <Text style={styles.text}>Mode hors ligne. Certaines donnees peuvent etre anciennes.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.offline,
    borderRadius: Radius.lg,
    marginHorizontal: 16,
    marginTop: 12,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: '#795501',
  },
});
