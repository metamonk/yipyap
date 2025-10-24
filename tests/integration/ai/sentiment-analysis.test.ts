/**
 * Sentiment Analysis Integration Tests (Story 5.3 - Task 12)
 *
 * E2E integration tests for the combined categorization + sentiment API endpoint.
 * Tests the full flow from request to response including error scenarios.
 *
 * Prerequisites:
 * - Edge function deployed at EXPO_PUBLIC_VERCEL_EDGE_URL
 * - Valid Firebase auth token
 *
 * To run:
 * npm test tests/integration/ai/sentiment-analysis.test.ts
 */

// Test configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_VERCEL_EDGE_URL || 'https://api.yipyap.wtf';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-for-validation';

interface CategorizationRequest {
  messageId: string;
  messageText: string;
  conversationId: string;
  senderId: string;
}

interface CategorizationResponse {
  success: boolean;
  category: string;
  confidence: number;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  emotionalTone: string[];
  crisisDetected: boolean;
  latency: number;
  model: string;
  error?: string;
}

describe('Sentiment Analysis Integration Tests (Task 12)', () => {
  // Skip if running in unit test mode (no API access)
  const shouldRun = process.env.RUN_INTEGRATION_TESTS === 'true';

  if (!shouldRun) {
    it.skip('Skipped - Set RUN_INTEGRATION_TESTS=true to run integration tests', () => {});
    return;
  }

  const CATEGORIZE_ENDPOINT = `${API_BASE_URL}/api/categorize-message`;

  /**
   * Helper to make API request
   */
  async function categorizeMessage(
    request: Partial<CategorizationRequest>,
    authToken: string = TEST_AUTH_TOKEN
  ): Promise<Response> {
    return fetch(CATEGORIZE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(request),
    });
  }

  describe('Successful Categorization + Sentiment Analysis', () => {
    it('should return valid response for positive message', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-positive-1',
        messageText: 'I love this so much! You\'re amazing!',
        conversationId: 'test-conv-1',
        senderId: 'test-user-1',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();

      // Validate response structure
      expect(result.success).toBe(true);
      expect(result.sentiment).toBe('positive');
      expect(result.sentimentScore).toBeGreaterThan(0);
      expect(result.sentimentScore).toBeLessThanOrEqual(1);
      expect(Array.isArray(result.emotionalTone)).toBe(true);
      expect(result.emotionalTone.length).toBeGreaterThan(0);
      expect(result.crisisDetected).toBe(false);
      expect(typeof result.category).toBe('string');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(typeof result.latency).toBe('number');
      expect(typeof result.model).toBe('string');
    });

    it('should return valid response for negative message', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-negative-1',
        messageText: 'I hate this. Everything is terrible and I feel awful.',
        conversationId: 'test-conv-2',
        senderId: 'test-user-2',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBeLessThan(0);
      expect(result.sentimentScore).toBeGreaterThanOrEqual(-1);
      expect(Array.isArray(result.emotionalTone)).toBe(true);
      expect(result.emotionalTone.length).toBeGreaterThan(0);
    });

    it('should return valid response for neutral message', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-neutral-1',
        messageText: 'The meeting is scheduled for 3pm tomorrow.',
        conversationId: 'test-conv-3',
        senderId: 'test-user-3',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();

      expect(result.success).toBe(true);
      expect(result.sentiment).toMatch(/^(neutral|mixed)$/);
      expect(result.sentimentScore).toBeGreaterThanOrEqual(-1);
      expect(result.sentimentScore).toBeLessThanOrEqual(1);
    });

    it('should detect crisis for severely negative message', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-crisis-1',
        messageText: 'I can\'t take this anymore. Everything is hopeless and I don\'t want to go on.',
        conversationId: 'test-conv-4',
        senderId: 'test-user-4',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe('negative');
      expect(result.sentimentScore).toBeLessThan(-0.7);
      expect(result.crisisDetected).toBe(true);
      expect(result.category).toBe('urgent'); // Should force urgent category
    });

    it('should force urgent category for very negative sentiment (< -0.5)', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-urgent-1',
        messageText: 'I\'m so angry and frustrated! This is unacceptable!',
        conversationId: 'test-conv-5',
        senderId: 'test-user-5',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();

      expect(result.success).toBe(true);
      expect(result.sentiment).toBe('negative');

      if (result.sentimentScore < -0.5) {
        expect(result.category).toBe('urgent');
      }
    });

    it('should include emotional tones in response', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-emotion-1',
        messageText: 'Thank you so much! I\'m really grateful for your help!',
        conversationId: 'test-conv-6',
        senderId: 'test-user-6',
      };

      const response = await categorizeMessage(request);
      const result: CategorizationResponse = await response.json();

      expect(result.success).toBe(true);
      expect(result.emotionalTone).toBeDefined();
      expect(Array.isArray(result.emotionalTone)).toBe(true);
      expect(result.emotionalTone.length).toBeGreaterThan(0);

      // Should detect grateful/thankful tone
      const tones = result.emotionalTone.map(t => t.toLowerCase());
      const hasPositiveTone = tones.some(t =>
        t.includes('grateful') || t.includes('thankful') || t.includes('happy')
      );
      expect(hasPositiveTone).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should reject request with missing messageText', async () => {
      const request = {
        messageId: 'test-invalid-1',
        conversationId: 'test-conv-7',
        senderId: 'test-user-7',
        // messageText missing
      };

      const response = await categorizeMessage(request);
      expect(response.status).toBe(400);

      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject request with empty messageText', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-invalid-2',
        messageText: '',
        conversationId: 'test-conv-8',
        senderId: 'test-user-8',
      };

      const response = await categorizeMessage(request);
      expect(response.status).toBe(400);
    });

    it('should reject request with missing required fields', async () => {
      const request = {
        messageText: 'Hello world',
        // Missing messageId, conversationId, senderId
      };

      const response = await categorizeMessage(request);
      expect(response.status).toBe(400);
    });

    it('should reject request with invalid auth token', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-auth-1',
        messageText: 'Hello world',
        conversationId: 'test-conv-9',
        senderId: 'test-user-9',
      };

      const response = await categorizeMessage(request, 'invalid-token');
      expect(response.status).toBe(401);
    });

    it('should reject request with no auth token', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-auth-2',
        messageText: 'Hello world',
        conversationId: 'test-conv-10',
        senderId: 'test-user-10',
      };

      const response = await categorizeMessage(request, '');
      expect(response.status).toBe(401);
    });
  });

  describe('Response Format Validation', () => {
    it('should always include all required fields', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-format-1',
        messageText: 'Testing response format',
        conversationId: 'test-conv-11',
        senderId: 'test-user-11',
      };

      const response = await categorizeMessage(request);
      const result: CategorizationResponse = await response.json();

      // Required fields
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('sentiment');
      expect(result).toHaveProperty('sentimentScore');
      expect(result).toHaveProperty('emotionalTone');
      expect(result).toHaveProperty('crisisDetected');
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('model');
    });

    it('should return valid sentiment types only', async () => {
      const messages = [
        'Great!',
        'Terrible.',
        'Okay.',
        'Mixed feelings about this.',
      ];

      for (const messageText of messages) {
        const request: CategorizationRequest = {
          messageId: `test-sentiment-type-${messageText}`,
          messageText,
          conversationId: 'test-conv-12',
          senderId: 'test-user-12',
        };

        const response = await categorizeMessage(request);
        const result: CategorizationResponse = await response.json();

        expect(result.sentiment).toMatch(/^(positive|negative|neutral|mixed)$/);
      }
    });

    it('should return sentiment scores within valid range (-1 to 1)', async () => {
      const messages = [
        'I absolutely love this!',
        'This is terrible and awful.',
        'It\'s fine.',
        'I have mixed feelings.',
      ];

      for (const messageText of messages) {
        const request: CategorizationRequest = {
          messageId: `test-score-range-${messageText}`,
          messageText,
          conversationId: 'test-conv-13',
          senderId: 'test-user-13',
        };

        const response = await categorizeMessage(request);
        const result: CategorizationResponse = await response.json();

        expect(result.sentimentScore).toBeGreaterThanOrEqual(-1);
        expect(result.sentimentScore).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short messages', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-short-1',
        messageText: 'Hi',
        conversationId: 'test-conv-14',
        senderId: 'test-user-14',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle messages with special characters', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-special-1',
        messageText: 'This is great!!! 😊🎉 #amazing @user',
        conversationId: 'test-conv-15',
        senderId: 'test-user-15',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle messages with line breaks', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-multiline-1',
        messageText: 'First line\nSecond line\nThird line',
        conversationId: 'test-conv-16',
        senderId: 'test-user-16',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();
      expect(result.success).toBe(true);
    });

    it('should handle messages with only punctuation', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-punctuation-1',
        messageText: '!!!',
        conversationId: 'test-conv-17',
        senderId: 'test-user-17',
      };

      const response = await categorizeMessage(request);
      expect(response.ok).toBe(true);

      const result: CategorizationResponse = await response.json();
      expect(result.success).toBe(true);
    });
  });

  describe('Crisis Detection Logic', () => {
    it('should set crisisDetected to true when sentimentScore < -0.7', async () => {
      // These messages should trigger crisis detection
      const crisisMessages = [
        'I want to end it all. Life is not worth living.',
        'I hate myself and everything. I can\'t go on.',
        'Nobody cares and I should just disappear.',
      ];

      for (const messageText of crisisMessages) {
        const request: CategorizationRequest = {
          messageId: `test-crisis-${messageText.substring(0, 10)}`,
          messageText,
          conversationId: 'test-conv-18',
          senderId: 'test-user-18',
        };

        const response = await categorizeMessage(request);
        const result: CategorizationResponse = await response.json();

        if (result.sentimentScore < -0.7) {
          expect(result.crisisDetected).toBe(true);
        }
      }
    });

    it('should set crisisDetected to false when sentimentScore >= -0.7', async () => {
      const nonCrisisMessages = [
        'I\'m a bit disappointed but it\'s okay.',
        'Not my favorite but I can deal with it.',
        'Things could be better.',
      ];

      for (const messageText of nonCrisisMessages) {
        const request: CategorizationRequest = {
          messageId: `test-non-crisis-${messageText.substring(0, 10)}`,
          messageText,
          conversationId: 'test-conv-19',
          senderId: 'test-user-19',
        };

        const response = await categorizeMessage(request);
        const result: CategorizationResponse = await response.json();

        if (result.sentimentScore >= -0.7) {
          expect(result.crisisDetected).toBe(false);
        }
      }
    });
  });

  describe('Model and Performance Metadata', () => {
    it('should return model information', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-metadata-1',
        messageText: 'Testing metadata',
        conversationId: 'test-conv-20',
        senderId: 'test-user-20',
      };

      const response = await categorizeMessage(request);
      const result: CategorizationResponse = await response.json();

      expect(result.model).toBeDefined();
      expect(typeof result.model).toBe('string');
      expect(result.model.length).toBeGreaterThan(0);
      // Should be using gpt-4o-mini for combined analysis
      expect(result.model.toLowerCase()).toContain('gpt');
    });

    it('should return latency information', async () => {
      const request: CategorizationRequest = {
        messageId: 'test-latency-1',
        messageText: 'Testing latency tracking',
        conversationId: 'test-conv-21',
        senderId: 'test-user-21',
      };

      const response = await categorizeMessage(request);
      const result: CategorizationResponse = await response.json();

      expect(result.latency).toBeDefined();
      expect(typeof result.latency).toBe('number');
      expect(result.latency).toBeGreaterThan(0);
    });
  });
});
