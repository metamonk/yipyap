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
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { updateConversationLastMessage } from '@/services/conversationService';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('@/services/conversationService');
jest.mock('firebase/firestore', () => ({
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
}));

describe('messageService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockDb = {} as any;
  const mockConversationId = 'user123_user456';
  const mockSenderId = 'user123';
  const mockParticipantIds = ['user123', 'user456'];

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
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
      expect(result.status).toBe('sending');
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        forEach: (callback: any) => {
          mockDocs.forEach(callback);
        },
      };

      (query as jest.Mock).mockReturnValue('mock-query');
      (getDocs as jest.Mock).mockResolvedValue(mockSnapshot);

      const result = await getMessages(mockConversationId);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg1');
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
