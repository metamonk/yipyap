/**
 * Presence Service - Manages user online/offline status
 * @module services/presenceService
 * @remarks
 * Lightweight Firestore-based presence system for MVP.
 * Updates every 30 seconds when active, immediate offline on background.
 */

import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';
import { getFirebaseDb } from './firebase';

/**
 * Presence status type
 */
export type PresenceStatus = 'online' | 'offline';

/**
 * Manages presence updates for a user
 */
class PresenceService {
  private userId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private lastUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 30000; // 30 seconds
  private readonly MIN_UPDATE_INTERVAL = 5000; // Prevent rapid updates

  /**
   * Initializes presence tracking for a user
   * @param userId - The authenticated user's ID
   * @example
   * ```typescript
   * presenceService.initialize('user123');
   * ```
   */
  public initialize(userId: string): void {
    if (this.userId) {
      this.cleanup();
    }

    this.userId = userId;

    // Set initial online status
    this.updatePresence('online');

    // Start heartbeat for online status
    this.startHeartbeat();

    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Updates user's presence status in Firestore
   * @param status - 'online' or 'offline'
   * @returns Promise that resolves when update completes
   */
  private async updatePresence(status: PresenceStatus): Promise<void> {
    if (!this.userId) return;

    // Throttle updates
    const now = Date.now();
    if (now - this.lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
      return;
    }
    this.lastUpdateTime = now;

    try {
      const db = getFirebaseDb();
      const userRef = doc(db, 'users', this.userId);

      await updateDoc(userRef, {
        'presence.status': status,
        'presence.lastSeen': serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to update presence:', error);
      // Silently fail - presence is non-critical
    }
  }

  /**
   * Handles app state changes (foreground/background)
   * @param nextAppState - The new app state
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      // App came to foreground
      this.updatePresence('online');
      this.startHeartbeat();
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App went to background
      this.updatePresence('offline');
      this.stopHeartbeat();
    }
  };

  /**
   * Starts the heartbeat interval for online status updates
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // Clear any existing interval

    this.intervalId = setInterval(() => {
      this.updatePresence('online');
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Stops the heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Cleans up presence tracking
   * @remarks
   * Call this when user logs out or component unmounts
   */
  public cleanup(): void {
    // Set offline status
    if (this.userId) {
      this.updatePresence('offline');
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.userId = null;
  }

  /**
   * Forces an immediate presence update
   * @param status - The status to set
   * @returns Promise that resolves when update completes
   * @example
   * ```typescript
   * await presenceService.forceUpdate('online');
   * ```
   */
  public async forceUpdate(status: PresenceStatus): Promise<void> {
    this.lastUpdateTime = 0; // Reset throttle
    await this.updatePresence(status);
  }
}

// Export singleton instance
export const presenceService = new PresenceService();

/**
 * React hook for managing presence
 * @returns Object with initialize and cleanup functions
 * @example
 * ```tsx
 * const { initializePresence, cleanupPresence } = usePresence();
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
  };
}
