import { useMemo, useRef } from 'react';
import { Animated } from 'react-native';

type UseCollapsibleHeaderOptions = {
  expandedHeight: number;
  collapsedHeight: number;
  collapseDistance?: number;
};

export function useCollapsibleHeader({
  expandedHeight,
  collapsedHeight,
  collapseDistance,
}: UseCollapsibleHeaderOptions) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const distance = collapseDistance ?? Math.max(expandedHeight - collapsedHeight, 1);

  const headerHeight = scrollY.interpolate({
    inputRange: [0, distance],
    outputRange: [expandedHeight, collapsedHeight],
    extrapolate: 'clamp',
  });

  const progress = scrollY.interpolate({
    inputRange: [0, distance],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const inverseProgress = scrollY.interpolate({
    inputRange: [0, distance],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const onScroll = useMemo(
    () =>
      Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: false }
      ),
    [scrollY]
  );

  return {
    scrollY,
    headerHeight,
    progress,
    inverseProgress,
    collapseDistance: distance,
    onScroll,
  };
}
