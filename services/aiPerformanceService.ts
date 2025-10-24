/**
 * AI Performance Tracking Service
 *
 * @module services/aiPerformanceService
 * @description
 * Tracks performance metrics for all AI operations including latency, success rates,
 * token usage, and costs. Provides non-blocking async tracking to avoid impacting
 * user-facing performance.
 */

import { getFirestore, collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import type { AIPerformanceMetrics, OperationPerformance } from '../types/ai';
import { trackModelUsage } from './aiCostMonitoringService';

/**
 * In-memory tracking of operation start times
 * Key: operation ID, Value: start timestamp in milliseconds
 */
const operationStartTimes = new Map<string, number>();

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Tracks the start of an AI operation
 *
 * @param operationId - Unique identifier for this operation instance
 * @param operation - Type of AI operation being performed
 * @returns The operation ID for use in trackOperationEnd()
 *
 * @remarks
 * Call this immediately before starting an AI operation.
 * Stores start time in memory for later duration calculation.
 * Non-blocking and does not throw errors to avoid impacting AI operations.
 *
 * @example
 * ```typescript
 * const opId = 'categorize_msg123_1698765432';
 * trackOperationStart(opId, 'categorization');
 * // ... perform AI operation
 * await trackOperationEnd(opId, { success: true, ... });
 * ```
 */
export function trackOperationStart(
  operationId: string,
  operation: AIPerformanceMetrics['operation']
): string {
  try {
    operationStartTimes.set(operationId, Date.now());
    return operationId;
  } catch (error) {
    // Silently fail to avoid impacting AI operations
    console.error('[aiPerformanceService] Failed to track operation start:', error);
    return operationId;
  }
}

/**
 * Tracks the completion of an AI operation and writes metrics to Firestore
 *
 * @param operationId - Unique identifier for this operation instance
 * @param metrics - Operation result metrics
 * @param metrics.userId - User ID this operation belongs to
 * @param metrics.operation - Type of AI operation performed
 * @param metrics.success - Whether the operation completed successfully
 * @param metrics.errorType - Error type if operation failed
 * @param metrics.modelUsed - AI model identifier
 * @param metrics.tokensUsed - Token usage breakdown
 * @param metrics.costCents - Operation cost in USD cents
 * @param metrics.cacheHit - Whether result was served from cache
 * @param metrics.cacheKey - Cache key used (if cache hit)
 *
 * @remarks
 * Call this immediately after an AI operation completes (success or failure).
 * Calculates latency from start time and writes metrics to Firestore asynchronously.
 * Non-blocking to avoid impacting user-facing performance (<5ms overhead).
 * If monitoring fails, operation continues normally (circuit breaker pattern).
 *
 * @example
 * ```typescript
 * await trackOperationEnd(opId, {
 *   userId: 'user123',
 *   operation: 'categorization',
 *   success: true,
 *   modelUsed: 'gpt-4o-mini',
 *   tokensUsed: { prompt: 100, completion: 50, total: 150 },
 *   costCents: 2,
 *   cacheHit: false
 * });
 * ```
 */
export async function trackOperationEnd(
  operationId: string,
  metrics: {
    userId: string;
    operation: AIPerformanceMetrics['operation'];
    success: boolean;
    errorType?: AIPerformanceMetrics['errorType'];
    modelUsed: string;
    tokensUsed: {
      prompt: number;
      completion: number;
      total: number;
    };
    costCents: number;
    cacheHit: boolean;
    cacheKey?: string;
  }
): Promise<void> {
  try {
    // Calculate latency
    const startTime = operationStartTimes.get(operationId);
    const latency = startTime ? Date.now() - startTime : 0;

    // Clean up start time from memory
    operationStartTimes.delete(operationId);

    const db = getDb();
    const metricsCollection = collection(db, `users/${metrics.userId}/ai_performance_metrics`);

    // Build performance metric object, excluding undefined values (Firestore doesn't accept undefined)
    const performanceMetric: any = {
      userId: metrics.userId,
      operation: metrics.operation,
      latency,
      timestamp: Timestamp.now(),
      success: metrics.success,
      modelUsed: metrics.modelUsed,
      tokensUsed: metrics.tokensUsed,
      costCents: metrics.costCents,
      cacheHit: metrics.cacheHit,
      createdAt: Timestamp.now(),
    };

    // Only include optional fields if they are defined
    if (metrics.errorType !== undefined) {
      performanceMetric.errorType = metrics.errorType;
    }
    if (metrics.cacheKey !== undefined) {
      performanceMetric.cacheKey = metrics.cacheKey;
    }

    // Non-blocking async write (fire and forget)
    addDoc(metricsCollection, performanceMetric).catch((error) => {
      // Silently log errors to avoid impacting AI operations
      console.error('[aiPerformanceService] Failed to write performance metrics:', error);
    });

    // Track cost metrics if operation succeeded and tokens were used
    if (metrics.success && metrics.tokensUsed.total > 0) {
      // Track for both daily and monthly periods
      trackModelUsage(
        metrics.userId,
        metrics.operation,
        metrics.modelUsed,
        metrics.tokensUsed.prompt,
        metrics.tokensUsed.completion,
        'daily'
      ).catch((error) => {
        console.error('[aiPerformanceService] Failed to track daily costs:', error);
      });

      trackModelUsage(
        metrics.userId,
        metrics.operation,
        metrics.modelUsed,
        metrics.tokensUsed.prompt,
        metrics.tokensUsed.completion,
        'monthly'
      ).catch((error) => {
        console.error('[aiPerformanceService] Failed to track monthly costs:', error);
      });
    }
  } catch (error) {
    // Circuit breaker: monitoring failures don't break AI operations
    console.error('[aiPerformanceService] Failed to track operation end:', error);
  }
}

/**
 * Retrieves performance metrics for a specific operation type and time period
 *
 * @param userId - User ID to retrieve metrics for
 * @param operation - Type of AI operation
 * @param startDate - Start of time period (optional, defaults to 24 hours ago)
 * @param endDate - End of time period (optional, defaults to now)
 * @returns Array of performance metrics
 *
 * @throws {Error} When Firestore query fails
 *
 * @remarks
 * Queries Firestore for performance metrics within the specified time range.
 * Useful for dashboard displays and performance analysis.
 * Results are ordered by timestamp descending (newest first).
 *
 * @example
 * ```typescript
 * const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
 * const metrics = await getOperationMetrics(
 *   'user123',
 *   'categorization',
 *   yesterday
 * );
 * console.log(`Found ${metrics.length} categorization operations`);
 * ```
 */
export async function getOperationMetrics(
  userId: string,
  operation: AIPerformanceMetrics['operation'],
  startDate?: Date,
  endDate?: Date
): Promise<AIPerformanceMetrics[]> {
  try {
    const db = getDb();
    const metricsCollection = collection(db, `users/${userId}/ai_performance_metrics`);

    // Default to last 24 hours if no dates provided
    const start = startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    const q = query(
      metricsCollection,
      where('operation', '==', operation),
      where('timestamp', '>=', Timestamp.fromDate(start)),
      where('timestamp', '<=', Timestamp.fromDate(end)),
      orderBy('timestamp', 'desc')
    );

    const snapshot = await getDocs(q);
    const metrics: AIPerformanceMetrics[] = [];

    snapshot.forEach((doc) => {
      metrics.push({
        id: doc.id,
        ...doc.data(),
      } as AIPerformanceMetrics);
    });

    return metrics;
  } catch (error) {
    console.error('[aiPerformanceService] Failed to retrieve performance metrics:', error);
    throw new Error('Unable to load performance metrics. Please try again.');
  }
}

/**
 * Calculates aggregated performance statistics for an operation
 *
 * @param metrics - Array of performance metrics to analyze
 * @returns Aggregated performance statistics including latency percentiles and success rate
 *
 * @remarks
 * Computes average latency, percentiles (p50, p95, p99), success rate, and cache hit rate.
 * Used for dashboard displays and performance monitoring.
 * Returns null if no metrics provided.
 *
 * @example
 * ```typescript
 * const metrics = await getOperationMetrics('user123', 'categorization');
 * const stats = calculateAggregatedPerformance(metrics);
 * if (stats) {
 *   console.log(`Average latency: ${stats.averageLatency}ms`);
 *   console.log(`Success rate: ${(stats.successRate * 100).toFixed(1)}%`);
 * }
 * ```
 */
export function calculateAggregatedPerformance(
  metrics: AIPerformanceMetrics[]
): OperationPerformance | null {
  if (metrics.length === 0) return null;

  // Calculate latency statistics
  const latencies = metrics.map((m) => m.latency).sort((a, b) => a - b);
  const averageLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

  // Calculate success rate
  const successCount = metrics.filter((m) => m.success).length;
  const successRate = successCount / metrics.length;

  // Calculate cache hit rate
  const cacheHitCount = metrics.filter((m) => m.cacheHit).length;
  const cacheHitRate = cacheHitCount / metrics.length;

  // Get time period
  const timestamps = metrics.map((m) => m.timestamp);
  const periodStart = timestamps[timestamps.length - 1]; // oldest (query ordered desc)
  const periodEnd = timestamps[0]; // newest

  return {
    operation: metrics[0].operation,
    averageLatency,
    p50Latency,
    p95Latency,
    p99Latency,
    successRate,
    cacheHitRate,
    totalOperations: metrics.length,
    periodStart,
    periodEnd,
  };
}

/**
 * Calculates average latency from an array of performance metrics
 *
 * @param metrics - Array of performance metrics
 * @returns Average latency in milliseconds, or 0 if no metrics provided
 *
 * @remarks
 * Simple helper function for calculating mean latency.
 * Used for quick performance checks and alerting.
 *
 * @example
 * ```typescript
 * const metrics = await getOperationMetrics('user123', 'categorization');
 * const avgLatency = calculateAverageLatency(metrics);
 * if (avgLatency > 500) {
 *   console.warn('Performance degradation detected!');
 * }
 * ```
 */
export function calculateAverageLatency(metrics: AIPerformanceMetrics[]): number {
  if (metrics.length === 0) return 0;
  const total = metrics.reduce((sum, m) => sum + m.latency, 0);
  return total / metrics.length;
}
