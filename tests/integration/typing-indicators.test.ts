/**
 * Integration tests for typing indicators
 *
 * @remarks
 * These tests verify the end-to-end typing indicator flow using Firebase Emulator Suite.
 * Tests cover real-time updates, cleanup, timeouts, and multi-user scenarios.
 *
 * IMPORTANT: These tests require Firebase Emulator Suite to be running:
 *   firebase emulators:start --only database
 *
 * To skip these tests when emulator is not available, run:
 *   npm test -- --testPathPattern="typing" --testNamePattern="^(?!.*Integration)"
 */

import { typingService } from '@/services/typingService';
import { connectDatabaseEmulator, getDatabase, Database } from 'firebase/database';
import { initializeApp } from 'firebase/app';

// Mock the firebase service to use test database
jest.mock('@/services/firebase', () => {
  const originalModule = jest.requireActual('@/services/firebase');
  return {
    ...originalModule,
    getFirebaseRealtimeDb: jest.fn(),
  };
});

import { getFirebaseRealtimeDb } from '@/services/firebase';

// Firebase config for emulator
const firebaseConfig = {
  projectId: 'yipyap-test',
  databaseURL: 'http://127.0.0.1:9000?ns=yipyap-test',
};

let testDb: Database;

// Skip integration tests if SKIP_INTEGRATION_TESTS env var is set
const describeIntegration = process.env.SKIP_INTEGRATION_TESTS ? describe.skip : describe;

describeIntegration('Typing Indicators Integration Tests', () => {
  const conversationId = 'test-conv-123';
  const userAId = 'userA';
  const userBId = 'userB';
  const userCId = 'userC';

  beforeAll(() => {
    // Initialize Firebase for testing
    try {
      const app = initializeApp(firebaseConfig);
      testDb = getDatabase(app, firebaseConfig.databaseURL);
      connectDatabaseEmulator(testDb, '127.0.0.1', 9000);

      // Mock getFirebaseRealtimeDb to return test database
      (getFirebaseRealtimeDb as jest.Mock).mockReturnValue(testDb);
    } catch (error: any) {
      // App might already be initialized, which is fine
      if (!error.message?.includes('already exists')) {
        throw error;
      }
    }
  });

  beforeEach(async () => {
    // Clear all typing states before each test
    await typingService.cleanupAll();
  });

  afterEach(async () => {
    // Cleanup after each test
    await typingService.cleanupAll();
  });

  describe('Basic Typing Flow', () => {
    it('User A types, User B sees "User A is typing"', async () => {
      const receivedTypingStates: any[] = [];

      // User B subscribes to typing indicators
      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);

      // Wait for debounce (300ms)
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify User B sees User A typing
      expect(receivedTypingStates.length).toBeGreaterThan(0);
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeDefined();
      expect(latestState[userAId].isTyping).toBe(true);

      unsubscribe();
    });

    it('Typing indicator disappears after 3 seconds of inactivity', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify typing state exists
      let latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]?.isTyping).toBe(true);

      // Wait for auto-clear timeout (3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Verify typing state cleared
      latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeUndefined();

      unsubscribe();
    });

    it('Typing indicator cleared immediately when message sent', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify typing state exists
      let latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]?.isTyping).toBe(true);

      // User A sends message (stops typing)
      await typingService.setTyping(conversationId, userAId, false);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify typing state cleared immediately
      latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeUndefined();

      unsubscribe();
    });
  });

  describe('Multi-User Typing', () => {
    it('Multiple users typing shows correct text', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userCId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // User B starts typing
      await typingService.setTyping(conversationId, userBId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify both users are in typing state
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(Object.keys(latestState).length).toBe(2);
      expect(latestState[userAId]?.isTyping).toBe(true);
      expect(latestState[userBId]?.isTyping).toBe(true);

      unsubscribe();
    });

    it('Typing state updates when users stop typing individually', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userCId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // Both users start typing
      await typingService.setTyping(conversationId, userAId, true);
      await typingService.setTyping(conversationId, userBId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // User A stops typing
      await typingService.setTyping(conversationId, userAId, false);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify only User B is still typing
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeUndefined();
      expect(latestState[userBId]?.isTyping).toBe(true);

      unsubscribe();
    });
  });

  describe('Navigation and Cleanup', () => {
    it('Typing state cleared when user navigates away', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify typing state exists
      let latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]?.isTyping).toBe(true);

      // User A navigates away (cleanup)
      await typingService.cleanup(conversationId, userAId);

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify typing state cleared
      latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeUndefined();

      unsubscribe();
    });
  });

  describe('Debouncing', () => {
    it('Rapid typing does not cause excessive RTDB writes', async () => {
      const setTypingCalls: number[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, () => {
        setTypingCalls.push(Date.now());
      });

      // Simulate rapid typing (10 keystrokes in 1 second)
      for (let i = 0; i < 10; i++) {
        await typingService.setTyping(conversationId, userAId, true);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Wait for final debounce
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Should have significantly fewer RTDB updates than keystrokes due to debouncing
      // Expect around 2-3 updates max (debouncing should batch the rapid calls)
      expect(setTypingCalls.length).toBeLessThan(5);

      unsubscribe();
    });
  });

  describe('Group Chat Scenarios', () => {
    it('Group chat shows multiple typing users', async () => {
      const receivedTypingStates: any[] = [];

      // User D subscribes (viewing the group chat)
      const unsubscribe = typingService.subscribeToTyping(conversationId, 'userD', (typing) => {
        receivedTypingStates.push(typing);
      });

      // Three users start typing
      await typingService.setTyping(conversationId, userAId, true);
      await typingService.setTyping(conversationId, userBId, true);
      await typingService.setTyping(conversationId, userCId, true);

      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify all three users are typing
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(Object.keys(latestState).length).toBe(3);
      expect(latestState[userAId]?.isTyping).toBe(true);
      expect(latestState[userBId]?.isTyping).toBe(true);
      expect(latestState[userCId]?.isTyping).toBe(true);

      unsubscribe();
    });
  });

  describe('Edge Cases', () => {
    it('Does not show own typing indicator', async () => {
      const receivedTypingStates: any[] = [];

      // User A subscribes (should not see own typing state)
      const unsubscribe = typingService.subscribeToTyping(conversationId, userAId, (typing) => {
        receivedTypingStates.push(typing);
      });

      // User A starts typing
      await typingService.setTyping(conversationId, userAId, true);
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Verify own typing state is filtered out
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(latestState[userAId]).toBeUndefined();

      unsubscribe();
    });

    it('Handles subscription to conversation with no typing activity', async () => {
      const receivedTypingStates: any[] = [];

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        receivedTypingStates.push(typing);
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should receive initial empty state
      expect(receivedTypingStates.length).toBeGreaterThan(0);
      const latestState = receivedTypingStates[receivedTypingStates.length - 1];
      expect(Object.keys(latestState).length).toBe(0);

      unsubscribe();
    });

    it('Handles cleanup of non-existent typing state gracefully', async () => {
      // Should not throw error
      await expect(
        typingService.cleanup('non-existent-conv', 'non-existent-user')
      ).resolves.not.toThrow();
    });
  });

  describe('Performance', () => {
    it('Typing indicator latency is < 500ms', async () => {
      let typingDetectedAt: number | null = null;

      const unsubscribe = typingService.subscribeToTyping(conversationId, userBId, (typing) => {
        if (typing[userAId]?.isTyping && !typingDetectedAt) {
          typingDetectedAt = Date.now();
        }
      });

      const typingStartedAt = Date.now();
      await typingService.setTyping(conversationId, userAId, true);

      // Wait for typing to be detected
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Calculate latency
      const latency = typingDetectedAt ? typingDetectedAt - typingStartedAt : Infinity;

      // Latency should be < 500ms (including debounce)
      expect(latency).toBeLessThan(500);

      unsubscribe();
    });
  });
});
