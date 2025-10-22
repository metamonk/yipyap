import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NetInfo from '@react-native-community/netinfo';

// Mock NetInfo
jest.mock('@react-native-community/netinfo');

interface MockNetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}

describe('useNetworkStatus', () => {
  let mockListener: ((state: MockNetInfoState) => void) | null = null;
  let unsubscribeMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockListener = null;
    unsubscribeMock = jest.fn();

    // Mock addEventListener
    (NetInfo.addEventListener as jest.Mock).mockImplementation((listener) => {
      mockListener = listener;
      return unsubscribeMock;
    });
  });

  afterEach(() => {
    mockListener = null;
  });

  it('returns online when NetInfo reports connected', async () => {
    // Mock initial fetch to return online state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('online');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.isInternetReachable).toBe(true);
      expect(result.current.type).toBe('wifi');
    });
  });

  it('returns offline when NetInfo reports disconnected', async () => {
    // Mock initial fetch to return offline state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('offline');
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isInternetReachable).toBe(false);
      expect(result.current.type).toBe('none');
    });
  });

  it('updates status when network changes from online to offline', async () => {
    // Mock initial fetch to return online state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('online');
    });

    // Simulate network change to offline
    act(() => {
      if (mockListener) {
        mockListener({
          isConnected: false,
          isInternetReachable: false,
          type: 'none',
        });
      }
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('offline');
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('updates status when network changes from offline to online', async () => {
    // Mock initial fetch to return offline state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
      type: 'none',
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('offline');
    });

    // Simulate network change to online
    act(() => {
      if (mockListener) {
        mockListener({
          isConnected: true,
          isInternetReachable: true,
          type: 'cellular',
        });
      }
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('online');
      expect(result.current.isConnected).toBe(true);
      expect(result.current.type).toBe('cellular');
    });
  });

  it('cleans up NetInfo listener on unmount', async () => {
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    });

    const { unmount } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(NetInfo.addEventListener).toHaveBeenCalled();
    });

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('handles null isConnected state', async () => {
    // Mock initial fetch to return null connection state
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: null,
      isInternetReachable: null,
      type: 'unknown',
    });

    const { result } = renderHook(() => useNetworkStatus());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('offline');
      expect(result.current.isConnected).toBe(null);
      expect(result.current.isInternetReachable).toBe(null);
    });
  });
});
