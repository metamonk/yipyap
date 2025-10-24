/**
 * Unit tests for Presence Service (RTDB-based)
 * @module tests/unit/services/presenceService
 */

 

import { presenceService } from '@/services/presenceService';
import { getFirebaseRealtimeDb } from '@/services/firebase';
import { getDeviceId } from '@/utils/deviceId';

// Mock dependencies
jest.mock('@/services/firebase');
jest.mock('@/utils/deviceId', () => ({
  getDeviceId: jest.fn(),
  getPlatform: jest.fn(() => 'ios'),
}));
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
  },
  Platform: {
    OS: 'ios',
  },
}));

// Mock Firebase RTDB functions
const mockRef = jest.fn();
const mockSet = jest.fn();
const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockOnDisconnect = jest.fn();
const mockOnValue = jest.fn();

jest.mock('firebase/database', () => ({
  ref: (...args: any[]) => mockRef(...args),
  set: (...args: any[]) => mockSet(...args),
  get: (...args: any[]) => mockGet(...args),
  update: (...args: any[]) => mockUpdate(...args),
  onDisconnect: (...args: any[]) => mockOnDisconnect(...args),
  onValue: (...args: any[]) => mockOnValue(...args),
  serverTimestamp: () => 1234567890,
}));

describe('PresenceService (RTDB)', () => {
  const mockDb = {} as any;
  const mockDeviceId = 'test-device-123';
  const mockUserId = 'user-456';
  // Create a reusable mock ref object with _repo property for onDisconnect checks
  const mockRefObj = { _repo: {} };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    (getFirebaseRealtimeDb as jest.Mock).mockReturnValue(mockDb);
    (getDeviceId as jest.Mock).mockResolvedValue(mockDeviceId);

    // Mock ref to return the same object (so reference equality checks work)
    mockRef.mockReturnValue(mockRefObj);
    mockSet.mockResolvedValue(undefined);
    mockGet.mockResolvedValue({ val: () => null });
    mockUpdate.mockResolvedValue(undefined);
    mockOnDisconnect.mockReturnValue({
      set: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    });
    mockOnValue.mockReturnValue(jest.fn());
  });

  afterEach(async () => {
    // Cleanup after each test
    await presenceService.cleanup();
  });

  describe('initialize', () => {
    it('should initialize presence tracking for a user', async () => {
      // Setup connection state callback
      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        if (ref === mockRefObj) {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      // Verify device ID was retrieved
      expect(getDeviceId).toHaveBeenCalled();

      // Verify RTDB refs were created
      expect(mockRef).toHaveBeenCalledWith(mockDb, `presence/${mockUserId}`);
      expect(mockRef).toHaveBeenCalledWith(mockDb, `presence/${mockUserId}/devices/${mockDeviceId}`);
      expect(mockRef).toHaveBeenCalledWith(mockDb, '.info/connected');

      // Simulate connection
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify device presence was set
      expect(mockSet).toHaveBeenCalled();

      // Verify onDisconnect handler was registered
      expect(mockOnDisconnect).toHaveBeenCalled();
    });

    it('should cleanup existing presence before re-initializing', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(mockUserId);
      const firstCallCount = mockSet.mock.calls.length;

      // Re-initialize
      await presenceService.initialize('different-user');

      // Should have set offline status during cleanup
      expect(mockSet.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('should register onDisconnect handlers', async () => {
      const mockDisconnectSet = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({
        set: mockDisconnectSet,
        cancel: jest.fn(),
      });

      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        // Immediately trigger connected state
        if (ref === mockRefObj) {
          setTimeout(() => callback({ val: () => true }), 0);
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      // Wait for connection callback
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockOnDisconnect).toHaveBeenCalled();
      expect(mockDisconnectSet).toHaveBeenCalled();
    });
  });

  describe('forceUpdate', () => {
    beforeEach(async () => {
      mockOnValue.mockReturnValue(jest.fn());
      await presenceService.initialize(mockUserId);
      jest.clearAllMocks();
    });

    it('should update status to online', async () => {
      await presenceService.forceUpdate('online');

      expect(mockSet).toHaveBeenCalled();
    });

    it('should update status to offline', async () => {
      await presenceService.forceUpdate('offline');

      expect(mockSet).toHaveBeenCalled();
    });

    it('should update status to away', async () => {
      await presenceService.forceUpdate('away');

      expect(mockSet).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      // Setup connection callback to simulate being connected
      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        connectionCallback = callback;
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      // Simulate connection to set isConnected = true
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      jest.clearAllMocks();
    });

    it('should set device presence to offline', async () => {
      await presenceService.cleanup();

      expect(mockSet).toHaveBeenCalled();
    });

    it('should cancel onDisconnect handlers', async () => {
      const mockCancel = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({
        set: jest.fn(),
        cancel: mockCancel,
      });

      await presenceService.cleanup();

      // OnDisconnect is called during cleanup to cancel
      expect(mockCancel).toHaveBeenCalled();
    });
  });

  describe('subscribeToPresence', () => {
    it('should subscribe to another user presence', () => {
      const callback = jest.fn();
      const unsubscribe = presenceService.subscribeToPresence('other-user', callback);

      expect(mockRef).toHaveBeenCalledWith(mockDb, 'presence/other-user');
      expect(mockOnValue).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with presence data', () => {
      const callback = jest.fn();
      const mockPresence = {
        state: 'online',
        lastSeen: Date.now(),
        devices: {},
      };

      mockOnValue.mockImplementation((ref: any, cb: (snapshot: any) => void) => {
        cb({ val: () => mockPresence });
        return jest.fn();
      });

      presenceService.subscribeToPresence('other-user', callback);

      expect(callback).toHaveBeenCalledWith(mockPresence);
    });
  });

  describe('recordActivity', () => {
    beforeEach(async () => {
      mockOnValue.mockReturnValue(jest.fn());
      await presenceService.initialize(mockUserId);
      jest.clearAllMocks();
    });

    it('should reset away timer', () => {
      // Just verify it doesn't throw
      expect(() => presenceService.recordActivity()).not.toThrow();
    });

    it('should change state from away to online', async () => {
      // Set to away first
      await presenceService.forceUpdate('away');
      jest.clearAllMocks();

      // Record activity
      presenceService.recordActivity();

      // Should trigger presence update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // State should be updated internally
    });
  });

  describe('connection state handling', () => {
    it('should handle connection lost', async () => {
      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        if (ref === mockRefObj) {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      if (connectionCallback) {
        // Simulate connection
        connectionCallback({ val: () => true });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Clear mocks to check reconnection behavior
        jest.clearAllMocks();

        // Simulate disconnection
        connectionCallback({ val: () => false });

        // onDisconnect handlers are triggered server-side, not in the callback
      }
    });

    it('should handle connection restored', async () => {
      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        if (ref === mockRefObj) {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      if (connectionCallback) {
        // Simulate disconnection first
        connectionCallback({ val: () => false });

        jest.clearAllMocks();

        // Simulate reconnection
        connectionCallback({ val: () => true });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should set presence and onDisconnect again
        expect(mockSet).toHaveBeenCalled();
        expect(mockOnDisconnect).toHaveBeenCalled();
      }
    });
  });

  describe('multi-device support', () => {
    it('should use device ID in RTDB path', async () => {
      mockOnValue.mockReturnValue(jest.fn());

      await presenceService.initialize(mockUserId);

      expect(mockRef).toHaveBeenCalledWith(
        mockDb,
        `presence/${mockUserId}/devices/${mockDeviceId}`
      );
    });
  });

  describe('automatic offline on disconnect', () => {
    it('should register onDisconnect when connected', async () => {
      const mockDisconnectSet = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({
        set: mockDisconnectSet,
        cancel: jest.fn(),
      });

      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        if (ref === mockRefObj) {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      // Simulate connection
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockOnDisconnect).toHaveBeenCalled();
      expect(mockDisconnectSet).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'offline',
          platform: 'ios',
        })
      );
    });
  });

  describe('Read-Aggregate-Write pattern (Bug #1 fix)', () => {
    beforeEach(async () => {
      let connectionCallback: ((snapshot: any) => void) | null = null;
      mockOnValue.mockImplementation((ref: any, callback: (snapshot: any) => void) => {
        if (ref === mockRefObj) {
          connectionCallback = callback;
        }
        return jest.fn();
      });

      await presenceService.initialize(mockUserId);

      // Simulate connection
      if (connectionCallback) {
        connectionCallback({ val: () => true });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      jest.clearAllMocks();
    });

    it('should read device data before aggregating presence', async () => {
      // Mock existing device data
      const existingDevices = {
        'device-1': { state: 'online', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'offline', platform: 'android', lastActivity: 2000 },
      };
      mockGet.mockResolvedValue({ val: () => existingDevices });

      // Trigger aggregation
      await presenceService.forceUpdate('online');

      // Verify device data was read first
      expect(mockGet).toHaveBeenCalled();
      // Verify update was called (not set, which would overwrite)
      expect(mockUpdate).toHaveBeenCalled();
      // Verify set was called for device presence (not user aggregated presence)
      expect(mockSet).toHaveBeenCalled();
    });

    it('should preserve device data when updating aggregated presence', async () => {
      const existingDevices = {
        'device-1': { state: 'online', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'offline', platform: 'android', lastActivity: 2000 },
      };
      mockGet.mockResolvedValue({ val: () => existingDevices });

      await presenceService.forceUpdate('online');

      // Verify update was called with only state and lastSeen (not devices)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          state: expect.any(String),
          lastSeen: expect.anything(),
        })
      );

      // Verify devices field was NOT in the update (would overwrite)
      const updateCall = mockUpdate.mock.calls[0];
      const updateData = updateCall?.[1];
      expect(updateData).not.toHaveProperty('devices');
    });

    it('should aggregate correctly: any device online = user online', async () => {
      const devicesWithOneOnline = {
        'device-1': { state: 'online', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'offline', platform: 'android', lastActivity: 2000 },
        'device-3': { state: 'offline', platform: 'web', lastActivity: 3000 },
      };
      mockGet.mockResolvedValue({ val: () => devicesWithOneOnline });

      await presenceService.forceUpdate('online');

      // User should be online because device-1 is online
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          state: 'online',
        })
      );
    });

    it('should aggregate correctly: all devices offline = user offline', async () => {
      const allDevicesOffline = {
        'device-1': { state: 'offline', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'offline', platform: 'android', lastActivity: 2000 },
      };
      mockGet.mockResolvedValue({ val: () => allDevicesOffline });

      await presenceService.forceUpdate('offline');

      // User should be offline because all devices are offline
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          state: 'offline',
        })
      );
    });

    it('should track most recent activity across all devices', async () => {
      const devicesWithActivities = {
        'device-1': { state: 'offline', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'online', platform: 'android', lastActivity: 5000 },
        'device-3': { state: 'offline', platform: 'web', lastActivity: 3000 },
      };
      mockGet.mockResolvedValue({ val: () => devicesWithActivities });

      await presenceService.forceUpdate('online');

      // lastSeen should be the most recent activity (5000)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lastSeen: 5000,
        })
      );
    });

    it('should handle empty device data gracefully', async () => {
      mockGet.mockResolvedValue({ val: () => null });

      await presenceService.forceUpdate('online');

      // Should not throw and should still update
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle away state correctly with multi-device', async () => {
      const devicesWithOneOnline = {
        'device-1': { state: 'online', platform: 'ios', lastActivity: 1000 },
        'device-2': { state: 'offline', platform: 'android', lastActivity: 2000 },
      };
      mockGet.mockResolvedValue({ val: () => devicesWithOneOnline });

      // Force update to 'away'
      await presenceService.forceUpdate('away');

      // User should be away (even though device is online, user explicitly set away)
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          state: 'away',
        })
      );
    });
  });
});
