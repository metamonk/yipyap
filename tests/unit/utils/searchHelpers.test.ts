/**
 * Unit tests for search helper utilities
 *
 * @group unit
 * @group utils
 */

import { filterMessagesByKeyword } from '@/utils/searchHelpers';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

describe('searchHelpers', () => {
  describe('filterMessagesByKeyword', () => {
    // Test data factory
    const createTestMessage = (id: string, text: string): Message => ({
      id,
      conversationId: 'test-conv-1',
      senderId: 'test-user-1',
      text,
      status: 'delivered',
      readBy: ['test-user-1'],
      timestamp: Timestamp.now(),
      metadata: {},
    });

    const testMessages: Message[] = [
      createTestMessage('msg-1', 'Hello world'),
      createTestMessage('msg-2', 'Good morning everyone'),
      createTestMessage('msg-3', 'The quick brown fox'),
      createTestMessage('msg-4', 'HELLO EVERYONE'),
      createTestMessage('msg-5', 'Special characters: @#$%'),
    ];

    it('should return all messages when query is empty', () => {
      const results = filterMessagesByKeyword(testMessages, '');
      expect(results).toEqual(testMessages);
      expect(results).toHaveLength(5);
    });

    it('should return all messages when query is only whitespace', () => {
      const results = filterMessagesByKeyword(testMessages, '   ');
      expect(results).toEqual(testMessages);
      expect(results).toHaveLength(5);
    });

    it('should find exact matches (case-insensitive)', () => {
      const results = filterMessagesByKeyword(testMessages, 'hello');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('msg-1');
      expect(results[1].id).toBe('msg-4');
    });

    it('should find partial/substring matches', () => {
      const results = filterMessagesByKeyword(testMessages, 'every');
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('msg-2');
      expect(results[1].id).toBe('msg-4');
    });

    it('should be case-insensitive', () => {
      const results1 = filterMessagesByKeyword(testMessages, 'hello');
      const results2 = filterMessagesByKeyword(testMessages, 'HELLO');
      const results3 = filterMessagesByKeyword(testMessages, 'HeLLo');

      expect(results1).toEqual(results2);
      expect(results2).toEqual(results3);
      expect(results1).toHaveLength(2);
    });

    it('should handle special characters in query', () => {
      const results = filterMessagesByKeyword(testMessages, '@#$%');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-5');
    });

    it('should return empty array when no matches found', () => {
      const results = filterMessagesByKeyword(testMessages, 'nonexistent');
      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should handle empty messages array', () => {
      const results = filterMessagesByKeyword([], 'hello');
      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should trim leading and trailing whitespace from query', () => {
      const results1 = filterMessagesByKeyword(testMessages, '  hello  ');
      const results2 = filterMessagesByKeyword(testMessages, 'hello');

      expect(results1).toEqual(results2);
      expect(results1).toHaveLength(2);
    });

    it('should match multiple words in query', () => {
      const results = filterMessagesByKeyword(testMessages, 'hello world');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-1');
    });

    it('should not modify the original messages array', () => {
      const originalLength = testMessages.length;
      const originalFirstMessage = testMessages[0];

      filterMessagesByKeyword(testMessages, 'hello');

      expect(testMessages).toHaveLength(originalLength);
      expect(testMessages[0]).toBe(originalFirstMessage);
    });

    it('should handle Unicode characters', () => {
      const unicodeMessages = [
        createTestMessage('msg-u1', 'Hello 世界'),
        createTestMessage('msg-u2', 'Emoji test 😀🎉'),
        createTestMessage('msg-u3', 'Café résumé'),
      ];

      const results1 = filterMessagesByKeyword(unicodeMessages, '世界');
      expect(results1).toHaveLength(1);
      expect(results1[0].id).toBe('msg-u1');

      const results2 = filterMessagesByKeyword(unicodeMessages, '😀');
      expect(results2).toHaveLength(1);
      expect(results2[0].id).toBe('msg-u2');

      const results3 = filterMessagesByKeyword(unicodeMessages, 'café');
      expect(results3).toHaveLength(1);
      expect(results3[0].id).toBe('msg-u3');
    });
  });
});
