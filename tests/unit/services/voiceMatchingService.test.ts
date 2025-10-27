/**
 * Unit tests for voiceMatchingService - Draft-First Mode (Story 6.2)
 * @remarks
 * Tests draft generation, confidence scoring, personalization suggestions,
 * and requiresEditing enforcement for the draft-first interface.
 */

import {
  VoiceMatchingService,
  DraftGenerationResult,
  VoiceMatchingError,
  VoiceMatchingErrorType,
} from '@/services/voiceMatchingService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseDb } from '@/services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { trackOperationStart, trackOperationEnd } from '@/services/aiPerformanceService';
import { checkUserBudgetStatus } from '@/services/aiAvailabilityService';
import { checkRateLimit, incrementOperationCount } from '@/services/aiRateLimitService';

// Mock Firebase modules
jest.mock('@/services/firebase');
jest.mock('firebase/functions');
jest.mock('firebase/firestore');
jest.mock('@/services/aiPerformanceService');
jest.mock('@/services/aiAvailabilityService');
jest.mock('@/services/aiRateLimitService');

describe('VoiceMatchingService - Draft-First Mode (Story 6.2)', () => {
  let service: VoiceMatchingService;
  const mockDb = {} as any;
  const mockAuth = {
    currentUser: { uid: 'user123' },
  } as any;
  const mockFunctions = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VoiceMatchingService();

    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (getFunctions as jest.Mock).mockReturnValue(mockFunctions);
    (checkUserBudgetStatus as jest.Mock).mockResolvedValue({ enabled: true });
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true, status: {} });
    (trackOperationStart as jest.Mock).mockReturnValue('op-123');
    (trackOperationEnd as jest.Mock).mockResolvedValue(undefined);
    (incrementOperationCount as jest.Mock).mockResolvedValue(undefined);
  });

  describe('generateDraft', () => {
    it('should successfully generate a draft with all required fields', async () => {
      // Mock Cloud Function response
      const mockCloudFunctionResponse = {
        data: {
          text: 'Thanks for reaching out! I appreciate your message.',
          confidence: 85,
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 5,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      // Mock voice profile for confidence calculation
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 80,
            averageSatisfactionRating: 4.5,
          },
        }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'fan_engagement');

      expect(result.success).toBe(true);
      expect(result.draft).toBeDefined();
      expect(result.draft?.text).toBe('Thanks for reaching out! I appreciate your message.');
      expect(result.draft?.confidence).toBe(85);
      expect(result.draft?.personalizationSuggestions).toHaveLength(3);
      expect(result.draft?.requiresEditing).toBeDefined();
      expect(result.draft?.timeSaved).toBeGreaterThan(0);
      expect(result.draft?.version).toBe(1);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should calculate confidence from voice profile when not returned by Cloud Function', async () => {
      // Mock Cloud Function response without confidence
      const mockCloudFunctionResponse = {
        data: {
          text: 'Thanks for your message!',
          tokensUsed: { prompt: 100, completion: 50, total: 150 },
          costCents: 5,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      // Mock voice profile with good metrics
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 90,
            averageSatisfactionRating: 4.8,
          },
        }),
      });

      const result = await service.generateDraft('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.draft?.confidence).toBeGreaterThanOrEqual(50);
      expect(result.draft?.confidence).toBeLessThanOrEqual(95);
    });

    it('should generate category-specific personalization suggestions', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'I would love to discuss this opportunity!',
          confidence: 80,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'business_opportunity');

      expect(result.success).toBe(true);
      expect(result.draft?.personalizationSuggestions).toHaveLength(3);
      expect(result.draft?.personalizationSuggestions[0].text).toContain('proposal');
      expect(result.draft?.personalizationSuggestions[0].type).toBe('detail');
    });

    it('should require editing for business_opportunity messages', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Thanks for the business inquiry!',
          confidence: 85,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'business_opportunity');

      expect(result.success).toBe(true);
      expect(result.draft?.requiresEditing).toBe(true);
    });

    it('should require editing for low confidence drafts (<70%)', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Thanks!',
          confidence: 65, // Low confidence
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'fan_engagement');

      expect(result.success).toBe(true);
      expect(result.draft?.confidence).toBe(65);
      expect(result.draft?.requiresEditing).toBe(true);
    });

    it('should handle budget disabled error', async () => {
      (checkUserBudgetStatus as jest.Mock).mockResolvedValue({
        enabled: false,
        message: 'Budget exceeded for today',
      });

      const result = await service.generateDraft('conv123', 'msg456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Budget exceeded for today');
    });

    it('should handle rate limit exceeded error', async () => {
      (checkRateLimit as jest.Mock).mockResolvedValue({
        allowed: false,
        status: { message: 'Rate limit exceeded' },
      });

      const result = await service.generateDraft('conv123', 'msg456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limit exceeded');
    });
  });

  describe('regenerateDraft', () => {
    it('should regenerate draft with incremented version number', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Here is a different response!',
          confidence: 82,
          tokensUsed: { prompt: 120, completion: 60, total: 180 },
          costCents: 6,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          metrics: {
            totalSuggestionsGenerated: 50,
            acceptedSuggestions: 40,
            averageSatisfactionRating: 4.2,
          },
        }),
      });

      const previousDrafts = ['First draft text', 'Second draft text'];
      const result = await service.regenerateDraft(
        'conv123',
        'msg456',
        previousDrafts,
        'fan_engagement'
      );

      expect(result.success).toBe(true);
      expect(result.draft?.version).toBe(3); // Should be previousDrafts.length + 1
      expect(result.draft?.text).toBe('Here is a different response!');
    });

    it('should pass previousDrafts to Cloud Function to avoid repetition', async () => {
      const mockCloudFunction = jest.fn().mockResolvedValue({
        data: {
          text: 'A completely new response!',
          confidence: 78,
        },
      });

      (httpsCallable as jest.Mock).mockReturnValue(mockCloudFunction);

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const previousDrafts = ['Previous draft 1', 'Previous draft 2'];
      await service.regenerateDraft('conv123', 'msg456', previousDrafts);

      expect(mockCloudFunction).toHaveBeenCalledWith({
        conversationId: 'conv123',
        incomingMessageId: 'msg456',
        previousDrafts: ['Previous draft 1', 'Previous draft 2'],
        draftMode: true,
      });
    });

    it('should handle regeneration errors gracefully', async () => {
      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockRejectedValue(new Error('Generation failed'))
      );

      const result = await service.regenerateDraft('conv123', 'msg456', ['Previous draft']);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Generation failed');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Helper Methods', () => {
    it('should calculate confidence based on voice profile metrics', async () => {
      // Test via generateDraft since calculateConfidence is private
      const mockCloudFunctionResponse = {
        data: {
          text: 'Test response',
          // No confidence from Cloud Function
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      // Mock excellent voice profile metrics
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 95,
            averageSatisfactionRating: 5.0,
          },
        }),
      });

      const result = await service.generateDraft('conv123', 'msg456');

      expect(result.success).toBe(true);
      // Confidence should be high: (95/100) * 60 + (5.0/5) * 40 = 57 + 40 = 97 clamped to 95
      expect(result.draft?.confidence).toBe(95);
    });

    it('should return default confidence when no voice profile exists', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Test response',
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      // Mock no voice profile
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const result = await service.generateDraft('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.draft?.confidence).toBe(60); // Default for no profile
    });

    it('should generate base personalization suggestions for unknown categories', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Generic response',
          confidence: 75,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'unknown_category');

      expect(result.success).toBe(true);
      expect(result.draft?.personalizationSuggestions).toHaveLength(3);
      expect(result.draft?.personalizationSuggestions[0].text).toContain('specific detail');
      expect(result.draft?.personalizationSuggestions[1].text).toContain('callback');
      expect(result.draft?.personalizationSuggestions[2].text).toContain('question');
    });

    it('should not require editing for standard confidence fan engagement', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'Thanks for being a fan!',
          confidence: 80,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'fan_engagement');

      expect(result.success).toBe(true);
      expect(result.draft?.requiresEditing).toBe(false);
    });

    it('should require editing for urgent/crisis messages', async () => {
      const mockCloudFunctionResponse = {
        data: {
          text: 'I understand your concern.',
          confidence: 85,
        },
      };

      (httpsCallable as jest.Mock).mockReturnValue(
        jest.fn().mockResolvedValue(mockCloudFunctionResponse)
      );

      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({ metrics: {} }),
      });

      const result = await service.generateDraft('conv123', 'msg456', 'crisis');

      expect(result.success).toBe(true);
      expect(result.draft?.requiresEditing).toBe(true);
    });
  });
});
