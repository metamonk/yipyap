/**
 * AI-specific TypeScript type definitions for Phase 2 AI features
 * @module types/ai
 */

/**
 * Configuration for an AI provider (OpenAI)
 *
 * @remarks
 * Defines the settings needed to initialize and use an AI provider.
 * Each provider requires API keys and model selections for different priorities.
 *
 * @example
 * ```typescript
 * const openaiConfig: AIProviderConfig = {
 *   name: 'openai',
 *   apiKey: 'sk-...',
 *   baseURL: 'https://api.openai.com/v1',
 *   models: {
 *     fast: 'gpt-4o-mini',
 *     quality: 'gpt-4-turbo-preview',
 *     cost: 'gpt-4o-mini'
 *   }
 * };
 * ```
 */
export interface AIProviderConfig {
  /** Provider name identifier */
  name: 'openai';

  /** API key for authentication */
  apiKey: string;

  /** Optional custom base URL for API endpoint */
  baseURL?: string;

  /** Model identifiers for different priorities */
  models: {
    /** Fast, low-latency model (e.g., 'claude-3-haiku') */
    fast: string;

    /** High-quality model (e.g., 'gpt-4-turbo-preview') */
    quality: string;

    /** Cost-optimized model */
    cost: string;
  };
}

/**
 * Criteria for selecting which AI model to use for an operation
 *
 * @remarks
 * Determines model selection based on operation requirements.
 * Priority dictates whether to optimize for speed, quality, or cost.
 *
 * @example
 * ```typescript
 * const criteria: ModelSelectionCriteria = {
 *   priority: 'speed',
 *   maxTokens: 1000,
 *   temperature: 0.7
 * };
 * ```
 */
export interface ModelSelectionCriteria {
  /** Operation priority: speed (fast response), quality (best output), or cost (budget-conscious) */
  priority: 'speed' | 'quality' | 'cost';

  /** Maximum tokens to generate (optional) */
  maxTokens?: number;

  /** Sampling temperature for generation (0.0-1.0, optional) */
  temperature?: number;
}

/**
 * Configuration for a selected AI model
 *
 * @remarks
 * Returned by model selection logic to specify which provider and model to use.
 * Includes generation parameters for the selected model.
 *
 * @example
 * ```typescript
 * const modelConfig: ModelConfig = {
 *   provider: 'openai',
 *   model: 'gpt-4o-mini',
 *   config: {
 *     maxTokens: 1000,
 *     temperature: 0.7
 *   }
 * };
 * ```
 */
export interface ModelConfig {
  /** Provider to use ('openai') */
  provider: 'openai';

  /** Specific model identifier */
  model: string;

  /** Generation configuration parameters */
  config: {
    /** Maximum tokens to generate */
    maxTokens: number;

    /** Sampling temperature (0.0-1.0) */
    temperature: number;
  };
}

/**
 * Result of an AI operation with success/failure information
 *
 * @typeParam T - Type of the data returned on success
 *
 * @remarks
 * Generic interface for all AI operation results.
 * Includes metadata about the operation (provider, model, tokens, latency).
 *
 * @example
 * ```typescript
 * const result: AIOperationResult<string> = {
 *   success: true,
 *   data: 'Generated text response',
 *   provider: 'openai',
 *   model: 'gpt-4-turbo-preview',
 *   tokensUsed: 150,
 *   latency: 1234
 * };
 * ```
 */
export interface AIOperationResult<T = unknown> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Data returned by the operation (present if success is true) */
  data?: T;

  /** Error details (present if success is false) */
  error?: AIError;

  /** Provider used for the operation */
  provider: string;

  /** Model used for the operation */
  model: string;

  /** Total tokens consumed by the operation */
  tokensUsed: number;

  /** Operation latency in milliseconds */
  latency: number;
}

/**
 * Detailed error information from an AI operation
 *
 * @remarks
 * Categorizes errors for appropriate handling and retry logic.
 * Network and rate_limit errors are retryable, auth and validation are not.
 *
 * @example
 * ```typescript
 * const error: AIError = {
 *   code: 'RATE_LIMIT_EXCEEDED',
 *   message: 'Rate limit exceeded, please retry after 60 seconds',
 *   type: 'rate_limit',
 *   retryable: true
 * };
 * ```
 */
export interface AIError {
  /** Machine-readable error code */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Error type for categorization */
  type: 'network' | 'auth' | 'rate_limit' | 'validation' | 'provider' | 'unknown';

  /** Whether this error is retryable */
  retryable: boolean;
}

/**
 * Voice characteristics extracted from a creator's message history
 *
 * @remarks
 * Analyzed by GPT-4 Turbo to capture the creator's unique communication style.
 * Used to generate voice-matched response suggestions.
 *
 * @example
 * ```typescript
 * const characteristics: VoiceCharacteristics = {
 *   tone: 'friendly',
 *   vocabulary: ['awesome', 'definitely', 'thanks so much'],
 *   sentenceStructure: 'short',
 *   punctuationStyle: 'minimal',
 *   emojiUsage: 'occasional'
 * };
 * ```
 */
export interface VoiceCharacteristics {
  /** Overall tone of the creator's messages (e.g., 'friendly', 'professional', 'casual') */
  tone: string;

  /** Array of common words and phrases used by the creator */
  vocabulary: string[];

  /** Typical sentence structure pattern ('short', 'medium', 'complex') */
  sentenceStructure: string;

  /** Punctuation usage style ('minimal', 'moderate', 'expressive') */
  punctuationStyle: string;

  /** Frequency of emoji usage */
  emojiUsage: 'none' | 'occasional' | 'frequent';

  /** Optional additional writing patterns noted by AI analysis */
  writingPatterns?: string;
}

/**
 * Performance metrics for a voice profile
 *
 * @remarks
 * Tracks suggestion quality and user satisfaction over time.
 * Used to measure voice matching effectiveness and guide retraining.
 *
 * @example
 * ```typescript
 * const metrics: VoiceProfileMetrics = {
 *   totalSuggestionsGenerated: 150,
 *   acceptedSuggestions: 90,
 *   editedSuggestions: 40,
 *   rejectedSuggestions: 20,
 *   averageSatisfactionRating: 4.2
 * };
 * ```
 */
export interface VoiceProfileMetrics {
  /** Total number of response suggestions generated */
  totalSuggestionsGenerated: number;

  /** Number of suggestions accepted and sent by the creator */
  acceptedSuggestions: number;

  /** Number of suggestions edited before sending */
  editedSuggestions: number;

  /** Number of suggestions rejected by the creator */
  rejectedSuggestions: number;

  /** Average user satisfaction rating (1-5 scale) */
  averageSatisfactionRating: number;
}

/**
 * Creator's voice profile for generating matched response suggestions
 *
 * @remarks
 * Stored in Firestore at `/voice_profiles/{userId}`.
 * Generated from creator's message history using GPT-4 Turbo.
 * Retrained weekly to adapt to evolving communication style.
 *
 * @example
 * ```typescript
 * const profile: VoiceProfile = {
 *   id: 'user123',
 *   userId: 'user123',
 *   characteristics: {
 *     tone: 'friendly',
 *     vocabulary: ['awesome', 'definitely'],
 *     sentenceStructure: 'short',
 *     punctuationStyle: 'minimal',
 *     emojiUsage: 'occasional'
 *   },
 *   trainingSampleCount: 150,
 *   lastTrainedAt: Timestamp.now(),
 *   modelVersion: 'gpt-4-turbo-preview',
 *   metrics: {
 *     totalSuggestionsGenerated: 50,
 *     acceptedSuggestions: 35,
 *     editedSuggestions: 10,
 *     rejectedSuggestions: 5,
 *     averageSatisfactionRating: 4.5
 *   },
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface VoiceProfile {
  /** Unique profile identifier (matches userId) */
  id: string;

  /** User ID this profile belongs to */
  userId: string;

  /** Voice characteristics analyzed from message history */
  characteristics: VoiceCharacteristics;

  /** Number of message samples used for training */
  trainingSampleCount: number;

  /** Timestamp when the profile was last trained */
  lastTrainedAt: any; // firebase.firestore.Timestamp

  /** GPT-4 Turbo model version used for training */
  modelVersion: string;

  /** Performance metrics for this voice profile */
  metrics: VoiceProfileMetrics;

  /** Timestamp when profile was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when profile was last updated */
  updatedAt: any; // firebase.firestore.Timestamp
}

/**
 * Voice sample data for training
 *
 * @remarks
 * Captures original message, user response, context, and approval status.
 * Used for continuous improvement of voice matching accuracy.
 */
export interface VoiceSample {
  /** The original incoming message */
  originalMessage: string;

  /** The creator's actual response */
  userResponse: string;

  /** Conversation context (previous messages) */
  context: string;

  /** Whether the creator approved this response style */
  approved: boolean;
}

/**
 * User feedback on AI-generated suggestions
 *
 * @remarks
 * Tracks how creators interact with suggestions for retraining.
 * Includes optional rating and comments for quality improvement.
 */
export interface ResponseFeedback {
  /** The original AI-generated suggestion */
  originalSuggestion: string;

  /** User action taken on the suggestion */
  action: 'accepted' | 'rejected' | 'edited';

  /** The edited version (if user modified before sending) */
  userEdit?: string;

  /** User satisfaction rating (1-5 stars, 0 if not rated) */
  rating: number;

  /** Optional user comments on the suggestion quality */
  comments?: string;
}

/**
 * Training data for voice matching and other AI features
 *
 * @remarks
 * Stored in Firestore at `/ai_training_data/{id}`.
 * Captures voice samples and user feedback for continuous model improvement.
 * Processed weekly during retraining jobs.
 *
 * @example
 * ```typescript
 * const trainingData: AITrainingData = {
 *   id: 'training_abc123',
 *   userId: 'user123',
 *   type: 'response_feedback',
 *   feedback: {
 *     originalSuggestion: 'Thanks for reaching out!',
 *     userEdit: 'Thanks so much for reaching out!',
 *     rating: 4,
 *     comments: 'Almost perfect, just needed more enthusiasm'
 *   },
 *   modelVersion: 'gpt-4-turbo-preview',
 *   processed: false,
 *   createdAt: Timestamp.now()
 * };
 * ```
 */
export interface AITrainingData {
  /** Unique training data identifier */
  id: string;

  /** User ID this training data belongs to */
  userId: string;

  /** Type of training data */
  type: 'voice_sample' | 'response_feedback' | 'categorization_feedback';

  /** Voice sample data (when type is 'voice_sample') */
  voiceSample?: VoiceSample;

  /** Response feedback data (when type is 'response_feedback') */
  feedback?: ResponseFeedback;

  /** AI model version that generated the original output */
  modelVersion: string;

  /** Whether this data has been processed in a retraining job */
  processed: boolean;

  /** Timestamp when processing was completed (if processed is true) */
  processedAt?: any; // firebase.firestore.Timestamp

  /** Timestamp when this training data was created */
  createdAt: any; // firebase.firestore.Timestamp
}

/**
 * Configuration settings for the daily agent workflow
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_workflow_config`.
 * Controls when and how the daily agent processes overnight messages.
 * Users can configure schedule, limits, and approval requirements.
 *
 * @example
 * ```typescript
 * const config: DailyAgentConfig = {
 *   id: 'user123',
 *   userId: 'user123',
 *   features: {
 *     dailyWorkflowEnabled: true,
 *     categorizationEnabled: true,
 *     faqDetectionEnabled: true,
 *     voiceMatchingEnabled: true,
 *     sentimentAnalysisEnabled: true
 *   },
 *   workflowSettings: {
 *     dailyWorkflowTime: '09:00',
 *     timezone: 'America/Los_Angeles',
 *     maxAutoResponses: 20,
 *     requireApproval: true,
 *     escalationThreshold: 0.3
 *   },
 *   modelPreferences: {
 *     categorization: 'gpt-4o-mini',
 *     responseGeneration: 'gpt-4-turbo-preview',
 *     sentimentAnalysis: 'gpt-4o-mini'
 *   },
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface DailyAgentConfig {
  /** Configuration document identifier (matches userId) */
  id: string;

  /** User ID this configuration belongs to */
  userId: string;

  /** Feature toggle flags for AI capabilities */
  features: {
    /** Enable/disable daily workflow automation */
    dailyWorkflowEnabled: boolean;

    /** Enable message categorization */
    categorizationEnabled: boolean;

    /** Enable FAQ detection and auto-response */
    faqDetectionEnabled: boolean;

    /** Enable voice-matched response generation */
    voiceMatchingEnabled: boolean;

    /** Enable sentiment analysis and crisis detection */
    sentimentAnalysisEnabled: boolean;
  };

  /** Workflow execution settings */
  workflowSettings: {
    /** Daily workflow execution time in HH:mm format (e.g., "09:00") */
    dailyWorkflowTime: string;

    /** Timezone for schedule execution (IANA timezone identifier) */
    timezone: string;

    /** Maximum auto-responses to send per day (1-100) */
    maxAutoResponses: number;

    /** Require manual approval before sending AI-generated responses */
    requireApproval: boolean;

    /** Sentiment score threshold for escalation (0.0-1.0, lower = more negative) */
    escalationThreshold: number;

    /** Minutes to consider user as "active" for skipping workflow (default: 30) */
    activeThresholdMinutes?: number;
  };

  /** AI model preferences for different operations */
  modelPreferences: {
    /** Model for message categorization (default: 'gpt-4o-mini') */
    categorization: string;

    /** Model for response generation (default: 'gpt-4-turbo-preview') */
    responseGeneration: string;

    /** Model for sentiment analysis (default: 'gpt-4o-mini') */
    sentimentAnalysis: string;
  };

  /** Timestamp when configuration was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when configuration was last updated */
  updatedAt: any; // firebase.firestore.Timestamp
}

/**
 * Single step in a multi-step daily agent workflow
 *
 * @remarks
 * Tracks execution status, timing, and errors for each workflow step.
 * Steps execute sequentially: fetch → categorize → faq_detect → draft_responses → generate_summary
 */
export interface WorkflowStep {
  /** Step identifier in the workflow pipeline */
  step: 'fetch' | 'categorize' | 'faq_detect' | 'draft_responses' | 'generate_summary';

  /** Current execution status of this step */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

  /** Timestamp when step execution started */
  startTime: any; // firebase.firestore.Timestamp

  /** Timestamp when step execution completed (undefined if still running) */
  endTime?: any; // firebase.firestore.Timestamp

  /** Error message if step failed (undefined if successful) */
  error?: string;

  /** Additional metadata specific to this step (e.g., messages processed, API calls made) */
  metadata?: Record<string, any>;
}

/**
 * Complete execution record for a daily agent workflow run
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/daily_executions/{executionId}`.
 * Tracks workflow execution status, results, performance metrics, and step-by-step progress.
 * Used for audit trail, debugging, and performance optimization.
 *
 * @example
 * ```typescript
 * const execution: DailyAgentExecution = {
 *   id: 'exec_2025-10-24_user123',
 *   userId: 'user123',
 *   executionDate: Timestamp.now(),
 *   status: 'completed',
 *   results: {
 *     messagesFetched: 50,
 *     messagesCategorized: 50,
 *     faqsDetected: 10,
 *     autoResponsesSent: 10,
 *     responsesDrafted: 5,
 *     messagesNeedingReview: 5
 *   },
 *   metrics: {
 *     startTime: Timestamp.now(),
 *     endTime: Timestamp.now(),
 *     duration: 180000, // 3 minutes
 *     costIncurred: 35 // 35 cents
 *   },
 *   steps: [
 *     {
 *       step: 'fetch',
 *       status: 'completed',
 *       startTime: Timestamp.now(),
 *       endTime: Timestamp.now(),
 *       metadata: { messagesFound: 50 }
 *     }
 *   ],
 *   digestSummary: '10 handled, 5 need review',
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface DailyAgentExecution {
  /** Unique execution identifier */
  id: string;

  /** User ID this execution belongs to */
  userId: string;

  /** Date this workflow was executed */
  executionDate: any; // firebase.firestore.Timestamp

  /** Overall workflow execution status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

  /** Workflow execution results and statistics */
  results: {
    /** Total messages fetched for processing */
    messagesFetched: number;

    /** Messages successfully categorized */
    messagesCategorized: number;

    /** FAQs detected in messages */
    faqsDetected: number;

    /** Auto-responses sent for FAQs */
    autoResponsesSent: number;

    /** Response drafts created for non-FAQ messages */
    responsesDrafted: number;

    /** Messages requiring manual review */
    messagesNeedingReview: number;
  };

  /** Performance and cost metrics for this execution */
  metrics: {
    /** Workflow start timestamp */
    startTime: any; // firebase.firestore.Timestamp

    /** Workflow end timestamp */
    endTime: any; // firebase.firestore.Timestamp

    /** Total execution duration in milliseconds */
    duration: number;

    /** Total AI API costs incurred in USD cents */
    costIncurred: number;
  };

  /** Step-by-step execution progress */
  steps: WorkflowStep[];

  /** Human-readable digest summary (e.g., "10 handled, 5 need review") */
  digestSummary?: string;

  /** Timestamp when execution record was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when execution record was last updated */
  updatedAt: any; // firebase.firestore.Timestamp
}

/**
 * Audit log entry for daily agent workflow execution
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/agent_logs/{logId}`.
 * Provides detailed logging for debugging, monitoring, and audit trail.
 * Captures info, warnings, and errors at each step of workflow execution.
 *
 * @example
 * ```typescript
 * const logEntry: AgentExecutionLog = {
 *   id: 'log_abc123',
 *   executionId: 'exec_2025-10-24_user123',
 *   userId: 'user123',
 *   timestamp: Timestamp.now(),
 *   level: 'info',
 *   message: 'Fetched 50 unprocessed messages from last 12 hours',
 *   metadata: {
 *     step: 'fetch',
 *     messagesFound: 50,
 *     timeRange: '12h'
 *   }
 * };
 * ```
 */
export interface AgentExecutionLog {
  /** Unique log entry identifier */
  id: string;

  /** Execution ID this log entry belongs to */
  executionId: string;

  /** User ID this log entry belongs to */
  userId: string;

  /** Timestamp when log entry was created */
  timestamp: any; // firebase.firestore.Timestamp

  /** Log severity level */
  level: 'info' | 'warning' | 'error';

  /** Human-readable log message */
  message: string;

  /** Additional structured data for this log entry */
  metadata?: Record<string, any>;
}

/**
 * Message summary for daily digest display
 *
 * @remarks
 * Lightweight message representation for digest review screen.
 * Contains preview, category, and action taken by the daily agent.
 */
export interface DigestMessage {
  /** Message document ID */
  messageId: string;

  /** Conversation document ID */
  conversationId: string;

  /** Display name of message sender */
  senderName: string;

  /** Message text preview (truncated to 100 characters) */
  messagePreview: string;

  /** AI-assigned category (e.g., 'fan_engagement', 'business_opportunity') */
  category: string;

  /** Action taken by daily agent */
  actionTaken: 'auto_responded' | 'draft_created' | 'pending_review';

  /** Draft response text (present when actionTaken is 'draft_created') */
  draftResponse?: string;

  /** FAQ template ID used for auto-response (present when actionTaken is 'auto_responded') */
  faqTemplateId?: string;
}

/**
 * Daily digest presented to creator for review and approval
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/daily_digests/{digestId}`.
 * Contains summary of overnight activity and AI-processed messages.
 * Creator can review, approve, reject, or edit AI actions from this digest.
 *
 * @example
 * ```typescript
 * const digest: DailyDigest = {
 *   id: 'digest_2025-10-24_user123',
 *   userId: 'user123',
 *   executionId: 'exec_2025-10-24_user123',
 *   date: Timestamp.now(),
 *   summary: {
 *     totalHandled: 10,
 *     totalNeedingReview: 5,
 *     summaryText: '10 handled, 5 need review'
 *   },
 *   handledMessages: [
 *     {
 *       messageId: 'msg123',
 *       conversationId: 'conv456',
 *       senderName: 'John Doe',
 *       messagePreview: 'How do I subscribe to your channel?',
 *       category: 'fan_engagement',
 *       actionTaken: 'auto_responded',
 *       faqTemplateId: 'faq_subscribe'
 *     }
 *   ],
 *   pendingMessages: [
 *     {
 *       messageId: 'msg789',
 *       conversationId: 'conv012',
 *       senderName: 'Jane Smith',
 *       messagePreview: 'Interested in collaboration opportunities',
 *       category: 'business_opportunity',
 *       actionTaken: 'draft_created',
 *       draftResponse: 'Thanks for reaching out! I love collaborating...'
 *     }
 *   ],
 *   createdAt: Timestamp.now()
 * };
 * ```
 */
export interface DailyDigest {
  /** Unique digest identifier */
  id: string;

  /** User ID this digest belongs to */
  userId: string;

  /** Reference to the DailyAgentExecution that generated this digest */
  executionId: string;

  /** Date of this digest */
  date: any; // firebase.firestore.Timestamp

  /** Summary statistics for the digest */
  summary: {
    /** Total messages auto-responded (FAQ matches) */
    totalHandled: number;

    /** Total messages needing manual review (drafted responses) */
    totalNeedingReview: number;

    /** Human-readable summary text (e.g., "10 handled, 5 need review") */
    summaryText: string;
  };

  /** Messages that were automatically handled (FAQ auto-responses) */
  handledMessages: DigestMessage[];

  /** Messages with drafted responses needing review */
  pendingMessages: DigestMessage[];

  /** Timestamp when digest was created */
  createdAt: any; // firebase.firestore.Timestamp
}

/**
 * Performance metrics for an individual AI operation
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_performance_metrics/{id}`.
 * Tracks latency, success rates, token usage, and costs for each AI operation.
 * Used to monitor performance, detect degradation, and generate optimization recommendations.
 *
 * @example
 * ```typescript
 * const metrics: AIPerformanceMetrics = {
 *   id: 'perf_abc123',
 *   userId: 'user123',
 *   operation: 'categorization',
 *   latency: 450,
 *   timestamp: Timestamp.now(),
 *   success: true,
 *   modelUsed: 'gpt-4o-mini',
 *   tokensUsed: {
 *     prompt: 100,
 *     completion: 50,
 *     total: 150
 *   },
 *   costCents: 2,
 *   cacheHit: false,
 *   createdAt: Timestamp.now()
 * };
 * ```
 */
export interface AIPerformanceMetrics {
  /** Unique performance metrics identifier */
  id: string;

  /** User ID this metric belongs to */
  userId: string;

  /** Type of AI operation performed */
  operation: 'categorization' | 'sentiment' | 'faq_detection' | 'voice_matching' | 'opportunity_scoring' | 'daily_agent';

  /** Operation latency in milliseconds */
  latency: number;

  /** Timestamp when operation was executed */
  timestamp: any; // firebase.firestore.Timestamp

  /** Whether the operation completed successfully */
  success: boolean;

  /** Error type if operation failed (undefined if successful) */
  errorType?: 'network' | 'timeout' | 'rate_limit' | 'model_error' | 'unknown';

  /** AI model used for this operation (e.g., "gpt-4o-mini", "gpt-4-turbo") */
  modelUsed: string;

  /** Token usage breakdown for this operation */
  tokensUsed: {
    /** Number of tokens in the prompt/input */
    prompt: number;

    /** Number of tokens in the completion/output */
    completion: number;

    /** Total tokens consumed (prompt + completion) */
    total: number;
  };

  /** Operation cost in USD cents */
  costCents: number;

  /** Whether this operation result was served from cache */
  cacheHit: boolean;

  /** Cache key used for this operation (present if cacheHit is true) */
  cacheKey?: string;

  /** Timestamp when this metric record was created */
  createdAt: any; // firebase.firestore.Timestamp
}

/**
 * Aggregated performance statistics for a specific operation type
 *
 * @remarks
 * Computed from AIPerformanceMetrics data for a specific time period.
 * Includes latency percentiles, success rates, and cache effectiveness.
 * Used for performance dashboards and alerting.
 *
 * @example
 * ```typescript
 * const performance: OperationPerformance = {
 *   operation: 'categorization',
 *   averageLatency: 420,
 *   p50Latency: 400,
 *   p95Latency: 480,
 *   p99Latency: 500,
 *   successRate: 0.98,
 *   cacheHitRate: 0.25,
 *   totalOperations: 1000,
 *   periodStart: Timestamp.now(),
 *   periodEnd: Timestamp.now()
 * };
 * ```
 */
export interface OperationPerformance {
  /** Operation type identifier */
  operation: string;

  /** Mean latency across all operations in milliseconds */
  averageLatency: number;

  /** 50th percentile (median) latency in milliseconds */
  p50Latency: number;

  /** 95th percentile latency in milliseconds */
  p95Latency: number;

  /** 99th percentile latency in milliseconds */
  p99Latency: number;

  /** Success rate as a decimal (0.0-1.0) */
  successRate: number;

  /** Cache hit rate as a decimal (0.0-1.0) */
  cacheHitRate: number;

  /** Total number of operations in this period */
  totalOperations: number;

  /** Start of the measurement period */
  periodStart: any; // firebase.firestore.Timestamp

  /** End of the measurement period */
  periodEnd: any; // firebase.firestore.Timestamp
}

/**
 * Cost tracking metrics for a specific time period
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_cost_metrics/{id}`.
 * Aggregates costs by operation type and AI model.
 * Tracks budget limits and sends alerts at threshold breaches.
 * Document ID format: "daily-YYYY-MM-DD" or "monthly-YYYY-MM"
 *
 * @example
 * ```typescript
 * const costMetrics: CostMetrics = {
 *   userId: 'user123',
 *   period: 'daily',
 *   periodStart: Timestamp.now(),
 *   periodEnd: Timestamp.now(),
 *   totalCostCents: 450,
 *   costByOperation: {
 *     categorization: 100,
 *     voice_matching: 250,
 *     faq_detection: 100
 *   },
 *   costByModel: {
 *     'gpt-4o-mini': 200,
 *     'gpt-4-turbo-preview': 250
 *   },
 *   budgetLimitCents: 500,
 *   budgetUsedPercent: 90,
 *   budgetAlertSent: true,
 *   budgetExceeded: false,
 *   totalTokens: 50000,
 *   tokensByOperation: {
 *     categorization: 10000,
 *     voice_matching: 30000,
 *     faq_detection: 10000
 *   },
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface CostMetrics {
  /** User ID this cost metric belongs to */
  userId: string;

  /** Time period granularity (daily or monthly) */
  period: 'daily' | 'monthly';

  /** Start of the measurement period */
  periodStart: any; // firebase.firestore.Timestamp

  /** End of the measurement period */
  periodEnd: any; // firebase.firestore.Timestamp

  /** Total cost in USD cents for this period */
  totalCostCents: number;

  /** Cost breakdown by operation type (operation name → cost in cents) */
  costByOperation: Record<string, number>;

  /** Cost breakdown by AI model (model name → cost in cents) */
  costByModel: Record<string, number>;

  /** Budget limit for this period in USD cents (default: 500 = $5.00) */
  budgetLimitCents: number;

  /** Percentage of budget used (0-100) */
  budgetUsedPercent: number;

  /** Whether a budget alert has been sent for this period */
  budgetAlertSent: boolean;

  /** Whether the budget limit has been exceeded */
  budgetExceeded: boolean;

  /** Total tokens consumed in this period */
  totalTokens: number;

  /** Token usage breakdown by operation type */
  tokensByOperation: Record<string, number>;

  /** Timestamp when this record was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when this record was last updated */
  updatedAt: any; // firebase.firestore.Timestamp
}

/**
 * AI optimization recommendation for improving performance or reducing costs
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_optimization_recommendations/{id}`.
 * Generated by analyzing performance metrics, costs, and usage patterns.
 * Recommendations can be dismissed by the user.
 * Types: latency (slow operations), cost (expensive operations), cache (low hit rates), rate_limit (approaching limits)
 *
 * @example
 * ```typescript
 * const recommendation: OptimizationRecommendation = {
 *   id: 'rec_abc123',
 *   userId: 'user123',
 *   type: 'cost',
 *   severity: 'high',
 *   title: 'Voice matching is exceeding budget',
 *   description: 'Voice matching operations are consuming 60% of your daily budget due to high token usage.',
 *   impact: 'Could save ~$2/day by switching to batch processing',
 *   actionable: true,
 *   actionSteps: [
 *     'Enable batch processing for voice matching',
 *     'Reduce max_tokens parameter from 500 to 300',
 *     'Consider using gpt-4o-mini for initial drafts'
 *   ],
 *   createdAt: Timestamp.now()
 * };
 * ```
 */
export interface OptimizationRecommendation {
  /** Unique recommendation identifier */
  id: string;

  /** User ID this recommendation is for */
  userId: string;

  /** Type of optimization recommended */
  type: 'latency' | 'cost' | 'cache' | 'rate_limit';

  /** Severity level of the issue */
  severity: 'low' | 'medium' | 'high';

  /** Short, actionable recommendation title */
  title: string;

  /** Detailed description of the issue */
  description: string;

  /** Estimated impact of implementing this recommendation */
  impact: string;

  /** Whether this recommendation has actionable steps */
  actionable: boolean;

  /** Specific action steps the user can take (present if actionable is true) */
  actionSteps?: string[];

  /** Timestamp when recommendation was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when user dismissed this recommendation (undefined if not dismissed) */
  dismissedAt?: any; // firebase.firestore.Timestamp
}

/**
 * Cache performance metrics for a specific operation
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_cache_metrics/{id}`.
 * Tracks cache hit rates and latency improvements from caching.
 * Used to optimize cache TTL settings and identify high-value cache targets.
 * Aggregated hourly or daily for trending analysis.
 *
 * @example
 * ```typescript
 * const cacheMetrics: CacheMetrics = {
 *   userId: 'user123',
 *   operation: 'faq_detection',
 *   cacheHitRate: 0.35,
 *   totalRequests: 200,
 *   cacheHits: 70,
 *   cacheMisses: 130,
 *   averageLatencyCacheHit: 50,
 *   averageLatencyCacheMiss: 400,
 *   period: 'hourly',
 *   periodStart: Timestamp.now()
 * };
 * ```
 */
export interface CacheMetrics {
  /** User ID this cache metric belongs to */
  userId: string;

  /** Operation type being cached */
  operation: string;

  /** Cache hit rate as a decimal (0.0-1.0) */
  cacheHitRate: number;

  /** Total cache lookup requests in this period */
  totalRequests: number;

  /** Number of successful cache hits */
  cacheHits: number;

  /** Number of cache misses requiring AI operation */
  cacheMisses: number;

  /** Average latency for cache hits in milliseconds */
  averageLatencyCacheHit: number;

  /** Average latency for cache misses in milliseconds */
  averageLatencyCacheMiss: number;

  /** Time period granularity (hourly or daily) */
  period: 'hourly' | 'daily';

  /** Start of the measurement period */
  periodStart: any; // firebase.firestore.Timestamp
}

/**
 * Rate limit status for a specific user and operation
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/rate_limits/{operation}`.
 * Implements sliding window rate limiting algorithm.
 * Prevents abuse and controls costs by limiting operation frequency.
 * Resets automatically at window expiration.
 *
 * @example
 * ```typescript
 * const rateLimitStatus: RateLimitStatus = {
 *   userId: 'user123',
 *   operation: 'categorization',
 *   currentCount: 180,
 *   limit: 200,
 *   windowStart: Timestamp.now(),
 *   windowEnd: Timestamp.now(),
 *   limitReached: false,
 *   resetAt: Timestamp.now()
 * };
 * ```
 */
export interface RateLimitStatus {
  /** User ID this rate limit applies to */
  userId: string;

  /** Operation type being rate limited */
  operation: string;

  /** Current operation count within this window */
  currentCount: number;

  /** Maximum operations allowed per window */
  limit: number;

  /** Start of the current rate limit window */
  windowStart: any; // firebase.firestore.Timestamp

  /** End of the current rate limit window */
  windowEnd: any; // firebase.firestore.Timestamp

  /** Whether the rate limit has been reached */
  limitReached: boolean;

  /** Timestamp when the rate limit will reset */
  resetAt: any; // firebase.firestore.Timestamp
}

/**
 * Configuration for A/B testing different AI models or parameters
 *
 * @remarks
 * Stored in Firestore at `/users/{userId}/ai_ab_tests/{id}`.
 * Enables comparing performance between model variants (e.g., GPT-4 Turbo vs GPT-4o-mini).
 * Automatically splits traffic and tracks metrics for statistical analysis.
 * Results include latency, cost, success rate, and optional user satisfaction ratings.
 *
 * @example
 * ```typescript
 * const abTest: ABTestConfig = {
 *   id: 'test_categorization_models',
 *   name: 'Categorization Model Comparison',
 *   operation: 'categorization',
 *   variantA: {
 *     model: 'gpt-4o-mini',
 *     parameters: { temperature: 0.7, maxTokens: 100 }
 *   },
 *   variantB: {
 *     model: 'gpt-4-turbo-preview',
 *     parameters: { temperature: 0.7, maxTokens: 100 }
 *   },
 *   splitRatio: 0.5,
 *   startDate: Timestamp.now(),
 *   active: true,
 *   results: {
 *     variantA: {
 *       totalOperations: 500,
 *       averageLatency: 380,
 *       averageCost: 1.2,
 *       successRate: 0.99
 *     },
 *     variantB: {
 *       totalOperations: 500,
 *       averageLatency: 420,
 *       averageCost: 8.5,
 *       successRate: 0.995
 *     }
 *   }
 * };
 * ```
 */
export interface ABTestConfig {
  /** Unique A/B test identifier */
  id: string;

  /** Human-readable test name */
  name: string;

  /** Operation type being tested */
  operation: string;

  /** Configuration for variant A */
  variantA: {
    /** AI model identifier */
    model: string;

    /** Model parameters (temperature, maxTokens, etc.) */
    parameters: Record<string, any>;
  };

  /** Configuration for variant B */
  variantB: {
    /** AI model identifier */
    model: string;

    /** Model parameters (temperature, maxTokens, etc.) */
    parameters: Record<string, any>;
  };

  /** Traffic split ratio (0.0-1.0, default 0.5 for 50/50 split) */
  splitRatio: number;

  /** Test start date */
  startDate: any; // firebase.firestore.Timestamp

  /** Test end date (undefined if test is ongoing) */
  endDate?: any; // firebase.firestore.Timestamp

  /** Whether this test is currently active */
  active: boolean;

  /** Test results (undefined until sufficient data is collected) */
  results?: {
    /** Variant A performance metrics */
    variantA: {
      /** Total operations executed with variant A */
      totalOperations: number;

      /** Average latency in milliseconds */
      averageLatency: number;

      /** Average cost in USD cents */
      averageCost: number;

      /** Success rate as a decimal (0.0-1.0) */
      successRate: number;

      /** Optional user satisfaction rating (1-5 scale) */
      userSatisfactionRating?: number;
    };

    /** Variant B performance metrics */
    variantB: {
      /** Total operations executed with variant B */
      totalOperations: number;

      /** Average latency in milliseconds */
      averageLatency: number;

      /** Average cost in USD cents */
      averageCost: number;

      /** Success rate as a decimal (0.0-1.0) */
      successRate: number;

      /** Optional user satisfaction rating (1-5 scale) */
      userSatisfactionRating?: number;
    };
  };
}

// =============================================
// Epic 6: Meaningful 10 Daily Digest Types
// =============================================

/**
 * Relationship context for a conversation (Epic 6)
 *
 * @remarks
 * Provides conversation metadata for relationship scoring.
 * Used to prioritize messages based on relationship depth.
 */
export interface RelationshipContext {
  /** Days since conversation started */
  conversationAge: number;

  /** Timestamp of last interaction */
  lastInteraction: any; // firebase.firestore.Timestamp

  /** Total message count in conversation */
  messageCount: number;

  /** Whether this is a VIP relationship (>10 messages AND >30 days old) */
  isVIP: boolean;
}

/**
 * Meaningful 10 digest message (Epic 6, Story 6.1)
 *
 * @remarks
 * Enhanced message summary with relationship scoring and time estimates.
 * Replaces flat message list with priority-tiered digest.
 *
 * @example
 * ```typescript
 * const message: Meaningful10DigestMessage = {
 *   id: 'msg123',
 *   conversationId: 'conv456',
 *   content: 'Interested in brand partnership...',
 *   timestamp: Timestamp.now(),
 *   relationshipScore: 85,
 *   relationshipContext: {
 *     conversationAge: 45,
 *     lastInteraction: Timestamp.now(),
 *     messageCount: 12,
 *     isVIP: true
 *   },
 *   category: 'Business',
 *   estimatedResponseTime: 5
 * };
 * ```
 */
export interface Meaningful10DigestMessage {
  /** Message document ID */
  id: string;

  /** Conversation document ID */
  conversationId: string;

  /** Message content preview */
  content: string;

  /** Message timestamp */
  timestamp: any; // firebase.firestore.Timestamp

  /** Relationship score (0-100) */
  relationshipScore: number;

  /** Relationship context metadata */
  relationshipContext: RelationshipContext;

  /** AI-assigned category (from Story 5.2) */
  category: string;

  /** Estimated response time in minutes */
  estimatedResponseTime: number;
}

/**
 * Auto-handled messages summary (Epic 6, Story 6.1)
 *
 * @remarks
 * Summarizes messages that were automatically handled via FAQ or archiving.
 * Collapsible section in UI showing counts without requiring action.
 */
export interface AutoHandledSummary {
  /** Count of FAQ auto-responses sent */
  faqCount: number;

  /** Count of low-priority messages archived (Story 6.4) */
  archivedCount: number;

  /** Total auto-handled messages (faqCount + archivedCount) - Story 6.4 */
  total: number;

  /** Whether a boundary message was sent to archived senders (Story 6.4) */
  boundaryMessageSent: boolean;
}

/**
 * Meaningful 10 digest structure (Epic 6, Story 6.1)
 *
 * @remarks
 * Replaces flat message list with priority-tiered digest.
 * Focuses creator attention on top 10 most important messages.
 *
 * Key changes from Story 5.8:
 * - ❌ Removed: Bulk "Approve All" / "Reject All" buttons
 * - ✅ Added: 3-tier priority system (High/Medium/Auto-handled)
 * - ✅ Added: Relationship scoring for prioritization
 * - ✅ Added: Time estimates and capacity tracking
 */
export interface Meaningful10Digest {
  /** Top 3 highest priority messages (respond today) */
  highPriority: Meaningful10DigestMessage[];

  /** Next 2-7 messages based on capacity (respond this week) */
  mediumPriority: Meaningful10DigestMessage[];

  /** Auto-handled messages (FAQ + archived) */
  autoHandled: AutoHandledSummary;

  /** Number of messages handled today (includes high + medium + auto) */
  capacityUsed: number;

  /** Estimated total time commitment in minutes */
  estimatedTimeCommitment: number;
}

/**
 * Engagement metrics snapshot (Epic 6, Story 6.1)
 *
 * @remarks
 * Provides creator insight into their engagement patterns.
 * Used to detect burnout risk and guide capacity adjustments.
 */
export interface EngagementMetrics {
  /** Percentage of messages the creator personally responds to (0.0-1.0) */
  personalResponseRate: number;

  /** Quality score based on response depth and timeliness (0-100) */
  qualityScore: number;

  /** Burnout risk level based on workload and response patterns */
  burnoutRisk: 'low' | 'medium' | 'high';
}

/**
 * Daily digest with Meaningful 10 structure (Epic 6, Story 6.1)
 *
 * @remarks
 * Extends the original DailyDigest interface with Meaningful 10 fields.
 * Dual-write strategy during migration: both old + new schemas present.
 *
 * Stored in Firestore at `/users/{userId}/daily_digests/{digestId}`.
 *
 * @example
 * ```typescript
 * const digest: Meaningful10DailyDigest = {
 *   id: 'digest_2025-10-26_user123',
 *   userId: 'user123',
 *   executionId: 'exec_2025-10-26_user123',
 *   executionDate: Timestamp.now(),
 *   meaningful10: {
 *     highPriority: [
 *       // Top 3 messages
 *     ],
 *     mediumPriority: [
 *       // Next 2-7 messages
 *     ],
 *     autoHandled: {
 *       faqCount: 8,
 *       archivedCount: 12,
 *       boundaryMessageSent: true
 *     },
 *     capacityUsed: 5,
 *     estimatedTimeCommitment: 20
 *   },
 *   engagementMetrics: {
 *     personalResponseRate: 0.75,
 *     qualityScore: 82,
 *     burnoutRisk: 'low'
 *   },
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface Meaningful10DailyDigest {
  /** Unique digest identifier */
  id: string;

  /** User ID this digest belongs to */
  userId: string;

  /** Reference to the DailyAgentExecution that generated this digest */
  executionId: string;

  /** Date of this digest */
  executionDate: any; // firebase.firestore.Timestamp

  /** NEW: Meaningful 10 structure with priority tiers */
  meaningful10: Meaningful10Digest;

  /** NEW: Engagement metrics snapshot */
  engagementMetrics: EngagementMetrics;

  /** Timestamp when digest was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when digest was last updated */
  updatedAt: any; // firebase.firestore.Timestamp
}

// =============================================
// Epic 6: Draft-First Response Interface (Story 6.2)
// =============================================

/**
 * Personalization suggestion for draft editing (Story 6.2)
 *
 * @remarks
 * Provides specific prompts to help creators personalize AI-generated drafts.
 * Displayed below draft text to guide authentic editing.
 *
 * @example
 * ```typescript
 * const suggestion: PersonalizationSuggestion = {
 *   text: 'Add specific detail about their message',
 *   type: 'context'
 * };
 * ```
 */
export interface PersonalizationSuggestion {
  /** Suggestion text prompt */
  text: string;

  /** Suggestion category */
  type: 'context' | 'callback' | 'question' | 'tone' | 'detail';
}

/**
 * AI-generated response draft for creator editing (Story 6.2)
 *
 * @remarks
 * Replaces approval-based interface with draft-first editing.
 * Always presented in editable mode with personalization guidance.
 *
 * Key features:
 * - Confidence scoring (0-100)
 * - Personalization suggestions (3 prompts)
 * - Time saved estimation
 * - Requires editing enforcement for high-priority messages
 *
 * @example
 * ```typescript
 * const draft: ResponseDraft = {
 *   text: 'Thanks for reaching out! I appreciate...',
 *   confidence: 85,
 *   requiresEditing: false,
 *   personalizationSuggestions: [
 *     { text: 'Add specific detail about their message', type: 'context' },
 *     { text: 'Include personal callback to previous conversation', type: 'callback' },
 *     { text: 'End with a question to continue dialogue', type: 'question' }
 *   ],
 *   timeSaved: 3,
 *   messageId: 'msg123',
 *   conversationId: 'conv456',
 *   version: 1
 * };
 * ```
 */
export interface ResponseDraft {
  /** Draft response text */
  text: string;

  /** AI confidence score (0-100) */
  confidence: number;

  /** Whether editing is required before sending (true for business/high-priority) */
  requiresEditing: boolean;

  /** Personalization suggestion prompts (3 hints) */
  personalizationSuggestions: PersonalizationSuggestion[];

  /** Estimated time saved in minutes */
  timeSaved: number;

  /** Message ID this draft responds to */
  messageId: string;

  /** Conversation ID */
  conversationId: string;

  /** Draft version number (for history) */
  version: number;

  /** Timestamp when draft was generated */
  createdAt?: any; // firebase.firestore.Timestamp
}

/**
 * Stored message draft in Firestore subcollection (Story 6.2)
 *
 * @remarks
 * Stored in Firestore at `/conversations/{conversationId}/message_drafts/{draftId}`.
 * Enables auto-save functionality and draft restoration.
 * TTL: 7 days (cleared after send or explicit discard)
 *
 * @example
 * ```typescript
 * const messageDraft: MessageDraft = {
 *   id: 'draft_abc123',
 *   messageId: 'msg456',
 *   conversationId: 'conv789',
 *   draftText: 'Thanks for reaching out! I appreciate...',
 *   confidence: 85,
 *   createdAt: Timestamp.now(),
 *   version: 1,
 *   isActive: true,
 *   expiresAt: Timestamp.now() // 7 days from now
 * };
 * ```
 */
export interface MessageDraft {
  /** Unique draft identifier */
  id: string;

  /** Message ID this draft responds to */
  messageId: string;

  /** Conversation ID */
  conversationId: string;

  /** Current draft text (may be edited by user) */
  draftText: string;

  /** Original AI confidence score (0-100) */
  confidence: number;

  /** Timestamp when draft was created */
  createdAt: any; // firebase.firestore.Timestamp

  /** Timestamp when draft was last updated (for auto-save tracking) */
  updatedAt?: any; // firebase.firestore.Timestamp

  /** Draft version number (increments with each regeneration) */
  version: number;

  /** Whether this is the currently active draft */
  isActive: boolean;

  /** Expiration timestamp (7 days from creation) */
  expiresAt: any; // firebase.firestore.Timestamp
}

/**
 * Extended message metadata for draft tracking (Story 6.2)
 *
 * @remarks
 * Extends existing message metadata to track draft editing behavior.
 * Used for analytics and AI improvement.
 *
 * @example
 * ```typescript
 * const metadata: DraftMessageMetadata = {
 *   // Existing fields from Story 5.5
 *   isAIDraft: true,
 *   confidence: 85,
 *
 *   // NEW: Draft tracking
 *   wasEdited: true,
 *   editCount: 3,
 *   timeToEdit: 45000, // 45 seconds
 *   requiresEditing: false,
 *   draftSavedAt: Timestamp.now(),
 *   draftVersion: 1,
 *   overrideApplied: false
 * };
 * ```
 */
export interface DraftMessageMetadata {
  /** Whether this message originated from AI draft */
  isAIDraft?: boolean;

  /** AI confidence score (0-100) */
  confidence?: number;

  /** Whether creator edited draft before sending */
  wasEdited?: boolean;

  /** Number of edits made to draft */
  editCount?: number;

  /** Time from draft generation to send (milliseconds) */
  timeToEdit?: number;

  /** Whether editing was required (true for business/high-priority) */
  requiresEditing?: boolean;

  /** Timestamp when draft was last auto-saved */
  draftSavedAt?: any; // firebase.firestore.Timestamp

  /** Draft version number (for history) */
  draftVersion?: number;

  /** Whether creator overrode "requires editing" enforcement */
  overrideApplied?: boolean;

  // =============================================
  // Story 6.4: Auto-Archive Boundary Tracking
  // =============================================

  /** Whether this is an automated boundary message (Story 6.4) */
  isAutoBoundary?: boolean;

  /** Reason for boundary message: 'low_priority' | 'capacity_exceeded' (Story 6.4) */
  boundaryReason?: string;

  /** Reference to the original message that triggered this boundary (Story 6.4) */
  originalMessageId?: string;
}

// =============================================
// Story 6.4: Auto-Archive System Types
// =============================================

/**
 * Result of auto-archive operation with kind boundary messages (Story 6.4)
 *
 * @remarks
 * Returned by autoArchiveWithKindBoundary() to track archiving outcomes.
 * Includes counts for archived messages, boundaries sent, rate-limited, and safety-blocked.
 *
 * @example
 * ```typescript
 * const result: AutoArchiveResult = {
 *   archivedCount: 12,
 *   boundariesSent: 8,
 *   rateLimited: 4,
 *   safetyBlocked: 3
 * };
 * ```
 */
export interface AutoArchiveResult {
  /** Number of messages successfully archived */
  archivedCount: number;

  /** Number of boundary messages sent to fans */
  boundariesSent: number;

  /** Number of fans who already received a boundary this week (rate limited) */
  rateLimited: number;

  /** Number of messages blocked by safety checks (business/urgent/VIP/crisis) */
  safetyBlocked: number;
}

/**
 * Undo archive record (Story 6.4)
 *
 * @remarks
 * Stored in Firestore at `/undo_archive/{undoId}`.
 * Allows creator to undo auto-archive within 24 hours.
 * Document expires automatically after 24 hours via TTL.
 *
 * @example
 * ```typescript
 * const undoRecord: UndoArchive = {
 *   id: 'undo_abc123',
 *   userId: 'user123',
 *   conversationId: 'conv456',
 *   messageId: 'msg789',
 *   archivedAt: Timestamp.now(),
 *   expiresAt: Timestamp.now() + 24h,
 *   boundaryMessageSent: true,
 *   canUndo: true
 * };
 * ```
 */
export interface UndoArchive {
  /** Unique undo record identifier */
  id: string;

  /** User ID who owns this conversation */
  userId: string;

  /** Conversation ID that was archived */
  conversationId: string;

  /** Original message ID that triggered archiving */
  messageId: string;

  /** Timestamp when message was archived */
  archivedAt: any; // firebase.firestore.Timestamp

  /** Expiration timestamp (archivedAt + 24 hours) */
  expiresAt: any; // firebase.firestore.Timestamp

  /** Whether a boundary message was sent to the fan */
  boundaryMessageSent: boolean;

  /** Whether undo is still available (false after 24 hours or if already undone) */
  canUndo: boolean;

  /** Timestamp when undo was performed (undefined if not yet undone) */
  undoneAt?: any; // firebase.firestore.Timestamp
}

/**
 * Rate limit record for boundary messages (Story 6.4)
 *
 * @remarks
 * Stored in Firestore at `/rate_limits/boundary_messages/{fanId}`.
 * Tracks when the last boundary message was sent to prevent spam (max 1 per week).
 *
 * @example
 * ```typescript
 * const rateLimit: BoundaryRateLimit = {
 *   fanId: 'fan123',
 *   creatorId: 'user456',
 *   lastBoundarySent: Timestamp.now(),
 *   expiresAt: Timestamp.now() + 7days
 * };
 * ```
 */
export interface BoundaryRateLimit {
  /** Fan user ID */
  fanId: string;

  /** Creator user ID who sent the boundary */
  creatorId: string;

  /** Timestamp when last boundary message was sent */
  lastBoundarySent: any; // firebase.firestore.Timestamp

  /** Expiration timestamp (lastBoundarySent + 7 days) */
  expiresAt: any; // firebase.firestore.Timestamp
}
