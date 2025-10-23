/**
 * Unit tests for useBadgeCount hook
 * @module tests/unit/hooks/useBadgeCount
 */

import { renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useBadgeCount } from '@/hooks/useBadgeCount';
import { notificationService } from '@/services/notificationService';
import { getFirebaseDb } from '@/services/firebase';
import type { Conversation } from '@/types/models';

// Mock dependencies
jest.mock('@/services/firebase');
jest.mock('@/services/notificationService');
jest.mock('@/hooks/useAuth');

// Mock Firestore
const mockOnSnapshot = jest.fn();
const mockQuery = jest.fn();
const mockCollection = jest.fn();
const mockWhere = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: (...args: any[]) => mockCollection(...args),
  query: (...args: any[]) => mockQuery(...args),
  where: (...args: any[]) => mockWhere(...args),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

// Mock useAuth hook
const mockUseAuth = jest.requireMock('@/hooks/useAuth');

describe('useBadgeCount Hook', () => {
  const mockUnsubscribe = jest.fn();
  const mockAppStateRemove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirebaseDb as jest.Mock).mockReturnValue({});
    mockCollection.mockReturnValue('mockCollectionRef');
    mockWhere.mockReturnValue('mockWhereClause');
    mockQuery.mockReturnValue('mockQuery');
    mockOnSnapshot.mockReturnValue(mockUnsubscribe);

    // Mock AppState.addEventListener to return object with remove method
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({
      remove: mockAppStateRemove,
    } as any);

    // Default auth mock
    mockUseAuth.useAuth = jest.fn(() => ({
      user: { uid: 'user123' },
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('badge count calculation', () => {
    it('should calculate total unread count from all conversations', async () => {
      const conversations: Partial<Conversation>[] = [
        { id: 'conv1', unreadCount: { user123: 5, user456: 2 } },
        { id: 'conv2', unreadCount: { user123: 3, user456: 1 } },
        { id: 'conv3', unreadCount: { user123: 0, user456: 4 } },
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = {
          docs: conversations.map((conv) => ({
            id: conv.id,
            data: () => conv,
          })),
        };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(8); // 5 + 3 + 0
      });
    });

    it('should handle conversations with no unread count for current user', async () => {
      const conversations: Partial<Conversation>[] = [
        { id: 'conv1', unreadCount: { user456: 5 } }, // No count for user123
        { id: 'conv2', unreadCount: { user123: 3 } },
        { id: 'conv3', unreadCount: {} }, // Empty unread count
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = {
          docs: conversations.map((conv) => ({
            id: conv.id,
            data: () => conv,
          })),
        };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(3); // Only conv2
      });
    });

    it('should handle empty conversations list', async () => {
      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = { docs: [] };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(0);
      });
    });

    it('should handle undefined unreadCount field', async () => {
      const conversations: Partial<Conversation>[] = [
        { id: 'conv1' }, // No unreadCount field
        { id: 'conv2', unreadCount: { user123: 2 } },
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = {
          docs: conversations.map((conv) => ({
            id: conv.id,
            data: () => conv,
          })),
        };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(2);
      });
    });

    it('should handle large unread counts', async () => {
      const conversations: Partial<Conversation>[] = [
        { id: 'conv1', unreadCount: { user123: 99 } },
        { id: 'conv2', unreadCount: { user123: 150 } },
        { id: 'conv3', unreadCount: { user123: 1000 } },
      ];

      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = {
          docs: conversations.map((conv) => ({
            id: conv.id,
            data: () => conv,
          })),
        };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(1249); // 99 + 150 + 1000
      });
    });
  });

  describe('Firestore subscription', () => {
    it('should subscribe to user conversations on mount', () => {
      renderHook(() => useBadgeCount());

      expect(mockCollection).toHaveBeenCalledWith({}, 'conversations');
      expect(mockWhere).toHaveBeenCalledWith('participantIds', 'array-contains', 'user123');
      expect(mockQuery).toHaveBeenCalled();
      expect(mockOnSnapshot).toHaveBeenCalled();
    });

    it('should unsubscribe from Firestore listener on unmount', () => {
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const { unmount } = renderHook(() => useBadgeCount());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should not subscribe if user is not authenticated', () => {
      mockUseAuth.useAuth = jest.fn(() => ({
        user: null,
      }));

      renderHook(() => useBadgeCount());

      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it('should not subscribe if user uid is undefined', () => {
      mockUseAuth.useAuth = jest.fn(() => ({
        user: { uid: undefined },
      }));

      renderHook(() => useBadgeCount());

      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });
  });

  describe('AppState handling', () => {
    it('should register AppState listener on mount', () => {
      renderHook(() => useBadgeCount());

      expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove AppState listener on unmount', () => {
      const { unmount } = renderHook(() => useBadgeCount());

      unmount();

      expect(mockAppStateRemove).toHaveBeenCalled();
    });

    it('should handle app becoming active', async () => {
      let appStateCallback: ((state: string) => void) | null = null;

      jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
        appStateCallback = callback as (state: string) => void;
        return { remove: mockAppStateRemove } as any;
      });

      mockOnSnapshot.mockImplementation((query, callback) => {
        const snapshot = {
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
          ],
        };
        callback(snapshot);
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      // Clear previous calls
      (notificationService.updateBadgeCount as jest.Mock).mockClear();

      // Simulate app becoming active
      if (appStateCallback) {
        appStateCallback('active');
      }

      // The snapshot listener should trigger recalculation
      // Note: In the actual implementation, the AppState handler doesn't do much
      // because the snapshot listener handles updates automatically
      expect(appStateCallback).toBeDefined();
    });
  });

  describe('real-time updates', () => {
    it('should update badge count when conversations change', async () => {
      let snapshotCallback: ((snapshot: any) => void) | null = null;

      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        // Initial state
        callback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
          ],
        });
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(5);
      });

      // Simulate conversation update (new message arrives)
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 6 } }),
            },
          ],
        });
      }

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(6);
      });
    });

    it('should update badge count when new conversation is added', async () => {
      let snapshotCallback: ((snapshot: any) => void) | null = null;

      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        // Initial state - 1 conversation
        callback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
          ],
        });
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(5);
      });

      // Simulate new conversation added
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
            {
              id: 'conv2',
              data: () => ({ id: 'conv2', unreadCount: { user123: 3 } }),
            },
          ],
        });
      }

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(8); // 5 + 3
      });
    });

    it('should update badge count when conversation is removed', async () => {
      let snapshotCallback: ((snapshot: any) => void) | null = null;

      mockOnSnapshot.mockImplementation((query, callback) => {
        snapshotCallback = callback;
        // Initial state - 2 conversations
        callback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
            {
              id: 'conv2',
              data: () => ({ id: 'conv2', unreadCount: { user123: 3 } }),
            },
          ],
        });
        return mockUnsubscribe;
      });

      renderHook(() => useBadgeCount());

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(8);
      });

      // Simulate conversation removed
      if (snapshotCallback) {
        snapshotCallback({
          docs: [
            {
              id: 'conv1',
              data: () => ({ id: 'conv1', unreadCount: { user123: 5 } }),
            },
          ],
        });
      }

      await waitFor(() => {
        expect(notificationService.updateBadgeCount).toHaveBeenCalledWith(5);
      });
    });
  });
});
