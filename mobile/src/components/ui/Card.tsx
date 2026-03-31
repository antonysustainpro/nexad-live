/**
 * NEXUS Field -- Glass Card
 *
 * Frosted-glass surface for grouping content.
 * Three variants: default (glass), elevated (surface + shadow), outlined (azure border).
 * Pressable with scale animation when `onPress` is provided.
 */

import React, { useRef, useCallback } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardVariant = 'default' | 'elevated' | 'outlined';

export interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Card({
  children,
  variant = 'default',
  onPress,
  style,
  accessibilityLabel,
}: CardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [onPress, scaleAnim]);

  const handlePressOut = useCallback(() => {
    if (!onPress) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [onPress, scaleAnim]);

  const variantStyle = VARIANT_STYLES[variant];

  const content = (
    <Animated.View
      style={[s.base, variantStyle, { transform: [{ scale: scaleAnim }] }, style]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<CardVariant, ViewStyle> = {
  default: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  elevated: {
    backgroundColor: Colors.surface,
    ...Shadows.card,
  },
  outlined: {
    backgroundColor: Colors.transparent,
    borderWidth: 1,
    borderColor: Colors.azure,
  },
};

const s = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    overflow: 'hidden',
  },
});
