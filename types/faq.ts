/**
 * FAQ-related type definitions for FAQ Detection & Auto-Response feature (Story 5.4)
 *
 * @module types/faq
 */

import { Timestamp } from 'firebase/firestore';

/**
 * FAQ template for automatic response to frequently asked questions
 *
 * @remarks
 * FAQ templates are stored in Firestore at `/faq_templates/{templateId}`.
 * Each template has an associated vector embedding stored in Pinecone for semantic search.
 * When a message matches an FAQ (confidence > 0.85), the system automatically sends
 * the template's answer as a response.
 *
 * Firestore Collection Path: `/faq_templates/{templateId}`
 *
 * @example
 * ```typescript
 * const faqTemplate: FAQTemplate = {
 *   id: 'faq123',
 *   creatorId: 'user123',
 *   question: 'What are your rates for custom videos?',
 *   answer: 'My custom video rates start at $50 for a 30-second personalized message.',
 *   keywords: ['rates', 'pricing', 'cost', 'custom video'],
 *   category: 'pricing',
 *   isActive: true,
 *   useCount: 42,
 *   lastUsedAt: Timestamp.now(),
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface FAQTemplate {
  /** Unique FAQ template identifier (Firestore document ID) */
  id: string;

  /** User ID of the creator who owns this FAQ template */
  creatorId: string;

  /**
   * The FAQ question pattern
   * @remarks
   * This text is used to generate the vector embedding for semantic matching.
   * Should be phrased as a natural question that fans might ask.
   * Max length: 500 characters
   */
  question: string;

  /**
   * The automatic response text
   * @remarks
   * This is sent as a message when the FAQ is matched with high confidence.
   * Should be clear, concise, and professional.
   * Max length: 1000 characters (same as regular message limit)
   */
  answer: string;

  /**
   * Keywords for basic text matching (optional fallback)
   * @remarks
   * Used as a simple fallback if Pinecone vector search is unavailable.
   * Not the primary matching mechanism - embeddings are preferred.
   */
  keywords: string[];

  /**
   * FAQ category for organization
   * @remarks
   * Categories help creators organize their FAQs and filter in the UI.
   * Examples: 'pricing', 'availability', 'shipping', 'general'
   */
  category: string;

  /**
   * Whether this FAQ is currently active
   * @remarks
   * Inactive FAQs are not matched against incoming messages.
   * Creators can toggle this to temporarily disable specific FAQs.
   * Default: true
   */
  isActive: boolean;

  /**
   * Number of times this FAQ has been used for auto-responses
   * @remarks
   * Incremented each time an auto-response is sent using this template.
   * Used for analytics and sorting FAQs by popularity.
   * Default: 0
   */
  useCount: number;

  /**
   * Timestamp when this FAQ was last used for an auto-response
   * @remarks
   * Updated when an auto-response is sent using this template.
   * Used for "Most Recently Used" sorting and analytics.
   */
  lastUsedAt?: Timestamp;

  /**
   * Vector embedding for semantic search (optional field)
   * @remarks
   * 1536-dimensional vector from OpenAI text-embedding-3-small model.
   * Stored in Pinecone for fast similarity search, not in Firestore.
   * This field is only present during embedding generation workflow.
   */
  embedding?: number[];

  /** Timestamp when the FAQ template was created */
  createdAt: Timestamp;

  /** Timestamp when the FAQ template was last updated */
  updatedAt: Timestamp;
}

/**
 * Input data for creating a new FAQ template
 *
 * @remarks
 * This type excludes auto-generated fields like id, timestamps, and useCount.
 * Used by the FAQ creation service layer and UI components.
 */
export interface CreateFAQTemplateInput {
  /** The FAQ question pattern */
  question: string;

  /** The automatic response text */
  answer: string;

  /** Keywords for matching (optional, defaults to []) */
  keywords?: string[];

  /** FAQ category (optional, defaults to 'general') */
  category?: string;

  /** Whether FAQ is active (optional, defaults to true) */
  isActive?: boolean;
}

/**
 * Input data for updating an existing FAQ template
 *
 * @remarks
 * All fields are optional - only provided fields will be updated.
 * If question is updated, the embedding will be regenerated automatically.
 */
export interface UpdateFAQTemplateInput {
  /** Updated question (triggers embedding regeneration) */
  question?: string;

  /** Updated answer text */
  answer?: string;

  /** Updated keywords */
  keywords?: string[];

  /** Updated category */
  category?: string;

  /** Updated active status */
  isActive?: boolean;
}

/**
 * FAQ analytics data for a creator
 *
 * @remarks
 * Aggregated statistics about FAQ usage and performance.
 * Calculated from FAQ templates and message metadata.
 */
export interface FAQAnalytics {
  /** Total number of FAQ templates created */
  totalTemplates: number;

  /** Number of active FAQ templates */
  activeTemplates: number;

  /** Total auto-responses sent across all FAQs */
  totalAutoResponses: number;

  /**
   * Estimated time saved in minutes
   * @remarks
   * Calculated as: totalAutoResponses × average response time (2 min)
   * Shows creators the value of auto-responses
   */
  timeSavedMinutes: number;

  /**
   * Top FAQs by usage count
   * @remarks
   * Sorted by useCount in descending order, limited to top 10
   */
  topFAQs: Array<{
    /** FAQ template ID */
    id: string;

    /** FAQ question */
    question: string;

    /** Number of times used */
    useCount: number;

    /** Category */
    category: string;
  }>;

  /**
   * FAQ usage by category
   * @remarks
   * Breakdown of auto-responses by category
   * Example: { pricing: 42, availability: 18, general: 7 }
   */
  usageByCategory: Record<string, number>;
}

/**
 * FAQ match result from Edge Function detection
 *
 * @remarks
 * Returned by the detect-faq Edge Function when a message matches an FAQ.
 * Contains the matched FAQ template and confidence score.
 */
export interface FAQDetectionResult {
  /** Whether FAQ detection was successful */
  success: boolean;

  /** Whether this message matches an FAQ */
  isFAQ: boolean;

  /** Matched FAQ template ID (if isFAQ is true) */
  faqTemplateId?: string;

  /**
   * Match confidence score (0-1 range)
   * @remarks
   * - 0.85+: High confidence - auto-response sent
   * - 0.70-0.84: Medium confidence - suggest to creator
   * - <0.70: Low confidence - no FAQ match
   */
  matchConfidence: number;

  /** The FAQ answer text (for preview or auto-response) */
  faqAnswer?: string;

  /**
   * Suggested FAQ for creator approval (medium confidence matches)
   * @remarks
   * Only present when matchConfidence is between 0.70 and 0.84
   */
  suggestedFAQ?: {
    /** Template ID */
    templateId: string;

    /** FAQ question */
    question: string;

    /** FAQ answer */
    answer: string;

    /** Confidence score */
    confidence: number;
  };

  /** Processing latency in milliseconds */
  latency: number;

  /** AI model used for embedding generation */
  model: 'text-embedding-3-small';

  /** Error message if detection failed */
  error?: string;
}

/**
 * FAQ categories available for classification
 *
 * @remarks
 * Predefined categories for organizing FAQ templates.
 * Creators can select from these categories when creating FAQs.
 */
export const FAQ_CATEGORIES = [
  'general',
  'pricing',
  'availability',
  'shipping',
  'refunds',
  'technical',
  'other',
] as const;

/**
 * FAQ category type
 */
export type FAQCategory = typeof FAQ_CATEGORIES[number];

/**
 * FAQ confidence thresholds for different actions
 *
 * @remarks
 * These thresholds determine how the system handles FAQ matches:
 * - AUTO_RESPONSE: Send automatic response immediately
 * - SUGGEST: Show suggestion to creator for manual approval
 * - NO_MATCH: Below this threshold, no FAQ action taken
 */
export const FAQ_CONFIDENCE_THRESHOLDS = {
  /** Threshold for automatic response (0.85) */
  AUTO_RESPONSE: 0.85,

  /** Threshold for suggesting FAQ to creator (0.70) */
  SUGGEST: 0.70,

  /** Below this threshold, no FAQ match (0.70) */
  NO_MATCH: 0.70,
} as const;
