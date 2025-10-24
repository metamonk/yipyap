/**
 * AI Optimization Recommendation Service
 *
 * @module services/aiOptimizationService
 * @description
 * Analyzes AI performance metrics and cost data to generate actionable optimization recommendations.
 * Identifies issues like high latency, excessive costs, low cache hit rates, and rate limit pressure.
 * Provides specific action steps for improving AI operation efficiency.
 */

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  limit as firestoreLimit,
} from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import type { OptimizationRecommendation, AIPerformanceMetrics } from '../types/ai';

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Thresholds for generating optimization recommendations
 */
const THRESHOLDS = {
  /** Latency threshold in milliseconds for performance recommendations */
  HIGH_LATENCY: 500,

  /** Success rate threshold (decimal) below which to recommend improvements */
  LOW_SUCCESS_RATE: 0.95,

  /** Cache hit rate threshold (decimal) below which to recommend cache tuning */
  LOW_CACHE_HIT_RATE: 0.2,

  /** Cost threshold in USD cents per operation for cost optimization */
  HIGH_COST_PER_OPERATION: 10,

  /** Minimum operations required before generating recommendations */
  MIN_OPERATIONS_FOR_ANALYSIS: 10,
} as const;

/**
 * Analyzes performance metrics for a specific operation and generates recommendations
 *
 * @param userId - User ID to analyze metrics for
 * @param operation - Operation type to analyze
 * @param timeWindow - Time range for analysis
 * @returns Array of optimization recommendations
 *
 * @remarks
 * Queries ai_performance_metrics for the specified time window and operation.
 * Calculates aggregates and applies heuristic rules to identify optimization opportunities.
 * Only generates recommendations if sufficient data is available (MIN_OPERATIONS_FOR_ANALYSIS).
 *
 * @example
 * ```typescript
 * const recommendations = await analyzeOperationMetrics('user123', 'categorization', {
 *   start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
 *   end: new Date()
 * });
 * ```
 */
export async function analyzeOperationMetrics(
  userId: string,
  operation: AIPerformanceMetrics['operation'],
  timeWindow: { start: Date; end: Date }
): Promise<OptimizationRecommendation[]> {
  try {
    const db = getDb();
    const metricsRef = collection(db, `users/${userId}/ai_performance_metrics`);

    // Query metrics for time window
    const metricsQuery = query(
      metricsRef,
      where('operation', '==', operation),
      where('timestamp', '>=', Timestamp.fromDate(timeWindow.start)),
      where('timestamp', '<=', Timestamp.fromDate(timeWindow.end)),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(metricsQuery);

    // Need sufficient data for meaningful analysis
    if (snapshot.size < THRESHOLDS.MIN_OPERATIONS_FOR_ANALYSIS) {
      return [];
    }

    // Calculate aggregates
    let totalLatency = 0;
    let totalCost = 0;
    let successCount = 0;
    let cacheHitCount = 0;
    const latencies: number[] = [];

    snapshot.forEach((doc) => {
      const metric = doc.data() as AIPerformanceMetrics;
      totalLatency += metric.latency;
      totalCost += metric.costCents;
      latencies.push(metric.latency);
      if (metric.success) successCount++;
      if (metric.cacheHit) cacheHitCount++;
    });

    const totalOps = snapshot.size;
    const avgLatency = totalLatency / totalOps;
    const avgCost = totalCost / totalOps;
    const successRate = successCount / totalOps;
    const cacheHitRate = cacheHitCount / totalOps;

    // Sort latencies for P95 calculation
    latencies.sort((a, b) => a - b);
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index];

    const recommendations: OptimizationRecommendation[] = [];

    // Rule 1: High latency recommendation
    if (avgLatency > THRESHOLDS.HIGH_LATENCY) {
      const rec: OptimizationRecommendation = {
        id: '', // Will be set by Firestore
        userId,
        type: 'latency',
        severity: p95Latency > THRESHOLDS.HIGH_LATENCY * 2 ? 'high' : 'medium',
        title: `High latency detected for ${getOperationLabel(operation)}`,
        description: `Average latency is ${Math.round(avgLatency)}ms (P95: ${Math.round(p95Latency)}ms), which is above the recommended threshold of ${THRESHOLDS.HIGH_LATENCY}ms.`,
        impact: `Improving latency could reduce response time by ${Math.round(avgLatency - THRESHOLDS.HIGH_LATENCY)}ms per operation.`,
        actionable: true,
        actionSteps: [
          cacheHitRate < 0.3
            ? 'Enable or increase caching to reduce API calls'
            : 'Consider switching to a faster AI model (e.g., gpt-4o-mini)',
          'Reduce max_tokens parameter if generating long responses',
          'Implement batch processing for non-urgent operations',
        ],
        createdAt: Timestamp.now(),
      };
      recommendations.push(rec);
    }

    // Rule 2: High cost recommendation
    if (avgCost > THRESHOLDS.HIGH_COST_PER_OPERATION) {
      const dailyEstimate = Math.round(avgCost * totalOps * (1440 / ((timeWindow.end.getTime() - timeWindow.start.getTime()) / 60000)));
      const rec: OptimizationRecommendation = {
        id: '',
        userId,
        type: 'cost',
        severity: avgCost > THRESHOLDS.HIGH_COST_PER_OPERATION * 2 ? 'high' : 'medium',
        title: `High costs for ${getOperationLabel(operation)}`,
        description: `Average cost is ${avgCost.toFixed(2)}¢ per operation, which is above the recommended threshold of ${THRESHOLDS.HIGH_COST_PER_OPERATION}¢.`,
        impact: `Could save ~$${(dailyEstimate / 100).toFixed(2)}/day by optimizing this operation.`,
        actionable: true,
        actionSteps: [
          'Switch to a more cost-effective AI model (e.g., gpt-4o-mini instead of gpt-4-turbo)',
          'Enable aggressive caching for repeated queries',
          'Reduce max_tokens parameter to minimize completion costs',
          'Implement batch processing to reduce per-operation overhead',
        ],
        createdAt: Timestamp.now(),
      };
      recommendations.push(rec);
    }

    // Rule 3: Low cache hit rate recommendation
    if (cacheHitRate < THRESHOLDS.LOW_CACHE_HIT_RATE && totalOps >= 20) {
      const potentialSavings = Math.round(avgCost * totalOps * (1 - cacheHitRate) * 0.7); // Assume 70% could be cached
      const rec: OptimizationRecommendation = {
        id: '',
        userId,
        type: 'cache',
        severity: cacheHitRate < 0.1 ? 'high' : 'medium',
        title: `Low cache hit rate for ${getOperationLabel(operation)}`,
        description: `Cache hit rate is only ${(cacheHitRate * 100).toFixed(1)}%, meaning ${((1 - cacheHitRate) * 100).toFixed(1)}% of operations require AI API calls.`,
        impact: `Improving cache hit rate to 50% could save ~${potentialSavings}¢ in this time period and reduce latency.`,
        actionable: true,
        actionSteps: [
          'Review and increase cache TTL settings',
          'Implement smarter cache key generation to increase hit rates',
          'Enable cache warming for common queries',
          'Consider using semantic similarity for cache lookups',
        ],
        createdAt: Timestamp.now(),
      };
      recommendations.push(rec);
    }

    // Rule 4: Low success rate recommendation
    if (successRate < THRESHOLDS.LOW_SUCCESS_RATE) {
      const errorRate = (1 - successRate) * 100;
      const rec: OptimizationRecommendation = {
        id: '',
        userId,
        type: 'latency', // Using latency type as it's performance-related
        severity: successRate < 0.9 ? 'high' : 'medium',
        title: `High error rate for ${getOperationLabel(operation)}`,
        description: `Success rate is ${(successRate * 100).toFixed(1)}%, meaning ${errorRate.toFixed(1)}% of operations are failing.`,
        impact: `Improving reliability will reduce wasted costs and improve user experience.`,
        actionable: true,
        actionSteps: [
          'Review error logs to identify common failure patterns',
          'Implement retry logic with exponential backoff',
          'Add input validation before AI operations',
          'Consider implementing fallback models when primary model fails',
        ],
        createdAt: Timestamp.now(),
      };
      recommendations.push(rec);
    }

    return recommendations;
  } catch (error) {
    console.error('[aiOptimizationService] Error analyzing operation metrics:', error);
    return []; // Fail gracefully
  }
}

/**
 * Analyzes all AI operations for a user and generates comprehensive recommendations
 *
 * @param userId - User ID to analyze
 * @param timeWindow - Time range for analysis (default: last 24 hours)
 * @returns Array of all recommendations across all operations
 *
 * @remarks
 * Analyzes all six operation types: categorization, sentiment, faq_detection,
 * voice_matching, opportunity_scoring, and daily_agent.
 * Writes recommendations to Firestore for persistence and real-time updates.
 * Deduplicates recommendations by type and operation to avoid spam.
 *
 * @example
 * ```typescript
 * const recommendations = await generateRecommendations('user123', {
 *   start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
 *   end: new Date()
 * });
 * ```
 */
export async function generateRecommendations(
  userId: string,
  timeWindow?: { start: Date; end: Date }
): Promise<OptimizationRecommendation[]> {
  try {
    // Default to last 24 hours if no window specified
    const window = timeWindow || {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000),
      end: new Date(),
    };

    const operations: AIPerformanceMetrics['operation'][] = [
      'categorization',
      'sentiment',
      'faq_detection',
      'voice_matching',
      'opportunity_scoring',
      'daily_agent',
    ];

    // Analyze each operation type
    const allRecommendations: OptimizationRecommendation[] = [];
    for (const operation of operations) {
      const operationRecs = await analyzeOperationMetrics(userId, operation, window);
      allRecommendations.push(...operationRecs);
    }

    // Write recommendations to Firestore
    const db = getDb();
    const recommendationsRef = collection(db, `users/${userId}/ai_optimization_recommendations`);

    // Get existing non-dismissed recommendations to avoid duplicates
    const existingQuery = query(
      recommendationsRef,
      where('dismissedAt', '==', null),
      orderBy('createdAt', 'desc'),
      firestoreLimit(50)
    );
    const existingSnapshot = await getDocs(existingQuery);
    const existingRecs = new Set<string>();
    existingSnapshot.forEach((doc) => {
      const rec = doc.data() as OptimizationRecommendation;
      // Create unique key based on type and title
      existingRecs.add(`${rec.type}_${rec.title}`);
    });

    // Write new recommendations (deduplicated)
    const newRecommendations: OptimizationRecommendation[] = [];
    for (const rec of allRecommendations) {
      const key = `${rec.type}_${rec.title}`;
      if (!existingRecs.has(key)) {
        const docRef = await addDoc(recommendationsRef, rec);
        rec.id = docRef.id;
        newRecommendations.push(rec);
      }
    }

    return newRecommendations;
  } catch (error) {
    console.error('[aiOptimizationService] Error generating recommendations:', error);
    return []; // Fail gracefully
  }
}

/**
 * Retrieves active (non-dismissed) optimization recommendations for a user
 *
 * @param userId - User ID to fetch recommendations for
 * @param limitCount - Maximum number of recommendations to return (default: 10)
 * @returns Array of active recommendations, sorted by severity and creation date
 *
 * @remarks
 * Fetches only non-dismissed recommendations from Firestore.
 * Results are sorted by severity (high → medium → low) then by creation date (newest first).
 * Used by the AI Performance Dashboard to display current recommendations.
 *
 * @example
 * ```typescript
 * const recommendations = await getRecommendations('user123', 5);
 * ```
 */
export async function getRecommendations(
  userId: string,
  limitCount: number = 10
): Promise<OptimizationRecommendation[]> {
  try {
    const db = getDb();
    const recommendationsRef = collection(db, `users/${userId}/ai_optimization_recommendations`);

    // Query for non-dismissed recommendations
    const recommendationsQuery = query(
      recommendationsRef,
      where('dismissedAt', '==', null),
      orderBy('createdAt', 'desc'),
      firestoreLimit(limitCount)
    );

    const snapshot = await getDocs(recommendationsQuery);
    const recommendations: OptimizationRecommendation[] = [];

    snapshot.forEach((doc) => {
      const rec = doc.data() as OptimizationRecommendation;
      rec.id = doc.id;
      recommendations.push(rec);
    });

    // Sort by severity (high first) then by creation date
    const severityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // Sort by creation date (newest first)
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });

    return recommendations;
  } catch (error) {
    console.error('[aiOptimizationService] Error fetching recommendations:', error);
    return []; // Fail gracefully
  }
}

/**
 * Dismisses an optimization recommendation
 *
 * @param userId - User ID who is dismissing the recommendation
 * @param recommendationId - Recommendation document ID to dismiss
 *
 * @remarks
 * Marks a recommendation as dismissed by setting dismissedAt timestamp.
 * Dismissed recommendations are excluded from future queries.
 * Non-blocking operation - errors are logged but don't throw.
 *
 * @example
 * ```typescript
 * await dismissRecommendation('user123', 'rec_abc123');
 * ```
 */
export async function dismissRecommendation(
  userId: string,
  recommendationId: string
): Promise<void> {
  try {
    const db = getDb();
    const recRef = doc(db, `users/${userId}/ai_optimization_recommendations/${recommendationId}`);

    await updateDoc(recRef, {
      dismissedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('[aiOptimizationService] Error dismissing recommendation:', error);
    // Non-blocking - don't throw
  }
}

/**
 * Gets a human-readable label for an operation type
 *
 * @param operation - Operation type identifier
 * @returns Human-readable operation label
 */
function getOperationLabel(operation: AIPerformanceMetrics['operation']): string {
  const labels: Record<AIPerformanceMetrics['operation'], string> = {
    categorization: 'Message Categorization',
    sentiment: 'Sentiment Analysis',
    faq_detection: 'FAQ Detection',
    voice_matching: 'Voice Matching',
    opportunity_scoring: 'Opportunity Scoring',
    daily_agent: 'Daily Agent Workflow',
  };
  return labels[operation] || operation;
}
