/**
 * Unit tests for useConnectionState hook
 * @module tests/unit/hooks/useConnectionState
 */

 
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useConnectionState } from '@/hooks/useConnectionState';
import { getFirebaseRealtimeDb } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');

// Mock Firebase RTDB
const mockRef = jest.fn();
const mockOnValue = jest.fn();

jest.mock('firebase/database', () => ({
  ref: (...args: any[]) => mockRef(...args),
  onValue: (...args: any[]) => mockOnValue(...args),
}));

describe('useConnectionState', () => {
  const mockDb = {} as any;
  let connectionCallback: Function | null = null;

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirebaseRealtimeDb as jest.Mock).mockReturnValue(mockDb);

    mockRef.mockReturnValue('connectedRef');
    mockOnValue.mockImplementation((ref: any, callback: Function) => {
      connectionCallback = callback;
      return jest.fn();
    });
  });

  afterEach(() => {
    connectionCallback = null;
  });

  describe('initialization', () => {
    it('should start with disconnected state', () => {
      const { result } = renderHook(() => useConnectionState());

      expect(result.current.connected).toBe(false);
      expect(result.current.reconnecting).toBe(false);
      expect(result.current.lastConnectedAt).toBeNull();
    });

    it('should monitor .info/connected reference', () => {
      renderHook(() => useConnectionState());

      expect(mockRef).toHaveBeenCalledWith(mockDb, '.info/connected');
      expect(mockOnValue).toHaveBeenCalled();
    });
  });

  describe('connection state changes', () => {
    it('should update to connected when connection established', async () => {
      const { result } = renderHook(() => useConnectionState());

      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.connected).toBe(true);
      expect(result.current.reconnecting).toBe(false);
      expect(result.current.lastConnectedAt).toBeGreaterThan(0);
    });

    it('should update to reconnecting when connection lost', async () => {
      const { result } = renderHook(() => useConnectionState());

      // First connect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Then disconnect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => false });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.connected).toBe(false);
      expect(result.current.reconnecting).toBe(true);
    });

    it('should update lastConnectedAt when connected', async () => {
      const { result } = renderHook(() => useConnectionState());

      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const firstConnection = result.current.lastConnectedAt;
      expect(firstConnection).toBeGreaterThan(0);

      // Disconnect and reconnect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => false });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.lastConnectedAt).toBeGreaterThanOrEqual(firstConnection!);
    });
  });

  describe('operation queue', () => {
    it('should queue operations when offline', async () => {
      const { result } = renderHook(() => useConnectionState());

      await act(async () => {
        const op = jest.fn().mockResolvedValue(undefined);
        result.current.queueOperation(op);
      });

      expect(result.current.queuedCount).toBe(1);
    });

    it('should process queued operations when connected', async () => {
      const { result } = renderHook(() => useConnectionState());

      const op = jest.fn().mockResolvedValue(undefined);

      // Queue while offline
      await act(async () => {
        result.current.queueOperation(op);
      });

      // Connect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Operation should have been executed
      await waitFor(() => {
        expect(op).toHaveBeenCalled();
      });

      expect(result.current.queuedCount).toBe(0);
    });

    it('should clear queue when requested', async () => {
      const { result } = renderHook(() => useConnectionState());

      await act(async () => {
        result.current.queueOperation(jest.fn());
        result.current.queueOperation(jest.fn());
        result.current.queueOperation(jest.fn());
      });

      expect(result.current.queuedCount).toBe(3);

      await act(async () => {
        result.current.clearQueue();
      });

      expect(result.current.queuedCount).toBe(0);
    });

    it('should re-queue failed operations', async () => {
      const { result } = renderHook(() => useConnectionState());

      const failingOp = jest.fn().mockRejectedValue(new Error('Operation failed'));

      // Queue operation
      await act(async () => {
        result.current.queueOperation(failingOp);
      });

      // Connect to trigger processing
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Operation should have been attempted
      expect(failingOp).toHaveBeenCalled();

      // Failed operation should be re-queued
      expect(result.current.queuedCount).toBe(1);
    });

    it('should limit queue size to prevent memory issues', async () => {
      const { result } = renderHook(() => useConnectionState());

      await act(async () => {
        // Queue 51 operations (more than max of 50)
        for (let i = 0; i < 51; i++) {
          result.current.queueOperation(jest.fn());
        }
      });

      // Should only keep 50 operations
      expect(result.current.queuedCount).toBeLessThanOrEqual(50);
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe on unmount', () => {
      const mockUnsubscribe = jest.fn();
      mockOnValue.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useConnectionState());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('reconnection handling', () => {
    it('should reset reconnection attempts when connected', async () => {
      const { result } = renderHook(() => useConnectionState());

      // Disconnect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => false });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.reconnecting).toBe(true);

      // Reconnect
      await act(async () => {
        if (connectionCallback) {
          connectionCallback({ val: () => true });
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(result.current.reconnecting).toBe(false);
    });
  });
});
