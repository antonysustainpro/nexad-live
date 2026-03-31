/**
 * NEXUS Field -- Status Badge
 *
 * Colour-coded dot + label for task / site / device status.
 * "critical" status gets a looping pulse animation on the dot.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Colors, Spacing, BorderRadius } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BadgeStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'critical'
  | 'warning'
  | 'success'
  | 'info';

export type BadgeSize = 'sm' | 'md';

export interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  size?: BadgeSize;
}

// ---------------------------------------------------------------------------
// Colour Map
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<BadgeStatus, string> = {
  pending: Colors.amber,
  in_progress: Colors.azure,
  completed: Colors.success,
  blocked: Colors.pulse,
  critical: Colors.pulse,
  warning: Colors.amber,
  success: Colors.success,
  info: Colors.azure,
};

const DEFAULT_LABELS: Record<BadgeStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
  critical: 'Critical',
  warning: 'Warning',
  success: 'Success',
  info: 'Info',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatusBadge({ status, label, size = 'md' }: StatusBadgeProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isCritical = status === 'critical';
  const color = STATUS_COLOR[status];
  const displayLabel = label ?? DEFAULT_LABELS[status];

  useEffect(() => {
    if (!isCritical) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [isCritical, pulseAnim]);

  const dotSize = size === 'sm' ? 6 : 8;
  const fontSize = size === 'sm' ? 11 : 13;
  const paddingV = size === 'sm' ? 2 : 4;
  const paddingH = size === 'sm' ? Spacing.sm : Spacing.md;

  return (
    <View
      style={[
        s.container,
        {
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          backgroundColor: `${color}1A`, // 10% opacity fill
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Status: ${displayLabel}`}
    >
      <Animated.View
        style={[
          s.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
            opacity: isCritical ? pulseAnim : 1,
          },
        ]}
      />
      <Text
        style={[s.label, { fontSize, color }]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  dot: {},
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
