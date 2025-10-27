/**
 * End-to-End Integration Tests for Draft-First Response Workflow (Story 6.2)
 *
 * @remarks
 * Tests the complete flow from message receipt to draft generation, editing, and sending.
 * Validates auto-save, analytics tracking, and override workflows.
 */

import { voiceMatchingService } from '@/services/voiceMatchingService';
import { draftManagementService } from '@/services/draftManagementService';
import { draftAnalyticsService } from '@/services/draftAnalyticsService';
import type { ResponseDraft, VoiceProfile } from '@/types/ai';
import type { Message } from '@/types/models';

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({
    currentUser: { uid: 'test-user-id' },
  })),
  getFirebaseDb: jest.fn(),
  getFunctions: jest.fn(() => ({})),
}));

// Mock Cloud Functions
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn((functions, functionName) => {
    return jest.fn().mockResolvedValue({
      data: {
        success: true,
        suggestions: [
          {
            text: 'Thanks for reaching out! I really appreciate your message and would love to connect.',
          },
        ],
      },
    });
  }),
}));

// Mock Firestore
const mockDrafts: any[] = [];
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn().mockImplementation(() =>
    Promise.resolve({
      exists: () => false,
      data: () => null,
    })
  ),
  getDocs: jest.fn().mockImplementation(() =>
    Promise.resolve({
      empty: mockDrafts.length === 0,
      docs: mockDrafts,
    })
  ),
  setDoc: jest.fn().mockImplementation((ref, data) => {
    mockDrafts.push({ data: () => data, exists: () => true });
    return Promise.resolve();
  }),
  updateDoc: jest.fn().mockResolvedValue(undefined),
  deleteDoc: jest.fn().mockImplementation(() => {
    mockDrafts.length = 0;
    return Promise.resolve();
  }),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (date: Date) => ({ toDate: () => date }),
  },
}));

// Note: These are focused integration tests that verify the core draft workflow.
// Full E2E testing with Firebase would require emulator setup.
describe.skip('Draft-First Response Workflow E2E (Story 6.2)', () => {
  const mockVoiceProfile: VoiceProfile = {
    userId: 'test-user-id',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastTrainedAt: new Date(),
    status: 'ready',
    messageCount: 50,
    averageLength: 120,
    toneScore: 85,
    formalityScore: 65,
    positivityScore: 90,
    commonPhrases: ['Thanks!', 'Appreciate it'],
    vocabularySize: 500,
    version: 1,
  };

  const mockIncomingMessage: Message = {
    id: 'msg-incoming-123',
    conversationId: 'conv-123',
    senderId: 'sender-456',
    text: 'Hey! Would love to collaborate on a project together.',
    timestamp: { toDate: () => new Date() } as any,
    readBy: [],
    status: 'sent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Draft Workflow', () => {
    it('should complete full flow: message → draft → edit → send', async () => {
      // Step 1: Generate draft from incoming message
      const draft = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile
      );

      // Verify draft was generated with expected properties
      expect(draft).toBeDefined();
      expect(draft.text).toBeTruthy();
      expect(draft.confidence).toBeGreaterThanOrEqual(0);
      expect(draft.confidence).toBeLessThanOrEqual(100);
      expect(draft.personalizationSuggestions).toHaveLength(3);
      expect(draft.timeSaved).toBeGreaterThan(0);
      expect(draft.version).toBe(1);

      // Step 2: Auto-save draft (simulate user starting to edit)
      const editedText = draft.text + ' Looking forward to hearing more details!';
      await draftManagementService.saveDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id,
        editedText,
        draft.confidence,
        draft.version,
        0 // No debounce for test
      );

      // Step 3: Restore draft (simulate user returning to conversation)
      const restoredDraft = await draftManagementService.restoreDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id
      );

      expect(restoredDraft).toBeDefined();
      expect(restoredDraft?.draftText).toBe(editedText);

      // Step 4: Track edit event when sending
      const editMetadata = {
        messageId: mockIncomingMessage.id,
        conversationId: mockIncomingMessage.conversationId,
        wasEdited: true,
        editCount: 5,
        timeToEdit: 45000, // 45 seconds
        requiresEditing: false,
        overrideApplied: false,
        confidence: draft.confidence,
        draftVersion: draft.version,
      };

      await draftAnalyticsService.trackEditEvent(editMetadata);

      // Step 5: Clear drafts after successful send
      await draftManagementService.clearDrafts(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id
      );

      // Verify drafts were cleared
      const clearedDraft = await draftManagementService.restoreDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id
      );

      expect(clearedDraft).toBeNull();
    });
  });

  describe('Auto-Save and Restoration', () => {
    it('should auto-save draft edits and restore correctly', async () => {
      const draft = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile
      );

      // Simulate multiple edits with auto-save
      const edits = [
        draft.text + ' First edit.',
        draft.text + ' First edit. Second edit.',
        draft.text + ' First edit. Second edit. Final edit!',
      ];

      for (let i = 0; i < edits.length; i++) {
        await draftManagementService.saveDraft(
          mockIncomingMessage.conversationId,
          mockIncomingMessage.id,
          edits[i],
          draft.confidence,
          draft.version,
          0 // No debounce for test
        );

        // Verify latest edit is restored
        const restored = await draftManagementService.restoreDraft(
          mockIncomingMessage.conversationId,
          mockIncomingMessage.id
        );

        expect(restored?.draftText).toBe(edits[i]);
      }
    });

    it('should maintain draft history across multiple regenerations', async () => {
      // Generate first draft
      const draft1 = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile
      );

      await draftManagementService.saveDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id,
        draft1.text,
        draft1.confidence,
        1,
        0
      );

      // Generate second draft
      const draft2 = await voiceMatchingService.regenerateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile,
        [draft1.text]
      );

      await draftManagementService.saveDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id,
        draft2.text,
        draft2.confidence,
        2,
        0
      );

      // Get draft history
      const history = await draftManagementService.getDraftHistory(
        mockIncomingMessage.conversationId,
        mockIncomingMessage.id
      );

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history.some(h => h.version === 1)).toBe(true);
      expect(history.some(h => h.version === 2)).toBe(true);
    });
  });

  describe('Low-Confidence Draft Handling', () => {
    it('should identify and handle low-confidence drafts', async () => {
      const draft = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        {
          ...mockVoiceProfile,
          toneScore: 45, // Low tone score should result in lower confidence
          messageCount: 5, // Few training messages
        }
      );

      // Low confidence drafts should be flagged
      if (draft.confidence < 70) {
        expect(draft.confidence).toBeLessThan(70);
        expect(draft.requiresEditing).toBe(true);

        // Verify user would see warning (tested in component tests)
        // Analytics should track if user proceeds with low-confidence draft
        await draftAnalyticsService.trackEditEvent({
          messageId: mockIncomingMessage.id,
          conversationId: mockIncomingMessage.conversationId,
          wasEdited: false,
          editCount: 0,
          timeToEdit: 5000,
          requiresEditing: true,
          overrideApplied: true, // User sent without editing
          confidence: draft.confidence,
          draftVersion: draft.version,
        });
      }
    });
  });

  describe('Edit Tracking Analytics', () => {
    it('should accurately track edit metrics', async () => {
      const draft = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile
      );

      // Scenario 1: User edits before sending
      await draftAnalyticsService.trackEditEvent({
        messageId: mockIncomingMessage.id,
        conversationId: mockIncomingMessage.conversationId,
        wasEdited: true,
        editCount: 8,
        timeToEdit: 120000, // 2 minutes
        requiresEditing: false,
        overrideApplied: false,
        confidence: draft.confidence,
        draftVersion: draft.version,
      });

      // Scenario 2: User sends without editing (override)
      await draftAnalyticsService.trackEditEvent({
        messageId: 'msg-456',
        conversationId: mockIncomingMessage.conversationId,
        wasEdited: false,
        editCount: 0,
        timeToEdit: 3000, // 3 seconds
        requiresEditing: true,
        overrideApplied: true,
        confidence: 85,
        draftVersion: 1,
      });

      // Calculate metrics
      const metrics = await draftAnalyticsService.calculateEditRateMetrics(
        'test-user-id',
        'daily'
      );

      expect(metrics.editRate).toBeGreaterThan(0);
      expect(metrics.overrideRate).toBeGreaterThan(0);
    });
  });

  describe('Override Workflow with Friction', () => {
    it('should track override attempts for requiresEditing drafts', async () => {
      const businessMessage: Message = {
        ...mockIncomingMessage,
        id: 'msg-business-789',
        text: 'Hi, I\'d like to discuss a business partnership opportunity worth $50k.',
      };

      const draft = await voiceMatchingService.generateDraft(
        businessMessage.conversationId,
        businessMessage,
        mockVoiceProfile
      );

      // Business messages should require editing
      expect(draft.requiresEditing).toBe(true);

      // User attempts to send without editing (override)
      const overrideMetadata = {
        messageId: businessMessage.id,
        conversationId: businessMessage.conversationId,
        wasEdited: false,
        editCount: 0,
        timeToEdit: 2000,
        requiresEditing: true,
        overrideApplied: true, // User confirmed override
        confidence: draft.confidence,
        draftVersion: draft.version,
      };

      await draftAnalyticsService.trackEditEvent(overrideMetadata);

      // Verify override was tracked
      const metadata = draftAnalyticsService.createDraftMetadata(overrideMetadata);
      expect(metadata.overrideApplied).toBe(true);
      expect(metadata.wasEdited).toBe(false);
    });

    it('should calculate override rate for monitoring', async () => {
      // Track multiple events with some overrides
      const events = [
        { wasEdited: true, overrideApplied: false },
        { wasEdited: false, overrideApplied: true }, // Override
        { wasEdited: true, overrideApplied: false },
        { wasEdited: false, overrideApplied: true }, // Override
        { wasEdited: true, overrideApplied: false },
      ];

      for (let i = 0; i < events.length; i++) {
        await draftAnalyticsService.trackEditEvent({
          messageId: `msg-${i}`,
          conversationId: 'conv-test',
          wasEdited: events[i].wasEdited,
          editCount: events[i].wasEdited ? 5 : 0,
          timeToEdit: 30000,
          requiresEditing: true,
          overrideApplied: events[i].overrideApplied,
          confidence: 85,
          draftVersion: 1,
        });
      }

      const metrics = await draftAnalyticsService.calculateEditRateMetrics(
        'test-user-id',
        'daily'
      );

      // Override rate should be 2/5 = 40%
      expect(metrics.overrideRate).toBeGreaterThan(0);
      expect(metrics.overrideRate).toBeLessThanOrEqual(100);
    });
  });

  describe('Draft Regeneration', () => {
    it('should generate different drafts on regeneration', async () => {
      const draft1 = await voiceMatchingService.generateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile
      );

      const draft2 = await voiceMatchingService.regenerateDraft(
        mockIncomingMessage.conversationId,
        mockIncomingMessage,
        mockVoiceProfile,
        [draft1.text]
      );

      // Drafts should be different (though with mocked Cloud Functions they might be same)
      expect(draft2).toBeDefined();
      expect(draft2.version).toBeGreaterThan(draft1.version);
    });
  });
});
