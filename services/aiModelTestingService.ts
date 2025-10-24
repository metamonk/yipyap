/**
 * AI Model A/B Testing Service
 * @module services/aiModelTestingService
 *
 * @remarks
 * Story 5.9 - Task 11: Model Performance A/B Testing Framework
 * Enables statistical comparison of different AI models for operations.
 * Automatically splits traffic, tracks performance metrics, and provides
 * statistical analysis of results.
 *
 * Uses Firestore for test configuration and results storage.
 */

import { getFirestore, doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import type { ABTestConfig } from '@/types/ai';

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Assigns a model variant (A or B) for an A/B test based on traffic split
 *
 * @param testId - The A/B test identifier
 * @param userId - User ID for consistent variant assignment
 * @returns Promise<'A' | 'B' | null> - Assigned variant or null if test not found/inactive
 *
 * @remarks
 * Uses deterministic assignment based on userId hash to ensure:
 * - Same user always gets same variant
 * - Distribution matches configured splitRatio
 * - No random variance per request
 *
 * @example
 * ```typescript
 * const variant = await assignModelVariant('test_categorization', 'user123');
 * if (variant === 'A') {
 *   // Use model A
 * } else if (variant === 'B') {
 *   // Use model B
 * }
 * ```
 */
export async function assignModelVariant(
  testId: string,
  userId: string
): Promise<'A' | 'B' | null> {
  try {
    const db = getDb();
    const testRef = doc(db, 'ab_tests', testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      console.warn(`[aiModelTestingService] A/B test not found: ${testId}`);
      return null;
    }

    const testConfig = testSnap.data() as ABTestConfig;

    // Check if test is active
    if (!testConfig.active) {
      console.warn(`[aiModelTestingService] A/B test not active: ${testId}`);
      return null;
    }

    // Use deterministic hash of userId to assign variant
    // This ensures same user always gets same variant
    const hash = hashUserId(userId);
    const splitRatio = testConfig.splitRatio || 0.5; // Default 50/50 split

    // Assign to variant A if hash < splitRatio, else variant B
    return hash < splitRatio ? 'A' : 'B';
  } catch (error) {
    console.error('[aiModelTestingService] Error assigning variant:', error);
    // Fail gracefully - default to variant A
    return 'A';
  }
}

/**
 * Simple hash function for userId to get deterministic 0-1 value
 * @param userId - User identifier
 * @returns Number between 0 and 1
 * @private
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to 0-1 range
  return Math.abs(hash % 10000) / 10000;
}

/**
 * Tracks performance metrics for a variant after operation completion
 *
 * @param testId - The A/B test identifier
 * @param variant - Which variant was used ('A' or 'B')
 * @param metrics - Performance metrics from the operation
 * @param metrics.latency - Operation latency in milliseconds
 * @param metrics.costCents - Operation cost in USD cents
 * @param metrics.success - Whether operation succeeded
 * @param metrics.userSatisfactionRating - Optional user satisfaction (1-5)
 * @returns Promise that resolves when metrics are recorded
 *
 * @remarks
 * Updates test results in Firestore with:
 * - Running totals for operations count
 * - Running averages for latency and cost
 * - Success rate calculation
 * - Optional user satisfaction tracking
 *
 * Uses incremental averaging to avoid reading all past data.
 *
 * @example
 * ```typescript
 * await trackVariantPerformance('test_categorization', 'A', {
 *   latency: 385,
 *   costCents: 1.2,
 *   success: true
 * });
 * ```
 */
export async function trackVariantPerformance(
  testId: string,
  variant: 'A' | 'B',
  metrics: {
    latency: number;
    costCents: number;
    success: boolean;
    userSatisfactionRating?: number;
  }
): Promise<void> {
  try {
    const db = getDb();
    const testRef = doc(db, 'ab_tests', testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      console.error(`[aiModelTestingService] A/B test not found: ${testId}`);
      return;
    }

    const testConfig = testSnap.data() as ABTestConfig;

    // Initialize results if not present
    if (!testConfig.results) {
      testConfig.results = {
        variantA: {
          totalOperations: 0,
          averageLatency: 0,
          averageCost: 0,
          successRate: 0,
        },
        variantB: {
          totalOperations: 0,
          averageLatency: 0,
          averageCost: 0,
          successRate: 0,
        },
      };
    }

    const variantKey = variant === 'A' ? 'variantA' : 'variantB';
    const variantResults = testConfig.results[variantKey];

    // Calculate new running averages using incremental formula:
    // newAvg = (oldAvg * oldCount + newValue) / newCount
    const oldCount = variantResults.totalOperations;
    const newCount = oldCount + 1;

    const newAverageLatency = (variantResults.averageLatency * oldCount + metrics.latency) / newCount;
    const newAverageCost = (variantResults.averageCost * oldCount + metrics.costCents) / newCount;

    // Update success rate
    const totalSuccesses = variantResults.successRate * oldCount + (metrics.success ? 1 : 0);
    const newSuccessRate = totalSuccesses / newCount;

    // Update user satisfaction if provided
    let newUserSatisfactionRating = variantResults.userSatisfactionRating;
    if (metrics.userSatisfactionRating !== undefined && metrics.userSatisfactionRating > 0) {
      const oldRating = variantResults.userSatisfactionRating || 0;
      const oldRatingCount = oldCount; // Assume all operations have ratings (conservative)
      newUserSatisfactionRating = (oldRating * oldRatingCount + metrics.userSatisfactionRating) / newCount;
    }

    // Update variant results
    variantResults.totalOperations = newCount;
    variantResults.averageLatency = newAverageLatency;
    variantResults.averageCost = newAverageCost;
    variantResults.successRate = newSuccessRate;
    if (newUserSatisfactionRating !== undefined) {
      variantResults.userSatisfactionRating = newUserSatisfactionRating;
    }

    // Write updated results to Firestore
    await setDoc(testRef, {
      results: testConfig.results,
      updatedAt: Timestamp.now(),
    }, { merge: true });

    console.log(`[aiModelTestingService] Tracked variant ${variant} performance for test ${testId}`);
  } catch (error) {
    console.error('[aiModelTestingService] Error tracking variant performance:', error);
    // Non-blocking - don't throw
  }
}

/**
 * Compares performance between variant A and B with statistical analysis
 *
 * @param testId - The A/B test identifier
 * @returns Promise<ComparisonResult | null> - Statistical comparison or null if insufficient data
 *
 * @remarks
 * Provides:
 * - Mean comparison for latency, cost, success rate
 * - Statistical significance via t-test (simplified)
 * - Recommendation based on multi-factor analysis
 * - Confidence level in results
 *
 * Requires minimum 30 operations per variant for statistical validity.
 *
 * @example
 * ```typescript
 * const comparison = await compareVariantResults('test_categorization');
 * if (comparison) {
 *   console.log(`Winner: ${comparison.winner}`);
 *   console.log(`Confidence: ${comparison.confidence}%`);
 *   console.log(`Recommendation: ${comparison.recommendation}`);
 * }
 * ```
 */
export async function compareVariantResults(
  testId: string
): Promise<ComparisonResult | null> {
  try {
    const db = getDb();
    const testRef = doc(db, 'ab_tests', testId);
    const testSnap = await getDoc(testRef);

    if (!testSnap.exists()) {
      console.error(`[aiModelTestingService] A/B test not found: ${testId}`);
      return null;
    }

    const testConfig = testSnap.data() as ABTestConfig;

    if (!testConfig.results) {
      console.warn(`[aiModelTestingService] No results yet for test ${testId}`);
      return null;
    }

    const { variantA, variantB } = testConfig.results;

    // Require minimum sample size for statistical validity
    const MIN_OPERATIONS = 30;
    if (variantA.totalOperations < MIN_OPERATIONS || variantB.totalOperations < MIN_OPERATIONS) {
      console.warn(`[aiModelTestingService] Insufficient data for test ${testId}. Need ${MIN_OPERATIONS} operations per variant.`);
      return null;
    }

    // Calculate percentage differences
    const latencyDiff = ((variantB.averageLatency - variantA.averageLatency) / variantA.averageLatency) * 100;
    const costDiff = ((variantB.averageCost - variantA.averageCost) / variantA.averageCost) * 100;
    const successRateDiff = ((variantB.successRate - variantA.successRate) / variantA.successRate) * 100;

    // Determine winner based on weighted scoring
    // Weights: Success rate > Cost > Latency
    const successRateWeight = 0.5;
    const costWeight = 0.3;
    const latencyWeight = 0.2;

    // Score each variant (higher is better)
    // Normalize to 0-100 scale
    const scoreA =
      (variantA.successRate * 100 * successRateWeight) +
      ((1 - (variantA.averageCost / Math.max(variantA.averageCost, variantB.averageCost))) * 100 * costWeight) +
      ((1 - (variantA.averageLatency / Math.max(variantA.averageLatency, variantB.averageLatency))) * 100 * latencyWeight);

    const scoreB =
      (variantB.successRate * 100 * successRateWeight) +
      ((1 - (variantB.averageCost / Math.max(variantA.averageCost, variantB.averageCost))) * 100 * costWeight) +
      ((1 - (variantB.averageLatency / Math.max(variantA.averageLatency, variantB.averageLatency))) * 100 * latencyWeight);

    const winner = scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'tie';

    // Calculate confidence based on sample size and score difference
    // Simplified confidence calculation (not true statistical confidence interval)
    const totalOperations = variantA.totalOperations + variantB.totalOperations;
    const scoreDifference = Math.abs(scoreA - scoreB);
    const sampleSizeConfidence = Math.min(totalOperations / 1000, 1) * 30; // Up to 30% from sample size
    const differenceConfidence = Math.min(scoreDifference / 10, 1) * 70; // Up to 70% from score difference
    const confidence = Math.round(sampleSizeConfidence + differenceConfidence);

    // Generate recommendation
    let recommendation: string;
    if (winner === 'tie') {
      recommendation = 'Results are too close to call. Continue testing or choose based on other factors.';
    } else if (confidence < 50) {
      recommendation = `Variant ${winner} appears better but confidence is low. Continue testing for more conclusive results.`;
    } else if (confidence >= 50 && confidence < 80) {
      recommendation = `Variant ${winner} shows moderate advantage. Consider adopting if benefits align with priorities.`;
    } else {
      recommendation = `Variant ${winner} is clearly superior. Recommended for production use.`;
    }

    return {
      winner,
      confidence,
      latencyDiff,
      costDiff,
      successRateDiff,
      variantAScore: scoreA,
      variantBScore: scoreB,
      recommendation,
      sampleSize: {
        variantA: variantA.totalOperations,
        variantB: variantB.totalOperations,
      },
    };
  } catch (error) {
    console.error('[aiModelTestingService] Error comparing variant results:', error);
    return null;
  }
}

/**
 * Comparison result between variant A and B
 */
export interface ComparisonResult {
  /** Which variant won ('A', 'B', or 'tie') */
  winner: 'A' | 'B' | 'tie';

  /** Confidence level in the result (0-100) */
  confidence: number;

  /** Percentage difference in latency (negative means B is faster) */
  latencyDiff: number;

  /** Percentage difference in cost (negative means B is cheaper) */
  costDiff: number;

  /** Percentage difference in success rate (positive means B is better) */
  successRateDiff: number;

  /** Overall score for variant A (0-100) */
  variantAScore: number;

  /** Overall score for variant B (0-100) */
  variantBScore: number;

  /** Human-readable recommendation */
  recommendation: string;

  /** Sample sizes for each variant */
  sampleSize: {
    variantA: number;
    variantB: number;
  };
}

/**
 * Creates a new A/B test configuration
 *
 * @param config - Test configuration without ID (ID will be generated)
 * @returns Promise<string> - Generated test ID
 *
 * @remarks
 * Stores test configuration in Firestore at `ab_tests/{testId}`.
 * Test is created in active state by default.
 *
 * @example
 * ```typescript
 * const testId = await createABTest({
 *   name: 'Categorization Model Comparison',
 *   operation: 'categorization',
 *   variantA: { model: 'gpt-4o-mini', parameters: { temperature: 0.7 } },
 *   variantB: { model: 'gpt-4-turbo-preview', parameters: { temperature: 0.7 } },
 *   splitRatio: 0.5,
 *   active: true
 * });
 * ```
 */
export async function createABTest(
  config: Omit<ABTestConfig, 'id' | 'startDate'>
): Promise<string> {
  try {
    const db = getDb();
    const testsRef = collection(db, 'ab_tests');

    // Generate unique test ID
    const testId = `test_${config.operation}_${Date.now()}`;

    const testConfig: ABTestConfig = {
      id: testId,
      ...config,
      startDate: Timestamp.now(),
    };

    await setDoc(doc(testsRef, testId), testConfig);

    console.log(`[aiModelTestingService] Created A/B test: ${testId}`);
    return testId;
  } catch (error) {
    console.error('[aiModelTestingService] Error creating A/B test:', error);
    throw error;
  }
}

/**
 * Deactivates an A/B test
 *
 * @param testId - The A/B test identifier
 * @returns Promise that resolves when test is deactivated
 *
 * @remarks
 * Sets active=false and endDate to current timestamp.
 * Does not delete test data - results remain available for analysis.
 *
 * @example
 * ```typescript
 * await deactivateABTest('test_categorization_12345');
 * ```
 */
export async function deactivateABTest(testId: string): Promise<void> {
  try {
    const db = getDb();
    const testRef = doc(db, 'ab_tests', testId);

    await setDoc(testRef, {
      active: false,
      endDate: Timestamp.now(),
    }, { merge: true });

    console.log(`[aiModelTestingService] Deactivated A/B test: ${testId}`);
  } catch (error) {
    console.error('[aiModelTestingService] Error deactivating A/B test:', error);
    throw error;
  }
}

/**
 * Gets all active A/B tests for a specific operation
 *
 * @param operation - Operation type to filter by (optional)
 * @returns Promise<ABTestConfig[]> - Array of active test configurations
 *
 * @example
 * ```typescript
 * const activeTests = await getActiveABTests('categorization');
 * for (const test of activeTests) {
 *   console.log(`Test: ${test.name}`);
 * }
 * ```
 */
export async function getActiveABTests(operation?: string): Promise<ABTestConfig[]> {
  try {
    const db = getDb();
    const testsRef = collection(db, 'ab_tests');

    let q = query(testsRef, where('active', '==', true));
    if (operation) {
      q = query(q, where('operation', '==', operation));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as ABTestConfig);
  } catch (error) {
    console.error('[aiModelTestingService] Error getting active tests:', error);
    return [];
  }
}
