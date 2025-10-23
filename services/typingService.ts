/**
 * Typing Indicator Service - Manages typing states in Firebase Realtime Database
 * @module services/typingService
 *
 * @remarks
 * Uses RTDB for instant typing indicators (<500ms latency).
 * Includes onDisconnect handlers for automatic cleanup.
 * Debounced to reduce database writes.
 * 3-second timeout for stale typing states.
 */

import {
  ref,
  set,
  onDisconnect,
  onValue,
  Unsubscribe,
  DatabaseReference,
} from 'firebase/database';
import { getFirebaseRealtimeDb } from './firebase';
import type { TypingIndicator } from '@/types/models';

/**
 * Typing state update callback
 */
export type TypingCallback = (typingUsers: Record<string, TypingIndicator>) => void;

/**
 * Manages typing indicators with RTDB
 */
class TypingService {
  private typingRefs: Map<string, DatabaseReference> = new Map();
  private typingTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private debounceTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();

  private readonly TYPING_TIMEOUT_MS = 3000; // Clear after 3 seconds
  private readonly DEBOUNCE_MS = 300; // Debounce typing updates

  /**
   * Sets typing state for a user in a conversation
   * @param conversationId - The conversation ID
   * @param userId - The user who is typing
   * @param isTyping - Whether the user is typing
   * @returns Promise that resolves when updated
   *
   * @example
   * ```typescript
   * // User starts typing
   * await typingService.setTyping('conv123', 'user456', true);
   *
   * // User stops typing
   * await typingService.setTyping('conv123', 'user456', false);
   * ```
   *
   * @remarks
   * - Debounced to reduce RTDB writes
   * - Auto-clears after 3 seconds of no updates
   * - Uses onDisconnect for cleanup on disconnect
   */
  public async setTyping(
    conversationId: string,
    userId: string,
    isTyping: boolean
  ): Promise<void> {
    const key = `${conversationId}:${userId}`;

    // Clear any existing debounce timeout
    const existingDebounce = this.debounceTimeouts.get(key);
    if (existingDebounce) {
      clearTimeout(existingDebounce);
    }

    // Debounce the typing update
    const timeout = setTimeout(async () => {
      try {
        const db = getFirebaseRealtimeDb();
        const typingRef = ref(db, `typing/${conversationId}/${userId}`);

        // Store reference for cleanup
        this.typingRefs.set(key, typingRef);

        if (isTyping) {
          const typingData: TypingIndicator = {
            isTyping: true,
            timestamp: Date.now(),
          };

          await set(typingRef, typingData);

          // Set up onDisconnect to clear typing state
          await onDisconnect(typingRef).remove();

          // Set timeout to auto-clear typing state
          this.resetTypingTimeout(key, conversationId, userId);
        } else {
          // User stopped typing - remove immediately
          await set(typingRef, null);

          // Cancel onDisconnect
          await onDisconnect(typingRef).cancel();

          // Clear timeout
          this.clearTypingTimeout(key);
        }
      } catch (error) {
        console.error('Failed to set typing state:', error);
      }

      this.debounceTimeouts.delete(key);
    }, this.DEBOUNCE_MS);

    this.debounceTimeouts.set(key, timeout);
  }

  /**
   * Resets the auto-clear timeout for typing state
   * @param key - The map key (conversationId:userId)
   * @param conversationId - The conversation ID
   * @param userId - The user ID
   */
  private resetTypingTimeout(key: string, conversationId: string, userId: string): void {
    // Clear existing timeout
    this.clearTypingTimeout(key);

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        const db = getFirebaseRealtimeDb();
        const typingRef = ref(db, `typing/${conversationId}/${userId}`);
        await set(typingRef, null);
      } catch (error) {
        console.error('Failed to clear stale typing state:', error);
      }

      this.typingTimeouts.delete(key);
    }, this.TYPING_TIMEOUT_MS);

    this.typingTimeouts.set(key, timeout);
  }

  /**
   * Clears the auto-clear timeout for typing state
   * @param key - The map key (conversationId:userId)
   */
  private clearTypingTimeout(key: string): void {
    const timeout = this.typingTimeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.typingTimeouts.delete(key);
    }
  }

  /**
   * Subscribes to typing indicators for a conversation
   * @param conversationId - The conversation to monitor
   * @param currentUserId - The current user ID (to exclude from results)
   * @param callback - Function called when typing state changes
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = typingService.subscribeToTyping('conv123', 'user123', (typing) => {
   *   const typingUserIds = Object.keys(typing);
   *   console.log(`${typingUserIds.length} users typing`);
   * });
   *
   * // Later...
   * unsubscribe();
   * ```
   *
   * @remarks
   * Filters out current user and stale typing states (>3 seconds old)
   */
  public subscribeToTyping(
    conversationId: string,
    currentUserId: string,
    callback: TypingCallback
  ): Unsubscribe {
    const db = getFirebaseRealtimeDb();
    const typingRef = ref(db, `typing/${conversationId}`);

    return onValue(
      typingRef,
      (snapshot) => {
        const typingData = snapshot.val() as Record<string, TypingIndicator> | null;

        if (!typingData) {
          callback({});
          return;
        }

        // Filter out current user and stale typing states
        const now = Date.now();
        const activeTyping: Record<string, TypingIndicator> = {};

        Object.entries(typingData).forEach(([userId, indicator]) => {
          // Skip current user
          if (userId === currentUserId) return;

          // Skip stale typing states (older than timeout)
          if (now - indicator.timestamp > this.TYPING_TIMEOUT_MS) return;

          // Skip if not typing
          if (!indicator.isTyping) return;

          activeTyping[userId] = indicator;
        });

        callback(activeTyping);
      },
      (error) => {
        console.error('Failed to subscribe to typing indicators:', error);
        callback({});
      }
    );
  }

  /**
   * Cleans up typing state for a user in a conversation
   * @param conversationId - The conversation ID
   * @param userId - The user ID
   * @returns Promise that resolves when cleaned up
   *
   * @example
   * ```typescript
   * await typingService.cleanup('conv123', 'user456');
   * ```
   */
  public async cleanup(conversationId: string, userId: string): Promise<void> {
    const key = `${conversationId}:${userId}`;

    try {
      // Clear any pending debounce
      const debounceTimeout = this.debounceTimeouts.get(key);
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        this.debounceTimeouts.delete(key);
      }

      // Clear typing timeout
      this.clearTypingTimeout(key);

      // Remove typing state from RTDB
      const typingRef = this.typingRefs.get(key);
      if (typingRef) {
        await set(typingRef, null);
        await onDisconnect(typingRef).cancel();
        this.typingRefs.delete(key);
      }
    } catch (error) {
      console.error('Failed to cleanup typing state:', error);
    }
  }

  /**
   * Cleans up all typing states (call on logout)
   * @returns Promise that resolves when all cleaned up
   */
  public async cleanupAll(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    this.typingRefs.forEach((ref, key) => {
      const [conversationId, userId] = key.split(':');
      cleanupPromises.push(this.cleanup(conversationId, userId));
    });

    await Promise.all(cleanupPromises);
  }
}

// Export singleton instance
export const typingService = new TypingService();

/**
 * React hook for managing typing indicators
 * @param conversationId - The conversation ID
 * @param userId - The current user ID
 * @returns Typing management functions
 *
 * @example
 * ```tsx
 * function ChatInput({ conversationId, userId }) {
 *   const { setTyping, subscribeToTyping, cleanup } = useTypingIndicator(conversationId, userId);
 *   const [typingUsers, setTypingUsers] = useState<Record<string, TypingIndicator>>({});
 *
 *   useEffect(() => {
 *     const unsubscribe = subscribeToTyping(setTypingUsers);
 *     return () => {
 *       cleanup();
 *       unsubscribe();
 *     };
 *   }, []);
 *
 *   const handleTextChange = (text: string) => {
 *     setTyping(text.length > 0);
 *   };
 *
 *   return (
 *     <View>
 *       <TextInput onChangeText={handleTextChange} />
 *       {Object.keys(typingUsers).length > 0 && <Text>Someone is typing...</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useTypingIndicator(conversationId: string, userId: string) {
  return {
    setTyping: (isTyping: boolean) => typingService.setTyping(conversationId, userId, isTyping),
    subscribeToTyping: (callback: TypingCallback) =>
      typingService.subscribeToTyping(conversationId, userId, callback),
    cleanup: () => typingService.cleanup(conversationId, userId),
  };
}
