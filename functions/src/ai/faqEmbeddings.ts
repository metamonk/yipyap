/**
 * Cloud Functions for FAQ Template Embedding Generation
 * @module functions/ai/faqEmbeddings
 *
 * @remarks
 * Story 5.4 - FAQ Detection & Auto-Response
 * Generates vector embeddings for FAQ templates using OpenAI text-embedding-3-small
 * and stores them in Pinecone for semantic search during FAQ detection.
 *
 * Features:
 * - Generates 1536-dimension embeddings from FAQ question text
 * - Stores embeddings in Pinecone with metadata (creatorId, isActive, category)
 * - Implements retry logic with exponential backoff (3 attempts)
 * - Marks templates as "pending_embedding" if all retries fail
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Pinecone index name for FAQ embeddings
 */
const PINECONE_INDEX_NAME = 'yipyap-faq-embeddings';

/**
 * Maximum retry attempts for embedding generation
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff (milliseconds)
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * FAQ Template document data structure
 */
interface FAQTemplateData {
  id: string;
  creatorId: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  isActive: boolean;
  useCount: number;
  embedding?: number[];
  embeddingStatus?: 'pending' | 'completed' | 'pending_embedding' | 'failed';
  embeddingError?: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  lastUsedAt?: admin.firestore.Timestamp;
}

/**
 * Request data for generateFAQEmbedding callable function
 */
interface GenerateFAQEmbeddingRequest {
  /** FAQ template ID */
  faqId: string;

  /** FAQ question text to generate embedding from */
  question: string;
}

/**
 * Response data from generateFAQEmbedding callable function
 */
interface GenerateFAQEmbeddingResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Embedding dimension (1536 for text-embedding-3-small) */
  embeddingDimension?: number;

  /** Error message if operation failed */
  error?: string;

  /** Number of retry attempts made */
  retryAttempts?: number;
}

/**
 * Exponential backoff delay calculation
 *
 * @param attempt - Current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Sleep utility for retry delays
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates vector embedding for FAQ question text
 *
 * @param question - The FAQ question text
 * @returns Promise resolving to embedding vector (1536 dimensions)
 * @throws {Error} When OpenAI API fails or returns invalid data
 */
async function generateEmbedding(question: string): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: question,
    });

    if (!embedding || embedding.length !== 1536) {
      throw new Error(`Invalid embedding dimension: expected 1536, got ${embedding?.length || 0}`);
    }

    return embedding;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`OpenAI embedding generation failed: ${errorMessage}`);
  }
}

/**
 * Stores embedding vector in Pinecone with metadata
 *
 * @param faqId - FAQ template ID
 * @param embedding - Vector embedding (1536 dimensions)
 * @param metadata - FAQ template metadata for filtering
 * @throws {Error} When Pinecone upsert fails
 */
async function storeEmbeddingInPinecone(
  faqId: string,
  embedding: number[],
  metadata: {
    creatorId: string;
    isActive: boolean;
    category: string;
    question: string;
  }
): Promise<void> {
  try {
    const apiKey = process.env.PINECONE_API_KEY || functions.config().pinecone?.api_key;

    if (!apiKey) {
      throw new Error('PINECONE_API_KEY not configured');
    }

    const pinecone = new Pinecone({
      apiKey,
    });

    const index = pinecone.index(PINECONE_INDEX_NAME);

    // Upsert vector with metadata
    await index.upsert([
      {
        id: faqId,
        values: embedding,
        metadata: {
          creatorId: metadata.creatorId,
          isActive: metadata.isActive,
          category: metadata.category,
          question: metadata.question,
        },
      },
    ]);

    functions.logger.info('Successfully stored embedding in Pinecone', {
      faqId,
      dimension: embedding.length,
      metadata,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Pinecone upsert failed: ${errorMessage}`);
  }
}

/**
 * Updates FAQ template document with embedding status
 *
 * @param faqId - FAQ template ID
 * @param status - Embedding generation status
 * @param embedding - Optional embedding vector
 * @param error - Optional error message
 */
async function updateFAQEmbeddingStatus(
  faqId: string,
  status: 'completed' | 'pending_embedding' | 'failed',
  embedding?: number[],
  error?: string
): Promise<void> {
  const updateData: Partial<FAQTemplateData> = {
    embeddingStatus: status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
  };

  if (embedding) {
    updateData.embedding = embedding;
  }

  if (error) {
    updateData.embeddingError = error;
  }

  await db.collection('faq_templates').doc(faqId).update(updateData);

  functions.logger.info('Updated FAQ embedding status', {
    faqId,
    status,
    hasEmbedding: !!embedding,
    hasError: !!error,
  });
}

/**
 * Generates embedding for FAQ template with retry logic
 *
 * Cloud Function (HTTPS Callable)
 *
 * @remarks
 * This function is called when a new FAQ template is created or updated.
 * It generates a vector embedding from the question text and stores it in Pinecone
 * for semantic search during FAQ detection.
 *
 * Retry Logic:
 * - Maximum 3 attempts with exponential backoff (1s, 2s, 4s)
 * - Retries on network errors and transient failures
 * - Marks FAQ as "pending_embedding" if all retries fail
 *
 * @param data - Request data containing faqId and question
 * @param context - Firebase callable function context with auth info
 * @returns Promise resolving to operation result
 *
 * @throws {functions.https.HttpsError} When authentication fails or validation errors occur
 *
 * @example
 * ```typescript
 * const result = await generateFAQEmbedding({
 *   faqId: 'faq123',
 *   question: 'What are your rates?'
 * });
 *
 * if (result.success) {
 *   console.log('Embedding generated:', result.embeddingDimension);
 * }
 * ```
 */
export const generateFAQEmbedding = functions.https.onCall(
  async (
    data: GenerateFAQEmbeddingRequest,
    context: functions.https.CallableContext
  ): Promise<GenerateFAQEmbeddingResponse> => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to generate FAQ embeddings'
      );
    }

    const { faqId, question } = data;

    // Validate input
    if (!faqId || typeof faqId !== 'string') {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'faqId must be a non-empty string'
      );
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'question must be a non-empty string'
      );
    }

    functions.logger.info('Starting FAQ embedding generation', {
      faqId,
      questionLength: question.length,
      userId: context.auth.uid,
    });

    try {
      // Get FAQ template document
      const faqDoc = await db.collection('faq_templates').doc(faqId).get();

      if (!faqDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          `FAQ template with ID ${faqId} not found`
        );
      }

      const faqData = faqDoc.data() as FAQTemplateData;

      // Verify user owns this FAQ template
      if (faqData.creatorId !== context.auth.uid) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'User does not have permission to modify this FAQ template'
        );
      }

      // Retry loop with exponential backoff
      let lastError: Error | null = null;
      let embedding: number[] | null = null;

      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          functions.logger.info(`Embedding generation attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS}`, {
            faqId,
          });

          // Generate embedding using OpenAI
          embedding = await generateEmbedding(question);

          // Store embedding in Pinecone
          await storeEmbeddingInPinecone(faqId, embedding, {
            creatorId: faqData.creatorId,
            isActive: faqData.isActive,
            category: faqData.category,
            question: faqData.question,
          });

          // Success - update FAQ document
          await updateFAQEmbeddingStatus(faqId, 'completed', embedding);

          functions.logger.info('FAQ embedding generated successfully', {
            faqId,
            dimension: embedding.length,
            attempts: attempt + 1,
          });

          return {
            success: true,
            embeddingDimension: embedding.length,
            retryAttempts: attempt,
          };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          functions.logger.warn(`Embedding generation attempt ${attempt + 1} failed`, {
            faqId,
            error: lastError.message,
          });

          // If not the last attempt, wait with exponential backoff
          if (attempt < MAX_RETRY_ATTEMPTS - 1) {
            const delayMs = calculateBackoffDelay(attempt);
            functions.logger.info(`Retrying after ${delayMs}ms`, { faqId });
            await sleep(delayMs);
          }
        }
      }

      // All retries failed - mark as pending_embedding
      await updateFAQEmbeddingStatus(
        faqId,
        'pending_embedding',
        undefined,
        lastError?.message || 'Unknown error after all retries'
      );

      functions.logger.error('FAQ embedding generation failed after all retries', {
        faqId,
        attempts: MAX_RETRY_ATTEMPTS,
        error: lastError?.message,
      });

      return {
        success: false,
        error: `Failed after ${MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message || 'Unknown error'}`,
        retryAttempts: MAX_RETRY_ATTEMPTS,
      };
    } catch (error) {
      // Handle validation errors and permissions errors
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Unexpected error in generateFAQEmbedding', {
        faqId,
        error: errorMessage,
      });

      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate FAQ embedding: ${errorMessage}`
      );
    }
  }
);
