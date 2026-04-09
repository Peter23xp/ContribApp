import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Radius } from '../../constants/colors';

interface Props {
  current: number;
  total: number;
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ current, total, color = Colors.secondary, height = 8, showLabel = true }: Props) {
  const animWidth = useRef(new Animated.Value(0)).current;
  const pct = total > 0 ? Math.min(current / total, 1) : 0;
  const barColor = current >= total ? Colors.statusPaid : color;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: pct,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View>
      {/* Track — surfaceVariant sans bordure */}
      <View style={[styles.track, { height, backgroundColor: Colors.surfaceContainerHigh }]}>
        <Animated.View
          style={[
            styles.fill,
            {
              height,
              backgroundColor: barColor,
              borderRadius: Radius.full,
              width: animWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{current} / {total}</Text>
          <Text style={[styles.pct, { color: barColor }]}>
            {total > 0 ? Math.round(pct * 100) : 0}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {},
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  label: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
  },
  pct: {
    fontSize: 12,
    fontWeight: '700',
  },
});
