/**
 * FAQ Detection Edge Function
 *
 * Performs semantic similarity search to detect if an incoming message matches
 * a creator's FAQ template. Uses OpenAI embeddings + Pinecone vector search.
 *
 * @module api/detect-faq
 */

import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import * as admin from 'firebase-admin';
import {
  queryFAQMatches,
  PINECONE_CONFIG,
  type FAQMatch,
} from './utils/pineconeClient';
import { checkRateLimit } from './utils/rateLimiter';

// Initialize Firebase Admin if not already initialized
// Required for fetching FAQ template answers from Firestore
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Runtime configuration
 * Note: Using Node.js runtime (configured in vercel.json) to support Pinecone client
 * which requires Node.js modules (fs, stream, path)
 */
// Runtime specified in vercel.json

/**
 * Request body schema for FAQ detection
 */
interface DetectFAQRequest {
  /** Message ID for tracking */
  messageId: string;

  /** Message text to analyze */
  messageText: string;

  /** Creator user ID to match FAQs for */
  creatorId: string;
}

/**
 * Performance metrics breakdown
 */
interface PerformanceMetrics {
  /** Total end-to-end latency in milliseconds */
  totalMs: number;

  /** Embedding generation latency in milliseconds */
  embeddingMs: number;

  /** Pinecone query latency in milliseconds */
  pineconeMs: number;

  /** Other overhead (parsing, validation, etc.) in milliseconds */
  overheadMs: number;
}

/**
 * Response schema for FAQ detection
 */
interface DetectFAQResponse {
  /** Whether detection was successful */
  success: boolean;

  /** Whether message matches an FAQ */
  isFAQ: boolean;

  /** Matched FAQ template ID (if isFAQ is true) */
  faqTemplateId?: string;

  /** Match confidence score (0-1) */
  matchConfidence: number;

  /** FAQ answer text */
  faqAnswer?: string;

  /** Suggested FAQ for medium-confidence matches (0.70-0.84) */
  suggestedFAQ?: {
    templateId: string;
    question: string;
    answer: string;
    confidence: number;
  };

  /** Processing latency in milliseconds (deprecated - use performance.totalMs) */
  latency: number;

  /** Detailed performance metrics breakdown */
  performance: PerformanceMetrics;

  /** Model used for embeddings */
  model: string;

  /** Error message if detection failed */
  error?: string;
}

/**
 * Helper function to fetch FAQ template from Firestore
 * @param faqId - FAQ template ID
 * @returns FAQ template answer text, or null if not found
 */
async function getFAQAnswer(faqId: string): Promise<string | null> {
  try {
    const faqDoc = await db.collection('faq_templates').doc(faqId).get();
    if (!faqDoc.exists) {
      console.warn(`FAQ template ${faqId} not found in Firestore`);
      return null;
    }
    const data = faqDoc.data();
    return data?.answer || null;
  } catch (error) {
    console.error(`Failed to fetch FAQ template ${faqId}:`, error);
    return null;
  }
}

/**
 * FAQ confidence thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  /** Auto-response threshold (0.85+) */
  AUTO_RESPONSE: 0.85,

  /** Suggestion threshold (0.70-0.84) */
  SUGGEST: 0.70,
} as const;

/**
 * FAQ Detection Edge Function Handler
 *
 * Processes incoming messages to detect FAQ matches using:
 * 1. Generate embedding with OpenAI text-embedding-3-small
 * 2. Query Pinecone for similar FAQ templates
 * 3. Return match with confidence score
 *
 * @param request - HTTP request with message data
 * @returns JSON response with FAQ detection results
 */
export default async function handler(request: Request): Promise<Response> {
  const startTime = Date.now();

  // Validate request method
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Method not allowed - use POST',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    // Parse request body
    const body = (await request.json()) as DetectFAQRequest;
    const { messageId, messageText, creatorId } = body;

    // Validate required fields
    if (!messageId || !messageText || !creatorId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: messageId, messageText, creatorId',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate message text length
    if (messageText.length === 0 || messageText.length > 1000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Message text must be 1-1000 characters',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limit (100 requests per minute per creator)
    const rateLimitKey = `faq-detect:${creatorId}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 100, 60);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded - too many FAQ detection requests',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimitResult.retryAfter || 60),
          },
        }
      );
    }

    // Generate embedding using OpenAI text-embedding-3-small
    let embeddingVector: number[];
    let embeddingLatency = 0;

    try {
      const embeddingStartTime = Date.now();

      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: messageText,
      });

      embeddingVector = embedding;
      embeddingLatency = Date.now() - embeddingStartTime;

      // Performance logging for monitoring (Subtask 17.2: Target <200ms)
      console.log(JSON.stringify({
        event: 'embedding_generated',
        messageId,
        creatorId,
        latencyMs: embeddingLatency,
        embeddingDimension: embedding.length,
        targetMs: 200,
        withinTarget: embeddingLatency < 200,
      }));

      // Validate embedding dimension
      if (embedding.length !== PINECONE_CONFIG.dimension) {
        throw new Error(
          `Invalid embedding dimension: expected ${PINECONE_CONFIG.dimension}, got ${embedding.length}`
        );
      }
    } catch (error) {
      const totalLatency = Date.now() - startTime;
      console.error('Embedding generation failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          isFAQ: false,
          matchConfidence: 0,
          latency: totalLatency,
          performance: {
            totalMs: totalLatency,
            embeddingMs: embeddingLatency,
            pineconeMs: 0,
            overheadMs: totalLatency - embeddingLatency,
          },
          model: 'text-embedding-3-small',
          error: 'Failed to generate embedding - please try again',
        } satisfies DetectFAQResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Query Pinecone for similar FAQ templates
    let faqMatches: FAQMatch[];
    let pineconeLatency = 0;

    try {
      const pineconeStartTime = Date.now();

      faqMatches = await queryFAQMatches(embeddingVector, {
        creatorId,
        topK: 3,
        minScore: CONFIDENCE_THRESHOLDS.SUGGEST, // 0.70 minimum
        activeOnly: true,
      });

      pineconeLatency = Date.now() - pineconeStartTime;

      // Performance logging for monitoring (Subtask 17.3: Target <50ms)
      console.log(JSON.stringify({
        event: 'pinecone_query_completed',
        messageId,
        creatorId,
        latencyMs: pineconeLatency,
        matchCount: faqMatches.length,
        topScore: faqMatches[0]?.score || 0,
        targetMs: 50,
        withinTarget: pineconeLatency < 50,
      }));
    } catch (error) {
      const totalLatency = Date.now() - startTime;
      console.error('Pinecone query failed:', error);
      return new Response(
        JSON.stringify({
          success: false,
          isFAQ: false,
          matchConfidence: 0,
          latency: totalLatency,
          performance: {
            totalMs: totalLatency,
            embeddingMs: embeddingLatency,
            pineconeMs: pineconeLatency,
            overheadMs: totalLatency - embeddingLatency - pineconeLatency,
          },
          model: 'text-embedding-3-small',
          error: 'FAQ search failed - please try again',
        } satisfies DetectFAQResponse),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine FAQ match based on confidence
    const totalLatency = Date.now() - startTime;
    const overheadLatency = totalLatency - embeddingLatency - pineconeLatency;

    // Overall performance logging (Subtask 17.4: Target <500ms at 95th percentile)
    console.log(JSON.stringify({
      event: 'faq_detection_completed',
      messageId,
      creatorId,
      performance: {
        totalMs: totalLatency,
        embeddingMs: embeddingLatency,
        pineconeMs: pineconeLatency,
        overheadMs: overheadLatency,
      },
      targetMs: 500,
      withinTarget: totalLatency < 500,
      matchFound: faqMatches.length > 0,
    }));

    // Create performance metrics object for all responses
    const performanceMetrics: PerformanceMetrics = {
      totalMs: totalLatency,
      embeddingMs: embeddingLatency,
      pineconeMs: pineconeLatency,
      overheadMs: overheadLatency,
    };

    if (faqMatches.length === 0) {
      // No matches found
      return new Response(
        JSON.stringify({
          success: true,
          isFAQ: false,
          matchConfidence: 0,
          latency: totalLatency,
          performance: performanceMetrics,
          model: 'text-embedding-3-small',
        } satisfies DetectFAQResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get best match
    const bestMatch = faqMatches[0];

    // High confidence (0.85+) - auto-response
    if (bestMatch.score >= CONFIDENCE_THRESHOLDS.AUTO_RESPONSE) {
      // Fetch actual FAQ answer from Firestore (QA Fix DATA-001)
      const faqAnswer = await getFAQAnswer(bestMatch.id);

      if (!faqAnswer) {
        // Graceful degradation: if answer not found, log error and continue without FAQ
        console.error(`FAQ template ${bestMatch.id} found in Pinecone but not in Firestore`);
        return new Response(
          JSON.stringify({
            success: true,
            isFAQ: false,
            matchConfidence: bestMatch.score,
            error: 'FAQ template not found in database',
            latency: Date.now() - startTime,
            performance: performanceMetrics,
            model: 'text-embedding-3-small',
          } satisfies DetectFAQResponse),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          isFAQ: true,
          faqTemplateId: bestMatch.id,
          matchConfidence: bestMatch.score,
          faqAnswer, // Return actual answer from Firestore
          latency: totalLatency,
          performance: performanceMetrics,
          model: 'text-embedding-3-small',
        } satisfies DetectFAQResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Medium confidence (0.70-0.84) - suggest to creator
    if (bestMatch.score >= CONFIDENCE_THRESHOLDS.SUGGEST) {
      // Fetch actual FAQ answer from Firestore (QA Fix DATA-001)
      const faqAnswer = await getFAQAnswer(bestMatch.id);

      if (!faqAnswer) {
        // Graceful degradation: if answer not found, skip suggestion
        console.error(`FAQ template ${bestMatch.id} found in Pinecone but not in Firestore`);
        return new Response(
          JSON.stringify({
            success: true,
            isFAQ: false,
            matchConfidence: bestMatch.score,
            error: 'FAQ template not found in database',
            latency: Date.now() - startTime,
            performance: performanceMetrics,
            model: 'text-embedding-3-small',
          } satisfies DetectFAQResponse),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          isFAQ: false, // Don't auto-respond
          matchConfidence: bestMatch.score,
          suggestedFAQ: {
            templateId: bestMatch.id,
            question: bestMatch.metadata.question,
            answer: faqAnswer, // Return actual answer from Firestore
            confidence: bestMatch.score,
          },
          latency: totalLatency,
          performance: performanceMetrics,
          model: 'text-embedding-3-small',
        } satisfies DetectFAQResponse),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Below suggestion threshold - no FAQ match
    return new Response(
      JSON.stringify({
        success: true,
        isFAQ: false,
        matchConfidence: bestMatch.score,
        latency: totalLatency,
        performance: performanceMetrics,
        model: 'text-embedding-3-small',
      } satisfies DetectFAQResponse),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    const totalLatency = Date.now() - startTime;
    console.error('FAQ detection error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        isFAQ: false,
        matchConfidence: 0,
        latency: totalLatency,
        performance: {
          totalMs: totalLatency,
          embeddingMs: 0,
          pineconeMs: 0,
          overheadMs: totalLatency,
        },
        model: 'text-embedding-3-small',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      } satisfies DetectFAQResponse),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
