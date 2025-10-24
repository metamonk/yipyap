/**
 * Unit tests for FAQ Detection Edge Function
 * Tests the detect-faq endpoint for semantic FAQ matching
 */

// Mock dependencies BEFORE any imports
jest.mock('ai', () => ({
  embed: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: {
    embedding: jest.fn(() => 'text-embedding-3-small'),
  },
}));

jest.mock('../../../api/utils/pineconeClient', () => ({
  queryFAQMatches: jest.fn(),
  PINECONE_CONFIG: {
    indexName: 'yipyap-faq-embeddings',
    dimension: 1536,
    metric: 'cosine',
    namespace: '',
  },
}));

jest.mock('../../../api/utils/rateLimiter', () => ({
  checkRateLimit: jest.fn(),
}));

// Now import after mocks are set up
import handler from '../../../api/detect-faq';
import { queryFAQMatches, type FAQMatch } from '../../../api/utils/pineconeClient';
import { checkRateLimit } from '../../../api/utils/rateLimiter';
import { embed } from 'ai';

describe('FAQ Detection Edge Function', () => {
  const mockEmbed = embed as jest.MockedFunction<typeof embed>;
  const mockQueryFAQMatches = queryFAQMatches as jest.MockedFunction<
    typeof queryFAQMatches
  >;
  const mockCheckRateLimit = checkRateLimit as jest.MockedFunction<
    typeof checkRateLimit
  >;

  // Mock embedding vector (1536 dimensions)
  const mockEmbedding = new Array(1536).fill(0.1);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: rate limit allowed
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt: Date.now() + 60000,
    });
  });

  describe('Request validation', () => {
    it('should reject non-POST requests', async () => {
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'GET',
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(405);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Method not allowed');
    });

    it('should reject requests with missing messageId', async () => {
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required fields');
    });

    it('should reject requests with missing messageText', async () => {
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required fields');
    });

    it('should reject requests with missing creatorId', async () => {
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Missing required fields');
    });

    it('should reject empty message text', async () => {
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: '',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      // Empty string causes "Missing required fields" error
      expect(body.error).toContain('Missing required fields');
    });

    it('should reject message text exceeding 1000 characters', async () => {
      const longText = 'a'.repeat(1001);
      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: longText,
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('1-1000 characters');
    });
  });

  describe('Rate limiting', () => {
    it('should reject requests when rate limit exceeded', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        limit: 100,
        remaining: 0,
        resetAt: Date.now() + 30000,
        retryAfter: 30,
      });

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Rate limit exceeded');
      expect(response.headers.get('Retry-After')).toBe('30');
    });

    it('should check rate limit with correct key', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      mockQueryFAQMatches.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      await handler(request);

      expect(mockCheckRateLimit).toHaveBeenCalledWith('faq-detect:creator123', 100, 60);
    });
  });

  describe('FAQ Detection - High Confidence (0.85+)', () => {
    it('should return isFAQ=true for high confidence match', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const highConfidenceMatch: FAQMatch = {
        id: 'faq123',
        score: 0.92,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq123',
          isActive: true,
          category: 'pricing',
          question: 'What are your rates?',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([highConfidenceMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      // Log error if test fails
      if (response.status !== 200) {
        console.log('Error response:', body);
      }

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(true);
      expect(body.faqTemplateId).toBe('faq123');
      expect(body.matchConfidence).toBe(0.92);
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.latency).toBeGreaterThan(0);
    });

    it('should detect FAQ at exactly 0.85 threshold', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const boundaryMatch: FAQMatch = {
        id: 'faq456',
        score: 0.85,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq456',
          isActive: true,
          category: 'general',
          question: 'When are you available?',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([boundaryMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'When are you free?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(true);
      expect(body.faqTemplateId).toBe('faq456');
      expect(body.matchConfidence).toBe(0.85);
    });
  });

  describe('FAQ Detection - Medium Confidence (0.70-0.84)', () => {
    it('should return suggestedFAQ for medium confidence match', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const mediumConfidenceMatch: FAQMatch = {
        id: 'faq789',
        score: 0.77,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq789',
          isActive: true,
          category: 'availability',
          question: 'Are you available this weekend?',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([mediumConfidenceMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Can you work this weekend?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(false); // Don't auto-respond
      expect(body.matchConfidence).toBe(0.77);
      expect(body.suggestedFAQ).toBeDefined();
      expect(body.suggestedFAQ.templateId).toBe('faq789');
      expect(body.suggestedFAQ.question).toBe('Are you available this weekend?');
      expect(body.suggestedFAQ.confidence).toBe(0.77);
    });

    it('should suggest FAQ at exactly 0.70 threshold', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const boundaryMatch: FAQMatch = {
        id: 'faq101',
        score: 0.70,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq101',
          isActive: true,
          category: 'general',
          question: 'Test FAQ',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([boundaryMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Test message',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(false);
      expect(body.matchConfidence).toBe(0.70);
      expect(body.suggestedFAQ).toBeDefined();
    });

    it('should suggest FAQ just below auto-response threshold (0.84)', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const almostHighMatch: FAQMatch = {
        id: 'faq999',
        score: 0.84,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq999',
          isActive: true,
          category: 'pricing',
          question: 'How much do you charge?',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([almostHighMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What do you charge?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(false); // Should suggest, not auto-respond
      expect(body.matchConfidence).toBe(0.84);
      expect(body.suggestedFAQ).toBeDefined();
    });
  });

  describe('FAQ Detection - Low Confidence (<0.70)', () => {
    it('should return isFAQ=false for low confidence match', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      const lowConfidenceMatch: FAQMatch = {
        id: 'faq222',
        score: 0.55,
        metadata: {
          creatorId: 'creator123',
          faqId: 'faq222',
          isActive: true,
          category: 'general',
          question: 'Unrelated FAQ',
        },
      };

      mockQueryFAQMatches.mockResolvedValueOnce([lowConfidenceMatch]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Random message',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(false);
      expect(body.matchConfidence).toBe(0.55);
      expect(body.suggestedFAQ).toBeUndefined();
    });

    it('should return isFAQ=false when no matches found', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      mockQueryFAQMatches.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Completely unrelated message',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.isFAQ).toBe(false);
      expect(body.matchConfidence).toBe(0);
      expect(body.latency).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle embedding generation failure gracefully', async () => {
      mockEmbed.mockRejectedValueOnce(new Error('OpenAI API error'));

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.isFAQ).toBe(false);
      expect(body.matchConfidence).toBe(0);
      expect(body.error).toContain('Failed to generate embedding');
      expect(body.latency).toBeGreaterThan(0);
    });

    it('should handle Pinecone query failure gracefully', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      mockQueryFAQMatches.mockRejectedValueOnce(new Error('Pinecone timeout'));

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.isFAQ).toBe(false);
      expect(body.matchConfidence).toBe(0);
      expect(body.error).toContain('FAQ search failed');
    });

    it('should handle invalid embedding dimension', async () => {
      const invalidEmbedding = new Array(512).fill(0.1); // Wrong dimension

      mockEmbed.mockResolvedValueOnce({
        embedding: invalidEmbedding,
      } as any);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Failed to generate embedding');
    });

    it('should handle unexpected errors gracefully', async () => {
      mockEmbed.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'What are your rates?',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('Performance monitoring', () => {
    it('should include latency in response', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      mockQueryFAQMatches.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Test message',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(body.latency).toBeDefined();
      expect(typeof body.latency).toBe('number');
      expect(body.latency).toBeGreaterThanOrEqual(0);
    });

    it('should include model information', async () => {
      mockEmbed.mockResolvedValueOnce({
        embedding: mockEmbedding,
      } as any);

      mockQueryFAQMatches.mockResolvedValueOnce([]);

      const request = new Request('http://localhost/api/detect-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: 'msg123',
          messageText: 'Test message',
          creatorId: 'creator123',
        }),
      });

      const response = await handler(request);
      const body = await response.json();

      expect(body.model).toBe('text-embedding-3-small');
    });
  });
});
