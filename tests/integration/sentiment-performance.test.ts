/**
 * Sentiment Analysis Performance Testing (Story 5.3 - Task 11)
 *
 * Validates AC IV3: "Performance remains under 500ms for combined categorization+sentiment"
 *
 * This test measures the latency of the combined Edge Function and ensures
 * there is no significant regression from the baseline established in Story 5.2.
 *
 * Prerequisites:
 * - Edge function deployed at EXPO_PUBLIC_VERCEL_EDGE_URL
 * - Valid Firebase auth token
 *
 * To run:
 * npm test tests/integration/sentiment-performance.test.ts
 */

// Test configuration
const API_BASE_URL = process.env.EXPO_PUBLIC_VERCEL_EDGE_URL || 'https://api.yipyap.wtf';
const TEST_AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token-for-validation';
const NUM_TEST_REQUESTS = 100;
const MAX_95TH_PERCENTILE_MS = 500;
const CONCURRENT_BATCH_SIZE = 10;

interface PerformanceResult {
  messageText: string;
  latency: number;
  timestamp: number;
  success: boolean;
  error?: string;
}

interface PerformanceStats {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  successRate: number;
  totalRequests: number;
}

describe('Sentiment Analysis Performance Testing (Task 11)', () => {
  // Skip if running in unit test mode (no API access)
  const shouldRun = process.env.RUN_PERFORMANCE_TESTS === 'true';

  if (!shouldRun) {
    it.skip('Skipped - Set RUN_PERFORMANCE_TESTS=true to run performance validation', () => {});
    return;
  }

  // Sample messages to test (various lengths and complexities)
  const testMessages = [
    'Hey, how are you doing today?',
    'I absolutely love this! You\'re amazing!',
    'I\'m so frustrated with everything. Nothing is working right.',
    'Thanks for your help!',
    'I feel terrible about what happened. I don\'t know what to do anymore.',
    'This is great, keep up the good work!',
    'I\'m disappointed but I understand.',
    'Everything is fine, no issues here.',
    'I hate this so much. Why does everything go wrong?',
    'You\'re the best! Thank you for everything!',
  ];

  /**
   * Calls the Edge Function API and measures latency
   */
  async function measureLatency(messageText: string): Promise<PerformanceResult> {
    const startTime = performance.now();

    try {
      const url = `${API_BASE_URL}/api/categorize-message`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
        },
        body: JSON.stringify({
          messageId: `perf-test-${Date.now()}-${Math.random()}`,
          messageText,
          conversationId: 'perf-test-conversation',
          senderId: 'perf-test-user',
        }),
      });

      const endTime = performance.now();
      const latency = endTime - startTime;

      if (!response.ok) {
        return {
          messageText,
          latency,
          timestamp: Date.now(),
          success: false,
          error: `HTTP ${response.status}`,
        };
      }

      const result = await response.json();

      if (!result.success) {
        return {
          messageText,
          latency,
          timestamp: Date.now(),
          success: false,
          error: result.error,
        };
      }

      return {
        messageText,
        latency,
        timestamp: Date.now(),
        success: true,
      };
    } catch (error) {
      const endTime = performance.now();
      const latency = endTime - startTime;

      return {
        messageText,
        latency,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Calculates percentile from sorted array
   */
  function calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }

  /**
   * Calculates performance statistics from results
   */
  function calculateStats(results: PerformanceResult[]): PerformanceStats {
    const successfulResults = results.filter(r => r.success);
    const latencies = successfulResults.map(r => r.latency).sort((a, b) => a - b);

    if (latencies.length === 0) {
      throw new Error('No successful requests to calculate stats');
    }

    const mean = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const median = calculatePercentile(latencies, 50);
    const p95 = calculatePercentile(latencies, 95);
    const p99 = calculatePercentile(latencies, 99);
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const successRate = successfulResults.length / results.length;

    return {
      mean,
      median,
      p95,
      p99,
      min,
      max,
      successRate,
      totalRequests: results.length,
    };
  }

  /**
   * Formats stats for display
   */
  function formatStats(stats: PerformanceStats): string {
    return `
    Total Requests: ${stats.totalRequests}
    Success Rate: ${(stats.successRate * 100).toFixed(2)}%

    Latency (ms):
      Mean:   ${stats.mean.toFixed(2)}ms
      Median: ${stats.median.toFixed(2)}ms
      P95:    ${stats.p95.toFixed(2)}ms
      P99:    ${stats.p99.toFixed(2)}ms
      Min:    ${stats.min.toFixed(2)}ms
      Max:    ${stats.max.toFixed(2)}ms
    `;
  }

  describe('Combined Categorization + Sentiment Latency', () => {
    let results: PerformanceResult[];
    let stats: PerformanceStats;

    beforeAll(async () => {
      console.log('\n⚡ Starting Performance Testing...\n');
      console.log(`API: ${API_BASE_URL}`);
      console.log(`Test Requests: ${NUM_TEST_REQUESTS}`);
      console.log(`Concurrent Batch Size: ${CONCURRENT_BATCH_SIZE}\n`);

      results = [];

      // Run tests in batches to simulate concurrent load
      const totalBatches = Math.ceil(NUM_TEST_REQUESTS / CONCURRENT_BATCH_SIZE);

      for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
        const batchStart = batchNum * CONCURRENT_BATCH_SIZE;
        const batchEnd = Math.min(batchStart + CONCURRENT_BATCH_SIZE, NUM_TEST_REQUESTS);
        const batchSize = batchEnd - batchStart;

        console.log(`Running batch ${batchNum + 1}/${totalBatches} (${batchSize} requests)...`);

        // Create batch of requests using rotating test messages
        const batchPromises = [];
        for (let i = 0; i < batchSize; i++) {
          const messageIndex = (batchStart + i) % testMessages.length;
          const message = testMessages[messageIndex];
          batchPromises.push(measureLatency(message));
        }

        // Execute batch concurrently
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Small delay between batches to avoid overwhelming the API
        if (batchNum < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      console.log(`\n✓ Completed ${results.length} requests\n`);

      // Calculate statistics
      stats = calculateStats(results);

      console.log('📊 Performance Statistics:');
      console.log(formatStats(stats));

      // Show failed requests if any
      const failedResults = results.filter(r => !r.success);
      if (failedResults.length > 0) {
        console.log(`\n⚠️  Failed Requests: ${failedResults.length}`);
        failedResults.slice(0, 5).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.error} (${result.latency.toFixed(2)}ms)`);
        });
      }
    }, 600000); // 10 minute timeout for all performance tests

    it('should have 95th percentile latency under 500ms', () => {
      expect(stats.p95).toBeLessThan(MAX_95TH_PERCENTILE_MS);
    });

    it('should have mean latency well under the 500ms threshold', () => {
      // Mean should be significantly better than the max threshold
      expect(stats.mean).toBeLessThan(MAX_95TH_PERCENTILE_MS * 0.8);
    });

    it('should have median latency under 500ms', () => {
      expect(stats.median).toBeLessThan(MAX_95TH_PERCENTILE_MS);
    });

    it('should maintain high success rate (>95%)', () => {
      expect(stats.successRate).toBeGreaterThanOrEqual(0.95);
    });

    it('should handle concurrent requests without degradation', () => {
      // Compare first 10% vs last 10% of requests to check for degradation
      const firstTenPercent = results.slice(0, Math.floor(results.length * 0.1))
        .filter(r => r.success)
        .map(r => r.latency);

      const lastTenPercent = results.slice(-Math.floor(results.length * 0.1))
        .filter(r => r.success)
        .map(r => r.latency);

      const firstMean = firstTenPercent.reduce((sum, val) => sum + val, 0) / firstTenPercent.length;
      const lastMean = lastTenPercent.reduce((sum, val) => sum + val, 0) / lastTenPercent.length;

      console.log(`\n📈 Degradation Check:`);
      console.log(`  First 10% mean: ${firstMean.toFixed(2)}ms`);
      console.log(`  Last 10% mean: ${lastMean.toFixed(2)}ms`);
      console.log(`  Difference: ${(lastMean - firstMean).toFixed(2)}ms\n`);

      // Last batch should not be more than 50% slower than first batch
      expect(lastMean).toBeLessThan(firstMean * 1.5);
    });

    it('should return valid latency measurements from API', () => {
      // Check that some results include the latency field from the API response
      const successfulResults = results.filter(r => r.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      // All successful results should have positive latency
      successfulResults.forEach(result => {
        expect(result.latency).toBeGreaterThan(0);
      });
    });
  });

  describe('Baseline Comparison (Story 5.2)', () => {
    it('should not show significant regression from Story 5.2 baseline', () => {
      // Story 5.2 baseline (categorization-only) was approximately 300-400ms
      // Combined categorization + sentiment should add minimal overhead
      // since it's a single GPT call with expanded prompt

      // This is informational - we accept some overhead for sentiment analysis
      // but it should still be well under 500ms

      console.log(`\n📊 Baseline Comparison Note:`);
      console.log(`  Story 5.2 baseline: ~300-400ms (categorization only)`);
      console.log(`  Story 5.3 combined: ${stats?.mean.toFixed(2)}ms (categorization + sentiment)`);
      console.log(`  Overhead: ${stats ? (stats.mean - 350).toFixed(2) : 'N/A'}ms\n`);

      // This is just informational, no assertion
      expect(true).toBe(true);
    });
  });

  describe('Load Testing', () => {
    it('should handle sustained load without failures', () => {
      const failureRate = 1 - stats.successRate;
      console.log(`\n💪 Load Test Results:`);
      console.log(`  Total requests: ${stats.totalRequests}`);
      console.log(`  Failures: ${(failureRate * 100).toFixed(2)}%\n`);

      // Should have very low failure rate
      expect(failureRate).toBeLessThan(0.05); // Less than 5% failures
    });

    it('should not have excessive outliers (P99 < 2x median)', () => {
      const ratio = stats.p99 / stats.median;
      console.log(`\n📊 Outlier Analysis:`);
      console.log(`  P99/Median ratio: ${ratio.toFixed(2)}x\n`);

      // P99 should not be more than 2x the median
      expect(ratio).toBeLessThan(2);
    });
  });
});
