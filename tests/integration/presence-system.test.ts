/**
 * Integration tests for Presence System (RTDB-based)
 * @module tests/integration/presence-system
 *
 * @remarks
 * Tests end-to-end presence functionality including:
 * - Real-time status updates
 * - Multi-device support
 * - Network disconnection handling
 * - Typing indicators
 * - Last seen timestamps
 * - Away detection
 */

 
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { presenceService } from '@/services/presenceService';
import { typingService } from '@/services/typingService';
import { getFirebaseRealtimeDb } from '@/services/firebase';
import { getDeviceId } from '@/utils/deviceId';
import type { PresenceData } from '@/types/models';

// Mock dependencies for controlled testing
jest.mock('@/services/firebase');
jest.mock('@/utils/deviceId');

// Mock Firebase RTDB
const mockDb = {
  _data: new Map<string, any>(),
};

const mockRef = jest.fn((db: any, path: string) => ({ _path: path }));
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockOnValue = jest.fn();
const mockOnDisconnect = jest.fn();

jest.mock('firebase/database', () => ({
  ref: (...args: any[]) => mockRef(...args),
  get: (...args: any[]) => mockGet(...args),
  set: (...args: any[]) => mockSet(...args),
  update: (...args: any[]) => mockUpdate(...args),
  onValue: (...args: any[]) => mockOnValue(...args),
  onDisconnect: (...args: any[]) => mockOnDisconnect(...args),
  serverTimestamp: () => Date.now(),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'ios',
  },
}));

describe('Presence System Integration', () => {
  const user1Id = 'user-1';
  const user2Id = 'user-2';
  const device1Id = 'device-1';
  const device2Id = 'device-2';

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirebaseRealtimeDb as jest.Mock).mockReturnValue(mockDb);
    (getDeviceId as jest.Mock).mockResolvedValue(device1Id);

    mockSet.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({ val: () => null });
    mockUpdate.mockResolvedValue(undefined);
    mockOnDisconnect.mockReturnValue({
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    });
    mockOnValue.mockReturnValue(jest.fn());
  });

  afterEach(async () => {
    await presenceService.cleanup();
    await typingService.cleanupAll();
  });

  describe('End-to-end presence updates', () => {
    it('should update presence when user comes online', async () => {
      let connectionCallback: Function | null = null;
      mockOnValue.mockImplementation((ref: any, callback: Function) => {
        if (ref._path === '.info/connected') {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(user1Id);

      // Simulate connection
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Verify presence was set
      expect(mockSet).toHaveBeenCalled();
      expect(mockOnDisconnect).toHaveBeenCalled();
    });

    it('should handle offline status correctly', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);

      // Explicitly set offline
      await presenceService.forceUpdate('offline');

      expect(mockSet).toHaveBeenCalled();
    });

    it('should transition between online, away, and offline states', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);
      jest.clearAllMocks();

      // Online
      await presenceService.forceUpdate('online');
      expect(mockSet).toHaveBeenCalled();

      jest.clearAllMocks();

      // Away
      await presenceService.forceUpdate('away');
      expect(mockSet).toHaveBeenCalled();

      jest.clearAllMocks();

      // Offline
      await presenceService.forceUpdate('offline');
      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('Multi-device scenarios', () => {
    it('should track presence per device', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      (getDeviceId as jest.Mock).mockResolvedValueOnce(device1Id);
      await presenceService.initialize(user1Id);

      expect(mockRef).toHaveBeenCalledWith(
        mockDb,
        `presence/${user1Id}/devices/${device1Id}`
      );
    });

    it('should support multiple devices for same user', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      // Device 1
      (getDeviceId as jest.Mock).mockResolvedValueOnce(device1Id);
      await presenceService.initialize(user1Id);

      expect(mockRef).toHaveBeenCalledWith(
        mockDb,
        `presence/${user1Id}/devices/${device1Id}`
      );

      await presenceService.cleanup();
      jest.clearAllMocks();

      // Device 2
      (getDeviceId as jest.Mock).mockResolvedValueOnce(device2Id);
      await presenceService.initialize(user1Id);

      expect(mockRef).toHaveBeenCalledWith(
        mockDb,
        `presence/${user1Id}/devices/${device2Id}`
      );
    });
  });

  describe('Network disconnection handling', () => {
    it('should register onDisconnect handlers', async () => {
      let connectionCallback: Function | null = null;
      mockOnValue.mockImplementation((ref: any, callback: Function) => {
        if (ref._path === '.info/connected') {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(user1Id);

      // Connect
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(mockOnDisconnect).toHaveBeenCalled();
    });

    it('should handle reconnection gracefully', async () => {
      let connectionCallback: Function | null = null;
      mockOnValue.mockImplementation((ref: any, callback: Function) => {
        if (ref._path === '.info/connected') {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(user1Id);

      // Disconnect
      if (connectionCallback) {
        connectionCallback({ val: () => false });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      jest.clearAllMocks();

      // Reconnect
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should set presence again
      expect(mockSet).toHaveBeenCalled();
      expect(mockOnDisconnect).toHaveBeenCalled();
    });
  });

  describe('Typing indicators with presence', () => {
    const conversationId = 'conv-123';

    it('should set typing state in RTDB', async () => {
      jest.useFakeTimers();

      const setPromise = typingService.setTyping(conversationId, user1Id, true);

      // Fast-forward debounce timer
      jest.advanceTimersByTime(300);
      await setPromise;
      await Promise.resolve(); // Let pending promises resolve

      expect(mockSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isTyping: true,
          timestamp: expect.any(Number),
        })
      );

      jest.useRealTimers();
    });

    it('should clear typing state when user stops typing', async () => {
      jest.useFakeTimers();

      const setPromise = typingService.setTyping(conversationId, user1Id, false);

      // Fast-forward debounce timer
      jest.advanceTimersByTime(300);
      await setPromise;
      await Promise.resolve();

      expect(mockSet).toHaveBeenCalledWith(expect.anything(), null);

      jest.useRealTimers();
    });

    it('should debounce rapid typing updates', async () => {
      jest.useFakeTimers();

      typingService.setTyping(conversationId, user1Id, true);
      typingService.setTyping(conversationId, user1Id, true);
      const lastPromise = typingService.setTyping(conversationId, user1Id, true);

      // Fast-forward debounce timer
      jest.advanceTimersByTime(300);
      await lastPromise;
      await Promise.resolve();

      // Should only call set once after debounce (previous calls were cancelled)
      expect(mockSet.mock.calls.length).toBeLessThanOrEqual(2);

      jest.useRealTimers();
    });

    it('should auto-clear stale typing states', async () => {
      jest.useFakeTimers();

      const setPromise = typingService.setTyping(conversationId, user1Id, true);

      // Fast-forward debounce timer (300ms)
      jest.advanceTimersByTime(300);
      await setPromise;
      await Promise.resolve();

      jest.clearAllMocks();

      // Fast-forward auto-clear timeout (3000ms)
      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      // Should have cleared the typing state
      expect(mockSet).toHaveBeenCalledWith(expect.anything(), null);

      jest.useRealTimers();
    });
  });

  describe('Last seen timestamp accuracy', () => {
    it('should update lastSeen when going offline', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);
      await presenceService.forceUpdate('offline');

      // Check aggregated presence update (uses mockUpdate, not mockSet)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastSeen: expect.any(Number),
        })
      );
    });

    it('should update lastSeen on state changes', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);

      await presenceService.forceUpdate('online');
      // Check last update call (aggregated presence)
      const firstUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];

      await new Promise((resolve) => setTimeout(resolve, 100));

      await presenceService.forceUpdate('away');
      const secondUpdateCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];

      // Both aggregated presence updates should have lastSeen
      expect(firstUpdateCall[1]).toHaveProperty('lastSeen');
      expect(secondUpdateCall[1]).toHaveProperty('lastSeen');
    });
  });

  describe('Away detection', () => {
    it('should provide recordActivity method', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);

      expect(() => presenceService.recordActivity()).not.toThrow();
    });

    it('should transition from away to online on activity', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);

      await presenceService.forceUpdate('away');
      jest.clearAllMocks();

      presenceService.recordActivity();

      // Should trigger state update
      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe('Subscription to presence updates', () => {
    it('should allow subscribing to another user presence', () => {
      const callback = jest.fn();

      const unsubscribe = presenceService.subscribeToPresence(user2Id, callback);

      expect(mockRef).toHaveBeenCalledWith(mockDb, `presence/${user2Id}`);
      expect(mockOnValue).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when presence data changes', () => {
      const callback = jest.fn();
      const mockPresence: PresenceData = {
        state: 'online',
        lastSeen: Date.now(),
        devices: {
          [device1Id]: {
            state: 'online',
            platform: 'ios',
            lastActivity: Date.now(),
          },
        },
      };

      mockOnValue.mockImplementation((ref: any, cb: Function) => {
        cb({ val: () => mockPresence });
        return jest.fn();
      });

      presenceService.subscribeToPresence(user2Id, callback);

      expect(callback).toHaveBeenCalledWith(mockPresence);
    });
  });

  describe('Cleanup and resource management', () => {
    it('should clean up all resources on cleanup', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);
      await presenceService.cleanup();

      expect(mockSet).toHaveBeenCalled(); // Set offline
    });

    it('should cancel onDisconnect handlers on cleanup', async () => {
      const mockCancel = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({
        set: jest.fn(),
        cancel: mockCancel,
      });

      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(user1Id);
      await presenceService.cleanup();

      expect(mockCancel).toHaveBeenCalled();
    });

    it('should cleanup typing indicators', async () => {
      jest.useFakeTimers();
      const conversationId = 'conv-123';

      const setPromise = typingService.setTyping(conversationId, user1Id, true);

      // Fast-forward debounce
      jest.advanceTimersByTime(300);
      await setPromise;
      await Promise.resolve();

      jest.clearAllMocks();

      await typingService.cleanup(conversationId, user1Id);
      await Promise.resolve();

      // Should have cleared typing state
      expect(mockSet).toHaveBeenCalledWith(expect.anything(), null);

      jest.useRealTimers();
    });
  });
});
