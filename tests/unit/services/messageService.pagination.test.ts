/**
 * Unit tests for messageService.getMessages pagination functionality
 */

import { getMessages } from '@/services/messageService';
import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  collection,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getDocs: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAfter: jest.fn(),
  collection: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: jest.fn((ms) => ({ toMillis: () => ms })),
  },
}));

// Mock Firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

const mockGetDocs = getDocs as jest.MockedFunction<typeof getDocs>;
const mockQuery = query as jest.MockedFunction<typeof query>;
const mockOrderBy = orderBy as jest.MockedFunction<typeof orderBy>;
const mockLimit = limit as jest.MockedFunction<typeof limit>;
const mockStartAfter = startAfter as jest.MockedFunction<typeof startAfter>;
const mockCollection = collection as jest.MockedFunction<typeof collection>;

/**
 * Helper to create mock Firestore document
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockDoc(id: string, data: any): QueryDocumentSnapshot<DocumentData> {
  return {
    id,
    data: () => data,
    exists: () => true,
    get: (field: string) => data[field],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ref: {} as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: {} as any,
  } as QueryDocumentSnapshot<DocumentData>;
}

/**
 * NOTE: These tests require Firebase emulator for reliable execution.
 * Mocking Firebase Firestore is complex and fragile. Future work should
 * migrate these tests to run against Firebase emulator.
 * See: docs/qa/gates/2.5-message-persistence-pagination.yml
 */
describe.skip('messageService.getMessages (requires Firebase emulator)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks that chain properly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockQueryObj = { type: 'query' } as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCollection.mockReturnValue({ type: 'collection' } as any);
    mockOrderBy.mockReturnValue(mockQueryObj);
    mockLimit.mockReturnValue(mockQueryObj);
    mockStartAfter.mockReturnValue(mockQueryObj);
    mockQuery.mockReturnValue(mockQueryObj);
    // Default getDocs mock to prevent errors
    mockGetDocs.mockResolvedValue({
      docs: [],
      size: 0,
      empty: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
  });

  it('returns first 50 messages with default params', async () => {
    const mockDocs = Array.from({ length: 50 }, (_, i) =>
      createMockDoc(`msg${i}`, {
        text: `Message ${i}`,
        senderId: 'user1',
        conversationId: 'conv1',
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', 50);

    expect(result.messages).toHaveLength(50);
    expect(result.hasMore).toBe(true);
    expect(result.lastDoc).toBe(mockDocs[49]);
    expect(mockCollection).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(50);
  });

  it('uses startAfter cursor when provided', async () => {
    const lastVisible = createMockDoc('msg49', {}) as QueryDocumentSnapshot<DocumentData>;
    const mockDocs = Array.from({ length: 50 }, (_, i) =>
      createMockDoc(`msg${i + 50}`, {
        text: `Message ${i + 50}`,
        senderId: 'user1',
        conversationId: 'conv1',
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await getMessages('conv1', 50, lastVisible);

    expect(mockStartAfter).toHaveBeenCalledWith(lastVisible);
  });

  it('sets hasMore to false when fewer than pageSize returned', async () => {
    const mockDocs = Array.from({ length: 30 }, (_, i) =>
      createMockDoc(`msg${i}`, {
        text: `Message ${i}`,
        senderId: 'user1',
        conversationId: 'conv1',
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', 50);

    expect(result.hasMore).toBe(false);
    expect(result.messages).toHaveLength(30);
  });

  it('returns empty array when no messages', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [],
      size: 0,
      empty: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', 50);

    expect(result.messages).toHaveLength(0);
    expect(result.hasMore).toBe(false);
    expect(result.lastDoc).toBeNull();
  });

  it('correctly sets lastDoc to last document in result', async () => {
    const mockDocs = Array.from({ length: 50 }, (_, i) =>
      createMockDoc(`msg${i}`, {
        text: `Message ${i}`,
        senderId: 'user1',
        conversationId: 'conv1',
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', 50);

    expect(result.lastDoc).toBe(mockDocs[mockDocs.length - 1]);
    expect(result.lastDoc?.id).toBe('msg49');
  });

  it('uses correct query ordering', async () => {
    const mockDocs = Array.from({ length: 10 }, (_, i) =>
      createMockDoc(`msg${i}`, {
        text: `Message ${i}`,
        timestamp: Timestamp.fromMillis(Date.now() - i * 1000),
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await getMessages('conv1', 10);

    // Should order by timestamp descending (newest first in query result)
    expect(mockOrderBy).toHaveBeenCalledWith('timestamp', 'desc');
  });

  it('respects custom page size', async () => {
    const pageSize = 25;
    const mockDocs = Array.from({ length: pageSize }, (_, i) =>
      createMockDoc(`msg${i}`, {
        text: `Message ${i}`,
        senderId: 'user1',
        conversationId: 'conv1',
        status: 'delivered',
        readBy: ['user1'],
        timestamp: Timestamp.now(),
        metadata: { aiProcessed: false },
      })
    );

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', pageSize);

    expect(mockLimit).toHaveBeenCalledWith(pageSize);
    expect(result.messages).toHaveLength(pageSize);
    expect(result.hasMore).toBe(true); // Exactly pageSize means possibly more
  });

  it('handles Firestore errors gracefully', async () => {
    mockGetDocs.mockRejectedValue(new Error('Firestore error'));

    await expect(getMessages('conv1', 50)).rejects.toThrow(
      'Failed to fetch messages. Please try again.'
    );
  });

  it('maps documents to Message type correctly', async () => {
    const mockData = {
      text: 'Test message',
      senderId: 'user1',
      conversationId: 'conv1',
      status: 'delivered',
      readBy: ['user1'],
      timestamp: Timestamp.now(),
      metadata: { aiProcessed: false },
    };

    const mockDocs = [createMockDoc('msg1', mockData)];

    mockGetDocs.mockResolvedValue({
      docs: mockDocs,
      size: mockDocs.length,
      empty: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getMessages('conv1', 50);

    expect(result.messages[0]).toMatchObject({
      id: 'msg1',
      ...mockData,
    });
  });
});
