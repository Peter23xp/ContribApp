import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
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
      <View style={[styles.track, { height, backgroundColor: Colors.surfaceContainerHigh }]}>
        {/* Background glow strip */}
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
        {/* Subtle shimmer overlay on the fill */}
        <Animated.View
          style={[
            styles.shimmer,
            {
              height,
              borderRadius: Radius.full,
              width: animWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    width: '100%',
    backgroundColor: Colors.surfaceContainerHigh,
  },
  fill: {},
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
