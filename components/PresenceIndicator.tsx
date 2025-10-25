/**
 * Presence Indicator Component - Shows user online/offline/away status
 * @component
 *
 * @remarks
 * Uses Firebase Realtime Database for instant status updates (<2 seconds).
 * Displays color-coded presence dots with optional "last seen" text.
 * Includes smooth transitions and pulse animation for recent online status.
 * Context-aware: Use without text for avatars, with text for lists/details.
 *
 * @example
 * ```tsx
 * // Avatar context (no text)
 * <PresenceIndicator
 *   userId="user123"
 *   size="medium"
 * />
 *
 * // List/detail context (with status text)
 * <PresenceIndicator
 *   userId="user123"
 *   showStatusText={true}
 *   showLastSeen={true}
 *   size="medium"
 * />
 * ```
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { presenceService } from '@/services/presenceService';
import { getFirebaseAuth } from '@/services/firebase';
import type { PresenceData } from '@/types/models';

/**
 * Props for PresenceIndicator component
 */
export interface PresenceIndicatorProps {
  /** User ID to show presence for */
  userId: string;

  /** Whether to show "last seen" text for offline users (default: false) */
  showLastSeen?: boolean;

  /** Whether to show status text labels like "Away" (default: false) */
  showStatusText?: boolean;

  /** Size of the presence dot (default: 'small') */
  size?: 'small' | 'medium' | 'large';

  /** Whether to show pulse animation for online users (default: true) */
  showPulse?: boolean;

  /** Whether to hide when user is offline (default: false) */
  hideWhenOffline?: boolean;
}

/**
 * Formats "last seen" timestamp into human-readable text
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted string like "Last seen 5m ago"
 */
function formatLastSeen(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Last seen just now';
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (hours < 24) return `Last seen ${hours}h ago`;
  if (days < 7) return `Last seen ${days}d ago`;
  return 'Last seen a while ago';
}

/**
 * PresenceIndicator component
 */
export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({
  userId,
  showLastSeen = false,
  showStatusText = false,
  size = 'small',
  showPulse = true,
  hideWhenOffline = false,
}) => {
  const [presence, setPresence] = useState<PresenceData | null>(null);
  const [isAuthValid, setIsAuthValid] = useState<boolean>(true);
  const pulseAnim = useState(new Animated.Value(1))[0];

  // Monitor auth state to prevent permission errors during logout
  useEffect(() => {
    const auth = getFirebaseAuth();

    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthValid(user !== null);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Subscribe to presence updates (only when authenticated)
  useEffect(() => {
    // Don't subscribe if user is not authenticated
    // This prevents permission_denied errors during logout
    if (!isAuthValid) {
      // Don't call setPresence here - let the subscription handle it
      // The callback will be called with null when unsubscribed
      return;
    }

    const unsubscribe = presenceService.subscribeToPresence(userId, (presenceData) => {
      setPresence(presenceData);
    });

    return () => {
      unsubscribe();
      // Clear presence when unsubscribing
      setPresence(null);
    };
  }, [userId, isAuthValid]);

  // Pulse animation for online status
  useEffect(() => {
    if (presence?.state === 'online' && showPulse) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();

      return () => {
        animation.stop();
        pulseAnim.setValue(1);
      };
    }
  }, [presence?.state, showPulse, pulseAnim]);

  // Hide when offline if requested
  if (hideWhenOffline && presence?.state === 'offline') {
    return null;
  }

  // Don't render if no presence data yet
  if (!presence) {
    return null;
  }

  const { state, lastSeen } = presence;

  // Size mapping
  const dotSize = {
    small: 8,
    medium: 12,
    large: 16,
  }[size];

  // Color mapping
  const dotColor = {
    online: '#10b981', // green
    offline: '#6b7280', // gray
    away: '#f59e0b', // yellow/orange
  }[state];

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: dotColor,
            transform: state === 'online' && showPulse ? [{ scale: pulseAnim }] : [],
          },
        ]}
      />

      {showLastSeen && state === 'offline' && lastSeen && (
        <Text style={styles.lastSeenText}>{formatLastSeen(lastSeen)}</Text>
      )}

      {showStatusText && state === 'away' && <Text style={styles.awayText}>Away</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  lastSeenText: {
    fontSize: 12,
    color: '#6b7280',
  },
  awayText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
});
