/**
 * Sentiment Analysis Accuracy Validation (Story 5.3 - Task 10)
 *
 * Validates AC 5: "90%+ accuracy for negative sentiment detection"
 *
 * This test runs the full test dataset through the deployed Edge Function
 * and calculates precision, recall, and F1 score for sentiment classification.
 *
 * Prerequisites:
 * - Edge function deployed at EXPO_PUBLIC_VERCEL_EDGE_URL
 * - Valid Firebase auth token
 * - Test dataset at tests/fixtures/sentiment-test-dataset.json
 *
 * To run:
 * npm test tests/integration/sentiment-accuracy.test.ts
 */

import testDataset from '../fixtures/sentiment-test-dataset.json';

// Test configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_VERCEL_EDGE_URL || 'https://api.yipyap.wtf';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-for-validation';

interface TestMessage {
  id: string;
  text: string;
  expectedSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  expectedScoreRange: [number, number];
  expectedEmotionalTones: string[];
  rationale: string;
}

interface CategorizationResult {
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

interface ConfusionMatrix {
  truePositive: number;
  trueNegative: number;
  falsePositive: number;
  falseNegative: number;
}

interface ClassificationMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  accuracy: number;
}

describe('Sentiment Analysis Accuracy Validation (Task 10)', () => {
  // Skip if running in unit test mode (no API access)
  const shouldRun = process.env.RUN_ACCURACY_TESTS === 'true';

  if (!shouldRun) {
    it.skip('Skipped - Set RUN_ACCURACY_TESTS=true to run accuracy validation', () => {});
    return;
  }

  /**
   * Calls the Edge Function API to analyze a message
   */
  async function analyzeMessage(messageText: string): Promise<CategorizationResult> {
    const url = `${API_BASE_URL}/api/categorize-message`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        messageId: `test-${Date.now()}`,
        messageText,
        conversationId: 'test-conversation',
        senderId: 'test-user',
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Calculates confusion matrix for negative sentiment detection
   */
  function calculateConfusionMatrix(
    messages: TestMessage[],
    results: Map<string, CategorizationResult>
  ): ConfusionMatrix {
    const matrix: ConfusionMatrix = {
      truePositive: 0,
      trueNegative: 0,
      falsePositive: 0,
      falseNegative: 0,
    };

    messages.forEach((message) => {
      const result = results.get(message.id);
      if (!result) return;

      const actualNegative = result.sentiment === 'negative';
      const expectedNegative = message.expectedSentiment === 'negative';

      if (actualNegative && expectedNegative) {
        matrix.truePositive++;
      } else if (!actualNegative && !expectedNegative) {
        matrix.trueNegative++;
      } else if (actualNegative && !expectedNegative) {
        matrix.falsePositive++;
      } else if (!actualNegative && expectedNegative) {
        matrix.falseNegative++;
      }
    });

    return matrix;
  }

  /**
   * Calculates classification metrics from confusion matrix
   */
  function calculateMetrics(matrix: ConfusionMatrix): ClassificationMetrics {
    const { truePositive, trueNegative, falsePositive, falseNegative } = matrix;

    const precision = truePositive / (truePositive + falsePositive) || 0;
    const recall = truePositive / (truePositive + falseNegative) || 0;
    const f1Score = (2 * precision * recall) / (precision + recall) || 0;
    const accuracy = (truePositive + trueNegative) /
      (truePositive + trueNegative + falsePositive + falseNegative) || 0;

    return {
      precision,
      recall,
      f1Score,
      accuracy,
    };
  }

  /**
   * Formats metrics as percentages for display
   */
  function formatMetrics(metrics: ClassificationMetrics): string {
    return `
    Precision: ${(metrics.precision * 100).toFixed(2)}%
    Recall: ${(metrics.recall * 100).toFixed(2)}%
    F1 Score: ${(metrics.f1Score * 100).toFixed(2)}%
    Overall Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%
    `;
  }

  describe('Negative Sentiment Detection Accuracy', () => {
    let results: Map<string, CategorizationResult>;
    let confusionMatrix: ConfusionMatrix;
    let metrics: ClassificationMetrics;

    beforeAll(async () => {
      console.log('\n📊 Starting Sentiment Accuracy Validation...\n');
      console.log(`Dataset: ${testDataset.messages.length} messages`);
      console.log(`API: ${API_BASE_URL}\n`);

      results = new Map();

      // Process messages in small batches to avoid rate limiting
      const batchSize = 5;
      const messages = testDataset.messages as TestMessage[];

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(messages.length / batchSize)}...`);

        await Promise.all(
          batch.map(async (message) => {
            try {
              const result = await analyzeMessage(message.text);
              results.set(message.id, result);
            } catch (error) {
              console.error(`Failed to analyze message ${message.id}:`, error);
              throw error;
            }
          })
        );

        // Rate limiting delay between batches
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`\n✓ Analyzed ${results.size} messages\n`);

      // Calculate metrics
      confusionMatrix = calculateConfusionMatrix(messages, results);
      metrics = calculateMetrics(confusionMatrix);

      // Display results
      console.log('📈 Confusion Matrix (Negative Sentiment):');
      console.log(`  True Positive:  ${confusionMatrix.truePositive} (correctly identified negative)`);
      console.log(`  True Negative:  ${confusionMatrix.trueNegative} (correctly identified non-negative)`);
      console.log(`  False Positive: ${confusionMatrix.falsePositive} (incorrectly flagged as negative)`);
      console.log(`  False Negative: ${confusionMatrix.falseNegative} (missed negative sentiment)\n`);

      console.log('📊 Classification Metrics:');
      console.log(formatMetrics(metrics));
    }, 300000); // 5 minute timeout for all API calls

    it('should achieve 90%+ precision for negative sentiment detection', () => {
      expect(metrics.precision).toBeGreaterThanOrEqual(0.90);
    });

    it('should achieve 90%+ recall for negative sentiment detection', () => {
      expect(metrics.recall).toBeGreaterThanOrEqual(0.90);
    });

    it('should achieve F1 score ≥ 0.90', () => {
      expect(metrics.f1Score).toBeGreaterThanOrEqual(0.90);
    });

    it('should have zero false negatives (all negative messages detected)', () => {
      expect(confusionMatrix.falseNegative).toBe(0);
    });

    it('should correctly classify all 27 negative messages', () => {
      const messages = testDataset.messages as TestMessage[];
      const negativeMessages = messages.filter(m => m.expectedSentiment === 'negative');

      expect(negativeMessages.length).toBe(27);

      negativeMessages.forEach((message) => {
        const result = results.get(message.id);
        expect(result?.sentiment).toBe('negative');
      });
    });

    it('should have sentiment scores within expected ranges', () => {
      const messages = testDataset.messages as TestMessage[];
      let scoresInRange = 0;
      let totalMessages = 0;

      messages.forEach((message) => {
        const result = results.get(message.id);
        if (!result) return;

        totalMessages++;
        const [minScore, maxScore] = message.expectedScoreRange;

        if (result.sentimentScore >= minScore && result.sentimentScore <= maxScore) {
          scoresInRange++;
        }
      });

      const rangeAccuracy = scoresInRange / totalMessages;
      console.log(`\n📏 Score Range Accuracy: ${(rangeAccuracy * 100).toFixed(2)}%\n`);

      // At least 80% of scores should be within expected ranges
      expect(rangeAccuracy).toBeGreaterThanOrEqual(0.80);
    });

    it('should detect crisis situations correctly (score < -0.7)', () => {
      const messages = testDataset.messages as TestMessage[];

      messages.forEach((message) => {
        const result = results.get(message.id);
        if (!result) return;

        const shouldBeCrisis = message.expectedScoreRange[0] < -0.7 || message.expectedScoreRange[1] < -0.7;

        if (shouldBeCrisis) {
          expect(result.crisisDetected).toBe(true);
          expect(result.sentimentScore).toBeLessThan(-0.7);
        }
      });
    });
  });

  describe('Overall Sentiment Classification', () => {
    let results: Map<string, CategorizationResult>;

    beforeAll(async () => {
      // Reuse results from previous test suite if available
      if (results && results.size > 0) return;

      results = new Map();
      const messages = testDataset.messages as TestMessage[];

      for (const message of messages) {
        try {
          const result = await analyzeMessage(message.text);
          results.set(message.id, result);
        } catch (error) {
          console.error(`Failed to analyze message ${message.id}:`, error);
        }
      }
    }, 300000);

    it('should achieve high overall accuracy across all sentiment types', () => {
      const messages = testDataset.messages as TestMessage[];
      let correct = 0;

      messages.forEach((message) => {
        const result = results.get(message.id);
        if (!result) return;

        if (result.sentiment === message.expectedSentiment) {
          correct++;
        }
      });

      const overallAccuracy = correct / messages.length;
      console.log(`\n🎯 Overall Accuracy: ${(overallAccuracy * 100).toFixed(2)}%\n`);

      // Overall accuracy should be 80%+ across all sentiment types
      expect(overallAccuracy).toBeGreaterThanOrEqual(0.80);
    });

    it('should return valid response format for all messages', () => {
      const messages = testDataset.messages as TestMessage[];

      messages.forEach((message) => {
        const result = results.get(message.id);
        expect(result).toBeDefined();
        expect(result?.success).toBe(true);
        expect(result?.sentiment).toMatch(/^(positive|negative|neutral|mixed)$/);
        expect(result?.sentimentScore).toBeGreaterThanOrEqual(-1);
        expect(result?.sentimentScore).toBeLessThanOrEqual(1);
        expect(Array.isArray(result?.emotionalTone)).toBe(true);
        expect(typeof result?.crisisDetected).toBe('boolean');
      });
    });
  });
});
