/**
 * Unit tests for messageService
 * @remarks
 * Tests message sending, fetching with pagination, real-time subscriptions,
 * and error handling scenarios
 */

import { sendMessage, getMessages, subscribeToMessages } from '@/services/messageService';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  FirestoreError,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { updateConversationLastMessage, checkConversationExists } from '@/services/conversationService';
// Import the mock helper to access mock enqueue function
const retryQueueMock = require('@/services/retryQueueService');
mockEnqueue = retryQueueMock.__getMockEnqueue();

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('@/services/conversationService');

// Mock RetryQueue at module level - create functions that will be accessible from tests
let mockEnqueue: jest.Mock;

jest.mock('@/services/retryQueueService', () => {
  // Create the mock functions inside the factory
  const enqueueMock = jest.fn();
  const registerProcessorMock = jest.fn();
  const mockRetryQueue = {
    enqueue: enqueueMock,
    registerProcessor: registerProcessorMock,
    processQueue: jest.fn(),
    loadQueue: jest.fn(),
  };

  return {
    RetryQueue: {
      getInstance: jest.fn(() => mockRetryQueue),
    },
    // Export the mock enqueue so we can access it in tests
    __getMockEnqueue: () => enqueueMock,
  };
})

jest.mock('firebase/firestore', () => {
  // Define MockFirestoreError inside the factory to ensure it's available
  class MockFirestoreErrorClass extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'FirebaseError';
    }
  }

  return {
    collection: jest.fn(),
    addDoc: jest.fn(),
    query: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    startAfter: jest.fn(),
    getDocs: jest.fn(),
    onSnapshot: jest.fn(),
    updateDoc: jest.fn(),
    serverTimestamp: jest.fn(),
    Timestamp: {
      now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
    },
    arrayUnion: jest.fn((value) => ({ _methodName: 'arrayUnion', _elements: [value] })),
    FirestoreError: MockFirestoreErrorClass,
  };
});

describe('messageService', () => {
   
  const mockDb = {} as any;
  const mockConversationId = 'user123_user456';
  const mockSenderId = 'user123';
  const mockParticipantIds = ['user123', 'user456'];

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueue.mockClear();
    mockEnqueue.mockResolvedValue(undefined);
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
    // Mock checkConversationExists to return true by default (conversation exists)
    (checkConversationExists as jest.Mock).mockResolvedValue(true);
    // Mock updateDoc to resolve successfully
    (updateDoc as jest.Mock).mockResolvedValue(undefined);
  });

  describe('sendMessage', () => {
    it('should send a message with valid data', async () => {
      const mockMessageRef = { id: 'msg123' };
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello, world!',
        },
        mockParticipantIds
      );

      expect(result.id).toBe('msg123');
      expect(result.text).toBe('Hello, world!');
      expect(result.senderId).toBe(mockSenderId);
      expect(result.status).toBe('delivered'); // Status is updated to 'delivered' after creation
      expect(result.readBy).toEqual([mockSenderId]);
      expect(result.metadata.aiProcessed).toBe(false);
      expect(addDoc).toHaveBeenCalled();
      expect(updateConversationLastMessage).toHaveBeenCalled();
    });

    it('should trim message text', async () => {
      const mockMessageRef = { id: 'msg123' };
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: '  Hello, world!  ',
        },
        mockParticipantIds
      );

      const messageData = (addDoc as jest.Mock).mock.calls[0][1];
      expect(messageData.text).toBe('Hello, world!');
    });

    it('should initialize sender in readBy array', async () => {
      const mockMessageRef = { id: 'msg123' };
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello!',
        },
        mockParticipantIds
      );

      expect(result.readBy).toEqual([mockSenderId]);
    });

    it('should initialize metadata with aiProcessed: false', async () => {
      const mockMessageRef = { id: 'msg123' };
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello!',
        },
        mockParticipantIds
      );

      expect(result.metadata).toEqual({ aiProcessed: false });
    });

    it('should reject empty message text', async () => {
      await expect(
        sendMessage(
          {
            conversationId: mockConversationId,
            senderId: mockSenderId,
            text: '',
          },
          mockParticipantIds
        )
      ).rejects.toThrow('Message text cannot be empty');

      expect(addDoc).not.toHaveBeenCalled();
    });

    it('should reject message text with only whitespace', async () => {
      await expect(
        sendMessage(
          {
            conversationId: mockConversationId,
            senderId: mockSenderId,
            text: '   ',
          },
          mockParticipantIds
        )
      ).rejects.toThrow('Message text cannot be empty');
    });

    it('should reject message text exceeding 1000 characters', async () => {
      const longText = 'a'.repeat(1001);

      await expect(
        sendMessage(
          {
            conversationId: mockConversationId,
            senderId: mockSenderId,
            text: longText,
          },
          mockParticipantIds
        )
      ).rejects.toThrow('Message text cannot exceed 1000 characters');
    });

    it('should update conversation last message after sending', async () => {
      const mockMessageRef = { id: 'msg123' };
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello!',
        },
        mockParticipantIds
      );

      expect(updateConversationLastMessage).toHaveBeenCalledWith(
        mockConversationId,
        expect.objectContaining({
          text: 'Hello!',
          senderId: mockSenderId,
        }),
        mockParticipantIds,
        mockSenderId
      );
    });

    it('should handle Firestore errors gracefully', async () => {
      (addDoc as jest.Mock).mockRejectedValue({ code: 'unknown' });

      await expect(
        sendMessage(
          {
            conversationId: mockConversationId,
            senderId: mockSenderId,
            text: 'Hello!',
          },
          mockParticipantIds
        )
      ).rejects.toThrow('Failed to send message');
    });

    it('should create conversation atomically when draft mode and conversation does not exist', async () => {
      // Mock checkConversationExists to return false (conversation doesn't exist)
      (checkConversationExists as jest.Mock).mockResolvedValue(false);

      // Import and mock createConversationWithFirstMessage
      const { createConversationWithFirstMessage } = require('@/services/conversationService');
      const mockCreateConversation = createConversationWithFirstMessage as jest.Mock;
      mockCreateConversation.mockResolvedValue({
        conversationId: mockConversationId,
        messageId: 'msg123',
      });

      const draftParams = {
        type: 'direct' as const,
        groupName: undefined,
        groupPhotoURL: undefined,
      };

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello!',
        },
        mockParticipantIds,
        draftParams
      );

      // Verify createConversationWithFirstMessage was called
      expect(mockCreateConversation).toHaveBeenCalledWith({
        type: 'direct',
        participantIds: mockParticipantIds,
        messageText: 'Hello!',
        senderId: mockSenderId,
        groupName: undefined,
        groupPhotoURL: undefined,
      });

      // Verify the returned message
      expect(result.id).toBe('msg123');
      expect(result.conversationId).toBe(mockConversationId);
      expect(result.text).toBe('Hello!');
      expect(result.status).toBe('delivered');
      expect(result.senderId).toBe(mockSenderId);
    });

    it('should use existing conversation when draft mode but conversation already exists', async () => {
      // Mock checkConversationExists to return true (conversation exists)
      (checkConversationExists as jest.Mock).mockResolvedValue(true);

      // Mock normal message creation flow
      const mockMessageRef = { id: 'msg456' };
      (collection as jest.Mock).mockReturnValue('mock-collection');
      (addDoc as jest.Mock).mockResolvedValue(mockMessageRef);
      (updateConversationLastMessage as jest.Mock).mockResolvedValue(undefined);

      const draftParams = {
        type: 'direct' as const,
        groupName: undefined,
        groupPhotoURL: undefined,
      };

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello to existing conversation!',
        },
        mockParticipantIds,
        draftParams
      );

      // Verify normal message flow was used (not atomic creation)
      expect(addDoc).toHaveBeenCalled();
      expect(updateConversationLastMessage).toHaveBeenCalled();

      // Verify the returned message
      expect(result.id).toBe('msg456');
      expect(result.text).toBe('Hello to existing conversation!');
      expect(result.status).toBe('delivered');
    });

    it('should queue conversation creation for retry when network error occurs', async () => {
      // Mock checkConversationExists to return false (conversation doesn't exist)
      (checkConversationExists as jest.Mock).mockResolvedValue(false);

      // Mock createConversationWithFirstMessage to throw network error
      const { createConversationWithFirstMessage } = require('@/services/conversationService');
      const mockCreateConversation = createConversationWithFirstMessage as jest.Mock;

      // Create a FirestoreError with 'unavailable' code (network error)
      // The categorizeError function will recognize this as 'network'
      const networkError = new FirestoreError('unavailable', 'Network unavailable');
      mockCreateConversation.mockRejectedValue(networkError);

      const draftParams = {
        type: 'direct' as const,
        groupName: undefined,
        groupPhotoURL: undefined,
      };

      const result = await sendMessage(
        {
          conversationId: mockConversationId,
          senderId: mockSenderId,
          text: 'Hello!',
        },
        mockParticipantIds,
        draftParams
      );

      // Verify enqueue was called with correct parameters
      expect(mockEnqueue).toHaveBeenCalledWith({
        operationType: 'CONVERSATION_CREATE',
        data: {
          type: 'direct',
          participantIds: mockParticipantIds,
          messageText: 'Hello!',
          senderId: mockSenderId,
          groupName: undefined,
          groupPhotoURL: undefined,
        },
      });

      // Verify optimistic message was returned with 'sending' status
      expect(result.status).toBe('sending');
      expect(result.id).toMatch(/^temp_/); // Temporary ID
      expect(result.text).toBe('Hello!');
      expect(result.senderId).toBe(mockSenderId);
    });
  });

  describe('getMessages', () => {
    it('should fetch messages with default page size', async () => {
      const mockMessages = [
        { id: 'msg1', text: 'Hello', timestamp: Timestamp.now() },
        { id: 'msg2', text: 'Hi', timestamp: Timestamp.now() },
      ];

      const mockDocs = mockMessages.map((msg) => ({
        id: msg.id,
        data: () => msg,
      }));

      const mockSnapshot = {
        docs: mockDocs,
         
        forEach: (callback: any) => {
          mockDocs.forEach(callback);
        },
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getMessages(mockConversationId);

      expect(result.messages).toHaveLength(2);
      // Messages are reversed, so msg2 comes first (oldest-to-newest order)
      expect(result.messages[0].id).toBe('msg2');
      expect(result.hasMore).toBe(false);
      expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(limit).toHaveBeenCalledWith(50);
    });

    it('should fetch messages with custom page size', async () => {
      const mockSnapshot = {
        docs: [],
        forEach: jest.fn(),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      await getMessages(mockConversationId, 25);

      expect(limit).toHaveBeenCalledWith(25);
    });

    it('should support cursor-based pagination', async () => {
      const mockLastDoc = { id: 'last-msg' };
      const mockSnapshot = {
        docs: [],
        forEach: jest.fn(),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

       
      await getMessages(mockConversationId, 50, mockLastDoc as any);

      expect(startAfter).toHaveBeenCalledWith(mockLastDoc);
    });

    it('should indicate hasMore when full page is returned', async () => {
      const mockMessages = Array.from({ length: 50 }, (_, i) => ({
        id: `msg${i}`,
        text: `Message ${i}`,
      }));

      const mockDocs = mockMessages.map((msg) => ({
        id: msg.id,
        data: () => msg,
      }));

      const mockSnapshot = {
        docs: mockDocs,
         
        forEach: (callback: any) => {
          mockDocs.forEach(callback);
        },
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getMessages(mockConversationId, 50);

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it('should indicate no more when partial page is returned', async () => {
      const mockMessages = Array.from({ length: 25 }, (_, i) => ({
        id: `msg${i}`,
        text: `Message ${i}`,
      }));

      const mockDocs = mockMessages.map((msg) => ({
        id: msg.id,
        data: () => msg,
      }));

      const mockSnapshot = {
        docs: mockDocs,
         
        forEach: (callback: any) => {
          mockDocs.forEach(callback);
        },
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getMessages(mockConversationId, 50);

      expect(result.messages).toHaveLength(25);
      expect(result.hasMore).toBe(false);
    });

    it('should return last document for pagination', async () => {
      const mockDocs = [
        { id: 'msg1', data: () => ({ text: 'First' }) },
        { id: 'msg2', data: () => ({ text: 'Last' }) },
      ];

      const mockSnapshot = {
        docs: mockDocs,
         
        forEach: (callback: any) => {
          mockDocs.forEach(callback);
        },
      };

      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getMessages(mockConversationId);

      expect(result.lastDoc).toEqual(mockDocs[1]);
    });

    it('should handle Firestore errors gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(getMessages(mockConversationId)).rejects.toThrow('Failed to fetch messages');
    });
  });

  describe('subscribeToMessages', () => {
    it('should subscribe to real-time message updates', () => {
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

      const callback = jest.fn();
      const unsubscribe = subscribeToMessages(mockConversationId, callback, 50);

      expect(onSnapshot).toHaveBeenCalled();
      expect(query).toHaveBeenCalled();
      expect(orderBy).toHaveBeenCalledWith('timestamp', 'desc');
      expect(limit).toHaveBeenCalledWith(50);
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should invoke callback with messages on snapshot', () => {
      const mockMessages = [
        { id: 'msg1', text: 'Hello' },
        { id: 'msg2', text: 'Hi' },
      ];

      const mockSnapshot = {
         
        forEach: (callback: any) => {
          mockMessages.forEach((msg) => {
            callback({ id: msg.id, data: () => msg });
          });
        },
      };

      (onSnapshot as jest.Mock).mockImplementation((q, successCallback) => {
        successCallback(mockSnapshot);
        return jest.fn();
      });

      const callback = jest.fn();
      subscribeToMessages(mockConversationId, callback);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'msg1', text: 'Hello' }),
          expect.objectContaining({ id: 'msg2', text: 'Hi' }),
        ])
      );
    });

    it('should invoke callback with empty array on error', () => {
      (onSnapshot as jest.Mock).mockImplementation((q, successCallback, errorCallback) => {
        errorCallback(new Error('Network error'));
        return jest.fn();
      });

      const callback = jest.fn();
      subscribeToMessages(mockConversationId, callback);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should handle subscription errors gracefully', () => {
      (onSnapshot as jest.Mock).mockImplementation(() => {
        throw new Error('Subscription error');
      });

      const callback = jest.fn();

      expect(() => subscribeToMessages(mockConversationId, callback)).toThrow(
        'Failed to subscribe to messages'
      );
    });
  });

  // Note: updateMessageStatus and markMessageAsRead use dynamic imports
  // which are difficult to test in Jest. These functions are tested
  // in integration tests instead.
});
