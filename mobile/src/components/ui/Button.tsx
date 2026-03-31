/**
 * NEXUS Field -- Field-Worker Optimised Button
 *
 * Large touch targets, haptic feedback, animated press state.
 * Variant "field" is 72 px tall for outdoor / gloved use.
 */

import React, { useCallback, useRef } from 'react';
import {
  Pressable,
  ActivityIndicator,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Colors, Spacing, BorderRadius, TOUCH_TARGET_MIN, TOUCH_TARGET_FIELD } from '@/lib/theme';
import { useHaptics } from '@/hooks/useHaptics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'field';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityHint?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<ButtonSize, { height: number; paddingH: number; fontSize: number }> = {
  sm: { height: 36, paddingH: Spacing.md, fontSize: 13 },
  md: { height: TOUCH_TARGET_MIN, paddingH: Spacing.lg, fontSize: 15 },
  lg: { height: 56, paddingH: Spacing.xl, fontSize: 16 },
  field: { height: TOUCH_TARGET_FIELD, paddingH: Spacing.xl, fontSize: 17 },
};

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: Colors.azure,
  secondary: Colors.glass,
  danger: Colors.pulse,
  success: Colors.success,
  ghost: Colors.transparent,
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: Colors.void,
  secondary: Colors.azure,
  danger: Colors.white,
  success: Colors.white,
  ghost: Colors.azure,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
  accessibilityHint,
}: ButtonProps) {
  const haptics = useHaptics();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const sizeConfig = SIZE_MAP[size];
  const isInert = disabled || loading;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    if (isInert) return;
    const feedback = size === 'lg' || size === 'field' ? haptics.medium : haptics.light;
    feedback();
    onPress();
  }, [isInert, size, haptics, onPress]);

  const borderStyle: ViewStyle =
    variant === 'secondary'
      ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }
      : variant === 'ghost'
        ? {}
        : {};

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, fullWidth && s.fullWidth, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isInert}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled: isInert, busy: loading }}
        style={[
          s.base,
          {
            height: sizeConfig.height,
            paddingHorizontal: sizeConfig.paddingH,
            backgroundColor: VARIANT_BG[variant],
            minWidth: TOUCH_TARGET_MIN,
          },
          borderStyle,
          isInert && s.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={VARIANT_TEXT[variant]} size="small" />
        ) : (
          <>
            {icon}
            <Animated.Text
              style={[
                s.label,
                { fontSize: sizeConfig.fontSize, color: VARIANT_TEXT[variant] },
                icon ? { marginLeft: Spacing.sm } : undefined,
              ]}
              numberOfLines={1}
            >
              {title}
            </Animated.Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  disabled: {
    opacity: 0.4,
  },
  fullWidth: {
    width: '100%',
  },
});
