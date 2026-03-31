/**
 * NEXUS Field -- Safety Check-In Interval Selector
 *
 * Horizontal chip selector for check-in reminder intervals.
 * Used in the Profile settings screen.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, BorderRadius, TOUCH_TARGET_MIN } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CheckInSelectorProps {
  value: number;
  onChange: (val: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHECK_IN_OPTIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: 'Off', value: 0 },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CheckInSelector({ value, onChange }: CheckInSelectorProps) {
  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.iconWrap}>
          <Ionicons name="timer-outline" size={20} color={Colors.azure} />
        </View>
        <View style={s.labelWrap}>
          <Text style={s.label}>Safety Check-In</Text>
          <Text style={s.description}>Periodic safety check reminder</Text>
        </View>
      </View>
      <View style={s.options}>
        {CHECK_IN_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === opt.value }}
            accessibilityLabel={`Check-in interval: ${opt.label}`}
            style={[s.chip, value === opt.value && s.chipActive]}
          >
            <Text style={[s.chipText, value === opt.value && s.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.azure}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelWrap: {
    flex: 1,
  },
  label: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  description: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 1,
  },
  options: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginLeft: 36 + Spacing.md,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
    minWidth: TOUCH_TARGET_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.azure,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textDim,
  },
  chipTextActive: {
    color: Colors.void,
  },
});
