/**
 * Performance Testing Script for FAQ Detection Edge Function
 *
 * Tests Task 17 - Performance Testing and Optimization from Story 5.4
 *
 * Test Coverage:
 * - Subtask 17.2: Measure embedding generation latency (<200ms target)
 * - Subtask 17.3: Measure Pinecone query latency (<50ms target)
 * - Subtask 17.4: Verify total FAQ detection latency <500ms (95th percentile)
 * - Subtask 17.5: Run load tests with 100 concurrent FAQ detections
 *
 * Usage:
 * ```bash
 * # Single performance test
 * npx ts-node scripts/test-faq-performance.ts
 *
 * # Load test with 100 concurrent requests
 * npx ts-node scripts/test-faq-performance.ts --load-test
 * ```
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

/**
 * Performance test configuration
 */
const CONFIG = {
  /** Edge Function URL (local or production) */
  edgeFunctionUrl: process.env.EXPO_PUBLIC_VERCEL_EDGE_URL || 'http://localhost:3000',

  /** Number of iterations for single performance test */
  iterations: 50,

  /** Number of concurrent requests for load test */
  loadTestConcurrency: 100,

  /** Test message samples */
  testMessages: [
    'What are your rates?',
    'How much do you charge for a photo shoot?',
    'What is your availability next week?',
    'Do you offer discounts for bulk orders?',
    'Can I see your portfolio?',
  ],

  /** Test creator ID */
  testCreatorId: 'test-creator-123',
};

/**
 * Performance metrics from Edge Function response
 */
interface PerformanceMetrics {
  totalMs: number;
  embeddingMs: number;
  pineconeMs: number;
  overheadMs: number;
}

/**
 * FAQ detection response
 */
interface DetectFAQResponse {
  success: boolean;
  isFAQ: boolean;
  matchConfidence: number;
  latency: number;
  performance: PerformanceMetrics;
  model: string;
  error?: string;
}

/**
 * Test result for a single request
 */
interface TestResult {
  messageText: string;
  success: boolean;
  performance: PerformanceMetrics;
  error?: string;
}

/**
 * Aggregated performance statistics
 */
interface PerformanceStats {
  total: Stats;
  embedding: Stats;
  pinecone: Stats;
  overhead: Stats;
}

interface Stats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

/**
 * Call the FAQ detection Edge Function
 */
async function callDetectFAQ(messageText: string, creatorId: string): Promise<DetectFAQResponse> {
  const url = `${CONFIG.edgeFunctionUrl}/api/detect-faq`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messageId: `test-msg-${Date.now()}`,
      messageText,
      creatorId,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(values: number[]): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: sum / values.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

/**
 * Run single performance test
 * Tests Subtasks 17.2, 17.3, 17.4
 */
async function runPerformanceTest(): Promise<void> {
  console.log('\n=== FAQ Detection Performance Test ===\n');
  console.log(`Iterations: ${CONFIG.iterations}`);
  console.log(`Edge Function URL: ${CONFIG.edgeFunctionUrl}/api/detect-faq\n`);

  const results: TestResult[] = [];

  for (let i = 0; i < CONFIG.iterations; i++) {
    const messageIndex = i % CONFIG.testMessages.length;
    const messageText = CONFIG.testMessages[messageIndex];

    try {
      const response = await callDetectFAQ(messageText, CONFIG.testCreatorId);

      results.push({
        messageText,
        success: response.success,
        performance: response.performance,
        error: response.error,
      });

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        console.log(`Completed ${i + 1}/${CONFIG.iterations} requests`);
      }
    } catch (error) {
      console.error(`Request ${i + 1} failed:`, error);
      results.push({
        messageText,
        success: false,
        performance: { totalMs: 0, embeddingMs: 0, pineconeMs: 0, overheadMs: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log(`\nCompleted ${CONFIG.iterations} requests\n`);

  // Calculate statistics
  const successfulResults = results.filter((r) => r.success);
  const totalLatencies = successfulResults.map((r) => r.performance.totalMs);
  const embeddingLatencies = successfulResults.map((r) => r.performance.embeddingMs);
  const pineconeLatencies = successfulResults.map((r) => r.performance.pineconeMs);
  const overheadLatencies = successfulResults.map((r) => r.performance.overheadMs);

  const stats: PerformanceStats = {
    total: calculateStats(totalLatencies),
    embedding: calculateStats(embeddingLatencies),
    pinecone: calculateStats(pineconeLatencies),
    overhead: calculateStats(overheadLatencies),
  };

  // Print results
  console.log('=== Performance Results ===\n');

  console.log('Total End-to-End Latency:');
  console.log(`  Min:     ${stats.total.min.toFixed(2)}ms`);
  console.log(`  Max:     ${stats.total.max.toFixed(2)}ms`);
  console.log(`  Mean:    ${stats.total.mean.toFixed(2)}ms`);
  console.log(`  Median:  ${stats.total.median.toFixed(2)}ms`);
  console.log(`  P95:     ${stats.total.p95.toFixed(2)}ms ${stats.total.p95 < 500 ? '✅' : '❌'} (Target: <500ms)`);
  console.log(`  P99:     ${stats.total.p99.toFixed(2)}ms\n`);

  console.log('Embedding Generation Latency (Subtask 17.2):');
  console.log(`  Min:     ${stats.embedding.min.toFixed(2)}ms`);
  console.log(`  Max:     ${stats.embedding.max.toFixed(2)}ms`);
  console.log(`  Mean:    ${stats.embedding.mean.toFixed(2)}ms ${stats.embedding.mean < 200 ? '✅' : '❌'} (Target: <200ms)`);
  console.log(`  Median:  ${stats.embedding.median.toFixed(2)}ms`);
  console.log(`  P95:     ${stats.embedding.p95.toFixed(2)}ms\n`);

  console.log('Pinecone Query Latency (Subtask 17.3):');
  console.log(`  Min:     ${stats.pinecone.min.toFixed(2)}ms`);
  console.log(`  Max:     ${stats.pinecone.max.toFixed(2)}ms`);
  console.log(`  Mean:    ${stats.pinecone.mean.toFixed(2)}ms ${stats.pinecone.mean < 50 ? '✅' : '❌'} (Target: <50ms)`);
  console.log(`  Median:  ${stats.pinecone.median.toFixed(2)}ms`);
  console.log(`  P95:     ${stats.pinecone.p95.toFixed(2)}ms\n`);

  console.log('Overhead (Parsing, Validation, etc.):');
  console.log(`  Min:     ${stats.overhead.min.toFixed(2)}ms`);
  console.log(`  Max:     ${stats.overhead.max.toFixed(2)}ms`);
  console.log(`  Mean:    ${stats.overhead.mean.toFixed(2)}ms`);
  console.log(`  Median:  ${stats.overhead.median.toFixed(2)}ms`);
  console.log(`  P95:     ${stats.overhead.p95.toFixed(2)}ms\n`);

  // Success rate
  const successRate = (successfulResults.length / results.length) * 100;
  console.log(`Success Rate: ${successRate.toFixed(2)}% (${successfulResults.length}/${results.length})\n`);

  // Acceptance criteria summary
  console.log('=== Acceptance Criteria Summary ===\n');
  console.log(`Subtask 17.2 - Embedding latency <200ms (mean): ${stats.embedding.mean < 200 ? '✅ PASS' : '❌ FAIL'} (${stats.embedding.mean.toFixed(2)}ms)`);
  console.log(`Subtask 17.3 - Pinecone latency <50ms (mean):  ${stats.pinecone.mean < 50 ? '✅ PASS' : '❌ FAIL'} (${stats.pinecone.mean.toFixed(2)}ms)`);
  console.log(`Subtask 17.4 - Total latency <500ms (P95):     ${stats.total.p95 < 500 ? '✅ PASS' : '❌ FAIL'} (${stats.total.p95.toFixed(2)}ms)\n`);
}

/**
 * Run load test with concurrent requests
 * Tests Subtask 17.5
 */
async function runLoadTest(): Promise<void> {
  console.log('\n=== FAQ Detection Load Test ===\n');
  console.log(`Concurrent Requests: ${CONFIG.loadTestConcurrency}`);
  console.log(`Edge Function URL: ${CONFIG.edgeFunctionUrl}/api/detect-faq\n`);

  const startTime = Date.now();
  const promises: Promise<TestResult>[] = [];

  // Create 100 concurrent requests
  for (let i = 0; i < CONFIG.loadTestConcurrency; i++) {
    const messageIndex = i % CONFIG.testMessages.length;
    const messageText = CONFIG.testMessages[messageIndex];

    const promise = callDetectFAQ(messageText, CONFIG.testCreatorId)
      .then((response) => ({
        messageText,
        success: response.success,
        performance: response.performance,
        error: response.error,
      }))
      .catch((error) => ({
        messageText,
        success: false,
        performance: { totalMs: 0, embeddingMs: 0, pineconeMs: 0, overheadMs: 0 },
        error: error instanceof Error ? error.message : 'Unknown error',
      }));

    promises.push(promise);
  }

  console.log(`Sending ${CONFIG.loadTestConcurrency} concurrent requests...\n`);

  // Wait for all requests to complete
  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  console.log(`All requests completed in ${totalTime}ms\n`);

  // Calculate statistics
  const successfulResults = results.filter((r) => r.success);
  const totalLatencies = successfulResults.map((r) => r.performance.totalMs);
  const embeddingLatencies = successfulResults.map((r) => r.performance.embeddingMs);
  const pineconeLatencies = successfulResults.map((r) => r.performance.pineconeMs);

  const stats: PerformanceStats = {
    total: calculateStats(totalLatencies),
    embedding: calculateStats(embeddingLatencies),
    pinecone: calculateStats(pineconeLatencies),
    overhead: calculateStats(totalLatencies.map((_, i) =>
      successfulResults[i].performance.overheadMs
    )),
  };

  // Print results
  console.log('=== Load Test Results ===\n');

  console.log(`Wall Clock Time: ${totalTime}ms`);
  console.log(`Requests per Second: ${((CONFIG.loadTestConcurrency / totalTime) * 1000).toFixed(2)}\n`);

  console.log('Latency Statistics (100 concurrent requests):');
  console.log(`  Total (Mean):     ${stats.total.mean.toFixed(2)}ms`);
  console.log(`  Total (P95):      ${stats.total.p95.toFixed(2)}ms ${stats.total.p95 < 500 ? '✅' : '❌'}`);
  console.log(`  Total (P99):      ${stats.total.p99.toFixed(2)}ms`);
  console.log(`  Embedding (Mean): ${stats.embedding.mean.toFixed(2)}ms ${stats.embedding.mean < 200 ? '✅' : '❌'}`);
  console.log(`  Pinecone (Mean):  ${stats.pinecone.mean.toFixed(2)}ms ${stats.pinecone.mean < 50 ? '✅' : '❌'}\n`);

  // Success rate
  const successRate = (successfulResults.length / results.length) * 100;
  console.log(`Success Rate: ${successRate.toFixed(2)}% (${successfulResults.length}/${results.length})\n`);

  // Acceptance criteria
  console.log('=== Acceptance Criteria ===\n');
  console.log(`Subtask 17.5 - Load test with 100 concurrent requests: ${successRate >= 99 ? '✅ PASS' : '❌ FAIL'} (${successRate.toFixed(2)}% success)\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const isLoadTest = process.argv.includes('--load-test');

  if (isLoadTest) {
    await runLoadTest();
  } else {
    await runPerformanceTest();
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
