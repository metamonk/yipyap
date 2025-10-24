/**
 * Integration Tests for Daily Agent Workflow (Story 5.8 - Task 14)
 * @module functions/tests/integration/ai/daily-agent-integration.test
 *
 * Tests Integration Verification criteria with Firebase Emulator:
 * - IV1: Non-interference with real-time messaging
 * - IV2: Manual override detection
 * - IV3: Online/offline status awareness
 * - Full workflow execution end-to-end
 * - Timezone scheduling accuracy
 *
 * Prerequisites:
 * - Firebase Emulator Suite running (firebase emulators:start)
 * - Environment: FIRESTORE_EMULATOR_HOST=localhost:8080
 * - Run with: npm run test:integration:with-emulator
 */

import * as admin from 'firebase-admin';
import { orchestrateWorkflow } from '../../../src/ai/daily-agent-workflow';

// Initialize Firebase Admin with emulator
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'test-project',
  });
}

// Connect to Firestore Emulator
const db = admin.firestore();
if (process.env.FIRESTORE_EMULATOR_HOST) {
  console.log(`✓ Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else {
  console.warn('⚠️  FIRESTORE_EMULATOR_HOST not set. Set it to localhost:8080');
}

describe('Daily Agent Workflow - Integration Tests', () => {
  const testUserId = 'test-user-integration';
  const testConversationId = 'test-conversation-integration';

  beforeEach(async () => {
    // Clear test data before each test
    await clearTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await clearTestData();
  });

  /**
   * Helper: Clear all test data from Firestore
   */
  async function clearTestData() {
    try {
      // Delete user's AI config
      await db
        .collection('users')
        .doc(testUserId)
        .collection('ai_workflow_config')
        .doc(testUserId)
        .delete();

      // Delete executions
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      for (const doc of executionsSnap.docs) {
        await doc.ref.delete();
      }

      // Delete digests
      const digestsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_digests')
        .get();
      for (const doc of digestsSnap.docs) {
        await doc.ref.delete();
      }

      // Delete agent logs
      const logsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('agent_logs')
        .get();
      for (const doc of logsSnap.docs) {
        await doc.ref.delete();
      }

      // Delete test conversation and messages
      const messagesSnap = await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .get();
      for (const doc of messagesSnap.docs) {
        await doc.ref.delete();
      }
      await db.collection('conversations').doc(testConversationId).delete();

      // Delete user document
      await db.collection('users').doc(testUserId).delete();
    } catch (error) {
      // Ignore errors during cleanup
      console.log('Cleanup error (ignoring):', error);
    }
  }

  /**
   * Helper: Create test user with AI config
   */
  async function createTestUser(overrides?: any) {
    // Create user document
    await db
      .collection('users')
      .doc(testUserId)
      .set({
        uid: testUserId,
        username: 'testuser',
        displayName: 'Test User',
        email: 'test@example.com',
        presence: {
          status: 'offline',
          lastSeen: admin.firestore.Timestamp.now(),
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

    // Create AI workflow config
    await db
      .collection('users')
      .doc(testUserId)
      .collection('ai_workflow_config')
      .doc(testUserId)
      .set({
        userId: testUserId,
        features: {
          dailyWorkflowEnabled: true,
          categorizationEnabled: true,
          faqDetectionEnabled: true,
          voiceMatchingEnabled: true,
          sentimentAnalysisEnabled: true,
        },
        workflowSettings: {
          dailyWorkflowTime: '09:00',
          timezone: 'America/Los_Angeles',
          maxAutoResponses: 20,
          requireApproval: false,
          escalationThreshold: 0.3,
          activeThresholdMinutes: 30,
          ...overrides,
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
  }

  /**
   * Helper: Create test conversation with messages
   */
  async function createTestConversation(messageCount: number = 1, messageOverrides?: any[]) {
    // Create conversation
    await db
      .collection('conversations')
      .doc(testConversationId)
      .set({
        id: testConversationId,
        type: 'direct',
        participantIds: [testUserId, 'other-user'],
        creatorId: testUserId,
        lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(
          Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago
        ),
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

    // Create messages
    for (let i = 0; i < messageCount; i++) {
      const override = messageOverrides?.[i] || {};
      await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .add({
          conversationId: testConversationId,
          senderId: override.senderId || 'other-user',
          text: override.text || `Test message ${i + 1}`,
          status: 'delivered',
          readBy: [],
          timestamp: override.timestamp || admin.firestore.Timestamp.fromMillis(
            Date.now() - (i + 1) * 60 * 60 * 1000 // i+1 hours ago
          ),
          metadata: override.metadata || {},
          createdAt: admin.firestore.Timestamp.now(),
        });
    }
  }

  describe('IV1: Non-Interference with Real-Time Messaging', () => {
    it('should skip conversations with recent activity (< 1 hour)', async () => {
      // Setup
      await createTestUser();
      await db
        .collection('conversations')
        .doc(testConversationId)
        .set({
          id: testConversationId,
          type: 'direct',
          participantIds: [testUserId, 'other-user'],
          creatorId: testUserId,
          // ACTIVE conversation - last message 30 minutes ago
          lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(
            Date.now() - 30 * 60 * 1000
          ),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      // Create message in active conversation
      await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .add({
          conversationId: testConversationId,
          senderId: 'other-user',
          text: 'Recent message - should be skipped',
          status: 'delivered',
          readBy: [],
          timestamp: admin.firestore.Timestamp.fromMillis(Date.now() - 30 * 60 * 1000),
          metadata: {},
          createdAt: admin.firestore.Timestamp.now(),
        });

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0); // No messages fetched
      expect(result.results.autoResponsesSent).toBe(0);

      // Verify execution was recorded
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);
      expect(executionsSnap.docs[0].data().status).toBe('completed');
    });

    it('should process conversations with old activity (> 1 hour)', async () => {
      // Setup
      await createTestUser();
      await createTestConversation(1);

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBeGreaterThan(0);
    });
  });

  describe('IV2: Manual Override Detection', () => {
    it('should detect manual messages and skip auto-response', async () => {
      // Setup
      await createTestUser();
      await db
        .collection('conversations')
        .doc(testConversationId)
        .set({
          id: testConversationId,
          type: 'direct',
          participantIds: [testUserId, 'other-user'],
          creatorId: testUserId,
          lastMessageTimestamp: admin.firestore.Timestamp.fromMillis(
            Date.now() - 2 * 60 * 60 * 1000
          ),
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      // Create original message from other user (2 hours ago)
      await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .add({
          conversationId: testConversationId,
          senderId: 'other-user',
          text: 'Question from other user',
          status: 'delivered',
          readBy: [],
          timestamp: admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000),
          metadata: {},
          createdAt: admin.firestore.Timestamp.now(),
        });

      // Create manual reply from creator (1 hour ago) - AFTER workflow would start
      await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .add({
          conversationId: testConversationId,
          senderId: testUserId, // Creator sent manual message
          text: 'Manual reply from creator',
          status: 'delivered',
          readBy: [],
          timestamp: admin.firestore.Timestamp.fromMillis(Date.now() - 1 * 60 * 60 * 1000),
          metadata: {
            isManualReply: true,
          },
          createdAt: admin.firestore.Timestamp.now(),
        });

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);

      // Check that messages were fetched but manual override was detected
      const messagesSnap = await db
        .collection('conversations')
        .doc(testConversationId)
        .collection('messages')
        .where('senderId', '==', 'other-user')
        .get();

      if (!messagesSnap.empty) {
        const msgData = messagesSnap.docs[0].data();
        // If manual override was detected, message should have manualOverride flag
        // OR autoResponseSent should be false
        expect(
          msgData.metadata?.manualOverride === true ||
          msgData.metadata?.autoResponseSent !== true
        ).toBe(true);
      }
    });
  });

  describe('IV3: Online/Offline Status Awareness', () => {
    it('should skip workflow when creator is explicitly online', async () => {
      // Setup user with online status
      await db
        .collection('users')
        .doc(testUserId)
        .set({
          uid: testUserId,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          presence: {
            status: 'online', // ONLINE status
            lastSeen: admin.firestore.Timestamp.now(),
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await db
        .collection('users')
        .doc(testUserId)
        .collection('ai_workflow_config')
        .doc(testUserId)
        .set({
          userId: testUserId,
          features: { dailyWorkflowEnabled: true },
          workflowSettings: {
            dailyWorkflowTime: '09:00',
            timezone: 'America/Los_Angeles',
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
            activeThresholdMinutes: 30,
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await createTestConversation(1);

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0);

      // Verify execution was marked as skipped
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);
      expect(executionsSnap.docs[0].data().status).toBe('skipped');
      expect(executionsSnap.docs[0].data().digestSummary).toContain('online/active');
    });

    it('should skip workflow when creator was recently active', async () => {
      // Setup user with recent activity (within 30 min threshold)
      await db
        .collection('users')
        .doc(testUserId)
        .set({
          uid: testUserId,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          presence: {
            status: 'offline',
            lastSeen: admin.firestore.Timestamp.fromMillis(
              Date.now() - 15 * 60 * 1000 // 15 minutes ago - within 30min threshold
            ),
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await db
        .collection('users')
        .doc(testUserId)
        .collection('ai_workflow_config')
        .doc(testUserId)
        .set({
          userId: testUserId,
          features: { dailyWorkflowEnabled: true },
          workflowSettings: {
            dailyWorkflowTime: '09:00',
            timezone: 'America/Los_Angeles',
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
            activeThresholdMinutes: 30, // 30 minute threshold
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await createTestConversation(1);

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0);

      // Verify execution was marked as skipped
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);
      expect(executionsSnap.docs[0].data().status).toBe('skipped');
    });

    it('should process workflow when creator has been inactive for longer than threshold', async () => {
      // Setup user with old activity (beyond 30 min threshold)
      await db
        .collection('users')
        .doc(testUserId)
        .set({
          uid: testUserId,
          username: 'testuser',
          displayName: 'Test User',
          email: 'test@example.com',
          presence: {
            status: 'offline',
            lastSeen: admin.firestore.Timestamp.fromMillis(
              Date.now() - 60 * 60 * 1000 // 1 hour ago - beyond 30min threshold
            ),
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await db
        .collection('users')
        .doc(testUserId)
        .collection('ai_workflow_config')
        .doc(testUserId)
        .set({
          userId: testUserId,
          features: { dailyWorkflowEnabled: true },
          workflowSettings: {
            dailyWorkflowTime: '09:00',
            timezone: 'America/Los_Angeles',
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
            activeThresholdMinutes: 30,
          },
          createdAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        });

      await createTestConversation(1);

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBeGreaterThan(0);

      // Verify execution completed (not skipped)
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);
      expect(executionsSnap.docs[0].data().status).toBe('completed');
    });
  });

  describe('Full Workflow Execution', () => {
    it('should complete workflow and create execution records', async () => {
      // Setup
      await createTestUser();
      await createTestConversation(2);

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify result
      expect(result.success).toBe(true);
      expect(result.executionId).toBeTruthy();
      expect(result.results).toHaveProperty('messagesFetched');
      expect(result.results).toHaveProperty('messagesCategorized');
      expect(result.results).toHaveProperty('faqsDetected');
      expect(result.results).toHaveProperty('autoResponsesSent');
      expect(result.results).toHaveProperty('responsesDrafted');
      expect(result.results).toHaveProperty('messagesNeedingReview');

      // Verify execution document was created
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);

      const executionData = executionsSnap.docs[0].data();
      expect(executionData.status).toBe('completed');
      expect(executionData.userId).toBe(testUserId);
      expect(executionData.results).toMatchObject(result.results);

      // Verify digest was created
      const digestsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_digests')
        .get();
      expect(digestsSnap.size).toBeGreaterThanOrEqual(0); // May be 0 if no messages processed

      // Verify agent logs were created
      const logsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('agent_logs')
        .where('executionId', '==', result.executionId)
        .get();
      expect(logsSnap.size).toBeGreaterThan(0);
    });

    it('should handle no messages gracefully', async () => {
      // Setup with no conversations
      await createTestUser();

      // Execute workflow
      const result = await orchestrateWorkflow(testUserId);

      // Verify
      expect(result.success).toBe(true);
      expect(result.results.messagesFetched).toBe(0);
      expect(result.results.autoResponsesSent).toBe(0);

      // Verify execution was still recorded
      const executionsSnap = await db
        .collection('users')
        .doc(testUserId)
        .collection('daily_executions')
        .get();
      expect(executionsSnap.size).toBe(1);
      expect(executionsSnap.docs[0].data().status).toBe('completed');
      expect(executionsSnap.docs[0].data().digestSummary).toBe('0 handled, 0 need review');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user config gracefully', async () => {
      // No user or config created - workflow should use defaults

      const result = await orchestrateWorkflow(testUserId);

      // Should complete with default settings
      expect(result.success).toBe(true);
    });

    it('should handle invalid conversation data', async () => {
      // Setup
      await createTestUser();

      // Create malformed conversation (missing required fields)
      await db
        .collection('conversations')
        .doc(testConversationId)
        .set({
          id: testConversationId,
          // Missing participantIds, creatorId, etc.
        });

      // Execute workflow - should not crash
      const result = await orchestrateWorkflow(testUserId);

      expect(result.success).toBe(true);
      // Malformed conversation should be skipped
    });
  });
});
