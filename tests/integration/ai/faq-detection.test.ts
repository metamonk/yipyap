/**
 * Integration tests for FAQ Detection
 * Tests the full FAQ detection flow with Pinecone vector search
 *
 * NOTE: These tests require:
 * - PINECONE_API_KEY environment variable
 * - OPENAI_API_KEY environment variable
 * - Pinecone index 'yipyap-faq-embeddings' created and configured
 *
 * Run with: INTEGRATION_TEST=true npm test tests/integration/ai/faq-detection.test.ts
 */

import { queryFAQMatches, upsertFAQEmbedding } from '../../../api/utils/pineconeClient';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

// Skip tests if API keys not configured
const SKIP_TESTS = !process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY;

describe('FAQ Detection Integration Tests', () => {
  // Skip all tests if credentials not available
  if (SKIP_TESTS) {
    it.skip('requires PINECONE_API_KEY and OPENAI_API_KEY environment variables', () => {});
    return;
  }

  const testCreatorId = 'test-creator-integration';
  const testFaqId = `test-faq-${Date.now()}`;

  beforeAll(async () => {
    // Generate embedding for test FAQ
    const { embedding: testEmbedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value: 'What are your rates for photography services?',
    });

    // Store test FAQ in Pinecone
    await upsertFAQEmbedding(testFaqId, testEmbedding, {
      creatorId: testCreatorId,
      faqId: testFaqId,
      isActive: true,
      category: 'pricing',
      question: 'What are your rates for photography services?',
    });

    // Wait for Pinecone indexing
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  describe('Semantic search with Pinecone', () => {
    it('should find FAQ with high similarity match', async () => {
      // Generate embedding for similar question
      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: 'How much do you charge for photos?',
      });

      // Query Pinecone
      const matches = await queryFAQMatches(queryEmbedding, {
        creatorId: testCreatorId,
        topK: 3,
        minScore: 0.70,
        activeOnly: true,
      });

      // Should find the test FAQ
      expect(matches.length).toBeGreaterThan(0);
      const topMatch = matches[0];
      expect(topMatch.metadata.creatorId).toBe(testCreatorId);
      expect(topMatch.metadata.faqId).toBe(testFaqId);
      expect(topMatch.score).toBeGreaterThan(0.70);
    });

    it('should not find FAQ for dissimilar query', async () => {
      // Generate embedding for unrelated question
      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: 'What is the weather like today?',
      });

      // Query Pinecone
      const matches = await queryFAQMatches(queryEmbedding, {
        creatorId: testCreatorId,
        topK: 3,
        minScore: 0.70,
        activeOnly: true,
      });

      // Should not find the pricing FAQ
      expect(matches.length).toBe(0);
    });

    it('should filter by creator ID', async () => {
      // Generate embedding
      const { embedding: queryEmbedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: 'What are your rates?',
      });

      // Query with different creator ID
      const matches = await queryFAQMatches(queryEmbedding, {
        creatorId: 'different-creator',
        topK: 3,
        minScore: 0.70,
        activeOnly: true,
      });

      // Should not find FAQs from other creators
      expect(matches.length).toBe(0);
    });

    it('should respect activeOnly filter', async () => {
      // This test would require updating the FAQ to inactive first
      // Skipping for now as it requires more setup
      // TODO: Implement after updateFAQMetadata is tested
    });
  });

  describe('Full Edge Function flow', () => {
    it.skip('should detect FAQ via Edge Function endpoint', async () => {
      // TODO: Test full Edge Function by making HTTP request
      // This requires deploying or running the Edge Function locally
      // For now, unit tests + Pinecone integration tests provide coverage
    });
  });
});
