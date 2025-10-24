/**
 * AI Client Service for communicating with Vercel Edge Functions
 * @remarks
 * This service handles all client-side AI operations by calling Edge Functions.
 * Never call Edge Functions directly from components - use this service layer.
 * All operations include authentication via Firebase Auth tokens.
 */

import { Config } from '@/constants/Config';
import { getFirebaseAuth } from './firebase';
import { trackOperationStart, trackOperationEnd } from './aiPerformanceService';
import { generateCacheKey, getCachedResult, setCachedResult, isCachingEnabled } from './aiCacheService';
import { checkUserBudgetStatus } from './aiAvailabilityService';
import { checkRateLimit, incrementOperationCount } from './aiRateLimitService';

/**
 * Message category types (matches Edge Function response)
 */
export type MessageCategory =
  | 'fan_engagement'
  | 'business_opportunity'
  | 'spam'
  | 'urgent'
  | 'general';

/**
 * Opportunity type for business opportunity categorization (Story 5.6)
 */
export type OpportunityType = 'sponsorship' | 'collaboration' | 'partnership' | 'sale';

/**
 * Result from Edge Function categorization, sentiment analysis, and opportunity scoring (Story 5.6)
 * @remarks
 * Extended in Story 5.3 to include sentiment analysis fields.
 * Extended in Story 5.6 to include business opportunity scoring fields.
 * The Edge Function now returns categorization, sentiment, and opportunity data in a single API call.
 */
export interface CategorizationResult {
  /** Whether categorization succeeded */
  success: boolean;

  // Categorization fields (Story 5.2)
  /** The assigned category */
  category: MessageCategory;
  /** Confidence score (0-1) */
  confidence: number;

  // Sentiment analysis fields (Story 5.3)
  /**
   * Sentiment classification
   * @remarks
   * One of: 'positive', 'negative', 'neutral', 'mixed'
   */
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';

  /**
   * Sentiment score on -1 to 1 scale
   * @remarks
   * -1 = very negative, 0 = neutral, +1 = very positive
   * Scores < -0.5 automatically trigger "urgent" category
   * Scores < -0.7 trigger crisis detection
   */
  sentimentScore: number;

  /**
   * Array of emotional tones detected
   * @remarks
   * Examples: ['excited', 'grateful', 'frustrated', 'angry', 'hopeful']
   */
  emotionalTone: string[];

  /**
   * Whether crisis situation was detected
   * @remarks
   * True when sentimentScore < -0.7
   * Triggers high-priority notifications
   */
  crisisDetected: boolean;

  // Opportunity scoring fields (Story 5.6)
  /**
   * Business opportunity score (0-100)
   * @remarks
   * Only present when category is 'business_opportunity'.
   * Scores >= 70 are high-value opportunities.
   */
  opportunityScore?: number;

  /**
   * Type of business opportunity detected
   * @remarks
   * Only present when category is 'business_opportunity'.
   */
  opportunityType?: OpportunityType;

  /**
   * Detected business keywords and signals
   * @remarks
   * Array of keywords that contributed to the opportunity score.
   * Examples: ['brand collaboration', 'budget discussion', 'compensation']
   */
  opportunityIndicators?: string[];

  /**
   * AI-generated opportunity analysis summary
   * @remarks
   * Brief 1-sentence summary of the opportunity from GPT-4 Turbo.
   * Only present when category is 'business_opportunity'.
   */
  opportunityAnalysis?: string;

  // Metadata
  /** Categorization, sentiment analysis, and opportunity scoring latency in milliseconds */
  latency: number;
  /** Model(s) used for analysis (e.g., 'gpt-4o-mini' or 'gpt-4o-mini + gpt-4-turbo') */
  model: string;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Error types for AI operations
 */
export enum AIErrorType {
  /** Network connection error */
  NETWORK = 'network',
  /** Authentication failed */
  UNAUTHORIZED = 'unauthorized',
  /** Rate limit exceeded */
  RATE_LIMIT = 'rate_limit',
  /** AI service unavailable */
  SERVICE_UNAVAILABLE = 'service_unavailable',
  /** Invalid request parameters */
  INVALID_REQUEST = 'invalid_request',
  /** Unknown error */
  UNKNOWN = 'unknown',
}

/**
 * Custom error class for AI operations
 */
export class AIError extends Error {
  constructor(
    public type: AIErrorType,
    public userMessage: string,
    public technicalMessage?: string,
    public retryable: boolean = false
  ) {
    super(userMessage);
    this.name = 'AIError';
  }
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
};

/**
 * Sleep utility for retry delays
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(2, attempt);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * AI Client Service class
 * Handles communication with Vercel Edge Functions for AI operations
 */
class AIClientService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = Config.ai.vercelEdgeUrl;

    if (!this.baseUrl) {
      console.warn('EXPO_PUBLIC_VERCEL_EDGE_URL not configured. AI features will not work.');
    }
  }

  /**
   * Get Firebase Auth ID token for current user
   * @returns Promise resolving to auth token
   * @throws {AIError} When user is not authenticated
   */
  private async getAuthToken(): Promise<string> {
    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new AIError(
          AIErrorType.UNAUTHORIZED,
          'You must be signed in to use AI features',
          'No authenticated user found',
          false
        );
      }

      const token = await currentUser.getIdToken();
      return token;
    } catch (error) {
      if (error instanceof AIError) {
        throw error;
      }
      throw new AIError(
        AIErrorType.UNAUTHORIZED,
        'Failed to get authentication token',
        error instanceof Error ? error.message : 'Unknown error',
        false
      );
    }
  }

  /**
   * Categorize a message using Edge Function
   *
   * @param messageId - Unique message identifier
   * @param messageText - Message text content to categorize
   * @param conversationId - Parent conversation ID
   * @param senderId - User ID who sent the message
   * @param retryConfig - Optional retry configuration
   * @returns Promise resolving to categorization result
   * @throws {AIError} When categorization fails after all retries
   *
   * @example
   * ```typescript
   * try {
   *   const result = await aiClientService.categorizeMessage(
   *     'msg123',
   *     'Love your content!',
   *     'conv456',
   *     'user789'
   *   );
   *   console.log(`Category: ${result.category}, Confidence: ${result.confidence}`);
   * } catch (error) {
   *   if (error instanceof AIError) {
   *     console.error('AI error:', error.userMessage);
   *   }
   * }
   * ```
   */
  async categorizeMessage(
    messageId: string,
    messageText: string,
    conversationId: string,
    senderId: string,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
  ): Promise<CategorizationResult> {
    // Start performance tracking
    const operationId = `categorize_${messageId}_${Date.now()}`;
    trackOperationStart(operationId, 'categorization');

    // Check if AI is enabled
    if (!Config.ai.aiEnabled) {
      throw new AIError(
        AIErrorType.SERVICE_UNAVAILABLE,
        'AI features are currently disabled',
        'Config.ai.aiEnabled is false',
        false
      );
    }

    // Check if user's AI features are disabled due to budget
    const budgetStatus = await checkUserBudgetStatus(senderId);
    if (!budgetStatus.enabled) {
      throw new AIError(
        AIErrorType.SERVICE_UNAVAILABLE,
        budgetStatus.message || 'AI features are temporarily disabled',
        `Budget disabled: ${budgetStatus.disabledReason}`,
        false
      );
    }

    // Check rate limit for categorization operation
    const rateLimitCheck = await checkRateLimit(senderId, 'categorization');
    if (!rateLimitCheck.allowed) {
      throw new AIError(
        AIErrorType.RATE_LIMIT,
        rateLimitCheck.status.message || 'Rate limit exceeded',
        `Rate limit: ${rateLimitCheck.reason}`,
        false
      );
    }

    // Check if base URL is configured
    if (!this.baseUrl) {
      throw new AIError(
        AIErrorType.INVALID_REQUEST,
        'AI service not configured',
        'EXPO_PUBLIC_VERCEL_EDGE_URL not set',
        false
      );
    }

    let lastError: AIError | null = null;

    // Check cache first (if caching enabled for categorization)
    if (isCachingEnabled('categorization')) {
      const cacheKey = generateCacheKey(messageText, 'categorization');
      const cachedResult = await getCachedResult(cacheKey, senderId);

      if (cachedResult) {
        console.log(`[aiClientService] Cache hit for message ${messageId}`);

        // Track performance with cache hit flag
        await trackOperationEnd(operationId, {
          userId: senderId,
          operation: 'categorization',
          success: true,
          modelUsed: cachedResult.model || 'gpt-4o-mini',
          tokensUsed: { prompt: 0, completion: 0, total: 0 }, // No tokens used for cache hit
          costCents: 0, // No cost for cache hit
          cacheHit: true,
          cacheKey,
        });

        return cachedResult;
      }
    }

    let cacheKey: string | undefined;
    if (isCachingEnabled('categorization')) {
      cacheKey = generateCacheKey(messageText, 'categorization');
    }

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        // Get authentication token
        const authToken = await this.getAuthToken();

        // Build request URL
        const url = `${this.baseUrl}/api/categorize-message`;

        // Build request body
        const requestBody = {
          messageId,
          messageText,
          conversationId,
          senderId,
        };

        // Make request to Edge Function
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(requestBody),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new AIError(
            AIErrorType.RATE_LIMIT,
            'Too many requests. Please try again in a moment.',
            `Rate limit exceeded. Retry after: ${retryAfter}`,
            true
          );
        }

        // Handle auth errors
        if (response.status === 401) {
          throw new AIError(
            AIErrorType.UNAUTHORIZED,
            'Authentication failed. Please sign in again.',
            'Edge Function returned 401',
            false
          );
        }

        // Handle invalid requests
        if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new AIError(
            AIErrorType.INVALID_REQUEST,
            'Invalid request. Please try again.',
            errorData.error || 'Bad request',
            false
          );
        }

        // Handle service unavailable
        if (response.status === 503) {
          throw new AIError(
            AIErrorType.SERVICE_UNAVAILABLE,
            'AI service is temporarily unavailable. Please try again.',
            'Edge Function returned 503',
            true
          );
        }

        // Handle other errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new AIError(
            AIErrorType.UNKNOWN,
            'Categorization failed. Please try again.',
            `HTTP ${response.status}: ${errorData.error || 'Unknown error'}`,
            true
          );
        }

        // Parse successful response
        const result: CategorizationResult = await response.json();

        // Validate response
        if (!result.success) {
          throw new AIError(
            AIErrorType.UNKNOWN,
            result.error || 'Categorization failed',
            'Edge Function returned success: false',
            true
          );
        }

        // Cache the result (if caching enabled)
        if (cacheKey && isCachingEnabled('categorization')) {
          await setCachedResult(cacheKey, senderId, 'categorization', result);
        }

        // Track successful operation performance
        // Note: Token counts and costs will be added in Task 4 (Cost Monitoring Service)
        await trackOperationEnd(operationId, {
          userId: senderId,
          operation: 'categorization',
          success: true,
          modelUsed: result.model || 'gpt-4o-mini',
          tokensUsed: { prompt: 0, completion: 0, total: 0 }, // Placeholder - will be populated in Task 4
          costCents: 0, // Placeholder - will be calculated in Task 4
          cacheHit: false,
          cacheKey,
        });

        // Increment rate limit counter for successful operation
        await incrementOperationCount(senderId, 'categorization');

        return result;
      } catch (error) {
        // Convert to AIError if not already
        if (error instanceof AIError) {
          lastError = error;
        } else if (error instanceof TypeError && error.message.includes('fetch')) {
          // Network error
          lastError = new AIError(
            AIErrorType.NETWORK,
            'Network error. Please check your connection.',
            error.message,
            true
          );
        } else {
          lastError = new AIError(
            AIErrorType.UNKNOWN,
            'An unexpected error occurred',
            error instanceof Error ? error.message : 'Unknown error',
            true
          );
        }

        // Track failed operation if this is the last attempt
        if (!lastError.retryable || attempt === retryConfig.maxRetries) {
          const errorType =
            lastError.type === AIErrorType.NETWORK ? 'network' :
            lastError.type === AIErrorType.RATE_LIMIT ? 'rate_limit' :
            lastError.type === AIErrorType.SERVICE_UNAVAILABLE ? 'timeout' :
            'unknown';

          await trackOperationEnd(operationId, {
            userId: senderId,
            operation: 'categorization',
            success: false,
            errorType,
            modelUsed: 'gpt-4o-mini', // Default model
            tokensUsed: { prompt: 0, completion: 0, total: 0 },
            costCents: 0,
            cacheHit: false,
          });
        }

        // Don't retry if error is not retryable
        if (!lastError.retryable) {
          throw lastError;
        }

        // Don't retry on the last attempt
        if (attempt === retryConfig.maxRetries) {
          break;
        }

        // Calculate and apply exponential backoff delay
        const delay = calculateBackoffDelay(attempt, retryConfig);
        console.log(`Categorization attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    // All retries exhausted - error tracking already done above
    throw new AIError(
      lastError?.type || AIErrorType.UNKNOWN,
      `Categorization failed after ${retryConfig.maxRetries + 1} attempts. ${lastError?.userMessage || ''}`,
      lastError?.technicalMessage,
      false
    );
  }

  /**
   * Check if AI features are available
   * @returns True if AI features are enabled and configured
   */
  isAvailable(): boolean {
    return Config.ai.aiEnabled && !!this.baseUrl;
  }
}

/**
 * Singleton instance of AIClientService
 */
export const aiClientService = new AIClientService();
