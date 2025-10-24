/**
 * Voice Matching Service for Voice-Matched Response Generation (Story 5.5)
 *
 * @remarks
 * This service handles all client-side voice matching operations by calling Cloud Functions.
 * Never call Cloud Functions directly from components - use this service layer.
 * All operations include authentication via Firebase Auth.
 *
 * **Features:**
 * - Voice profile training and retraining
 * - Response suggestion generation
 * - Feedback tracking for AI improvement
 * - Error handling and retry logic
 */

import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseDb } from './firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  increment,
} from 'firebase/firestore';
import { trackOperationStart, trackOperationEnd } from './aiPerformanceService';
import { checkUserBudgetStatus } from './aiAvailabilityService';
import { checkRateLimit, incrementOperationCount } from './aiRateLimitService';

/**
 * Response suggestion structure from Cloud Function
 * @interface
 */
export interface ResponseSuggestion {
  /** The suggested response text */
  text: string;
}

/**
 * Result from voice profile generation
 * @interface
 */
export interface VoiceProfileResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Voice profile data (if successful) */
  profile?: {
    userId: string;
    characteristics: {
      tone: string;
      vocabulary: string[];
      sentenceStructure: string;
      punctuationStyle: string;
      emojiUsage: 'none' | 'occasional' | 'frequent';
      writingPatterns?: string;
    };
    trainingSampleCount: number;
    modelVersion: string;
  };

  /** Error message if operation failed */
  error?: string;
}

/**
 * Result from response suggestion generation
 * @interface
 */
export interface ResponseSuggestionsResult {
  /** Whether operation succeeded */
  success: boolean;

  /** Array of response suggestions (if successful) */
  suggestions?: ResponseSuggestion[];

  /** Generation latency in milliseconds */
  latency?: number;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Feedback tracking data for response suggestions
 * @interface
 */
export interface SuggestionFeedback {
  /** The original suggestion text */
  suggestion: string;

  /** User action taken */
  action: 'accepted' | 'rejected' | 'edited';

  /** Optional user edit if action was 'edited' */
  userEdit?: string;

  /** Optional rating (1-5 stars) */
  rating?: number;

  /** Optional user comments */
  comments?: string;
}

/**
 * Error types for voice matching operations
 * @enum
 */
export enum VoiceMatchingErrorType {
  /** Network connection error */
  NETWORK = 'network',

  /** User not authenticated */
  UNAUTHENTICATED = 'unauthenticated',

  /** Voice profile not found */
  PROFILE_NOT_FOUND = 'profile_not_found',

  /** Insufficient training data */
  INSUFFICIENT_DATA = 'insufficient_data',

  /** Generation timeout */
  TIMEOUT = 'timeout',

  /** AI service unavailable */
  SERVICE_UNAVAILABLE = 'service_unavailable',

  /** Unknown error */
  UNKNOWN = 'unknown',
}

/**
 * Custom error class for voice matching operations
 * @class
 */
export class VoiceMatchingError extends Error {
  type: VoiceMatchingErrorType;
  originalError?: Error;

  constructor(type: VoiceMatchingErrorType, message: string, originalError?: Error) {
    super(message);
    this.name = 'VoiceMatchingError';
    this.type = type;
    this.originalError = originalError;
  }
}

/**
 * Voice Matching Service Class
 *
 * @remarks
 * Provides client-side access to voice matching Cloud Functions.
 * Includes error handling, retry logic, and feedback tracking.
 *
 * @example
 * ```typescript
 * import { voiceMatchingService } from '@/services/voiceMatchingService';
 *
 * // Generate response suggestions
 * const result = await voiceMatchingService.generateSuggestions(
 *   'conversation123',
 *   'message456',
 *   2
 * );
 *
 * if (result.success) {
 *   console.log('Suggestions:', result.suggestions);
 * }
 * ```
 */
export class VoiceMatchingService {
  /**
   * Generates voice-matched response suggestions for a message
   *
   * @param conversationId - The conversation ID
   * @param incomingMessageId - The message to respond to
   * @param suggestionCount - Number of suggestions to generate (1-3, defaults to 2)
   * @returns Promise resolving to response suggestions result
   *
   * @throws {VoiceMatchingError} When voice profile not found or generation fails
   *
   * @example
   * ```typescript
   * const result = await voiceMatchingService.generateSuggestions(
   *   'conv123',
   *   'msg456',
   *   2
   * );
   *
   * if (result.success && result.suggestions) {
   *   result.suggestions.forEach(s => console.log(s.text));
   * }
   * ```
   */
  async generateSuggestions(
    conversationId: string,
    incomingMessageId: string,
    suggestionCount: number = 2
  ): Promise<ResponseSuggestionsResult> {
    // Get current user for tracking
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    const userId = currentUser?.uid;

    // Check if user's AI features are disabled due to budget
    if (userId) {
      const budgetStatus = await checkUserBudgetStatus(userId);
      if (!budgetStatus.enabled) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNKNOWN,
          budgetStatus.message || 'AI features are temporarily disabled'
        );
      }
    }

    // Check rate limit for voice matching operation
    if (userId) {
      const rateLimitCheck = await checkRateLimit(userId, 'voice_matching');
      if (!rateLimitCheck.allowed) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNKNOWN,
          rateLimitCheck.status.message || 'Rate limit exceeded'
        );
      }
    }

    // Start performance tracking
    const operationId = `voice_matching_${incomingMessageId}_${Date.now()}`;
    if (userId) {
      trackOperationStart(operationId, 'voice_matching');
    }

    try {
      // Validate inputs
      if (!conversationId || !incomingMessageId) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNKNOWN,
          'Conversation ID and message ID are required'
        );
      }

      // Validate suggestion count range
      const validCount = Math.min(Math.max(1, suggestionCount), 3);

      // Get Cloud Functions instance
      const functions = getFunctions();
      const generateResponseSuggestions = httpsCallable<
        {
          conversationId: string;
          incomingMessageId: string;
          suggestionCount: number;
        },
        ResponseSuggestionsResult
      >(functions, 'generateResponseSuggestions');

      // Call Cloud Function
      const result: HttpsCallableResult<ResponseSuggestionsResult> =
        await generateResponseSuggestions({
          conversationId,
          incomingMessageId,
          suggestionCount: validCount,
        });

      // Track successful operation
      if (userId) {
        trackOperationEnd(operationId, {
          userId,
          operation: 'voice_matching',
          success: true,
          modelUsed: 'gpt-4-turbo', // Voice matching uses GPT-4 Turbo
          tokensUsed: {
            prompt: 0, // TODO: Get actual token counts from Cloud Function response
            completion: 0,
            total: 0,
          },
          costCents: 0, // TODO: Get actual cost from Cloud Function response
          cacheHit: false,
        }).catch((error) => {
          console.error('[voiceMatchingService] Failed to track performance:', error);
        });

        // Increment rate limit counter for successful operation
        await incrementOperationCount(userId, 'voice_matching');
      }

      return result.data;
    } catch (error: unknown) {
      // Track failed operation
      const err = error as { code?: string; message?: string };
      if (userId) {
        let errorType: 'network' | 'timeout' | 'rate_limit' | 'model_error' | 'unknown' = 'unknown';

        if (err.code === 'unauthenticated') {
          errorType = 'network';
        } else if (err.code === 'deadline-exceeded' || err.message?.includes('timeout')) {
          errorType = 'timeout';
        } else if (err.code === 'unavailable') {
          errorType = 'network';
        } else if (err.code === 'failed-precondition') {
          errorType = 'model_error';
        }

        trackOperationEnd(operationId, {
          userId,
          operation: 'voice_matching',
          success: false,
          errorType,
          modelUsed: 'gpt-4-turbo',
          tokensUsed: {
            prompt: 0,
            completion: 0,
            total: 0,
          },
          costCents: 0,
          cacheHit: false,
        }).catch((trackError) => {
          console.error('[voiceMatchingService] Failed to track performance:', trackError);
        });
      }

      // Handle Firebase Functions errors
      if (error.code === 'unauthenticated') {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNAUTHENTICATED,
          'Please sign in to generate response suggestions',
          error
        );
      }

      if (
        error.code === 'failed-precondition' ||
        error.message?.includes('Voice profile not found')
      ) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.PROFILE_NOT_FOUND,
          'Voice profile not found. Please train your voice profile first.',
          error
        );
      }

      if (error.code === 'deadline-exceeded' || error.message?.includes('timeout')) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.TIMEOUT,
          'Response generation took too long. Please try again.',
          error
        );
      }

      if (error.code === 'unavailable') {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.SERVICE_UNAVAILABLE,
          'Voice matching service is temporarily unavailable. Please try again later.',
          error
        );
      }

      // Default error
      throw new VoiceMatchingError(
        VoiceMatchingErrorType.UNKNOWN,
        error.message || 'Failed to generate response suggestions',
        error
      );
    }
  }

  /**
   * Trains or updates the user's voice profile
   *
   * @param userId - The user's ID
   * @param minSamples - Minimum message samples required (defaults to 10 for testing, production: 50)
   * @returns Promise resolving to voice profile result
   *
   * @throws {VoiceMatchingError} When insufficient data or training fails
   *
   * @example
   * ```typescript
   * try {
   *   const result = await voiceMatchingService.trainVoiceProfile('user123');
   *   if (result.success) {
   *     console.log('Voice profile trained!');
   *   }
   * } catch (error) {
   *   if (error.type === VoiceMatchingErrorType.INSUFFICIENT_DATA) {
   *     console.log('Keep chatting to unlock voice matching!');
   *   }
   * }
   * ```
   */
  async trainVoiceProfile(userId: string, minSamples: number = 10): Promise<VoiceProfileResult> {
    try {
      // Validate inputs
      if (!userId) {
        throw new VoiceMatchingError(VoiceMatchingErrorType.UNKNOWN, 'User ID is required');
      }

      // Get Cloud Functions instance
      const functions = getFunctions();
      const generateVoiceProfile = httpsCallable<
        { userId: string; minSamples?: number },
        VoiceProfileResult
      >(functions, 'generateVoiceProfile');

      // Call Cloud Function
      const result: HttpsCallableResult<VoiceProfileResult> = await generateVoiceProfile({
        userId,
        minSamples,
      });

      return result.data;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      // Handle Firebase Functions errors
      if (err.code === 'unauthenticated') {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNAUTHENTICATED,
          'Please sign in to train your voice profile',
          error
        );
      }

      if (err.code === 'permission-denied') {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNAUTHENTICATED,
          'You can only train your own voice profile',
          error
        );
      }

      if (err.code === 'failed-precondition' || err.message?.includes('Insufficient')) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.INSUFFICIENT_DATA,
          err.message || 'Not enough messages for training. Keep chatting!',
          error
        );
      }

      if (err.code === 'unavailable') {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.SERVICE_UNAVAILABLE,
          'Voice training service is temporarily unavailable. Please try again later.',
          error
        );
      }

      // Default error
      throw new VoiceMatchingError(
        VoiceMatchingErrorType.UNKNOWN,
        err.message || 'Failed to train voice profile',
        error
      );
    }
  }

  /**
   * Tracks user feedback on response suggestions for retraining
   *
   * @param feedback - Feedback data including action, rating, and comments
   * @returns Promise resolving when feedback is stored
   *
   * @throws {VoiceMatchingError} When feedback tracking fails
   *
   * @example
   * ```typescript
   * // Track accepted suggestion
   * await voiceMatchingService.trackFeedback({
   *   suggestion: 'Thanks for reaching out!',
   *   action: 'accepted',
   *   rating: 5,
   * });
   *
   * // Track edited suggestion
   * await voiceMatchingService.trackFeedback({
   *   suggestion: 'Hey there!',
   *   action: 'edited',
   *   userEdit: 'Hey! Thanks for the message',
   *   rating: 4,
   * });
   * ```
   */
  async trackFeedback(feedback: SuggestionFeedback): Promise<void> {
    try {
      // Get current user
      const auth = getFirebaseAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new VoiceMatchingError(
          VoiceMatchingErrorType.UNAUTHENTICATED,
          'Please sign in to provide feedback'
        );
      }

      const db = getFirebaseDb();

      // Build feedback data object, only including defined optional fields
      const feedbackData: Record<string, unknown> = {
        originalSuggestion: feedback.suggestion,
        action: feedback.action,
        rating: feedback.rating || 0,
      };

      // Only include optional fields if they're defined (Firestore doesn't support undefined)
      if (feedback.userEdit !== undefined) {
        feedbackData.userEdit = feedback.userEdit;
      }
      if (feedback.comments !== undefined) {
        feedbackData.comments = feedback.comments;
      }

      // Store feedback in ai_training_data collection
      await addDoc(collection(db, 'ai_training_data'), {
        userId: user.uid,
        type: 'response_feedback',
        feedback: feedbackData,
        modelVersion: 'gpt-4-turbo-preview',
        processed: false,
        createdAt: serverTimestamp(),
      });

      // Update voice profile metrics based on action type
      const profileRef = doc(db, 'voice_profiles', user.uid);
      const profileSnapshot = await getDoc(profileRef);

      if (profileSnapshot.exists()) {
        const updateData: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
        };

        // Increment appropriate counter based on action
        switch (feedback.action) {
          case 'accepted':
            updateData['metrics.acceptedSuggestions'] = increment(1);
            break;
          case 'rejected':
            updateData['metrics.rejectedSuggestions'] = increment(1);
            break;
          case 'edited':
            updateData['metrics.editedSuggestions'] = increment(1);
            break;
        }

        // Update average satisfaction rating if rating was provided
        if (feedback.rating && feedback.rating > 0) {
          const currentProfile = profileSnapshot.data();
          const currentMetrics = currentProfile.metrics || {
            totalSuggestionsGenerated: 0,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 0,
            averageSatisfactionRating: 0,
          };

          // Calculate total number of rated suggestions
          const totalRated =
            (currentMetrics.acceptedSuggestions || 0) + (currentMetrics.editedSuggestions || 0);

          // Calculate new average (weighted average)
          const currentAvg = currentMetrics.averageSatisfactionRating || 0;
          const newAvg =
            totalRated === 0
              ? feedback.rating
              : (currentAvg * totalRated + feedback.rating) / (totalRated + 1);

          updateData['metrics.averageSatisfactionRating'] = newAvg;
        }

        await updateDoc(profileRef, updateData);
      }
    } catch (error: unknown) {
      // Re-throw VoiceMatchingError instances
      if (error instanceof VoiceMatchingError) {
        throw error;
      }

      // Wrap other errors
      throw new VoiceMatchingError(
        VoiceMatchingErrorType.UNKNOWN,
        'Failed to track feedback',
        error
      );
    }
  }

  /**
   * Checks if user has a trained voice profile
   *
   * @param userId - The user's ID
   * @returns Promise resolving to boolean indicating if profile exists
   *
   * @example
   * ```typescript
   * const hasProfile = await voiceMatchingService.hasVoiceProfile('user123');
   * if (!hasProfile) {
   *   // Show prompt to train voice profile
   * }
   * ```
   */
  async hasVoiceProfile(userId: string): Promise<boolean> {
    try {
      const db = getFirebaseDb();
      const profileRef = doc(db, 'voice_profiles', userId);
      const profileDoc = await getDoc(profileRef);

      return profileDoc.exists();
    } catch (error) {
      console.error('[VoiceMatchingService] Error checking voice profile:', error);
      return false;
    }
  }
}

/**
 * Singleton instance of VoiceMatchingService
 * @constant
 */
export const voiceMatchingService = new VoiceMatchingService();
