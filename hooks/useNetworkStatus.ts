import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export type ConnectionStatus = 'online' | 'offline';

export interface NetworkStatus {
  /** Whether the connection is 'online' or 'offline' */
  connectionStatus: ConnectionStatus;
  /** Whether the device is connected to a network (null if unknown) */
  isConnected: boolean | null;
  /** Whether the device has internet reachability (null if unknown) */
  isInternetReachable: boolean | null;
  /** The type of network connection (wifi, cellular, none, etc.) */
  type: string | null;
}

/**
 * Custom hook for monitoring network connectivity state
 *
 * @returns Network status object with connection state and reachability
 *
 * @example
 * ```tsx
 * function ChatScreen() {
 *   const { connectionStatus, isConnected } = useNetworkStatus();
 *
 *   if (connectionStatus === 'offline') {
 *     return <OfflineBanner />;
 *   }
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connectionStatus: 'online',
    isConnected: null,
    isInternetReachable: null,
    type: null,
  });

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkStatus({
        connectionStatus: state.isConnected ? 'online' : 'offline',
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    // Get initial state
    NetInfo.fetch().then((state) => {
      setNetworkStatus({
        connectionStatus: state.isConnected ? 'online' : 'offline',
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    });

    return () => unsubscribe();
  }, []);

  return networkStatus;
}
