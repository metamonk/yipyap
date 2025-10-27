import { Timestamp } from 'firebase/firestore';

/**
 * Represents a chat conversation between users
 *
 * @remarks
 * Conversations can be either direct (1:1) or group chats.
 * For direct chats, the conversation ID is deterministic based on participant IDs.
 * For group chats, the conversation ID is randomly generated.
 *
 * Firestore Collection Path: `/conversations/{conversationId}`
 *
 * @example
 * ```typescript
 * const conversation: Conversation = {
 *   id: 'user123_user456',
 *   type: 'direct',
 *   participantIds: ['user123', 'user456'],
 *   lastMessage: {
 *     text: 'Hello!',
 *     senderId: 'user123',
 *     timestamp: Timestamp.now()
 *   },
 *   lastMessageTimestamp: Timestamp.now(),
 *   unreadCount: { 'user456': 1 },
 *   archivedBy: {},
 *   deletedBy: {},
 *   mutedBy: {},
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface Conversation {
  /** Unique conversation identifier (deterministic for direct, random for group) */
  id: string;

  /** Type of conversation */
  type: 'direct' | 'group';

  /** Array of user IDs participating in this conversation (indexed for queries) */
  participantIds: string[];

  /** Group name (only for group conversations) */
  groupName?: string;

  /** Group photo URL (only for group conversations) */
  groupPhotoURL?: string;

  /** User ID of the group creator (only for group conversations) */
  creatorId?: string;

  /** Array of user IDs with admin privileges (only for group conversations) */
  adminIds?: string[];

  /** Preview of the most recent message */
  lastMessage: {
    /** Text content of the last message */
    text: string;

    /** User ID of the message sender */
    senderId: string;

    /** Timestamp when the message was sent */
    timestamp: Timestamp;
  };

  /** Timestamp of the last message (indexed for sorting conversations) */
  lastMessageTimestamp: Timestamp;

  /** Per-user unread message counts */
  unreadCount: Record<string, number>;

  /** Per-user archive status map. If userId maps to true, conversation is archived for that user. */
  archivedBy: Record<string, boolean>;

  /** Per-user soft deletion status (true if deleted by that user) */
  deletedBy: Record<string, boolean>;

  /** Per-user mute status (true if muted by that user) */
  mutedBy: Record<string, boolean>;

  /** Timestamp when the conversation was created */
  createdAt: Timestamp;

  /** Timestamp when the conversation was last updated */
  updatedAt: Timestamp;

  /**
   * Category statistics for AI-categorized messages (Story 5.2)
   * @remarks
   * NEW field added in Story 5.2 for message categorization feature.
   * Enables efficient category filtering in conversation list without querying all messages.
   * Updated automatically when messages are categorized.
   */
  categoryStats?: {
    /** Category of the most recent message in this conversation */
    lastCategory?: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';

    /** Count of messages by category (e.g., { urgent: 3, fan_engagement: 12 }) */
    categoryCounts?: Record<string, number>;

    /** Quick flag indicating if conversation has any urgent messages */
    hasUrgent?: boolean;
  };

  /**
   * Sentiment statistics for sentiment-analyzed messages (Story 5.3)
   * @remarks
   * NEW field added in Story 5.3 for sentiment analysis and crisis detection.
   * Tracks sentiment history and crisis events for pattern analysis.
   * Updated automatically when messages are analyzed for sentiment.
   */
  sentimentStats?: {
    /**
     * Sentiment classification of the most recent message
     * @remarks
     * One of: 'positive', 'negative', 'neutral', 'mixed'
     */
    lastSentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';

    /**
     * Sentiment score of the most recent message (-1 to 1)
     * @remarks
     * -1 = very negative, 0 = neutral, +1 = very positive
     */
    lastSentimentScore?: number;

    /**
     * Count of negative messages in this conversation
     * @remarks
     * Tracks cumulative count of messages with negative sentiment (score < -0.3)
     * Used for pattern analysis and conversation prioritization
     */
    negativeCount?: number;

    /**
     * Flag indicating if conversation has active crisis situation
     * @remarks
     * Set to true when a message with sentimentScore < -0.7 is detected
     * Triggers high-priority notifications and UI highlighting
     */
    hasCrisis?: boolean;

    /**
     * Timestamp of the most recent crisis detection
     * @remarks
     * Used to track when crisis situations occur and for analytics
     * Only set when hasCrisis is true
     */
    lastCrisisAt?: Timestamp;
  };

  /**
   * Whether FAQ auto-response is enabled for this conversation (Story 5.4)
   * @remarks
   * NEW field added in Story 5.4 for FAQ auto-response feature.
   * When true (default), matching FAQs trigger automatic responses.
   * When false, FAQ detection runs but no auto-response is sent.
   * Creators can toggle this per conversation for manual control.
   * Default: true
   */
  autoResponseEnabled?: boolean;

  /**
   * Advanced auto-response settings (Story 5.4)
   * @remarks
   * Optional configuration for fine-tuning FAQ auto-response behavior.
   * If not set, default behavior applies (unlimited, no approval required).
   */
  autoResponseSettings?: {
    /**
     * Whether auto-response is enabled
     * @remarks
     * Mirrors autoResponseEnabled for backwards compatibility
     */
    enabled: boolean;

    /**
     * Maximum auto-responses per day (optional)
     * @remarks
     * Limits number of auto-responses sent in 24-hour period
     * Prevents spam if FAQ matching is too aggressive
     * Default: unlimited (no limit)
     */
    maxPerDay?: number;

    /**
     * Require manual approval before sending (optional)
     * @remarks
     * When true, show preview instead of sending automatically
     * Useful for sensitive conversations or quality control
     * Default: false (send automatically)
     */
    requireApproval?: boolean;
  };
}

/**
 * Represents a chat message within a conversation (both 1:1 and group)
 *
 * @remarks
 * Messages are stored as subcollections under conversations.
 * Messages are immutable once sent and include metadata for future AI processing.
 * The metadata field is prepared for Phase 2 AI features (categorization, sentiment analysis).
 * Message structure is identical for both direct and group conversations.
 * In group chats, senderId is used to identify and display sender attribution.
 *
 * Firestore Collection Path: `/conversations/{conversationId}/messages/{messageId}`
 *
 * @example
 * ```typescript
 * const message: Message = {
 *   id: 'msg123',
 *   conversationId: 'user123_user456',
 *   senderId: 'user123',
 *   text: 'Hello, how are you?',
 *   status: 'delivered',
 *   readBy: ['user123'],
 *   timestamp: Timestamp.now(),
 *   metadata: {
 *     aiProcessed: false
 *   }
 * };
 * ```
 */
export interface Message {
  /** Unique message identifier (Firestore document ID) */
  id: string;

  /** ID of the parent conversation this message belongs to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Message text content (1-1000 characters) */
  text: string;

  /** Current delivery status of the message */
  status: 'sending' | 'delivered' | 'read';

  /** Array of user IDs who have read this message */
  readBy: string[];

  /** Server timestamp when the message was created (indexed for ordering) */
  timestamp: Timestamp;

  /** Metadata for AI features (Phase 2) */
  metadata: {
    /**
     * AI-assigned message category (Story 5.2)
     * @remarks
     * Automatically assigned by Edge Function categorization:
     * - fan_engagement: General fan messages, compliments, casual conversation
     * - business_opportunity: Sponsorship inquiries, collaboration requests
     * - spam: Promotional content, suspicious links, irrelevant messages
     * - urgent: Negative sentiment, crisis situations, time-sensitive requests
     * - general: Default category for low-confidence results
     */
    category?: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';

    /**
     * Confidence score for the assigned category (0-1 range)
     * @remarks
     * Scores below 0.7 result in category defaulting to 'general'
     */
    categoryConfidence?: number;

    /**
     * Sentiment classification result (Story 5.3)
     * @remarks
     * Automatically determined by sentiment analysis:
     * - positive: Positive emotional tone (score > 0.3)
     * - negative: Negative emotional tone (score < -0.3)
     * - neutral: Neutral emotional tone (score between -0.3 and 0.3)
     * - mixed: Conflicting emotional tones detected
     */
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';

    /**
     * Sentiment score on -1 to 1 scale (Story 5.3)
     * @remarks
     * Numerical sentiment rating:
     * - 1.0 to 0.5: Very positive to moderately positive
     * - 0.5 to -0.5: Neutral range
     * - -0.5 to -1.0: Moderately negative to very negative
     * - Scores < -0.5 automatically trigger "urgent" category
     * - Scores < -0.7 trigger crisis detection
     */
    sentimentScore?: number;

    /**
     * Array of emotional tones detected in the message (Story 5.3)
     * @remarks
     * Examples: ['excited', 'grateful', 'frustrated', 'curious', 'angry', 'hopeful']
     * Multiple tones can be present simultaneously (e.g., mixed sentiment)
     */
    emotionalTone?: string[];

    /** Whether AI processing has been completed */
    aiProcessed?: boolean;

    /**
     * Timestamp when AI processing was completed (Story 5.3)
     * @remarks
     * Used to track processing latency and debug AI operations
     */
    aiProcessedAt?: Timestamp;

    /**
     * AI model version used for processing (Story 5.3)
     * @remarks
     * Example: 'gpt-4o-mini'
     * Helps track which model version was used for analysis
     */
    aiVersion?: string;

    /**
     * Whether this message matches an FAQ template (Story 5.4)
     * @remarks
     * Set to true when message semantically matches a creator's FAQ template
     * with confidence > 0.85. Triggers automatic response workflow.
     */
    isFAQ?: boolean;

    /**
     * Matched FAQ template ID (Story 5.4)
     * @remarks
     * Reference to the FAQ template document in faq_templates collection
     * Only set when isFAQ is true
     */
    faqTemplateId?: string;

    /**
     * FAQ match confidence score 0-1 (Story 5.4)
     * @remarks
     * Cosine similarity score from Pinecone vector search
     * - 0.85+: High confidence - auto-response triggered
     * - 0.70-0.84: Medium confidence - suggested to creator
     * - <0.70: Low confidence - no FAQ match
     */
    faqMatchConfidence?: number;

    /**
     * Whether an automatic response was sent for this message (Story 5.4)
     * @remarks
     * Set to true when an auto-response message is created and sent.
     * Used to display "Auto-replied" badge in UI
     */
    autoResponseSent?: boolean;

    /**
     * Auto-response message ID (Story 5.4)
     * @remarks
     * Reference to the message document that contains the auto-response
     * Links the original message to its automatic reply
     */
    autoResponseId?: string;

    /**
     * Display name of the message sender (Fallback for auto-responses)
     * @remarks
     * Used as a fallback when the sender's user profile cannot be loaded.
     * Primarily set for auto-response messages to ensure the recipient
     * always sees the sender's name even if the profile is missing.
     * Added to fix issue where auto-responses showed "Unknown" sender.
     */
    senderDisplayName?: string;

    /**
     * Suggested FAQ for creator approval (Story 5.4)
     * @remarks
     * Set when FAQ match has medium confidence (0.70-0.84)
     * Creator can manually approve and send the suggested response
     */
    suggestedFAQ?: {
      /** FAQ template ID */
      templateId: string;

      /** FAQ question text */
      question: string;

      /** FAQ answer text */
      answer: string;

      /** Match confidence score */
      confidence: number;
    };

    /**
     * AI-generated response suggestion (Story 5.5)
     * @remarks
     * Voice-matched response suggestion generated by GPT-4 Turbo.
     * Based on the creator's voice profile and conversation context.
     * Presented to creator for acceptance, editing, or rejection.
     */
    suggestedResponse?: string;

    /**
     * Whether the suggested response was approved (Story 5.5)
     * @remarks
     * Set to true when creator marks the suggestion as good quality.
     * Used for tracking voice matching accuracy and retraining.
     */
    suggestedResponseApproved?: boolean;

    /**
     * Whether the creator used the suggestion (Story 5.5)
     * @remarks
     * Set to true when creator accepts and sends the suggested response.
     * Helps measure voice matching effectiveness and user satisfaction.
     */
    suggestionUsed?: boolean;

    /**
     * Whether the creator edited the suggestion before sending (Story 5.5)
     * @remarks
     * Set to true when creator modifies the suggestion before sending.
     * Indicates good direction but not perfect match.
     * Used to refine voice profile in retraining.
     */
    suggestionEdited?: boolean;

    /**
     * Whether the creator rejected the suggestion (Story 5.5)
     * @remarks
     * Set to true when creator dismisses the suggestion without using it.
     * Helps identify when voice matching is off-target.
     * Used to improve suggestion quality in retraining.
     */
    suggestionRejected?: boolean;

    /**
     * User satisfaction rating for the suggestion (Story 5.5)
     * @remarks
     * Optional 1-5 star rating provided by creator.
     * Used to calculate averageSatisfactionRating in voice profile metrics.
     * Helps measure voice matching quality and guide retraining priorities.
     */
    suggestionRating?: number;

    /**
     * Business opportunity score (0-100) (Story 5.6)
     * @remarks
     * Automatically calculated when category is 'business_opportunity'.
     * Scoring algorithm considers:
     * - Brand/sponsorship mentions (+40 points)
     * - Budget/compensation mentions (+30 points)
     * - Partnership/collaboration keywords (+20 points)
     * - Professionalism and seriousness (+10 points)
     * High scores (>= 70) trigger priority notifications and dashboard display.
     */
    opportunityScore?: number;

    /**
     * Type of business opportunity detected (Story 5.6)
     * @remarks
     * Categorizes the business opportunity for filtering and analytics.
     * Only set when opportunityScore is present.
     */
    opportunityType?: 'sponsorship' | 'collaboration' | 'partnership' | 'sale';

    /**
     * Detected business keywords and signals (Story 5.6)
     * @remarks
     * Array of keywords that contributed to the opportunity score.
     * Examples: ['sponsorship deal', 'brand collaboration', 'compensation']
     * Used for debugging and displaying opportunity details to creator.
     */
    opportunityIndicators?: string[];

    /**
     * AI-generated opportunity analysis summary (Story 5.6)
     * @remarks
     * Brief 1-sentence summary of the opportunity from GPT-4 Turbo.
     * Displayed in opportunity cards and notifications.
     * Example: "Brand sponsorship inquiry with budget discussion"
     */
    opportunityAnalysis?: string;
  };
}

/**
 * Input data for creating a new conversation
 *
 * @remarks
 * This type is used when creating conversations and excludes auto-generated fields
 * like timestamps and IDs that are set by the service layer.
 */
export interface CreateConversationInput {
  /** Type of conversation to create */
  type: 'direct' | 'group';

  /** Array of user IDs to include in the conversation */
  participantIds: string[];

  /** Group name (required for group conversations) */
  groupName?: string;

  /** Group photo URL (optional for group conversations) */
  groupPhotoURL?: string;

  /** User ID of the group creator */
  creatorId?: string;

  /** Array of user IDs with admin privileges (optional, defaults to [creatorId]) */
  adminIds?: string[];
}

/**
 * Input parameters for creating a conversation with its first message atomically
 *
 * @remarks
 * This type is used when creating conversations that should only exist after
 * the first message is sent. Supports both direct and group conversations.
 * The conversation and message are created together in a single Firestore transaction.
 *
 * @example
 * ```typescript
 * const params: CreateConversationWithMessageParams = {
 *   type: 'direct',
 *   participantIds: ['user123', 'user456'],
 *   messageText: 'Hello!',
 *   senderId: 'user123'
 * };
 * ```
 */
export interface CreateConversationWithMessageParams {
  /** Type of conversation to create */
  type: 'direct' | 'group';

  /** Array of user IDs to include in the conversation */
  participantIds: string[];

  /** Text content of the first message (1-1000 characters) */
  messageText: string;

  /** User ID of the message sender */
  senderId: string;

  /** Group name (required for group conversations) */
  groupName?: string;

  /** Group photo URL (optional for group conversations) */
  groupPhotoURL?: string;
}

/**
 * Result of creating a conversation with its first message atomically
 *
 * @remarks
 * Returned by createConversationWithFirstMessage() to provide both IDs
 * for navigation and state management purposes.
 *
 * @example
 * ```typescript
 * const result: CreateConversationResult = {
 *   conversationId: 'user123_user456',
 *   messageId: 'msg_abc123'
 * };
 * ```
 */
export interface CreateConversationResult {
  /** ID of the created conversation */
  conversationId: string;

  /** ID of the created first message */
  messageId: string;
}

/**
 * Input data for creating a new message
 *
 * @remarks
 * This type is used when sending messages and excludes auto-generated fields
 * like ID, timestamp, and status that are set by the service layer.
 */
export interface CreateMessageInput {
  /** ID of the conversation to send the message to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Message text content (1-1000 characters) */
  text: string;
}

/**
 * Represents a date separator item in the chat message list
 *
 * @remarks
 * Used to visually separate messages from different days in the chat timeline.
 * Rendered as a centered date label with horizontal lines on both sides.
 */
export interface DateSeparatorItem {
  /** Item type discriminator */
  type: 'separator';

  /** Unique identifier for FlatList key */
  id: string;

  /** Timestamp representing the date for this separator */
  timestamp: Timestamp;
}

/**
 * Represents a message item in the chat message list
 *
 * @remarks
 * Wraps the Message data with type discriminator for FlatList rendering.
 */
export interface MessageListItem {
  /** Item type discriminator */
  type: 'message';

  /** Unique identifier for FlatList key (matches message.id) */
  id: string;

  /** The message data */
  data: Message;
}

/**
 * Union type for chat list items (messages and date separators)
 *
 * @remarks
 * Discriminated union based on 'type' field allows type-safe rendering
 * in FlatList renderItem function.
 */
export type ChatListItem = MessageListItem | DateSeparatorItem;

/**
 * Represents a search result with message and conversation context
 *
 * @remarks
 * Used to display search results with additional context like sender information
 * and conversation details. This allows users to navigate to the specific message
 * within its conversation.
 *
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   message: messageData,
 *   conversationId: 'user123_user456',
 *   conversationName: 'John Doe',
 *   senderName: 'John Doe',
 *   senderPhotoURL: 'https://...'
 * };
 * ```
 */
export interface SearchResult {
  /** The message that matches the search query */
  message: Message;

  /** ID of the conversation containing this message */
  conversationId: string;

  /** Display name of the conversation (other participant name or group name) */
  conversationName: string;

  /** Display name of the message sender */
  senderName: string;

  /** Profile photo URL of the message sender (optional) */
  senderPhotoURL?: string;
}

/**
 * State management interface for message search functionality
 *
 * @remarks
 * Tracks search query, results, loading state, and errors.
 * Used by the useMessageSearch hook to manage search state.
 *
 * @example
 * ```typescript
 * const searchState: SearchState = {
 *   query: 'hello',
 *   results: [message1, message2],
 *   isSearching: false,
 *   error: null
 * };
 * ```
 */
export interface SearchState {
  /** Current search query string */
  query: string;

  /** Array of messages matching the search query */
  results: Message[];

  /** Whether a search operation is in progress */
  isSearching: boolean;

  /** Error message if search fails, null otherwise */
  error: string | null;
}

/**
 * Represents user presence state in Firebase Realtime Database
 *
 * @remarks
 * Stored in RTDB at `/presence/{userId}` for instant status updates.
 * Uses onDisconnect handlers to automatically set offline status.
 * Multi-device support aggregates status across all user devices.
 *
 * @example
 * ```typescript
 * const presence: PresenceData = {
 *   state: 'online',
 *   lastSeen: Date.now(),
 *   devices: {
 *     'device-uuid-123': {
 *       state: 'online',
 *       platform: 'ios',
 *       lastActivity: Date.now(),
 *       appVersion: '1.0.0'
 *     }
 *   }
 * };
 * ```
 */
export interface PresenceData {
  /** User's aggregated presence state (online if any device online) */
  state: 'online' | 'offline' | 'away';

  /** Unix timestamp (ms) of last activity across all devices */
  lastSeen: number;

  /** Per-device presence information for multi-device support */
  devices: Record<string, DevicePresence>;
}

/**
 * Represents presence state for a specific device
 *
 * @remarks
 * Stored under `/presence/{userId}/devices/{deviceId}`.
 * Each device has its own onDisconnect handler for reliable cleanup.
 *
 * @example
 * ```typescript
 * const devicePresence: DevicePresence = {
 *   state: 'online',
 *   platform: 'android',
 *   lastActivity: Date.now(),
 *   appVersion: '1.0.0'
 * };
 * ```
 */
export interface DevicePresence {
  /** Device-specific presence state */
  state: 'online' | 'offline';

  /** Platform this device is running on */
  platform: 'ios' | 'android' | 'web';

  /** Unix timestamp (ms) of last activity on this device */
  lastActivity: number;

  /** App version running on this device (optional) */
  appVersion?: string;
}

/**
 * Represents typing indicator state in Firebase Realtime Database
 *
 * @remarks
 * Stored in RTDB at `/typing/{conversationId}/{userId}`.
 * Auto-cleared via onDisconnect and 3-second timeout.
 *
 * @example
 * ```typescript
 * const typing: TypingIndicator = {
 *   isTyping: true,
 *   timestamp: Date.now()
 * };
 * ```
 */
export interface TypingIndicator {
  /** Whether the user is currently typing */
  isTyping: boolean;

  /** Unix timestamp (ms) when typing state was last updated */
  timestamp: number;
}

/**
 * Connection state for network monitoring
 *
 * @remarks
 * Tracks RTDB connection status via `.info/connected` reference.
 * Used by useConnectionState hook.
 *
 * @example
 * ```typescript
 * const connState: ConnectionState = {
 *   connected: true,
 *   reconnecting: false,
 *   lastConnectedAt: Date.now()
 * };
 * ```
 */
export interface ConnectionState {
  /** Whether currently connected to Firebase RTDB */
  connected: boolean;

  /** Whether actively attempting to reconnect */
  reconnecting: boolean;

  /** Unix timestamp (ms) of last successful connection */
  lastConnectedAt: number | null;
}

// Re-export User type from user.ts for convenience
export type { User } from './user';

/**
 * Represents an item in the retry queue for failed operations
 * @interface RetryQueueItem
 *
 * @remarks
 * Used to track and retry failed operations with exponential backoff.
 * Includes metadata for monitoring and debugging retry behavior.
 *
 * @example
 * ```typescript
 * const queueItem: RetryQueueItem = {
 *   id: 'READ_RECEIPT_BATCH_1234567890_abc123',
 *   operationType: 'READ_RECEIPT_BATCH',
 *   data: {
 *     messageIds: ['msg1', 'msg2'],
 *     userId: 'user123',
 *     timestamp: Timestamp.now()
 *   },
 *   retryCount: 2,
 *   nextRetryTime: Date.now() + 4000,
 *   createdAt: Date.now() - 5000,
 *   lastError: 'Network timeout'
 * };
 * ```
 */
export interface RetryQueueItem {
  /** Unique identifier for the operation */
  id: string;

  /** Type of operation being retried */
  operationType: 'READ_RECEIPT_BATCH' | 'MESSAGE_SEND' | 'STATUS_UPDATE';

  /** Operation-specific data payload */
  data: {
    messageIds?: string[];
    userId?: string;
    timestamp?: Timestamp;
    conversationId?: string;
    [key: string]: unknown;
  };

  /** Number of retry attempts made */
  retryCount: number;

  /** Timestamp (ms) when next retry should be attempted */
  nextRetryTime: number;

  /** Timestamp (ms) when item was created */
  createdAt: number;

  /** Last error message encountered (optional) */
  lastError?: string;
}

/**
 * Configuration for retry behavior with exponential backoff
 * @interface RetryConfig
 *
 * @remarks
 * Controls retry logic including backoff delays, circuit breaker,
 * and queue size limits for resilient operation handling.
 *
 * @example
 * ```typescript
 * const config: RetryConfig = {
 *   maxRetries: 5,
 *   backoffDelays: [1000, 2000, 4000, 8000, 16000, 30000],
 *   maxQueueSize: 100,
 *   enableCircuitBreaker: true,
 *   circuitBreakerThreshold: 10,
 *   circuitBreakerCooldown: 60000
 * };
 * ```
 */
export interface RetryConfig {
  /** Maximum number of retry attempts before giving up */
  maxRetries: number;

  /** Array of backoff delays in milliseconds for each retry attempt */
  backoffDelays: number[];

  /** Maximum items allowed in retry queue */
  maxQueueSize: number;

  /** Whether to enable circuit breaker pattern */
  enableCircuitBreaker: boolean;

  /** Number of consecutive failures to trigger circuit breaker */
  circuitBreakerThreshold: number;

  /** Circuit breaker cool-down period in milliseconds */
  circuitBreakerCooldown: number;
}

/**
 * Result of a batch update operation with success/failure details
 * @interface BatchUpdateResult
 *
 * @remarks
 * Provides detailed information about batch operation results
 * including partial failures and performance metrics.
 *
 * @example
 * ```typescript
 * const result: BatchUpdateResult = {
 *   success: true,
 *   processedCount: 50,
 *   failedCount: 0,
 *   totalCount: 50,
 *   duration: 234,
 *   errors: [],
 *   retryQueued: false
 * };
 * ```
 */
export interface BatchUpdateResult {
  /** Whether the overall batch operation succeeded */
  success: boolean;

  /** Number of items successfully processed */
  processedCount: number;

  /** Number of items that failed to process */
  failedCount: number;

  /** Total number of items in the batch */
  totalCount: number;

  /** Operation duration in milliseconds */
  duration: number;

  /** Array of error details for failed items */
  errors: Array<{
    itemId: string;
    error: string;
    errorType: ErrorType;
  }>;

  /** Whether failed items were queued for retry */
  retryQueued: boolean;
}

/**
 * Enumeration of error types for categorization
 * @enum {string}
 *
 * @remarks
 * Used to categorize errors and determine appropriate retry behavior.
 * Permission errors are not retried, while network errors are.
 */
export enum ErrorType {
  /** Network-related errors (retry) */
  NETWORK = 'network',

  /** Permission/auth errors (don't retry) */
  PERMISSION = 'permission',

  /** Rate limiting/quota errors (retry with longer backoff) */
  QUOTA = 'quota',

  /** Data validation errors (don't retry) */
  VALIDATION = 'validation',

  /** Unknown/unexpected errors (retry cautiously) */
  UNKNOWN = 'unknown',
}

/**
 * Validation severity levels for group creation
 * @enum {string}
 *
 * @remarks
 * Used to determine UI feedback intensity and color coding.
 * - error: Hard validation failure, prevents submission
 * - warning: Soft limit approaching, allows submission
 * - success: Validation passed, normal state
 */
export type ValidationSeverity = 'error' | 'warning' | 'success';

/**
 * State of group member selection and validation
 * @interface MemberSelectionState
 *
 * @remarks
 * Tracks selected members and derived validation state for group creation UI.
 * Used to manage real-time feedback as users add/remove participants.
 *
 * @example
 * ```typescript
 * const selectionState: MemberSelectionState = {
 *   selectedMemberIds: ['user123', 'user456', 'user789'],
 *   currentCount: 4,
 *   canAddMore: true,
 *   limitReached: false,
 *   warningThresholdReached: false
 * };
 * ```
 */
export interface MemberSelectionState {
  /** Array of user IDs currently selected (includes current user) */
  selectedMemberIds: string[];

  /** Total count of selected members including current user */
  currentCount: number;

  /** Whether more members can be added (currentCount < GROUP_SIZE_LIMIT) */
  canAddMore: boolean;

  /** Whether the hard limit has been reached (currentCount >= GROUP_SIZE_LIMIT) */
  limitReached: boolean;

  /** Whether the warning threshold has been reached (currentCount >= GROUP_SIZE_WARNING_THRESHOLD) */
  warningThresholdReached: boolean;
}

/**
 * Result of group size validation with error/warning details
 * @interface GroupValidationState
 *
 * @remarks
 * Returned by validation logic to inform UI rendering and user feedback.
 * Uses discriminated union via 'isValid' field for type-safe error handling.
 *
 * @example
 * ```typescript
 * // Error state
 * const errorState: GroupValidationState = {
 *   isValid: false,
 *   errorMessage: 'Groups are limited to 10 members',
 *   warningMessage: null,
 *   severity: 'error',
 *   memberCount: 11,
 *   canSubmit: false
 * };
 *
 * // Warning state
 * const warningState: GroupValidationState = {
 *   isValid: true,
 *   errorMessage: null,
 *   warningMessage: 'Approaching limit (8 of 10 members)',
 *   severity: 'warning',
 *   memberCount: 8,
 *   canSubmit: true
 * };
 *
 * // Success state
 * const successState: GroupValidationState = {
 *   isValid: true,
 *   errorMessage: null,
 *   warningMessage: null,
 *   severity: 'success',
 *   memberCount: 5,
 *   canSubmit: true
 * };
 * ```
 */
export interface GroupValidationState {
  /** Whether the current member count passes validation (< GROUP_SIZE_LIMIT) */
  isValid: boolean;

  /** Error message to display if validation fails, null otherwise */
  errorMessage: string | null;

  /** Warning message to display when approaching limit, null otherwise */
  warningMessage: string | null;

  /** Validation severity level for UI styling */
  severity: ValidationSeverity;

  /** Current member count being validated */
  memberCount: number;

  /** Whether group creation can proceed (isValid && other conditions met) */
  canSubmit: boolean;
}

/**
 * Discriminated union of possible group creation error types
 * @type GroupCreationError
 *
 * @remarks
 * Categorizes different validation and creation failures for specific error handling.
 * Uses 'type' field as discriminator for type-safe error handling in UI.
 *
 * @example
 * ```typescript
 * function handleError(error: GroupCreationError) {
 *   switch (error.type) {
 *     case 'SIZE_LIMIT_EXCEEDED':
 *       return showAlert(error.message, error.currentCount, error.limit);
 *     case 'INSUFFICIENT_MEMBERS':
 *       return showAlert(error.message, error.minimumRequired);
 *     case 'MISSING_GROUP_NAME':
 *       return focusGroupNameInput();
 *     case 'NETWORK_ERROR':
 *       return showRetryDialog(error.message, error.details);
 *   }
 * }
 * ```
 */
export type GroupCreationError =
  | {
      /** Error type discriminator */
      type: 'SIZE_LIMIT_EXCEEDED';
      /** User-friendly error message */
      message: string;
      /** Current member count that exceeded limit */
      currentCount: number;
      /** Maximum allowed member count */
      limit: number;
    }
  | {
      /** Error type discriminator */
      type: 'INSUFFICIENT_MEMBERS';
      /** User-friendly error message */
      message: string;
      /** Current member count */
      currentCount: number;
      /** Minimum required members for group */
      minimumRequired: number;
    }
  | {
      /** Error type discriminator */
      type: 'MISSING_GROUP_NAME';
      /** User-friendly error message */
      message: string;
    }
  | {
      /** Error type discriminator */
      type: 'NETWORK_ERROR';
      /** User-friendly error message */
      message: string;
      /** Technical error details for logging */
      details?: string;
    }
  | {
      /** Error type discriminator */
      type: 'PERMISSION_ERROR';
      /** User-friendly error message */
      message: string;
      /** Technical error details for logging */
      details?: string;
    };

/**
 * State management for conversation selection mode
 * @interface ConversationSelectionState
 *
 * @remarks
 * Used to track selection mode state in the conversation list screen.
 * Selection state is local to the screen (not global store) since it's transient.
 * Uses Set<string> for O(1) add/remove/lookup operations.
 *
 * @example
 * ```typescript
 * const [selectionState, setSelectionState] = useState<ConversationSelectionState>({
 *   isSelectionMode: false,
 *   selectedConversationIds: new Set()
 * });
 * ```
 */
export interface ConversationSelectionState {
  /** Whether selection mode is currently active */
  isSelectionMode: boolean;

  /** Set of conversation IDs currently selected (O(1) operations) */
  selectedConversationIds: Set<string>;
}

/**
 * Handler functions for managing conversation selection
 * @type SelectionHandlers
 *
 * @remarks
 * Provides type-safe callbacks for selection mode interactions.
 * Passed as props to ConversationListItem components.
 *
 * @example
 * ```typescript
 * const handlers: SelectionHandlers = {
 *   enterSelectionMode: (id) => {
 *     setIsSelectionMode(true);
 *     setSelectedConversationIds(new Set([id]));
 *   },
 *   exitSelectionMode: () => {
 *     setIsSelectionMode(false);
 *     setSelectedConversationIds(new Set());
 *   },
 *   toggleSelection: (id) => {
 *     setSelectedConversationIds(prev => {
 *       const next = new Set(prev);
 *       next.has(id) ? next.delete(id) : next.add(id);
 *       return next;
 *     });
 *   }
 * };
 * ```
 */
export type SelectionHandlers = {
  /** Enters selection mode with the specified conversation initially selected */
  enterSelectionMode: (conversationId: string) => void;

  /** Exits selection mode and clears all selections */
  exitSelectionMode: () => void;

  /** Toggles selection state for the specified conversation */
  toggleSelection: (conversationId: string) => void;
};
