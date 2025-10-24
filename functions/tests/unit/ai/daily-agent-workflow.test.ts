/**
 * Unit Tests for Daily Agent Workflow Orchestrator
 * @module functions/tests/unit/ai/daily-agent-workflow.test
 *
 * Tests the workflow orchestration including:
 * - Message fetching with filtering
 * - Message categorization
 * - FAQ detection and auto-response
 * - Voice-matched response drafting
 * - Daily digest generation
 * - Error handling and rollback
 * - Performance metrics tracking
 */

import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

let mockFirestore: any;
let mockFunctions: any;

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const actualAdmin = jest.requireActual('firebase-admin');
  return {
    ...actualAdmin,
    apps: [],
    initializeApp: jest.fn(),
    firestore: jest.fn(() => ({
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    })),
  };
});

// Mock node-fetch
jest.mock('node-fetch');

// Import after mocks
import { orchestrateWorkflow } from '../../../src/ai/daily-agent-workflow';

describe('daily-agent-workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Firestore
    mockFirestore = {
      collection: jest.fn().mockReturnThis(),
      doc: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      add: jest.fn(),
      update: jest.fn(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
    };

    // Mock Functions
    mockFunctions = {
      httpsCallable: jest.fn(),
    };

    // Mock Timestamp
    (admin.firestore.Timestamp as any) = {
      now: jest.fn(() => ({
        seconds: Math.floor(Date.now() / 1000),
        nanoseconds: 0,
      })),
    };

    // Mock FieldValue
    (admin.firestore.FieldValue as any) = {
      serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
    };

    // Setup process.env
    process.env.VERCEL_URL = 'api.yipyap.test';
  });

  describe('orchestrateWorkflow', () => {
    it('should complete workflow successfully with messages', async () => {
      const userId = 'user123';

      // Mock config document
      const mockConfigDoc = {
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
          },
        }),
      };

      // Mock conversations
      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              creatorId: userId,
              lastMessageTimestamp: {
                seconds: Math.floor(Date.now() / 1000) - 2 * 60 * 60, // 2 hours ago
                nanoseconds: 0,
              },
            }),
          },
        ],
      };

      // Mock messages
      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            ref: {
              update: jest.fn(),
            },
            data: () => ({
              conversationId: 'conv1',
              senderId: 'other_user',
              text: 'Hello, how are you?',
              timestamp: {
                seconds: Math.floor(Date.now() / 1000) - 1 * 60 * 60,
                nanoseconds: 0,
              },
              metadata: {},
            }),
          },
        ],
      };

      // Setup Firestore mocks
      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc) // config
        .mockResolvedValueOnce({ exists: () => false }) // execution doc check
        .mockResolvedValueOnce(mockConversations) // conversations query
        .mockResolvedValueOnce(mockMessages); // messages query

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.add.mockResolvedValue({ id: 'digest123' });
      mockFirestore.update.mockResolvedValue(undefined);

      // Mock Edge Function responses
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/categorize-message')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                category: 'general',
                cost: 0.05,
              }),
          });
        }
        if (url.includes('/api/detect-faq')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                isFAQ: false,
                confidence: 0.3,
                cost: 0.03,
              }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      // Mock voice matching function
      const mockVoiceMatchCallable = jest.fn().mockResolvedValue({
        data: {
          success: true,
          response: 'Thanks for reaching out!',
          cost: 1.5,
        },
      });
      mockFunctions.httpsCallable.mockReturnValue(mockVoiceMatchCallable);

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      expect(result.executionId).toBeTruthy();
      expect(result.results.messagesFetched).toBe(1);
      expect(result.results.messagesCategorized).toBe(1);
      expect(result.results.responsesDrafted).toBe(1);
      expect(mockFirestore.set).toHaveBeenCalled(); // Execution doc created
      expect(mockFirestore.update).toHaveBeenCalled(); // Execution doc updated
      expect(mockFirestore.add).toHaveBeenCalled(); // Digest created
    });

    it('should handle no messages gracefully', async () => {
      const userId = 'user123';

      // Mock config document
      const mockConfigDoc = {
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 20,
            requireApproval: true,
            escalationThreshold: 0.3,
          },
        }),
      };

      // Mock empty conversations
      const mockConversations = {
        docs: [],
      };

      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc)
        .mockResolvedValueOnce(mockConversations);

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.update.mockResolvedValue(undefined);

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0);
      expect(result.results.autoResponsesSent).toBe(0);
      expect(result.metrics.costIncurred).toBe(0);
    });

    it('should respect maxAutoResponses limit', async () => {
      const userId = 'user123';

      // Mock config with low limit
      const mockConfigDoc = {
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 1, // Only allow 1 auto-response
            requireApproval: false,
            escalationThreshold: 0.3,
          },
        }),
      };

      // Mock conversations with multiple messages
      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              creatorId: userId,
              lastMessageTimestamp: {
                seconds: Math.floor(Date.now() / 1000) - 2 * 60 * 60,
                nanoseconds: 0,
              },
            }),
          },
        ],
      };

      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            ref: { update: jest.fn() },
            data: () => ({
              conversationId: 'conv1',
              senderId: 'other_user',
              text: 'Question 1',
              timestamp: { seconds: Math.floor(Date.now() / 1000) - 60 * 60, nanoseconds: 0 },
              metadata: {},
            }),
          },
          {
            id: 'msg2',
            ref: { update: jest.fn() },
            data: () => ({
              conversationId: 'conv1',
              senderId: 'other_user',
              text: 'Question 2',
              timestamp: { seconds: Math.floor(Date.now() / 1000) - 60 * 60, nanoseconds: 0 },
              metadata: {},
            }),
          },
        ],
      };

      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc)
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValueOnce(mockMessages);

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.add.mockResolvedValue({ id: 'digest123' });
      mockFirestore.update.mockResolvedValue(undefined);

      // Mock FAQ detection - both messages are FAQs
      (fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/categorize-message')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ category: 'general', cost: 0.05 }),
          });
        }
        if (url.includes('/api/detect-faq')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                isFAQ: true,
                confidence: 0.9,
                templateId: 'faq123',
                suggestedResponse: 'Auto response',
                cost: 0.03,
              }),
          });
        }
        return Promise.reject(new Error('Unknown URL'));
      });

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      // Should only send 1 auto-response despite 2 FAQs detected
      expect(result.results.autoResponsesSent).toBe(1);
    });

    it('should skip active conversations', async () => {
      const userId = 'user123';

      const mockConfigDoc = {
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
          },
        }),
      };

      // Mock conversation with recent activity (< 1 hour)
      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              creatorId: userId,
              lastMessageTimestamp: {
                seconds: Math.floor(Date.now() / 1000) - 30 * 60, // 30 minutes ago
                nanoseconds: 0,
              },
            }),
          },
        ],
      };

      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc)
        .mockResolvedValueOnce(mockConversations);

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.update.mockResolvedValue(undefined);

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0);
    });

    it('should skip crisis messages', async () => {
      const userId = 'user123';

      const mockConfigDoc = {
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
          },
        }),
      };

      const mockConversations = {
        docs: [
          {
            id: 'conv1',
            data: () => ({
              creatorId: userId,
              lastMessageTimestamp: {
                seconds: Math.floor(Date.now() / 1000) - 2 * 60 * 60,
                nanoseconds: 0,
              },
            }),
          },
        ],
      };

      // Mock message with negative sentiment (crisis)
      const mockMessages = {
        docs: [
          {
            id: 'msg1',
            ref: { update: jest.fn() },
            data: () => ({
              conversationId: 'conv1',
              senderId: 'other_user',
              text: 'I am very upset',
              timestamp: { seconds: Math.floor(Date.now() / 1000) - 60 * 60, nanoseconds: 0 },
              metadata: {
                sentiment: 'very_negative',
                sentimentScore: 0.1, // Below threshold
              },
            }),
          },
        ],
      };

      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc)
        .mockResolvedValueOnce(mockConversations)
        .mockResolvedValueOnce(mockMessages);

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.update.mockResolvedValue(undefined);

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      // Crisis message should be skipped
      expect(result.results.messagesFetched).toBe(0);
    });

    it('should handle errors gracefully and mark execution as failed', async () => {
      const userId = 'user123';

      // Mock config
      mockFirestore.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workflowSettings: {
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
          },
        }),
      });

      // Mock execution document creation
      mockFirestore.set.mockResolvedValue(undefined);

      // Mock conversations query to fail
      mockFirestore.get.mockRejectedValueOnce(new Error('Firestore error'));

      mockFirestore.update.mockResolvedValue(undefined);

      await expect(orchestrateWorkflow(userId)).rejects.toThrow('Firestore error');

      // Execution should be marked as failed
      expect(mockFirestore.update).toHaveBeenCalled();
    });

    it('should use default config when config document does not exist', async () => {
      const userId = 'user123';

      // Mock non-existent config
      const mockConfigDoc = {
        exists: false,
      };

      const mockConversations = { docs: [] };

      mockFirestore.get
        .mockResolvedValueOnce(mockConfigDoc)
        .mockResolvedValueOnce(mockConversations);

      mockFirestore.set.mockResolvedValue(undefined);
      mockFirestore.update.mockResolvedValue(undefined);

      const result = await orchestrateWorkflow(userId);

      expect(result.success).toBe(true);
      // Should use default config values
    });
  });
});
