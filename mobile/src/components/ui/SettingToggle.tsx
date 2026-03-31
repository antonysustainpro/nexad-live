/**
 * NEXUS Field -- Setting Toggle Row
 *
 * Toggle switch with icon, label, and description.
 * Used in the Profile settings screen.
 */

import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, TOUCH_TARGET_MIN } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingToggle({
  label,
  description,
  value,
  onValueChange,
  icon,
  disabled = false,
}: SettingToggleProps) {
  return (
    <View
      style={s.toggleRow}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      accessibilityHint={description}
    >
      <View style={s.toggleIcon}>
        <Ionicons name={icon} size={20} color={Colors.azure} />
      </View>
      <View style={s.toggleContent}>
        <Text style={s.toggleLabel}>{label}</Text>
        {description && <Text style={s.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: 'rgba(255,255,255,0.1)', true: `${Colors.azure}60` }}
        thumbColor={value ? Colors.azure : Colors.textDim}
        ios_backgroundColor="rgba(255,255,255,0.1)"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TOUCH_TARGET_MIN,
  },
  toggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.azure}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toggleDescription: {
    ...Typography.caption,
    fontSize: 12,
    color: Colors.textDim,
    marginTop: 1,
  },
});
