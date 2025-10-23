/**
 * Unit tests for typingService
 */

import { typingService } from '@/services/typingService';
import { ref, set, onDisconnect, onValue } from 'firebase/database';
import type { TypingIndicator } from '@/types/models';

// Mock Firebase RTDB
jest.mock('firebase/database');
jest.mock('@/services/firebase', () => ({
  getFirebaseRealtimeDb: jest.fn(() => ({})),
}));

const mockRef = ref as jest.MockedFunction<typeof ref>;
const mockSet = set as jest.MockedFunction<typeof set>;
const mockOnDisconnect = onDisconnect as jest.MockedFunction<typeof onDisconnect>;
const mockOnValue = onValue as jest.MockedFunction<typeof onValue>;

describe('TypingService', () => {
  const conversationId = 'conv123';
  const userId = 'user456';
  const otherUserId = 'user789';

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock onDisconnect to return object with remove and cancel methods
    mockOnDisconnect.mockReturnValue({
      remove: jest.fn().mockResolvedValue(undefined),
      cancel: jest.fn().mockResolvedValue(undefined),
    } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('setTyping', () => {
    it('should publish typing state to correct RTDB path', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      await typingService.setTyping(conversationId, userId, true);

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve(); // Wait for async operations

      expect(mockRef).toHaveBeenCalledWith(
        expect.anything(),
        `typing/${conversationId}/${userId}`
      );
    });

    it('should set isTyping to true when user starts typing', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      await typingService.setTyping(conversationId, userId, true);

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      expect(mockSet).toHaveBeenCalledWith(
        mockTypingRef,
        expect.objectContaining({
          isTyping: true,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should set isTyping to false when user stops typing', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      await typingService.setTyping(conversationId, userId, false);

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      expect(mockSet).toHaveBeenCalledWith(mockTypingRef, null);
    });

    it('should register onDisconnect cleanup handler when typing starts', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      const mockRemove = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({ remove: mockRemove, cancel: jest.fn() } as any);

      await typingService.setTyping(conversationId, userId, true);

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      expect(mockOnDisconnect).toHaveBeenCalledWith(mockTypingRef);
      expect(mockRemove).toHaveBeenCalled();
    });

    it('should cancel onDisconnect when user stops typing', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      const mockCancel = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({ remove: jest.fn(), cancel: mockCancel } as any);

      await typingService.setTyping(conversationId, userId, false);

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      expect(mockCancel).toHaveBeenCalled();
    });

    it('should auto-clear typing state after 3 seconds', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      await typingService.setTyping(conversationId, userId, true);

      // Advance debounce timer and flush promises
      await jest.advanceTimersByTimeAsync(300);

      // Clear mock calls from initial setTyping
      mockSet.mockClear();

      // Advance 3 seconds for auto-clear timeout and flush promises
      await jest.advanceTimersByTimeAsync(3000);

      // Should call set with null to clear typing state
      expect(mockSet).toHaveBeenCalledWith(mockTypingRef, null);
    });

    it('should debounce typing updates (300ms)', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      // Call setTyping multiple times rapidly
      await typingService.setTyping(conversationId, userId, true);
      await typingService.setTyping(conversationId, userId, true);
      await typingService.setTyping(conversationId, userId, true);

      // Should not have called set yet (debounced)
      expect(mockSet).not.toHaveBeenCalled();

      // Advance debounce timer
      jest.advanceTimersByTime(300);

      await Promise.resolve();

      // Should only call set once after debounce
      expect(mockSet).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribeToTyping', () => {
    it('should subscribe to correct RTDB path', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockOnValue.mockReturnValue(jest.fn());

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      expect(mockRef).toHaveBeenCalledWith(expect.anything(), `typing/${conversationId}`);
      expect(mockOnValue).toHaveBeenCalledWith(
        mockTypingRef,
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should filter out current user from typing users', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      let snapshotCallback: (snapshot: any) => void = () => {};
      mockOnValue.mockImplementation((ref, callback) => {
        snapshotCallback = callback;
        return jest.fn();
      });

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      // Simulate typing data with current user included
      const typingData: Record<string, TypingIndicator> = {
        [userId]: { isTyping: true, timestamp: Date.now() },
        [otherUserId]: { isTyping: true, timestamp: Date.now() },
      };

      snapshotCallback({
        val: () => typingData,
      } as any);

      // Should only include other user, not current user
      expect(callback).toHaveBeenCalledWith({
        [otherUserId]: expect.objectContaining({ isTyping: true }),
      });
    });

    it('should filter out stale typing states (>3 seconds old)', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      let snapshotCallback: (snapshot: any) => void = () => {};
      mockOnValue.mockImplementation((ref, callback) => {
        snapshotCallback = callback;
        return jest.fn();
      });

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      const now = Date.now();
      const staleTimestamp = now - 4000; // 4 seconds ago (stale)
      const freshTimestamp = now - 1000; // 1 second ago (fresh)

      // Simulate typing data with stale and fresh states
      const typingData: Record<string, TypingIndicator> = {
        user1: { isTyping: true, timestamp: staleTimestamp },
        user2: { isTyping: true, timestamp: freshTimestamp },
      };

      snapshotCallback({
        val: () => typingData,
      } as any);

      // Should only include fresh typing state
      expect(callback).toHaveBeenCalledWith({
        user2: expect.objectContaining({ isTyping: true }),
      });
    });

    it('should filter out users with isTyping: false', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      let snapshotCallback: (snapshot: any) => void = () => {};
      mockOnValue.mockImplementation((ref, callback) => {
        snapshotCallback = callback;
        return jest.fn();
      });

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      const typingData: Record<string, TypingIndicator> = {
        user1: { isTyping: false, timestamp: Date.now() },
        user2: { isTyping: true, timestamp: Date.now() },
      };

      snapshotCallback({
        val: () => typingData,
      } as any);

      // Should only include user with isTyping: true
      expect(callback).toHaveBeenCalledWith({
        user2: expect.objectContaining({ isTyping: true }),
      });
    });

    it('should call callback with empty object when no typing data', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      let snapshotCallback: (snapshot: any) => void = () => {};
      mockOnValue.mockImplementation((ref, callback) => {
        snapshotCallback = callback;
        return jest.fn();
      });

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      snapshotCallback({
        val: () => null,
      } as any);

      expect(callback).toHaveBeenCalledWith({});
    });

    it('should return unsubscribe function', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      const mockUnsubscribe = jest.fn();
      mockOnValue.mockReturnValue(mockUnsubscribe);

      const callback = jest.fn();
      const unsubscribe = typingService.subscribeToTyping(conversationId, userId, callback);

      expect(unsubscribe).toBe(mockUnsubscribe);
    });
  });

  describe('cleanup', () => {
    it('should clear typing state from RTDB', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      // First set typing state
      await typingService.setTyping(conversationId, userId, true);
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      mockSet.mockClear();

      // Then cleanup
      await typingService.cleanup(conversationId, userId);

      expect(mockSet).toHaveBeenCalledWith(mockTypingRef, null);
    });

    it('should cancel onDisconnect handler', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      const mockCancel = jest.fn().mockResolvedValue(undefined);
      mockOnDisconnect.mockReturnValue({ remove: jest.fn(), cancel: mockCancel } as any);

      // First set typing state
      await typingService.setTyping(conversationId, userId, true);
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      // Then cleanup
      await typingService.cleanup(conversationId, userId);

      expect(mockCancel).toHaveBeenCalled();
    });

    it('should clear pending debounce timeouts', async () => {
      await typingService.setTyping(conversationId, userId, true);

      // Cleanup before debounce completes
      await typingService.cleanup(conversationId, userId);

      // Advance timer - should not trigger debounced action
      jest.advanceTimersByTime(300);

      // Cleanup should have prevented the set call
      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should clear auto-clear timeout', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockResolvedValue(undefined);

      await typingService.setTyping(conversationId, userId, true);

      // Advance debounce timer and flush promises
      await jest.advanceTimersByTimeAsync(300);

      mockSet.mockClear();

      // Cleanup before auto-clear timeout
      await typingService.cleanup(conversationId, userId);

      // Advance timer - should not trigger auto-clear
      await jest.advanceTimersByTimeAsync(3000);

      // Should only have cleanup call, not auto-clear call
      expect(mockSet).toHaveBeenCalledTimes(1); // Only cleanup call
    });
  });

  describe('cleanupAll', () => {
    it('should cleanup all tracked typing states', async () => {
      const mockTypingRef1 = { path: `typing/conv1/user1` };
      const mockTypingRef2 = { path: `typing/conv2/user2` };

      mockRef.mockReturnValueOnce(mockTypingRef1 as any).mockReturnValueOnce(mockTypingRef2 as any);
      mockSet.mockResolvedValue(undefined);

      // Set typing for multiple conversations
      await typingService.setTyping('conv1', 'user1', true);
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      await typingService.setTyping('conv2', 'user2', true);
      jest.advanceTimersByTime(300);
      await Promise.resolve();

      mockSet.mockClear();

      // Cleanup all
      await typingService.cleanupAll();

      // Should have cleared both typing states
      expect(mockSet).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle RTDB write errors gracefully', async () => {
      const mockTypingRef = { path: `typing/${conversationId}/${userId}` };
      mockRef.mockReturnValue(mockTypingRef as any);
      mockSet.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(typingService.setTyping(conversationId, userId, true)).resolves.not.toThrow();

      jest.advanceTimersByTime(300);
      await Promise.resolve();
    });

    it('should handle subscription errors gracefully', () => {
      const mockTypingRef = { path: `typing/${conversationId}` };
      mockRef.mockReturnValue(mockTypingRef as any);

      let errorCallback: (error: Error) => void = () => {};
      mockOnValue.mockImplementation((ref, callback, errorCb) => {
        errorCallback = errorCb;
        return jest.fn();
      });

      const callback = jest.fn();
      typingService.subscribeToTyping(conversationId, userId, callback);

      // Simulate subscription error
      errorCallback(new Error('Network error'));

      // Should call callback with empty object on error
      expect(callback).toHaveBeenCalledWith({});
    });
  });
});
