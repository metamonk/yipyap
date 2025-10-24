/**
 * Connection state monitoring hook for Firebase Realtime Database
 * @module hooks/useConnectionState
 *
 * @remarks
 * Monitors RTDB connection via `.info/connected` reference.
 * Handles reconnection with exponential backoff.
 * Queues presence updates during offline periods.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, Unsubscribe } from 'firebase/database';
import { getFirebaseRealtimeDb } from '@/services/firebase';
import type { ConnectionState } from '@/types/models';

/**
 * Queued operation for offline processing
 */
interface QueuedOperation {
  id: string;
  operation: () => Promise<void>;
  timestamp: number;
}

// Exponential backoff delays (in ms)
const BACKOFF_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const MAX_QUEUE_SIZE = 50;

/**
 * Hook for monitoring Firebase RTDB connection state
 * @returns Connection state and queue management functions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     connected,
 *     reconnecting,
 *     lastConnectedAt,
 *     queueOperation,
 *     clearQueue
 *   } = useConnectionState();
 *
 *   return (
 *     <View>
 *       <Text>Status: {connected ? 'Online' : 'Offline'}</Text>
 *       {reconnecting && <Text>Reconnecting...</Text>}
 *     </View>
 *   );
 * }
 * ```
 */
export function useConnectionState() {
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    connected: false,
    reconnecting: false,
    lastConnectedAt: null,
  });
  const [queuedCount, setQueuedCount] = useState(0);

  const queueRef = useRef<QueuedOperation[]>([]);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  /**
   * Processes queued operations when connection restored
   */
  const processQueue = useCallback(async (): Promise<void> => {
    if (queueRef.current.length === 0) return;

    const operations = [...queueRef.current];
    queueRef.current = [];
    setQueuedCount(0);

    for (const op of operations) {
      try {
        await op.operation();
      } catch (error) {
        console.error('Failed to process queued operation:', error);
        // Re-queue failed operations
        queueRef.current.push(op);
        setQueuedCount(queueRef.current.length);
      }
    }
  }, []);

  /**
   * Queues an operation to be executed when connection restored
   * @param operation - Async function to execute
   * @returns Operation ID for tracking
   */
  const queueOperation = (operation: () => Promise<void>): string => {
    const id = `op-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Check queue size limit
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      console.warn('Operation queue full, dropping oldest operation');
      queueRef.current.shift();
    }

    queueRef.current.push({
      id,
      operation,
      timestamp: Date.now(),
    });
    setQueuedCount(queueRef.current.length);

    return id;
  };

  /**
   * Clears all queued operations
   */
  const clearQueue = (): void => {
    queueRef.current = [];
    setQueuedCount(0);
  };

  /**
   * Handles reconnection with exponential backoff
   */
  const handleReconnect = useCallback((): void => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = BACKOFF_DELAYS[Math.min(reconnectAttemptsRef.current, BACKOFF_DELAYS.length - 1)];

    setConnectionState((prev) => ({ ...prev, reconnecting: true }));

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectAttemptsRef.current++;
    }, delay);
  }, []);

  useEffect(() => {
    try {
      // Monitor Firebase RTDB connection
      const rtdb = getFirebaseRealtimeDb();
      const connectedRef = ref(rtdb, '.info/connected');

      unsubscribeRef.current = onValue(connectedRef, async (snapshot) => {
        const isConnected = snapshot.val() === true;

        if (isConnected) {
          // Connection restored
          console.warn('[ConnectionState] ✅ Firebase RTDB connected');
          reconnectAttemptsRef.current = 0;

          setConnectionState({
            connected: true,
            reconnecting: false,
            lastConnectedAt: Date.now(),
          });

          // Process queued operations
          if (queueRef.current.length > 0) {
            console.warn(
              `[ConnectionState] Processing ${queueRef.current.length} queued operations`
            );
          }
          await processQueue();
        } else {
          // Connection lost
          console.warn('[ConnectionState] ⚠️ Firebase RTDB disconnected');
          setConnectionState((prev) => ({
            ...prev,
            connected: false,
            reconnecting: true,
          }));

          // Start reconnection handling
          handleReconnect();
        }
      });

      // Note: Firestore handles its own connection management and auto-reconnects
      // when the app returns to foreground. Active snapshot listeners will
      // automatically resume when the connection is restored.
      console.warn('[ConnectionState] Firestore auto-reconnect enabled via active listeners');
    } catch (error) {
      console.error('[ConnectionState] Failed to setup connection monitoring:', error);
    }

    // Cleanup
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [handleReconnect, processQueue]);

  return {
    ...connectionState,
    queueOperation,
    clearQueue,
    queuedCount,
  };
}
