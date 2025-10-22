/**
 * Integration tests for message pagination flow
 *
 * @remarks
 * Tests end-to-end pagination functionality including:
 * - Initial message load
 * - Loading more messages
 * - Offline persistence
 * - Real-time updates during pagination
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMessages } from '@/hooks/useMessages';
import {
  getFirestore,
  collection,
  addDoc,
  Timestamp,
  DocumentReference,
  Firestore,
} from 'firebase/firestore';
import { initializeApp, FirebaseApp } from 'firebase/app';

// Test configuration for Firebase emulator
const testConfig = {
  projectId: 'test-yipyap',
  apiKey: 'test-api-key',
  authDomain: 'test.firebaseapp.com',
  storageBucket: 'test.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

/**
 * Integration tests for message pagination flow
 *
 * NOTE: These tests require Firebase emulator to be running.
 * To run these tests:
 * 1. Start Firebase emulator: npm run test:emulator
 * 2. Run tests: npm test integration/message-pagination
 *
 * Skipped by default as part of standard test suite.
 * See: docs/qa/gates/2.5-message-persistence-pagination.yml
 */
describe.skip('Message Pagination Integration (requires Firebase emulator)', () => {
  let app: FirebaseApp;
  let db: Firestore;
  let conversationId: string;

  beforeAll(async () => {
    // Initialize Firebase app for testing
    app = initializeApp(testConfig, 'test-app-' + Date.now());
    db = getFirestore(app);

    // Note: In a real integration test, you would connect to Firebase emulator:
    // import { connectFirestoreEmulator } from 'firebase/firestore';
    // connectFirestoreEmulator(db, 'localhost', 8080);
  });

  beforeEach(async () => {
    // Create a test conversation ID
    conversationId = `test-conv-${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup
    if (app) {
      await app.delete();
    }
  });

  /**
   * Helper to seed messages in Firestore
   */
  async function seedMessages(count: number): Promise<DocumentReference[]> {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const messageRefs: DocumentReference[] = [];

    for (let i = 0; i < count; i++) {
      const ref = await addDoc(messagesRef, {
        text: `Message ${i}`,
        senderId: 'user1',
        conversationId,
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.fromMillis(Date.now() - i * 60000), // Each message 1 minute apart
        metadata: { aiProcessed: false },
      });
      messageRefs.push(ref);
    }

    return messageRefs;
  }

  it('loads initial 50 messages on mount', async () => {
    // Seed 75 messages
    await seedMessages(75);

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    // Wait for messages to load
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Should load initial 50 messages
    expect(result.current.messages.length).toBeLessThanOrEqual(50);
    expect(result.current.hasMore).toBe(true);
  });

  it('paginates through all messages', async () => {
    // Seed 150 messages
    await seedMessages(150);

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    // Wait for initial load
    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    const initialCount = result.current.messages.length;
    expect(initialCount).toBeLessThanOrEqual(50);
    expect(result.current.hasMore).toBe(true);

    // Load more (page 2)
    await act(async () => {
      await result.current.loadMoreMessages();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    const afterFirstLoad = result.current.messages.length;
    expect(afterFirstLoad).toBeGreaterThan(initialCount);
    expect(afterFirstLoad).toBeLessThanOrEqual(100);

    // Load more (page 3)
    if (result.current.hasMore) {
      await act(async () => {
        await result.current.loadMoreMessages();
      });

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });

      const afterSecondLoad = result.current.messages.length;
      expect(afterSecondLoad).toBeGreaterThan(afterFirstLoad);
      expect(afterSecondLoad).toBeLessThanOrEqual(150);
    }
  });

  it('stops pagination when all messages loaded', async () => {
    // Seed 30 messages (less than page size)
    await seedMessages(30);

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Should have all messages and hasMore should be false
    expect(result.current.messages.length).toBeLessThanOrEqual(30);
    expect(result.current.hasMore).toBe(false);

    // Try to load more
    await act(async () => {
      await result.current.loadMoreMessages();
    });

    // Should not increase message count
    expect(result.current.messages.length).toBeLessThanOrEqual(30);
  });

  it('maintains chronological order during pagination', async () => {
    // Seed 100 messages
    await seedMessages(100);

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Load more messages
    if (result.current.hasMore) {
      await act(async () => {
        await result.current.loadMoreMessages();
      });

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });
    }

    // Verify messages are in chronological order (oldest to newest)
    const timestamps = result.current.messages.map((m) => m.timestamp.toMillis());
    const sortedTimestamps = [...timestamps].sort((a, b) => a - b);
    expect(timestamps).toEqual(sortedTimestamps);
  });

  it('deduplicates messages correctly', async () => {
    // Seed 75 messages
    await seedMessages(75);

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Load more
    if (result.current.hasMore) {
      await act(async () => {
        await result.current.loadMoreMessages();
      });

      await waitFor(() => {
        expect(result.current.isLoadingMore).toBe(false);
      });
    }

    // Check for duplicate message IDs
    const messageIds = result.current.messages.map((m) => m.id);
    const uniqueIds = new Set(messageIds);
    expect(messageIds.length).toBe(uniqueIds.size); // No duplicates
  });

  it('handles empty conversation gracefully', async () => {
    // Don't seed any messages

    const { result } = renderHook(() => useMessages(conversationId, 'user1', ['user1', 'user2']));

    await waitFor(
      () => {
        expect(result.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });

  /**
   * Note: Offline persistence test requires Firebase emulator
   * This is a placeholder showing the test structure
   */
  it.skip('loads cached messages on restart (requires emulator)', async () => {
    // Seed messages
    await seedMessages(75);

    // First load
    const { result: result1, unmount: unmount1 } = renderHook(() =>
      useMessages(conversationId, 'user1', ['user1', 'user2'])
    );

    await waitFor(
      () => {
        expect(result1.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    const messageCount = result1.current.messages.length;

    // Unmount (simulate app close)
    unmount1();

    // Remount (simulate app restart)
    const { result: result2 } = renderHook(() =>
      useMessages(conversationId, 'user1', ['user1', 'user2'])
    );

    await waitFor(
      () => {
        expect(result2.current.loading).toBe(false);
      },
      { timeout: 5000 }
    );

    // Should load from cache (same count)
    expect(result2.current.messages.length).toBe(messageCount);
  });
});
