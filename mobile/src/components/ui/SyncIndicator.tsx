/**
 * NEXUS Field -- Sync Indicator
 *
 * Compact header widget showing connectivity + sync queue state.
 * Tappable to trigger a manual sync when online.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Colors, Spacing, BorderRadius, TOUCH_TARGET_MIN } from '@/lib/theme';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useHaptics } from '@/hooks/useHaptics';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SyncIndicator() {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useOfflineSync();
  const haptics = useHaptics();

  const handlePress = useCallback(() => {
    if (!isOnline || isSyncing) return;
    haptics.light();
    triggerSync();
  }, [isOnline, isSyncing, haptics, triggerSync]);

  // Determine visual state
  const synced = isOnline && !isSyncing && pendingCount === 0;
  const syncing = isOnline && isSyncing;
  const pending = isOnline && !isSyncing && pendingCount > 0;
  const offline = !isOnline;

  const dotColor = synced
    ? Colors.success
    : syncing
      ? Colors.azure
      : pending
        ? Colors.amber
        : Colors.pulse;

  const statusLabel = synced
    ? 'Synced'
    : syncing
      ? 'Syncing...'
      : pending
        ? `${pendingCount} pending`
        : 'Offline';

  const accessibilityLabel = offline
    ? `Offline. ${pendingCount} items queued.`
    : syncing
      ? 'Syncing data with server.'
      : pending
        ? `Online. ${pendingCount} items waiting to sync. Tap to sync now.`
        : 'All data synced.';

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isOnline || isSyncing}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !isOnline || isSyncing }}
      style={s.container}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={s.inner}>
        {syncing ? (
          <ActivityIndicator color={Colors.azure} size={12} />
        ) : (
          <View style={[s.dot, { backgroundColor: dotColor }]} />
        )}

        <Text style={[s.label, { color: dotColor }]} numberOfLines={1}>
          {statusLabel}
        </Text>

        {offline && pendingCount > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{pendingCount > 99 ? '99+' : pendingCount}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    minHeight: TOUCH_TARGET_MIN,
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.glass,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  badge: {
    backgroundColor: Colors.pulse,
    borderRadius: BorderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 2,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});
