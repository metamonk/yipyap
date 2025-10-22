/**
 * Unit tests for Presence Service
 * @module tests/unit/services/presenceService
 */

import { presenceService } from '@/services/presenceService';
import { getFirebaseDb } from '@/services/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { AppState } from 'react-native';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(),
    currentState: 'active',
  },
}));

describe('PresenceService', () => {
  const mockUserId = 'user123';
  const mockDb = {};
  const mockUserRef = { id: mockUserId };
  const mockAppStateListener = { remove: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (doc as jest.Mock).mockReturnValue(mockUserRef);
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
    (serverTimestamp as jest.Mock).mockReturnValue({ _serverTimestamp: true });
    (AppState.addEventListener as jest.Mock).mockReturnValue(mockAppStateListener);
  });

  afterEach(() => {
    // Cleanup to prevent state leakage between tests
    presenceService.cleanup();
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should set initial online status', async () => {
      presenceService.initialize(mockUserId);

      // Wait for async operations
      await Promise.resolve();

      expect(doc).toHaveBeenCalledWith(mockDb, 'users', mockUserId);
      expect(updateDoc).toHaveBeenCalledWith(mockUserRef, {
        'presence.status': 'online',
        'presence.lastSeen': { _serverTimestamp: true },
        updatedAt: { _serverTimestamp: true },
      });
    });

    it('should start heartbeat interval', () => {
      presenceService.initialize(mockUserId);

      // Advance time by 30 seconds
      jest.advanceTimersByTime(30000);

      // Should have made 2 calls - initial and after 30 seconds
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('should setup app state listener', () => {
      presenceService.initialize(mockUserId);

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should cleanup previous session before initializing new one', () => {
      presenceService.initialize('user1');
      const firstListenerRemove = mockAppStateListener.remove;

      presenceService.initialize('user2');

      expect(firstListenerRemove).toHaveBeenCalled();
    });
  });

  describe('app state changes', () => {
    it('should set online status when app becomes active', async () => {
      presenceService.initialize(mockUserId);
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      jest.clearAllMocks();
      appStateHandler('active');

      await Promise.resolve();

      expect(updateDoc).toHaveBeenCalledWith(mockUserRef, {
        'presence.status': 'online',
        'presence.lastSeen': { _serverTimestamp: true },
        updatedAt: { _serverTimestamp: true },
      });
    });

    it('should set offline status when app goes to background', async () => {
      presenceService.initialize(mockUserId);
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      jest.clearAllMocks();
      appStateHandler('background');

      await Promise.resolve();

      expect(updateDoc).toHaveBeenCalledWith(mockUserRef, {
        'presence.status': 'offline',
        'presence.lastSeen': { _serverTimestamp: true },
        updatedAt: { _serverTimestamp: true },
      });
    });

    it('should stop heartbeat when app goes to background', () => {
      presenceService.initialize(mockUserId);
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];

      jest.clearAllMocks();
      appStateHandler('background');

      // Advance time - should not trigger more updates
      jest.advanceTimersByTime(60000);

      expect(updateDoc).toHaveBeenCalledTimes(1); // Only the offline status update
    });
  });

  describe('throttling', () => {
    it('should throttle rapid updates', async () => {
      presenceService.initialize(mockUserId);

      jest.clearAllMocks();

      // Try to force multiple rapid updates
      await presenceService.forceUpdate('online');
      await presenceService.forceUpdate('offline');
      await presenceService.forceUpdate('online');

      // Should only make first update due to 5-second throttle
      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('should allow updates after throttle period', async () => {
      presenceService.initialize(mockUserId);

      jest.clearAllMocks();

      await presenceService.forceUpdate('online');

      // Advance time past throttle period
      jest.advanceTimersByTime(6000);

      await presenceService.forceUpdate('offline');

      expect(updateDoc).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup', () => {
    it('should set offline status on cleanup', async () => {
      presenceService.initialize(mockUserId);
      jest.clearAllMocks();

      presenceService.cleanup();

      await Promise.resolve();

      expect(updateDoc).toHaveBeenCalledWith(mockUserRef, {
        'presence.status': 'offline',
        'presence.lastSeen': { _serverTimestamp: true },
        updatedAt: { _serverTimestamp: true },
      });
    });

    it('should stop heartbeat interval', () => {
      presenceService.initialize(mockUserId);
      presenceService.cleanup();

      jest.clearAllMocks();
      jest.advanceTimersByTime(60000);

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('should remove app state listener', () => {
      presenceService.initialize(mockUserId);
      presenceService.cleanup();

      expect(mockAppStateListener.remove).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should silently fail on update errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      presenceService.initialize(mockUserId);

      await Promise.resolve();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update presence:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should continue heartbeat even after errors', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      presenceService.initialize(mockUserId);

      // Advance time to trigger multiple heartbeats
      jest.advanceTimersByTime(60000);

      // Should have attempted updates despite errors
      expect(updateDoc).toHaveBeenCalledTimes(3); // Initial + 2 heartbeats
    });
  });

  describe('forceUpdate', () => {
    it('should bypass throttle for force updates', async () => {
      presenceService.initialize(mockUserId);

      // Make a regular update
      const appStateHandler = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
      appStateHandler('background');

      jest.clearAllMocks();

      // Force update immediately (would normally be throttled)
      await presenceService.forceUpdate('online');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(mockUserRef, {
        'presence.status': 'online',
        'presence.lastSeen': { _serverTimestamp: true },
        updatedAt: { _serverTimestamp: true },
      });
    });
  });
});
