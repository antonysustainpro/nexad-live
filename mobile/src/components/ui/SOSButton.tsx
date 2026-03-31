/**
 * NEXUS Field -- Lone Worker SOS Panic Button
 *
 * Floating red circle above the tab bar.
 * Long-press 2 s to activate -- prevents accidental triggers.
 * When activated: full-screen red flash, SOS morse haptic, GPS broadcast.
 * Cancel button appears after activation.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Platform,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows } from '@/lib/theme';
import { useLocation } from '@/hooks/useLocation';
import { useHaptics } from '@/hooks/useHaptics';
import { apiClient } from '@/lib/api';
import type { SOSAlert } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUTTON_SIZE = 64;
const LONG_PRESS_MS = 2000;

/** SOS in Morse: ... --- ... mapped to vibration durations (ms) */
const SOS_VIBRATE_PATTERN = Platform.select({
  // Android: [pause, vib, pause, vib, ...]
  android: [0, 150, 100, 150, 100, 150, 200, 400, 100, 400, 100, 400, 200, 150, 100, 150, 100, 150],
  // iOS: Vibration.vibrate(pattern) -- simplified
  default: [0, 150, 100, 150, 100, 150, 200, 400, 100, 400, 100, 400, 200, 150, 100, 150, 100, 150],
}) as number[];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SOSButton() {
  const [isCharging, setIsCharging] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [alertId, setAlertId] = useState<string | null>(null);

  const { currentLocation } = useLocation();
  const haptics = useHaptics();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const chargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chargeTimer.current) clearTimeout(chargeTimer.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      Vibration.cancel();
    };
  }, []);

  // Pulse animation when active
  useEffect(() => {
    if (!isActive) {
      pulseAnim.setValue(1);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isActive, pulseAnim]);

  // ---- Press handlers ----

  const handlePressIn = useCallback(() => {
    if (isActive) return;
    setIsCharging(true);

    // Animate progress ring
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: LONG_PRESS_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();

    // Countdown haptics every 500 ms
    let tick = 0;
    countdownRef.current = setInterval(() => {
      tick += 1;
      haptics.warning();
    }, 500);

    // Fire after 2 s
    chargeTimer.current = setTimeout(() => {
      triggerSOS();
    }, LONG_PRESS_MS);
  }, [isActive, haptics, progressAnim]);

  const handlePressOut = useCallback(() => {
    if (isActive) return;
    setIsCharging(false);
    progressAnim.setValue(0);

    if (chargeTimer.current) {
      clearTimeout(chargeTimer.current);
      chargeTimer.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, [isActive, progressAnim]);

  // ---- Trigger / Cancel ----

  const triggerSOS = useCallback(async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setIsCharging(false);
    setIsActive(true);

    // Full-screen red flash
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();

    // SOS haptic + vibration
    haptics.sos();
    Vibration.vibrate(SOS_VIBRATE_PATTERN, true);

    // Send GPS to backend
    try {
      const payload = {
        latitude: currentLocation?.latitude ?? 0,
        longitude: currentLocation?.longitude ?? 0,
      };
      const response = await apiClient.post<SOSAlert>('/api/v1/safety/sos', payload);
      if (response && typeof response === 'object' && 'id' in response) {
        setAlertId(response.id);
      }
    } catch {
      // SOS must always show active even if API fails --
      // the local alarm keeps running until cancelled.
    }
  }, [currentLocation, flashAnim, haptics]);

  /**
   * SEC-MOBILE-R8-007: Fixed race condition in SOS cancel.
   * Previously, `setAlertId(null)` was called before the API cancel request,
   * and `alertId` was read from the React closure which could be stale.
   * Now: capture the alert ID first, send the cancel request, THEN clear state.
   * This ensures the server always receives the correct alert ID for cancellation.
   */
  const cancelSOS = useCallback(async () => {
    // SEC-MOBILE-R8-007: Capture alertId BEFORE clearing state
    const currentAlertId = alertId;

    Vibration.cancel();
    haptics.success();

    // Send cancel to backend BEFORE clearing local state
    if (currentAlertId) {
      try {
        await apiClient.post(`/api/v1/safety/sos/${currentAlertId}/cancel`, {});
      } catch {
        // Fail silently -- the alert will time out server-side.
      }
    }

    // Clear state AFTER the API call
    setIsActive(false);
    setAlertId(null);
    progressAnim.setValue(0);
  }, [alertId, haptics, progressAnim]);

  // ---- Render ----

  return (
    <>
      {/* Full-screen red flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[s.flash, { opacity: flashAnim }]}
      />

      {/* GPS trail indicator */}
      {isActive && (
        <View style={s.gpsTrail} accessibilityLabel="SOS active, transmitting GPS">
          <View style={s.gpsTrailDot} />
          <Text style={s.gpsTrailText}>GPS transmitting</Text>
        </View>
      )}

      {/* Main SOS Button */}
      <Animated.View
        style={[
          s.wrapper,
          { transform: [{ scale: pulseAnim }] },
        ]}
      >
        <Pressable
          onPressIn={isActive ? undefined : handlePressIn}
          onPressOut={isActive ? undefined : handlePressOut}
          onPress={isActive ? cancelSOS : undefined}
          accessibilityRole="button"
          accessibilityLabel="Emergency SOS"
          accessibilityHint={
            isActive
              ? 'SOS is active. Tap to cancel.'
              : 'Long press for 2 seconds to send an emergency alert.'
          }
          style={[
            s.button,
            isCharging && s.buttonCharging,
            isActive && s.buttonActive,
          ]}
        >
          {isActive ? (
            <Text style={s.cancelLabel}>CANCEL</Text>
          ) : (
            <Ionicons name="shield" size={28} color={Colors.white} />
          )}
        </Pressable>

        {/* Charging progress ring (simplified as border) */}
        {isCharging && (
          <Animated.View
            style={[
              s.chargingRing,
              {
                opacity: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                borderWidth: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, 4],
                }),
              },
            ]}
          />
        )}
      </Animated.View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    zIndex: 1000,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    backgroundColor: Colors.pulse,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.elevated,
  },
  buttonCharging: {
    backgroundColor: '#cc1a2a',
  },
  buttonActive: {
    backgroundColor: '#991122',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  cancelLabel: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chargingRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: BUTTON_SIZE + 8,
    height: BUTTON_SIZE + 8,
    borderRadius: (BUTTON_SIZE + 8) / 2,
    borderColor: Colors.white,
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.pulse,
    zIndex: 999,
  },
  gpsTrail: {
    position: 'absolute',
    bottom: 170,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,71,87,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    zIndex: 1000,
  },
  gpsTrailDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.pulse,
  },
  gpsTrailText: {
    color: Colors.pulse,
    fontSize: 12,
    fontWeight: '700',
  },
});
