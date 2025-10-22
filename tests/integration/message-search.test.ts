/**
 * Integration tests for message search functionality
 *
 * @group integration
 * @group search
 */

import { filterMessagesByKeyword } from '@/utils/searchHelpers';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

describe('Message Search Integration', () => {
  // Test data factory
  const createTestMessage = (
    id: string,
    conversationId: string,
    senderId: string,
    text: string
  ): Message => ({
    id,
    conversationId,
    senderId,
    text,
    status: 'delivered',
    readBy: [senderId],
    timestamp: Timestamp.now(),
    metadata: {},
  });

  // Simulate messages from multiple conversations
  const conversation1Messages: Message[] = [
    createTestMessage('msg-1', 'conv-1', 'user-1', 'Hello everyone'),
    createTestMessage('msg-2', 'conv-1', 'user-2', 'Good morning'),
    createTestMessage('msg-3', 'conv-1', 'user-1', 'How are you today?'),
  ];

  const conversation2Messages: Message[] = [
    createTestMessage('msg-4', 'conv-2', 'user-1', 'Meeting at 3pm'),
    createTestMessage('msg-5', 'conv-2', 'user-3', 'Thanks for the update'),
    createTestMessage('msg-6', 'conv-2', 'user-1', 'See you there'),
  ];

  const conversation3Messages: Message[] = [
    createTestMessage('msg-7', 'conv-3', 'user-4', 'Hello from the team'),
    createTestMessage('msg-8', 'conv-3', 'user-1', 'Great to hear from you'),
  ];

  const allMessages = [
    ...conversation1Messages,
    ...conversation2Messages,
    ...conversation3Messages,
  ];

  describe('Cross-conversation search', () => {
    it('should search across all conversations', () => {
      const results = filterMessagesByKeyword(allMessages, 'hello');

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('msg-1');
      expect(results[1].id).toBe('msg-7');

      // Verify results are from different conversations
      expect(results[0].conversationId).toBe('conv-1');
      expect(results[1].conversationId).toBe('conv-3');
    });

    it('should find messages from specific user across conversations', () => {
      const user1Messages = allMessages.filter((msg) => msg.senderId === 'user-1');
      const results = filterMessagesByKeyword(user1Messages, 'you');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.senderId).toBe('user-1');
      });
    });

    it('should handle search within single conversation', () => {
      const results = filterMessagesByKeyword(conversation1Messages, 'morning');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('msg-2');
      expect(results[0].conversationId).toBe('conv-1');
    });
  });

  describe('Search result ordering', () => {
    it('should maintain original message order in results', () => {
      const results = filterMessagesByKeyword(allMessages, 'you');

      // Extract message IDs in order
      const resultIds = results.map((msg) => msg.id);

      // Verify order is preserved (matches order in allMessages)
      const expectedOrder = allMessages
        .filter((msg) => msg.text.toLowerCase().includes('you'))
        .map((msg) => msg.id);

      expect(resultIds).toEqual(expectedOrder);
    });
  });

  describe('Empty and edge cases', () => {
    it('should handle empty message list gracefully', () => {
      const results = filterMessagesByKeyword([], 'hello');

      expect(results).toEqual([]);
      expect(results).toHaveLength(0);
    });

    it('should return all messages when query is empty', () => {
      const results = filterMessagesByKeyword(allMessages, '');

      expect(results).toEqual(allMessages);
      expect(results).toHaveLength(allMessages.length);
    });

    it('should return empty array when no matches found', () => {
      const results = filterMessagesByKeyword(allMessages, 'nonexistent phrase');

      expect(results).toEqual([]);
    });
  });

  describe('Real-world search scenarios', () => {
    it('should find meeting-related messages', () => {
      const results = filterMessagesByKeyword(allMessages, 'meeting');

      expect(results).toHaveLength(1);
      expect(results[0].text).toContain('Meeting');
    });

    it('should find greetings across conversations', () => {
      const results = filterMessagesByKeyword(allMessages, 'hello');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.text.toLowerCase()).toContain('hello');
      });
    });

    it('should handle partial word matching', () => {
      const results = filterMessagesByKeyword(allMessages, 'up');

      // Should match "update"
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((msg) => msg.text.includes('update'))).toBe(true);
    });
  });

  describe('Search workflow simulation', () => {
    it('should simulate user typing and searching', () => {
      // User types "h"
      let results = filterMessagesByKeyword(allMessages, 'h');
      expect(results.length).toBeGreaterThan(0);

      // User types "he"
      results = filterMessagesByKeyword(allMessages, 'he');
      expect(results.length).toBeGreaterThan(0);

      // User types "hel"
      results = filterMessagesByKeyword(allMessages, 'hel');
      expect(results.length).toBeGreaterThan(0);

      // User types "hello"
      results = filterMessagesByKeyword(allMessages, 'hello');
      expect(results).toHaveLength(2);

      // Verify progressive refinement
      const searchTerms = ['h', 'he', 'hel', 'hello'];
      const resultCounts = searchTerms.map(
        (term) => filterMessagesByKeyword(allMessages, term).length
      );

      // Results should narrow down or stay same as search becomes more specific
      for (let i = 1; i < resultCounts.length; i++) {
        expect(resultCounts[i]).toBeLessThanOrEqual(resultCounts[i - 1]);
      }
    });

    it('should handle clearing search', () => {
      // User searches
      let results = filterMessagesByKeyword(allMessages, 'hello');
      expect(results).toHaveLength(2);

      // User clears search (empty query)
      results = filterMessagesByKeyword(allMessages, '');
      expect(results).toEqual(allMessages);
      expect(results).toHaveLength(allMessages.length);
    });
  });

  describe('Performance characteristics', () => {
    it('should handle large number of messages efficiently', () => {
      // Create a large set of test messages
      const largeMessageSet: Message[] = [];
      for (let i = 0; i < 1000; i++) {
        largeMessageSet.push(
          createTestMessage(
            `msg-${i}`,
            `conv-${i % 10}`,
            `user-${i % 5}`,
            `Message number ${i} with some test content`
          )
        );
      }

      const startTime = Date.now();
      const results = filterMessagesByKeyword(largeMessageSet, 'test');
      const endTime = Date.now();

      // Should complete in reasonable time (<50ms for 1000 messages)
      expect(endTime - startTime).toBeLessThan(50);

      // Should find all matching messages
      expect(results).toHaveLength(1000); // All messages contain "test"
    });
  });
});
