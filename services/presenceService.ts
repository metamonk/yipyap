/**
 * Presence Service - Manages user online/offline/away status in Firebase Realtime Database
 * @module services/presenceService
 *
 * @remarks
 * Migrated from Firestore to RTDB for instant status updates (<2 seconds).
 * Uses onDisconnect handlers for automatic offline status on disconnect.
 * Supports multi-device presence with aggregated user state.
 * No heartbeat polling needed - connection-based presence detection.
 */

import {
  ref,
  set,
  get,
  update,
  onDisconnect,
  onValue,
  serverTimestamp as rtdbServerTimestamp,
  DatabaseReference,
  Unsubscribe,
} from 'firebase/database';
import { AppState, AppStateStatus } from 'react-native';
import { getFirebaseRealtimeDb } from './firebase';
import { getDeviceId, getPlatform } from '@/utils/deviceId';
import type { PresenceData, DevicePresence } from '@/types/models';

/**
 * Presence status type (compatible with legacy usage)
 */
export type PresenceStatus = 'online' | 'offline' | 'away';

/**
 * Manages presence updates for a user with multi-device support
 */
class PresenceService {
  private userId: string | null = null;
  private deviceId: string | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private userPresenceRef: DatabaseReference | null = null;
  private devicePresenceRef: DatabaseReference | null = null;
  private connectionRef: DatabaseReference | null = null;
  private connectionUnsubscribe: Unsubscribe | null = null;
  private isConnected: boolean = false;
  private currentState: PresenceStatus = 'offline';

  // Away detection
  private awayTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly AWAY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Initializes presence tracking for a user
   * @param userId - The authenticated user's ID
   * @returns Promise that resolves when setup complete
   *
   * @example
   * ```typescript
   * await presenceService.initialize('user123');
   * ```
   *
   * @remarks
   * - Generates/retrieves device ID
   * - Sets up RTDB connection monitoring
   * - Registers onDisconnect handlers
   * - Sets initial online status
   * - Listens to app state changes
   */
  public async initialize(userId: string): Promise<void> {
    if (this.userId) {
      await this.cleanup();
    }

    this.userId = userId;

    try {
      // Get or create device ID
      this.deviceId = await getDeviceId();

      const db = getFirebaseRealtimeDb();

      // Set up references
      this.userPresenceRef = ref(db, `presence/${userId}`);
      this.devicePresenceRef = ref(db, `presence/${userId}/devices/${this.deviceId}`);
      this.connectionRef = ref(db, '.info/connected');

      // Monitor connection state
      this.connectionUnsubscribe = onValue(this.connectionRef, async (snapshot) => {
        this.isConnected = snapshot.val() === true;

        if (this.isConnected && this.devicePresenceRef) {
          // Set online status
          await this.setDevicePresence('online');

          // Set up onDisconnect to mark device offline
          await onDisconnect(this.devicePresenceRef).set({
            state: 'offline',
            platform: getPlatform(),
            lastActivity: rtdbServerTimestamp(),
          } as DevicePresence);

          // Update aggregated user state
          await this.updateAggregatedPresence();
        }
      });

      // Listen to app state changes
      this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

      // Start away detection timer
      this.resetAwayTimer();
    } catch (error) {
      console.error('Failed to initialize presence:', error);
      throw error;
    }
  }

  /**
   * Sets device-specific presence state
   * @param state - The presence state to set
   * @returns Promise that resolves when updated
   */
  private async setDevicePresence(state: 'online' | 'offline'): Promise<void> {
    // Guard: Don't write if service is cleaned up (userId is null)
    // This prevents permission errors during logout when connection listener fires
    if (!this.userId || !this.devicePresenceRef || !this.deviceId) return;

    try {
      const devicePresence: DevicePresence = {
        state,
        platform: getPlatform(),
        lastActivity: rtdbServerTimestamp() as unknown as number,
      };

      // Include app version if available (would come from Config/Constants)
      // devicePresence.appVersion = Config.appVersion;

      await set(this.devicePresenceRef, devicePresence);
    } catch (error) {
      console.error('Failed to set device presence:', error);
      // Silently fail - presence is non-critical
    }
  }

  /**
   * Updates aggregated user presence based on all devices
   * @returns Promise that resolves when updated
   *
   * @remarks
   * User is "online" if ANY device is online
   * User is "away" if online but inactive
   * User is "offline" if all devices are offline
   *
   * Implements the Read-Aggregate-Write pattern to prevent data loss.
   * See: docs/architecture/real-time-data-patterns.md#pattern-2-aggregate-data-race-conditions
   */
  private async updateAggregatedPresence(): Promise<void> {
    // Guard: Don't write if service is cleaned up (userId is null)
    if (!this.userId || !this.userPresenceRef) return;

    try {
      // 1. READ all device data first
      const devicesRef = ref(getFirebaseRealtimeDb(), `presence/${this.userId}/devices`);
      const snapshot = await get(devicesRef);
      const devices = snapshot.val() as Record<string, DevicePresence> || {};

      // 2. AGGREGATE: if ANY device is online, user is online
      let aggregatedState: 'online' | 'offline' | 'away' = 'offline';
      let mostRecentActivity = 0;

      Object.values(devices).forEach(device => {
        if (device.state === 'online') {
          // If any device is online, user is online (or away if explicitly set)
          aggregatedState = this.currentState === 'away' ? 'away' : 'online';
        }
        // Track most recent activity across all devices
        mostRecentActivity = Math.max(mostRecentActivity, device.lastActivity || 0);
      });

      // 3. WRITE aggregated result (preserving device data)
      await update(this.userPresenceRef, {
        state: aggregatedState,
        lastSeen: mostRecentActivity || rtdbServerTimestamp(),
        // ✓ Device data automatically preserved by not touching it
      });
    } catch (error) {
      console.error('Failed to update aggregated presence:', error);
    }
  }

  /**
   * Handles app state changes (foreground/background)
   * @param nextAppState - The new app state
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'active') {
      // App came to foreground
      this.currentState = 'online';
      await this.setDevicePresence('online');
      await this.updateAggregatedPresence();
      this.resetAwayTimer();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background
      this.currentState = 'offline';
      await this.setDevicePresence('offline');
      await this.updateAggregatedPresence();
      this.clearAwayTimer();
    }
  };

  /**
   * Resets the away detection timer
   *
   * @remarks
   * Call this on user activity (typing, navigation, etc.)
   * If no activity for AWAY_TIMEOUT_MS, user is marked "away"
   */
  private resetAwayTimer(): void {
    this.clearAwayTimer();

    this.awayTimeoutId = setTimeout(() => {
      if (this.currentState === 'online') {
        this.currentState = 'away';
        this.updateAggregatedPresence();
      }
    }, this.AWAY_TIMEOUT_MS);
  }

  /**
   * Clears the away detection timer
   */
  private clearAwayTimer(): void {
    if (this.awayTimeoutId) {
      clearTimeout(this.awayTimeoutId);
      this.awayTimeoutId = null;
    }
  }

  /**
   * Manually triggers user activity to reset away timer
   *
   * @example
   * ```typescript
   * presenceService.recordActivity(); // Reset away timer
   * ```
   *
   * @remarks
   * Call this on user interactions like typing, scrolling, tapping
   */
  public recordActivity(): void {
    if (this.currentState === 'away') {
      this.currentState = 'online';
      this.updateAggregatedPresence();
    }
    this.resetAwayTimer();
  }

  /**
   * Cleans up presence tracking
   * @returns Promise that resolves when cleanup complete
   *
   * @remarks
   * - Sets offline status
   * - Cancels onDisconnect handlers
   * - Removes listeners
   * - Call on logout or component unmount
   */
  public async cleanup(): Promise<void> {
    try {
      // CRITICAL: Store refs locally and clear userId FIRST to prevent race conditions
      // This guards against queued connection listener callbacks that might fire during cleanup
      const localDevicePresenceRef = this.devicePresenceRef;
      const localUserId = this.userId;
      const localIsConnected = this.isConnected;

      // Immediately null userId to guard setDevicePresence and updateAggregatedPresence
      this.userId = null;
      this.deviceId = null;

      // Clear away timer
      this.clearAwayTimer();

      // Remove connection listener (prevents writes during cleanup)
      if (this.connectionUnsubscribe) {
        try {
          this.connectionUnsubscribe();
        } catch (unsubError) {
          console.warn('Failed to unsubscribe from connection listener:', unsubError);
        }
        this.connectionUnsubscribe = null;
      }

      // Remove app state listener
      if (this.appStateSubscription) {
        try {
          this.appStateSubscription.remove();
        } catch (appStateError) {
          console.warn('Failed to remove app state listener:', appStateError);
        }
        this.appStateSubscription = null;
      }

      // Now safely set offline status using locally stored refs
      // This happens AFTER userId is null, so queued callbacks are guarded
      if (localDevicePresenceRef && localUserId) {
        try {
          // Directly set offline using stored ref (bypass guard in setDevicePresence)
          const devicePresence: DevicePresence = {
            state: 'offline',
            platform: getPlatform(),
            lastActivity: rtdbServerTimestamp() as unknown as number,
          };
          await set(localDevicePresenceRef, devicePresence);

          // Cancel onDisconnect handlers (only if database is connected)
          if (localIsConnected && localDevicePresenceRef) {
            try {
              // @ts-expect-error - accessing internal _repo property for safety check
              if (localDevicePresenceRef._repo !== null && localDevicePresenceRef._repo !== undefined) {
                await onDisconnect(localDevicePresenceRef).cancel();
              }
            } catch (disconnectError) {
              console.warn('Failed to cancel onDisconnect:', disconnectError);
            }
          }
        } catch (refError) {
          // Database ref might be invalid if Firebase already cleaned up, or permission denied
          console.warn('Failed to set offline or cancel onDisconnect:', refError);
        }
      }

      // Clear references
      this.userPresenceRef = null;
      this.devicePresenceRef = null;
      this.connectionRef = null;
      this.currentState = 'offline';
    } catch (error) {
      console.error('Failed to cleanup presence:', error);
    }
  }

  /**
   * Forces an immediate presence update
   * @param status - The status to set
   * @returns Promise that resolves when update completes
   *
   * @example
   * ```typescript
   * await presenceService.forceUpdate('away');
   * ```
   */
  public async forceUpdate(status: PresenceStatus): Promise<void> {
    this.currentState = status;

    if (status === 'online' || status === 'away') {
      await this.setDevicePresence('online');
    } else {
      await this.setDevicePresence('offline');
    }

    await this.updateAggregatedPresence();

    // Reset away timer if going online
    if (status === 'online') {
      this.resetAwayTimer();
    }
  }

  /**
   * Subscribes to another user's presence updates
   * @param userId - The user ID to monitor
   * @param callback - Function called when presence changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = presenceService.subscribeToPresence('user456', (presence) => {
   *   console.log(`User is ${presence?.state}`);
   * });
   * // Later...
   * unsubscribe();
   * ```
   */
  public subscribeToPresence(
    userId: string,
    callback: (presence: PresenceData | null) => void
  ): Unsubscribe {
    const db = getFirebaseRealtimeDb();
    const presenceRef = ref(db, `presence/${userId}`);

    return onValue(
      presenceRef,
      (snapshot) => {
        const presence = snapshot.val() as PresenceData | null;
        callback(presence);
      },
      (error) => {
        console.error('Failed to subscribe to presence:', error);
        callback(null);
      }
    );
  }
}

// Export singleton instance
export const presenceService = new PresenceService();

/**
 * React hook for managing presence
 * @returns Object with presence management functions
 *
 * @example
 * ```tsx
 * const { initializePresence, cleanupPresence, recordActivity } = usePresence();
 *
 * useEffect(() => {
 *   if (userId) {
 *     initializePresence(userId);
 *   }
 *   return () => cleanupPresence();
 * }, [userId]);
 * ```
 */
export function usePresence() {
  return {
    initializePresence: (userId: string) => presenceService.initialize(userId),
    cleanupPresence: () => presenceService.cleanup(),
    forceUpdate: (status: PresenceStatus) => presenceService.forceUpdate(status),
    recordActivity: () => presenceService.recordActivity(),
    subscribeToPresence: (userId: string, callback: (presence: PresenceData | null) => void) =>
      presenceService.subscribeToPresence(userId, callback),
  };
}
