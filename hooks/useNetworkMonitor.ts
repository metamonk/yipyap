/**
 * Custom hook for monitoring network connectivity state and triggering actions on state changes
 *
 * @remarks
 * Detects online/offline transitions and provides debounced callbacks for network recovery.
 * Integrates with retry queue to process pending operations when connection is restored.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import NetInfo, { NetInfoState, NetInfoSubscription } from '@react-native-community/netinfo';
import { getRetryQueue } from '@/services/retryQueueService';

/**
 * Network connection quality levels
 * @enum
 */
export enum ConnectionQuality {
  /** No network connection */
  OFFLINE = 'offline',
  /** Slow or unreliable connection (2G, poor signal) */
  SLOW = 'slow',
  /** Moderate connection (3G, fair signal) */
  MODERATE = 'moderate',
  /** Good connection (4G, WiFi with good signal) */
  GOOD = 'good',
  /** Excellent connection (5G, strong WiFi) */
  EXCELLENT = 'excellent',
}

/**
 * Network state information with quality metrics
 * @interface NetworkState
 */
export interface NetworkState {
  /** Whether device is connected to network */
  isConnected: boolean;

  /** Whether internet is reachable (can reach external servers) */
  isInternetReachable: boolean | null;

  /** Type of network connection (wifi, cellular, none, etc.) */
  type: string;

  /** Connection quality assessment */
  quality: ConnectionQuality;

  /** Timestamp of last state change */
  lastChanged: number;

  /** Additional network details from NetInfo */
  details: NetInfoState['details'];
}

/**
 * Configuration options for network monitoring
 * @interface UseNetworkMonitorOptions
 */
export interface UseNetworkMonitorOptions {
  /** Debounce delay in ms before triggering reconnection callbacks (default: 2000) */
  reconnectionDebounce?: number;

  /** Whether to automatically process retry queue on reconnection (default: true) */
  autoProcessQueue?: boolean;

  /** Callback fired when network goes offline */
  onOffline?: () => void;

  /** Callback fired when network comes online (after debounce) */
  onOnline?: () => void;

  /** Callback fired on any network state change */
  onStateChange?: (state: NetworkState) => void;
}

/**
 * Determines connection quality based on network type and details
 * @param state - NetInfo state object
 * @returns Connection quality enum value
 */
function determineConnectionQuality(state: NetInfoState): ConnectionQuality {
  if (!state.isConnected) {
    return ConnectionQuality.OFFLINE;
  }

  // Check internet reachability
  if (state.isInternetReachable === false) {
    return ConnectionQuality.SLOW;
  }

  // Analyze by connection type
  switch (state.type) {
    case 'wifi': {
      // WiFi is generally good, but check signal strength if available
      const wifiDetails = state.details as { strength?: number } | null;
      if (wifiDetails?.strength !== undefined) {
        if (wifiDetails.strength > 75) return ConnectionQuality.EXCELLENT;
        if (wifiDetails.strength > 50) return ConnectionQuality.GOOD;
        if (wifiDetails.strength > 25) return ConnectionQuality.MODERATE;
        return ConnectionQuality.SLOW;
      }
      return ConnectionQuality.GOOD; // Default for WiFi
    }

    case 'cellular': {
      // Check cellular generation
      const cellDetails = state.details as { cellularGeneration?: string } | null;
      const cellularGeneration = cellDetails?.cellularGeneration;

      switch (cellularGeneration) {
        case '5g':
          return ConnectionQuality.EXCELLENT;
        case '4g':
          return ConnectionQuality.GOOD;
        case '3g':
          return ConnectionQuality.MODERATE;
        case '2g':
          return ConnectionQuality.SLOW;
        default:
          return ConnectionQuality.MODERATE;
      }
    }

    case 'ethernet':
      return ConnectionQuality.EXCELLENT;

    case 'bluetooth':
    case 'wimax':
      return ConnectionQuality.MODERATE;

    default:
      return ConnectionQuality.SLOW;
  }
}

/**
 * Custom hook for monitoring network state with debounced reconnection handling
 *
 * @param options - Configuration options for network monitoring
 * @returns Current network state and utility functions
 *
 * @example
 * ```tsx
 * function ChatScreen() {
 *   const { isConnected, quality, refresh } = useNetworkMonitor({
 *     reconnectionDebounce: 3000,
 *     onOffline: () => console.log('Lost connection'),
 *     onOnline: () => console.log('Connection restored'),
 *   });
 *
 *   if (!isConnected) {
 *     return <OfflineMessage />;
 *   }
 *
 *   // Render chat UI
 * }
 * ```
 */
export function useNetworkMonitor(options: UseNetworkMonitorOptions = {}): NetworkState & {
  /** Manually refresh network state */
  refresh: () => void;
  /** Check if retry queue is processing */
  isQueueProcessing: boolean;
} {
  const {
    reconnectionDebounce = 2000,
    autoProcessQueue = true,
    onOffline,
    onOnline,
    onStateChange,
  } = options;

  // Network state
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true, // Optimistic default
    isInternetReachable: null,
    type: 'unknown',
    quality: ConnectionQuality.GOOD,
    lastChanged: Date.now(),
    details: null,
  });

  const [isQueueProcessing, setIsQueueProcessing] = useState(false);

  // Refs for debouncing and callbacks
  const reconnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousConnectionStateRef = useRef<boolean>(true);
  const subscriptionRef = useRef<NetInfoSubscription | null>(null);

  /**
   * Processes the retry queue when connection is restored
   */
  const processRetryQueue = useCallback(async () => {
    if (!autoProcessQueue) return;

    const retryQueue = getRetryQueue();
    const queueSize = retryQueue.getQueueSize();

    if (queueSize > 0) {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log(`Processing ${queueSize} queued operations after reconnection`);
      }
      setIsQueueProcessing(true);

      try {
        await retryQueue.processQueue();
      } finally {
        setIsQueueProcessing(false);
      }
    }
  }, [autoProcessQueue]);

  /**
   * Handles network state changes
   */
  const handleNetworkChange = useCallback((state: NetInfoState) => {
    const quality = determineConnectionQuality(state);

    const newState: NetworkState = {
      isConnected: state.isConnected || false,
      isInternetReachable: state.isInternetReachable,
      type: state.type,
      quality,
      lastChanged: Date.now(),
      details: state.details,
    };

    setNetworkState(newState);

    // Call state change callback
    onStateChange?.(newState);

    // Handle connection state transitions
    const wasConnected = previousConnectionStateRef.current;
    const isNowConnected = newState.isConnected;

    if (wasConnected && !isNowConnected) {
      // Going offline
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log('Network connection lost');
      }

      // Clear any pending reconnection timer
      if (reconnectionTimerRef.current) {
        clearTimeout(reconnectionTimerRef.current);
        reconnectionTimerRef.current = null;
      }

      onOffline?.();
    } else if (!wasConnected && isNowConnected) {
      // Coming online - debounce to avoid rapid reconnection attempts
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console -- Development-only logging
        console.log('Network connection restored, waiting for stability...');
      }

      // Clear any existing timer
      if (reconnectionTimerRef.current) {
        clearTimeout(reconnectionTimerRef.current);
      }

      // Set new debounced reconnection handler
      reconnectionTimerRef.current = setTimeout(() => {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- Development-only logging
          console.log('Network connection stable, processing queued operations');
        }
        onOnline?.();
        processRetryQueue();
        reconnectionTimerRef.current = null;
      }, reconnectionDebounce);
    }

    previousConnectionStateRef.current = isNowConnected;
  }, [reconnectionDebounce, onOffline, onOnline, onStateChange, processRetryQueue]);

  /**
   * Manually refresh network state
   */
  const refresh = useCallback(() => {
    NetInfo.fetch().then(handleNetworkChange);
  }, [handleNetworkChange]);

  // Set up network monitoring
  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(handleNetworkChange);

    // Subscribe to network state changes
    subscriptionRef.current = NetInfo.addEventListener(handleNetworkChange);

    // Cleanup
    return () => {
      // Clear reconnection timer
      if (reconnectionTimerRef.current) {
        clearTimeout(reconnectionTimerRef.current);
      }

      // Unsubscribe from network events
      if (subscriptionRef.current) {
        subscriptionRef.current();
      }
    };
  }, [handleNetworkChange]);

  return {
    ...networkState,
    refresh,
    isQueueProcessing,
  };
}

/**
 * Utility hook for simple online/offline status
 *
 * @returns Boolean indicating if device is online
 *
 * @example
 * ```tsx
 * function Component() {
 *   const isOnline = useIsOnline();
 *
 *   return isOnline ? <OnlineContent /> : <OfflineMessage />;
 * }
 * ```
 */
export function useIsOnline(): boolean {
  const { isConnected } = useNetworkMonitor();
  return isConnected;
}

/**
 * Utility hook for connection quality monitoring
 *
 * @returns Current connection quality level
 *
 * @example
 * ```tsx
 * function VideoCall() {
 *   const quality = useConnectionQuality();
 *
 *   if (quality === ConnectionQuality.SLOW) {
 *     return <LowBandwidthWarning />;
 *   }
 *
 *   // Render video call UI
 * }
 * ```
 */
export function useConnectionQuality(): ConnectionQuality {
  const { quality } = useNetworkMonitor();
  return quality;
}