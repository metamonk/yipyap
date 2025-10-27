/**
 * Pinecone Vector Database Client for Cloud Functions (migrated from Edge Functions in Story 6.10)
 *
 * Provides Pinecone client for FAQ vector similarity search in Cloud Functions.
 * Uses OpenAI text-embedding-3-small embeddings (1536 dimensions) with cosine similarity.
 *
 * **Migration Notes (Story 6.10):**
 * - Migrated from Edge Functions (`api/utils/pineconeClient.ts`) to Cloud Functions
 * - All functionality remains identical
 * - Updated error messages to remove Vercel-specific references
 *
 * @module functions/src/utils/pineconeClient
 * @see {@link https://docs.pinecone.io/docs/overview|Pinecone Documentation}
 */

import { Pinecone } from '@pinecone-database/pinecone';

/**
 * Pinecone index configuration for FAQ embeddings
 */
export const PINECONE_CONFIG = {
  /** Name of the Pinecone index for FAQ embeddings */
  indexName: 'yipyap-faq-embeddings',
  /** Vector dimension - matches OpenAI text-embedding-3-small */
  dimension: 1536,
  /** Similarity metric - cosine for semantic similarity */
  metric: 'cosine' as const,
  /** Namespace for organizing vectors (optional) */
  namespace: '',
} as const;

/**
 * Metadata structure for FAQ vectors stored in Pinecone
 */
export interface FAQVectorMetadata {
  /** Creator user ID who owns this FAQ */
  creatorId: string;
  /** FAQ template ID from Firestore */
  faqId: string;
  /** Whether this FAQ is currently active */
  isActive: boolean;
  /** FAQ category for organization */
  category: string;
  /** The FAQ question text */
  question: string;
  /** Index signature for Pinecone compatibility */
  [key: string]: string | boolean;
}

/**
 * Query result from Pinecone vector search
 */
export interface FAQMatch {
  /** FAQ template ID */
  id: string;
  /** Cosine similarity score (0-1, higher is better) */
  score: number;
  /** FAQ metadata */
  metadata: FAQVectorMetadata;
}

/**
 * Options for FAQ vector search queries
 */
export interface QueryOptions {
  /** Number of top matches to return (default: 3) */
  topK?: number;
  /** Minimum similarity score threshold (0-1) */
  minScore?: number;
  /** Creator ID to filter results */
  creatorId?: string;
  /** Only include active FAQs */
  activeOnly?: boolean;
  /** FAQ category filter */
  category?: string;
}

/**
 * Initialize Pinecone client with API key from environment
 *
 * @returns Initialized Pinecone client instance
 * @throws {Error} When PINECONE_API_KEY environment variable is missing
 *
 * @example
 * ```typescript
 * const pinecone = initPinecone();
 * const index = pinecone.index('yipyap-faq-embeddings');
 * ```
 */
export function initPinecone(): Pinecone {
  const apiKey = process.env.PINECONE_API_KEY;

  if (!apiKey) {
    throw new Error(
      'PINECONE_API_KEY environment variable is required but not set. ' +
        'Please configure it in Firebase Functions environment.'
    );
  }

  return new Pinecone({
    apiKey,
  });
}

/**
 * Query Pinecone for similar FAQ templates using vector search
 *
 * Performs semantic similarity search to find FAQ templates matching
 * the given message embedding. Supports filtering by creator, category,
 * and active status.
 *
 * @param embedding - Vector embedding of the message (1536 dimensions)
 * @param options - Query options for filtering and limiting results
 * @returns Promise resolving to array of FAQ matches sorted by similarity score
 * @throws {Error} When Pinecone query fails or times out
 *
 * @example
 * ```typescript
 * const embedding = [0.1, 0.2, ...]; // 1536-dim vector
 * const matches = await queryFAQMatches(embedding, {
 *   creatorId: 'user123',
 *   topK: 3,
 *   minScore: 0.85,
 *   activeOnly: true
 * });
 * ```
 */
export async function queryFAQMatches(
  embedding: number[],
  options: QueryOptions = {}
): Promise<FAQMatch[]> {
  const { topK = 3, minScore = 0, creatorId, activeOnly = true, category } = options;

  // Validate embedding dimension
  if (embedding.length !== PINECONE_CONFIG.dimension) {
    throw new Error(
      `Invalid embedding dimension: expected ${PINECONE_CONFIG.dimension}, got ${embedding.length}`
    );
  }

  try {
    const pinecone = initPinecone();
    const index = pinecone.index(PINECONE_CONFIG.indexName);

    // Build metadata filter

    const filter: Record<string, { $eq: string | boolean }> = {};

    if (creatorId) {
      filter.creatorId = { $eq: creatorId };
    }

    if (activeOnly) {
      filter.isActive = { $eq: true };
    }

    if (category) {
      filter.category = { $eq: category };
    }

    // Query Pinecone with 1s timeout for edge performance (increased for reliability)
    const queryResponse = await Promise.race([
      index.query({
        vector: embedding,
        topK,
        includeMetadata: true,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Pinecone query timeout (1s)')), 1000)
      ),
    ]);

    // Filter by minimum score and map to FAQMatch format
    const matches = (queryResponse.matches || [])
      .filter((match) => match.score && match.score >= minScore)
      .map((match) => ({
        id: match.id,
        score: match.score!,
        metadata: match.metadata as unknown as FAQVectorMetadata,
      }));

    return matches;
  } catch (error) {
    // Log error but don't expose sensitive details
    console.error('Pinecone query failed:', error);
    throw new Error(
      error instanceof Error && error.message.includes('timeout')
        ? 'FAQ search timed out - please try again'
        : 'FAQ search failed - service temporarily unavailable'
    );
  }
}

/**
 * Upsert a single FAQ embedding to Pinecone
 *
 * Stores or updates an FAQ template's vector embedding in Pinecone
 * with associated metadata for filtering. Used when creating or
 * updating FAQ templates.
 *
 * @param id - FAQ template ID (should match Firestore document ID)
 * @param embedding - Vector embedding of FAQ question (1536 dimensions)
 * @param metadata - FAQ metadata for filtering
 * @returns Promise that resolves when upsert completes
 * @throws {Error} When upsert operation fails
 *
 * @example
 * ```typescript
 * await upsertFAQEmbedding('faq123', embedding, {
 *   creatorId: 'user123',
 *   faqId: 'faq123',
 *   isActive: true,
 *   category: 'pricing',
 *   question: 'What are your rates?'
 * });
 * ```
 */
export async function upsertFAQEmbedding(
  id: string,
  embedding: number[],
  metadata: FAQVectorMetadata
): Promise<void> {
  // Validate embedding dimension
  if (embedding.length !== PINECONE_CONFIG.dimension) {
    throw new Error(
      `Invalid embedding dimension: expected ${PINECONE_CONFIG.dimension}, got ${embedding.length}`
    );
  }

  try {
    const pinecone = initPinecone();
    const index = pinecone.index(PINECONE_CONFIG.indexName);

    await index.upsert([
      {
        id,
        values: embedding,
        metadata,
      },
    ]);
  } catch (error) {
    console.error('Pinecone upsert failed:', error);
    throw new Error('Failed to store FAQ embedding - please retry');
  }
}

/**
 * Delete an FAQ embedding from Pinecone
 *
 * Removes an FAQ template's vector from Pinecone when the template
 * is deleted from Firestore.
 *
 * @param id - FAQ template ID to delete
 * @returns Promise that resolves when deletion completes
 * @throws {Error} When deletion fails
 *
 * @example
 * ```typescript
 * await deleteFAQEmbedding('faq123');
 * ```
 */
export async function deleteFAQEmbedding(id: string): Promise<void> {
  try {
    const pinecone = initPinecone();
    const index = pinecone.index(PINECONE_CONFIG.indexName);

    await index.deleteOne(id);
  } catch (error) {
    console.error('Pinecone delete failed:', error);
    throw new Error('Failed to delete FAQ embedding - please retry');
  }
}

/**
 * Update FAQ metadata in Pinecone without changing the embedding
 *
 * Updates metadata fields (like isActive, category) without regenerating
 * the embedding. Useful for toggling FAQ active status or updating categories.
 *
 * @param id - FAQ template ID to update
 * @param updates - Partial metadata updates
 * @returns Promise that resolves when update completes
 * @throws {Error} When update operation fails
 *
 * @example
 * ```typescript
 * await updateFAQMetadata('faq123', { isActive: false });
 * ```
 */
export async function updateFAQMetadata(
  id: string,
  updates: Partial<FAQVectorMetadata>
): Promise<void> {
  try {
    const pinecone = initPinecone();
    const index = pinecone.index(PINECONE_CONFIG.indexName);

    await index.update({
      id,
      metadata: updates,
    });
  } catch (error) {
    console.error('Pinecone metadata update failed:', error);
    throw new Error('Failed to update FAQ metadata - please retry');
  }
}
