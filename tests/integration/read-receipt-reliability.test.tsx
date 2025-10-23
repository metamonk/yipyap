/**
 * Integration tests for read receipt reliability improvements
 * Tests retry logic, batch updates, network recovery, and UI feedback
 */

import { render, waitFor, act, renderHook } from '@testing-library/react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  markMessagesAsReadBatch,
  getBatchUpdateMetrics,
  getBatchUpdateSuccessRate,
} from '@/services/messageService';
import { RetryQueue } from '@/services/retryQueueService';
import { IdempotencyCache } from '@/utils/idempotencyHelpers';
import { PerformanceMonitor } from '@/utils/performanceMonitor';
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor';
import { MessageItem } from '@/components/chat/MessageItem';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  connectFirestoreEmulator,
  writeBatch,
  runTransaction,
  Timestamp,
} from 'firebase/firestore';

// Mock Firebase
jest.mock('firebase/app');
jest.mock('firebase/firestore');

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Use real timers for integration tests
jest.useRealTimers();

describe('Read Receipt Reliability Integration', () => {
   
  let db: any;
  let retryQueue: RetryQueue;
  let idempotencyCache: IdempotencyCache;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(() => {
    // Initialize Firebase with test project
    const app = initializeApp({
      projectId: 'test-project',
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
    });

    db = getFirestore(app);

    // Connect to Firestore emulator
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  });

  beforeEach(async () => {
    // Reset all singletons
    // @ts-expect-error - Testing requires resetting singleton instances
    RetryQueue.instance = undefined;
    // @ts-expect-error - Testing requires resetting singleton instances
    IdempotencyCache.instance = undefined;
    // @ts-expect-error - Testing requires resetting singleton instances
    PerformanceMonitor.instance = undefined;

    retryQueue = RetryQueue.getInstance();
    idempotencyCache = IdempotencyCache.getInstance();
    performanceMonitor = PerformanceMonitor.getInstance();

    // Clear any persisted data
    await AsyncStorage.clear();
    await retryQueue.clear();
    idempotencyCache.clear();
    performanceMonitor.clear();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default network state as online
    (NetInfo.fetch as jest.Mock).mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {},
    });
  });

  afterEach(() => {
    retryQueue.destroy();
    idempotencyCache.destroy();
    performanceMonitor.destroy();
  });

  describe('Read Receipts Retry on Network Failure', () => {
    it('should retry batch updates when network fails', async () => {
      const conversationId = 'conv_test_1';
      const messageIds = ['msg1', 'msg2', 'msg3'];
      const userId = 'user123';

      // Mock initial network failure
      const mockWriteBatch = jest.fn().mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockRejectedValueOnce(new Error('Network unavailable')),
      }));
      (writeBatch as jest.Mock).mockImplementation(mockWriteBatch);

      // Attempt batch update - should fail and queue
      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Verify operation was queued
      expect(retryQueue.getQueueSize()).toBe(1);
      const queueItems = retryQueue.getQueueItems();
      expect(queueItems[0].operationType).toBe('READ_RECEIPT_BATCH');
      expect(queueItems[0].data.messageIds).toEqual(messageIds);

      // Mock successful retry
      mockWriteBatch.mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      // Wait for retry (simulating time passage)
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for first backoff

      // Process queue
      await retryQueue.processQueue();

      // Verify queue is now empty (success)
      expect(retryQueue.getQueueSize()).toBe(0);

      // Verify metrics were recorded
      const metrics = performanceMonitor.getAggregatedMetrics();
      expect(metrics.totalOperations).toBeGreaterThanOrEqual(1);
      expect(metrics.retryPatterns.retriedOnce).toBeGreaterThanOrEqual(1);
    });

    it('should handle network recovery and process queued updates', async () => {
      const conversationId = 'conv_test_2';
      const messageIds = ['msg4', 'msg5'];
      const userId = 'user456';

      // Simulate offline state
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
        type: 'none',
        details: {},
      });

      // Mock network failure
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error('Network unavailable')),
      }));

      // Attempt update while offline
      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Verify queued
      expect(retryQueue.getQueueSize()).toBe(1);

      // Simulate network recovery
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: {},
      });

      // Mock successful batch
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      // Trigger network state change handler
      const networkCallbacks = (NetInfo.addEventListener as jest.Mock).mock.calls;
      if (networkCallbacks.length > 0) {
        const callback = networkCallbacks[0][0];
        await callback({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
        });
      }

      // Wait for debounced reconnection processing
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Process queue
      await retryQueue.processQueue();

      // Verify queue processed
      expect(retryQueue.getQueueSize()).toBe(0);
    });
  });

  describe('Batch Updates Fall Back to Individual Updates', () => {
    it('should fall back to individual updates after persistent batch failures', async () => {
      const conversationId = 'conv_test_3';
      const messageIds = ['msg6', 'msg7', 'msg8'];
      const userId = 'user789';

      // Mock persistent batch failures
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error('Batch operation failed')),
      }));

      // Mock transaction failures
      (runTransaction as jest.Mock).mockRejectedValue(new Error('Transaction failed'));

      // Mock successful individual updates
      const mockUpdateDoc = jest.fn().mockResolvedValue(undefined);
      const mockDoc = jest.fn((db, ...path) => ({ path: path.join('/') }));

      // Import and mock updateDoc
      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        updateDoc: mockUpdateDoc,
        doc: mockDoc,
      }));

      // Enqueue the operation
      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Process retries to trigger fallback
      for (let i = 0; i < 4; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        await retryQueue.processQueue();
      }

      // Verify individual updates were called
      expect(mockUpdateDoc).toHaveBeenCalledTimes(messageIds.length + 1); // +1 for conversation update

      // Verify metrics show fallback was used
      const metrics = performanceMonitor.getAggregatedMetrics();
      expect(metrics.fallbackCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('No Duplicate Updates Processed', () => {
    it('should prevent duplicate read receipt updates', async () => {
      const conversationId = 'conv_test_4';
      const messageIds = ['msg9', 'msg10'];
      const userId = 'user111';

      let updateCount = 0;
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(() => updateCount++),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      // Send same update multiple times rapidly
      await Promise.all([
        markMessagesAsReadBatch(conversationId, messageIds, userId),
        markMessagesAsReadBatch(conversationId, messageIds, userId),
        markMessagesAsReadBatch(conversationId, messageIds, userId),
      ]);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should only process once (idempotency)
      expect(updateCount).toBeLessThanOrEqual(messageIds.length + 1); // Messages + conversation

      // Verify idempotency cache has the operation
      const operationData = {
        conversationId,
        messageIds,
        userId,
      };
      const operationId = idempotencyCache.generateOperationId(operationData);
      expect(idempotencyCache.hasProcessed(operationId)).toBe(true);
    });

    it('should allow different updates to process independently', async () => {
      let batch1Count = 0;
      let batch2Count = 0;

      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn((ref) => {
          if (ref.path?.includes('msg11') || ref.path?.includes('msg12')) {
            batch1Count++;
          } else if (ref.path?.includes('msg13') || ref.path?.includes('msg14')) {
            batch2Count++;
          }
        }),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      // Send different updates
      await Promise.all([
        markMessagesAsReadBatch('conv1', ['msg11', 'msg12'], 'user1'),
        markMessagesAsReadBatch('conv2', ['msg13', 'msg14'], 'user2'),
      ]);

      // Both should process
      expect(batch1Count).toBeGreaterThan(0);
      expect(batch2Count).toBeGreaterThan(0);
    });
  });

  describe('UI Shows Retry Indication', () => {
    it('should display syncing indicator during retry', () => {
      const message = {
        id: 'msg_ui_1',
        conversationId: 'conv_ui',
        senderId: 'sender1',
        text: 'Test message',
        status: 'delivered' as const,
        readBy: [],
        timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as Timestamp,
        metadata: { aiProcessed: false },
      };

      const { getByText, queryByText, rerender } = render(
        <MessageItem
          message={message}
          isOwnMessage={false}
          senderDisplayName="Test User"
          senderPhotoURL={null}
          isRetrying={false}
        />
      );

      // Initially no syncing indicator
      expect(queryByText('• syncing')).toBeNull();

      // Re-render with retrying state
      rerender(
        <MessageItem
          message={message}
          isOwnMessage={false}
          senderDisplayName="Test User"
          senderPhotoURL={null}
          isRetrying={true}
        />
      );

      // Should show syncing indicator
      expect(getByText('• syncing')).toBeTruthy();

      // Re-render with retry complete
      rerender(
        <MessageItem
          message={message}
          isOwnMessage={false}
          senderDisplayName="Test User"
          senderPhotoURL={null}
          isRetrying={false}
        />
      );

      // Syncing indicator should be gone
      expect(queryByText('• syncing')).toBeNull();
    });

    it('should apply opacity animation during retry', async () => {
      const message = {
        id: 'msg_ui_2',
        conversationId: 'conv_ui',
        senderId: 'sender2',
        text: 'Another test',
        status: 'delivered' as const,
        readBy: [],
        timestamp: { seconds: Date.now() / 1000, nanoseconds: 0 } as unknown as Timestamp,
        metadata: { aiProcessed: false },
      };

      const { getByTestId } = render(
        <MessageItem
          message={message}
          isOwnMessage={true}
          senderDisplayName="Me"
          senderPhotoURL={null}
          isRetrying={true}
        />
      );

      const container = getByTestId('message-container');

      // Should have opacity style applied
      expect(container.props.style).toBeDefined();
      // Animated.View will have opacity in its style
      const styles = Array.isArray(container.props.style)
        ? container.props.style
        : [container.props.style];
      const hasOpacity = styles.some((style: unknown) =>
        style && typeof style === 'object' && 'opacity' in style
      );
      expect(hasOpacity).toBe(true);
    });
  });

  describe('Transactions Ensure Consistency', () => {
    it('should use transactions for atomic updates', async () => {
      const conversationId = 'conv_test_5';
      const messageIds = ['msg15', 'msg16', 'msg17'];
      const userId = 'user222';

      let transactionUsed = false;
      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        transactionUsed = true;

        // Simulate transaction
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: () => true }),
          update: jest.fn(),
        };

        await callback(transaction);
        return Promise.resolve();
      });

      // Use successful writeBatch as fallback
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify transaction was attempted
      expect(transactionUsed).toBe(true);
    });

    it('should handle partial document existence in transactions', async () => {
      const conversationId = 'conv_test_6';
      const messageIds = ['msg18', 'msg19_missing', 'msg20'];
      const userId = 'user333';

      const existingDocs = new Set(['msg18', 'msg20']);
      let skippedCount = 0;

      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
           
          get: jest.fn().mockImplementation((ref: any) => ({
            exists: () => {
              const id = ref.path?.split('/').pop();
              return existingDocs.has(id || '');
            },
          })),
           
          update: jest.fn().mockImplementation((ref: any) => {
            const id = ref.path?.split('/').pop();
            if (!existingDocs.has(id || '')) {
              skippedCount++;
            }
          }),
        };

        await callback(transaction);
        return Promise.resolve();
      });

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Should skip non-existent document
      expect(skippedCount).toBe(0); // Transaction only updates existing docs
    });
  });

  describe('Performance Monitoring', () => {
    it('should track batch update success rates', async () => {
      // Successful batch
      (writeBatch as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      }));

      await markMessagesAsReadBatch('conv1', ['msg21'], 'user1');

      // Failed batch
      (writeBatch as jest.Mock).mockImplementationOnce(() => ({
        update: jest.fn(),
        commit: jest.fn().mockRejectedValue(new Error('Failed')),
      }));

      await markMessagesAsReadBatch('conv2', ['msg22'], 'user2');

      // Check success rate
      const successRate = getBatchUpdateSuccessRate();
      expect(successRate).toBe(50); // 1 success, 1 failure = 50%

      // Check detailed metrics
      const metrics = getBatchUpdateMetrics();
      expect(metrics.length).toBeGreaterThanOrEqual(2);
      expect(metrics.filter(m => m.success).length).toBeGreaterThanOrEqual(1);
      expect(metrics.filter(m => !m.success).length).toBeGreaterThanOrEqual(1);
    });

    it('should track retry frequencies and patterns', async () => {
      // Mock failures then success
      let attemptCount = 0;
      (writeBatch as jest.Mock).mockImplementation(() => ({
        update: jest.fn(),
        commit: jest.fn().mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('Temporary failure'));
          }
          return Promise.resolve();
        }),
      }));

      await markMessagesAsReadBatch('conv3', ['msg23'], 'user3');

      // Process retries
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        await retryQueue.processQueue();
      }

      const metrics = performanceMonitor.getAggregatedMetrics();
      expect(metrics.averageRetryCount).toBeGreaterThan(0);
      expect(metrics.retryPatterns.retriedMultiple).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Prerequisite Check (Bug #2 fix - Race Condition Prevention)', () => {
    it('should filter out non-existent messages before batch update', async () => {
      const conversationId = 'conv_test_prerequisite_1';
      const messageIds = ['msg_exists', 'msg_not_yet_propagated', 'msg_exists_2'];
      const userId = 'user_prereq_1';

      // Mock getDoc to return existence status
      const mockGetDoc = jest.fn().mockImplementation((docRef) => {
        const path = docRef.path || '';
        if (path.includes('msg_exists') || path.includes('msg_exists_2')) {
          return Promise.resolve({ exists: () => true });
        }
        return Promise.resolve({ exists: () => false });
      });

      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        getDoc: mockGetDoc,
      }));

      let transactionCalls = 0;
      (runTransaction as jest.Mock).mockImplementation(async (db, callback) => {
        const transaction = {
          get: jest.fn().mockResolvedValue({ exists: () => true }),
          update: jest.fn(() => transactionCalls++),
        };
        await callback(transaction);
        return Promise.resolve();
      });

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Should only update the 2 existing messages (not the non-existent one)
      // +1 for conversation update
      expect(transactionCalls).toBeGreaterThanOrEqual(2);
      expect(transactionCalls).toBeLessThan(messageIds.length + 1);
    });

    it('should skip batch update when no messages exist', async () => {
      const conversationId = 'conv_test_prerequisite_2';
      const messageIds = ['msg_nonexistent_1', 'msg_nonexistent_2'];
      const userId = 'user_prereq_2';

      // Mock all messages as non-existent
      const mockGetDoc = jest.fn().mockResolvedValue({ exists: () => false });

      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        getDoc: mockGetDoc,
      }));

      const transactionCalled = jest.fn();
      (runTransaction as jest.Mock).mockImplementation(async () => {
        transactionCalled();
        return Promise.resolve();
      });

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Transaction should NOT be called when no messages exist
      expect(transactionCalled).not.toHaveBeenCalled();
    });

    it('should log warning when messages not found yet', async () => {
      const conversationId = 'conv_test_prerequisite_3';
      const messageIds = ['msg1', 'msg2_missing', 'msg3'];
      const userId = 'user_prereq_3';

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Mock partial existence
      const mockGetDoc = jest.fn().mockImplementation((docRef) => {
        const path = docRef.path || '';
        return Promise.resolve({
          exists: () => !path.includes('_missing'),
        });
      });

      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        getDoc: mockGetDoc,
      }));

      (runTransaction as jest.Mock).mockResolvedValue(undefined);

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Should log warning about missing messages
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('messages not found yet')
      );

      consoleSpy.mockRestore();
    });

    it('should NOT retry permission errors', async () => {
      const conversationId = 'conv_test_prerequisite_4';
      const messageIds = ['msg1'];
      const userId = 'user_prereq_4';

      // Mock messages exist
      const mockGetDoc = jest.fn().mockResolvedValue({ exists: () => true });

      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        getDoc: mockGetDoc,
      }));

      // Mock permission error
      const permissionError = new Error('Permission denied');
      // @ts-expect-error - Adding code property for FirestoreError simulation
      permissionError.code = 'permission-denied';
      (runTransaction as jest.Mock).mockRejectedValue(permissionError);

      // Should throw and NOT queue for retry
      await expect(
        markMessagesAsReadBatch(conversationId, messageIds, userId)
      ).rejects.toThrow('Permission denied');

      // Verify NOT queued
      expect(retryQueue.getQueueSize()).toBe(0);
    });

    it('should queue network errors for retry (after prerequisite check)', async () => {
      const conversationId = 'conv_test_prerequisite_5';
      const messageIds = ['msg1', 'msg2'];
      const userId = 'user_prereq_5';

      // Mock messages exist (prerequisite passes)
      const mockGetDoc = jest.fn().mockResolvedValue({ exists: () => true });

      jest.doMock('firebase/firestore', () => ({
        ...jest.requireActual('firebase/firestore'),
        getDoc: mockGetDoc,
      }));

      // Mock network error
      const networkError = new Error('Network unavailable');
      // @ts-expect-error - Adding code property for FirestoreError simulation
      networkError.code = 'unavailable';
      (runTransaction as jest.Mock).mockRejectedValue(networkError);

      await markMessagesAsReadBatch(conversationId, messageIds, userId);

      // Should be queued for retry
      expect(retryQueue.getQueueSize()).toBe(1);
      const queueItems = retryQueue.getQueueItems();
      expect(queueItems[0].operationType).toBe('READ_RECEIPT_BATCH');
    });
  });

  describe('Network Monitor Hook Integration', () => {
    it('should trigger queue processing on network recovery', async () => {
      // Use renderHook to properly test the hook
      const { result } = renderHook(() =>
        useNetworkMonitor({
          autoProcessQueue: true,
          reconnectionDebounce: 100, // Short debounce for testing
        })
      );

      // Simulate offline
      await act(async () => {
        const callback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
        await callback({
          isConnected: false,
          isInternetReachable: false,
          type: 'none',
        });
      });

      // Add item to queue while offline
      await retryQueue.enqueue({
        operationType: 'READ_RECEIPT_BATCH',
        data: { messageIds: ['msg24'], userId: 'user4' },
      });

      expect(retryQueue.getQueueSize()).toBe(1);

      // Mock successful processing
      retryQueue.registerProcessor('READ_RECEIPT_BATCH', async () => true);

      // Simulate coming online
      await act(async () => {
        const callback = (NetInfo.addEventListener as jest.Mock).mock.calls[0][0];
        await callback({
          isConnected: true,
          isInternetReachable: true,
          type: 'wifi',
        });
      });

      // Wait for debounced processing
      await waitFor(() => {
        expect(result.current.isConnected).toBe(true);
      }, { timeout: 3000 });

      // Queue should be processed
      await waitFor(() => {
        expect(retryQueue.getQueueSize()).toBe(0);
      }, { timeout: 3000 });
    });
  });
});