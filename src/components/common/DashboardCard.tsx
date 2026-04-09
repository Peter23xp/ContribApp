import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, Radius, Shadow } from '../../constants/colors';

interface Props {
  title: string;
  value?: string | number;
  subtitle?: string;
  badgeColor?: string;
  onPress?: () => void;
  loading?: boolean;
  children?: React.ReactNode;
  accent?: boolean; // fond coloré
}

export function DashboardCard({ title, value, subtitle, badgeColor, onPress, loading = false, children, accent = false }: Props) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading]);

  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  if (loading) {
    return (
      <Animated.View style={[styles.card, { opacity: shimmerOpacity }]}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonValue} />
        <View style={styles.skeletonSubtitle} />
      </Animated.View>
    );
  }

  const inner = (
    <View style={[styles.card, accent && styles.cardAccent]}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, accent && { color: Colors.primaryFixed }]}>{title}</Text>
        {badgeColor && <View style={[styles.badge, { backgroundColor: badgeColor }]} />}
      </View>
      {value !== undefined && (
        <Text style={[styles.value, accent && { color: '#FFF' }]}>{value}</Text>
      )}
      {subtitle && (
        <Text style={[styles.subtitle, accent && { color: Colors.primaryFixed }]}>{subtitle}</Text>
      )}
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: Radius.xl,
    padding: 20,
    marginBottom: 12,
    ...Shadow.card,
  },
  cardAccent: {
    backgroundColor: Colors.primaryContainer,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontWeight: '600',
    flex: 1,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  badge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  value: {
    fontSize: 30,
    fontWeight: 'bold',
    color: Colors.onSurface,
    marginBottom: 2,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.onSurfaceVariant,
    lineHeight: 18,
  },
  skeletonTitle: {
    height: 12,
    width: '40%',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.sm,
    marginBottom: 12,
  },
  skeletonValue: {
    height: 30,
    width: '65%',
    backgroundColor: Colors.surfaceContainerHigh,
    borderRadius: Radius.sm,
    marginBottom: 10,
  },
  skeletonSubtitle: {
    height: 12,
    width: '35%',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.sm,
  },
});
