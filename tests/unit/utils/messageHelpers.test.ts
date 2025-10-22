/**
 * Unit tests for message helper utilities
 */

import { Timestamp } from 'firebase/firestore';
import { groupMessagesWithSeparators } from '@/utils/messageHelpers';
import type { Message } from '@/types/models';
import * as dateHelpers from '@/utils/dateHelpers';

// Mock the shouldShowDateSeparator function
jest.mock('@/utils/dateHelpers', () => ({
  shouldShowDateSeparator: jest.fn(),
}));

describe('messageHelpers', () => {
  describe('groupMessagesWithSeparators', () => {
    // Helper function to create a test message
    const createMessage = (id: string, timestampStr: string): Message => ({
      id,
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Test message',
      status: 'delivered',
      readBy: ['user1'],
      timestamp: Timestamp.fromMillis(new Date(timestampStr).getTime()),
      metadata: { aiProcessed: false },
    });

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('returns empty array for empty messages array', () => {
      const result = groupMessagesWithSeparators([]);
      expect(result).toEqual([]);
      expect(dateHelpers.shouldShowDateSeparator).not.toHaveBeenCalled();
    });

    it('inserts separator before first message', () => {
      // Mock shouldShowDateSeparator to return true for first message
      (dateHelpers.shouldShowDateSeparator as jest.Mock).mockReturnValue(true);

      const messages = [createMessage('1', '2025-01-15 10:00')];
      const items = groupMessagesWithSeparators(messages);

      expect(items).toHaveLength(2);
      expect(items[0].type).toBe('separator');
      expect(items[0].id).toContain('separator-');
      expect(items[1].type).toBe('message');
      expect(items[1].id).toBe('1');

      expect(dateHelpers.shouldShowDateSeparator).toHaveBeenCalledWith(messages[0].timestamp, null);
    });

    it('does not insert separator between same-day messages', () => {
      // Mock: true for first message, false for second (same day)
      (dateHelpers.shouldShowDateSeparator as jest.Mock)
        .mockReturnValueOnce(true) // First message
        .mockReturnValueOnce(false); // Second message (same day)

      const messages = [
        createMessage('1', '2025-01-15 10:00'),
        createMessage('2', '2025-01-15 14:00'),
      ];
      const items = groupMessagesWithSeparators(messages);

      expect(items).toHaveLength(3); // 1 separator + 2 messages
      expect(items[0].type).toBe('separator');
      expect(items[1].type).toBe('message');
      expect(items[1].id).toBe('1');
      expect(items[2].type).toBe('message');
      expect(items[2].id).toBe('2');

      expect(dateHelpers.shouldShowDateSeparator).toHaveBeenCalledTimes(2);
    });

    it('inserts separators at date boundaries', () => {
      // Mock: true for each message (different days)
      (dateHelpers.shouldShowDateSeparator as jest.Mock).mockReturnValue(true);

      const messages = [
        createMessage('1', '2025-01-15 10:00'),
        createMessage('2', '2025-01-16 10:00'),
        createMessage('3', '2025-01-17 10:00'),
      ];
      const items = groupMessagesWithSeparators(messages);

      expect(items).toHaveLength(6); // 3 separators + 3 messages

      // Check alternating pattern: separator, message, separator, message...
      expect(items[0].type).toBe('separator');
      expect(items[1].type).toBe('message');
      expect(items[1].id).toBe('1');
      expect(items[2].type).toBe('separator');
      expect(items[3].type).toBe('message');
      expect(items[3].id).toBe('2');
      expect(items[4].type).toBe('separator');
      expect(items[5].type).toBe('message');
      expect(items[5].id).toBe('3');

      expect(dateHelpers.shouldShowDateSeparator).toHaveBeenCalledTimes(3);
    });

    it('handles mixed separator conditions correctly', () => {
      // Mock: pattern for day boundaries
      (dateHelpers.shouldShowDateSeparator as jest.Mock)
        .mockReturnValueOnce(true) // First message
        .mockReturnValueOnce(false) // Same day
        .mockReturnValueOnce(false) // Same day
        .mockReturnValueOnce(true) // New day
        .mockReturnValueOnce(false); // Same day

      const messages = [
        createMessage('1', '2025-01-15 09:00'),
        createMessage('2', '2025-01-15 12:00'),
        createMessage('3', '2025-01-15 18:00'),
        createMessage('4', '2025-01-16 08:00'),
        createMessage('5', '2025-01-16 14:00'),
      ];
      const items = groupMessagesWithSeparators(messages);

      expect(items).toHaveLength(7); // 2 separators + 5 messages

      // First day group
      expect(items[0].type).toBe('separator');
      expect(items[1].type).toBe('message');
      expect(items[1].id).toBe('1');
      expect(items[2].type).toBe('message');
      expect(items[2].id).toBe('2');
      expect(items[3].type).toBe('message');
      expect(items[3].id).toBe('3');

      // Second day group
      expect(items[4].type).toBe('separator');
      expect(items[5].type).toBe('message');
      expect(items[5].id).toBe('4');
      expect(items[6].type).toBe('message');
      expect(items[6].id).toBe('5');
    });

    it('preserves message data in message items', () => {
      (dateHelpers.shouldShowDateSeparator as jest.Mock).mockReturnValue(true);

      const originalMessage = createMessage('msg-1', '2025-01-15 10:00');
      const items = groupMessagesWithSeparators([originalMessage]);

      const messageItem = items[1]; // Second item should be the message
      expect(messageItem.type).toBe('message');
      expect(messageItem.id).toBe('msg-1');

      if (messageItem.type === 'message') {
        expect(messageItem.data).toEqual(originalMessage);
        expect(messageItem.data.text).toBe('Test message');
        expect(messageItem.data.senderId).toBe('user1');
      }
    });

    it('creates unique separator IDs based on timestamp', () => {
      (dateHelpers.shouldShowDateSeparator as jest.Mock).mockReturnValue(true);

      const messages = [
        createMessage('1', '2025-01-15 10:00'),
        createMessage('2', '2025-01-16 10:00'),
      ];
      const items = groupMessagesWithSeparators(messages);

      const separator1 = items[0];
      const separator2 = items[2];

      if (separator1.type === 'separator' && separator2.type === 'separator') {
        expect(separator1.id).toContain('separator-');
        expect(separator2.id).toContain('separator-');
        expect(separator1.id).not.toEqual(separator2.id);

        // IDs should be based on message timestamps
        const expectedId1 = `separator-${messages[0].timestamp.toMillis()}`;
        const expectedId2 = `separator-${messages[1].timestamp.toMillis()}`;
        expect(separator1.id).toBe(expectedId1);
        expect(separator2.id).toBe(expectedId2);
      }
    });

    it('maintains chronological order of messages', () => {
      (dateHelpers.shouldShowDateSeparator as jest.Mock)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false);

      const messages = [
        createMessage('1', '2025-01-15 09:00'),
        createMessage('2', '2025-01-15 12:00'),
        createMessage('3', '2025-01-15 18:00'),
      ];
      const items = groupMessagesWithSeparators(messages);

      // Filter out separators to check message order
      const messageItems = items.filter((item) => item.type === 'message');
      expect(messageItems[0].id).toBe('1');
      expect(messageItems[1].id).toBe('2');
      expect(messageItems[2].id).toBe('3');
    });

    it('passes correct timestamp to separator items', () => {
      (dateHelpers.shouldShowDateSeparator as jest.Mock).mockReturnValue(true);

      const message = createMessage('1', '2025-01-15 10:00');
      const items = groupMessagesWithSeparators([message]);

      const separator = items[0];
      if (separator.type === 'separator') {
        expect(separator.timestamp).toEqual(message.timestamp);
      }
    });
  });
});
