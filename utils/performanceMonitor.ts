/**
 * Performance monitoring utility for tracking batch update metrics
 *
 * @remarks
 * Collects and analyzes performance metrics for read receipt batch updates,
 * retry operations, and network recovery patterns. Provides insights for
 * optimization and debugging.
 */

/**
 * Metrics data for a single batch update operation
 * @interface BatchMetric
 */
export interface BatchMetric {
  /** Unique identifier for the metric */
  id: string;

  /** Type of operation */
  operationType: 'READ_RECEIPT_BATCH' | 'MESSAGE_BATCH' | 'STATUS_BATCH' | 'CONVERSATION_CREATE';

  /** Start time of operation (ms since epoch) */
  startTime: number;

  /** End time of operation (ms since epoch) */
  endTime: number;

  /** Duration of operation in milliseconds */
  duration: number;

  /** Whether operation succeeded */
  success: boolean;

  /** Number of items in batch */
  batchSize: number;

  /** Number of retry attempts made */
  retryCount: number;

  /** Error type if failed */
  errorType?: string;

  /** Error message if failed */
  errorMessage?: string;

  /** Network quality at time of operation */
  networkQuality?: string;

  /** Whether operation used fallback strategy */
  usedFallback: boolean;
}

/**
 * Aggregated metrics for a time period
 * @interface AggregatedMetrics
 */
export interface AggregatedMetrics {
  /** Time period for aggregation */
  period: {
    start: number;
    end: number;
  };

  /** Total number of operations */
  totalOperations: number;

  /** Number of successful operations */
  successCount: number;

  /** Number of failed operations */
  failureCount: number;

  /** Success rate percentage (0-100) */
  successRate: number;

  /** Average operation duration in ms */
  averageDuration: number;

  /** Median operation duration in ms */
  medianDuration: number;

  /** 95th percentile duration in ms */
  p95Duration: number;

  /** Average retry count before success */
  averageRetryCount: number;

  /** Average batch size */
  averageBatchSize: number;

  /** Number of operations that used fallback */
  fallbackCount: number;

  /** Error breakdown by type */
  errorBreakdown: Map<string, number>;

  /** Retry pattern analysis */
  retryPatterns: {
    immediateSuccess: number;
    retriedOnce: number;
    retriedMultiple: number;
    maxRetriesExceeded: number;
  };
}

/**
 * Performance monitoring service for tracking and analyzing batch operations
 * @class PerformanceMonitor
 *
 * @remarks
 * Singleton service that collects performance metrics and provides
 * analysis for optimization and debugging purposes.
 *
 * @example
 * ```typescript
 * const monitor = PerformanceMonitor.getInstance();
 *
 * // Start tracking an operation
 * const metricId = monitor.startOperation('READ_RECEIPT_BATCH', 50);
 *
 * try {
 *   // Perform operation
 *   await batchUpdate();
 *   monitor.endOperation(metricId, true);
 * } catch (error) {
 *   monitor.endOperation(metricId, false, error);
 * }
 *
 * // Get metrics
 * const metrics = monitor.getAggregatedMetrics();
 * console.log(`Success rate: ${metrics.successRate}%`);
 * ```
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, BatchMetric>;
  private activeOperations: Map<string, Partial<BatchMetric>>;
  private maxMetricsSize: number = 10000;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.metrics = new Map();
    this.activeOperations = new Map();
    this.startCleanupTimer();
  }

  /**
   * Gets the singleton instance of PerformanceMonitor
   * @returns The PerformanceMonitor singleton instance
   */
  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Starts tracking a new operation
   * @param operationType - Type of operation being tracked
   * @param batchSize - Number of items in batch
   * @param networkQuality - Optional current network quality
   * @returns Unique metric ID for this operation
   *
   * @example
   * ```typescript
   * const metricId = monitor.startOperation('READ_RECEIPT_BATCH', 100, 'good');
   * ```
   */
  public startOperation(
    operationType: BatchMetric['operationType'],
    batchSize: number,
    networkQuality?: string
  ): string {
    const id = this.generateMetricId();

    const metric: Partial<BatchMetric> = {
      id,
      operationType,
      startTime: Date.now(),
      batchSize,
      networkQuality,
      retryCount: 0,
      usedFallback: false,
    };

    this.activeOperations.set(id, metric);
    return id;
  }

  /**
   * Ends tracking for an operation
   * @param metricId - The metric ID returned from startOperation
   * @param success - Whether operation succeeded
   * @param error - Optional error if operation failed
   * @param options - Additional metric options
   *
   * @example
   * ```typescript
   * monitor.endOperation(metricId, true);
   * // or with error
   * monitor.endOperation(metricId, false, new Error('Network timeout'), {
   *   retryCount: 2,
   *   usedFallback: true
   * });
   * ```
   */
  public endOperation(
    metricId: string,
    success: boolean,
    error?: Error | unknown,
    options?: {
      retryCount?: number;
      usedFallback?: boolean;
    }
  ): void {
    const activeMetric = this.activeOperations.get(metricId);

    if (!activeMetric) {
      console.warn(`No active operation found for metric ID: ${metricId}`);
      return;
    }

    const endTime = Date.now();
    const duration = endTime - (activeMetric.startTime || endTime);

    const completedMetric: BatchMetric = {
      ...activeMetric as BatchMetric,
      endTime,
      duration,
      success,
      retryCount: options?.retryCount || activeMetric.retryCount || 0,
      usedFallback: options?.usedFallback || activeMetric.usedFallback || false,
    };

    // Add error information if failed
    if (!success && error) {
      completedMetric.errorType = this.categorizeError(error);
      completedMetric.errorMessage = error instanceof Error ? error.message : String(error);
    }

    // Store completed metric
    this.metrics.set(metricId, completedMetric);
    this.activeOperations.delete(metricId);

    // Enforce size limit
    if (this.metrics.size > this.maxMetricsSize) {
      this.pruneOldestMetrics();
    }

    // Log in dev mode
    if (process.env.NODE_ENV === 'development') {
      this.logMetric(completedMetric);
    }
  }

  /**
   * Updates retry count for an active operation
   * @param metricId - The metric ID
   * @param retryCount - New retry count
   */
  public updateRetryCount(metricId: string, retryCount: number): void {
    const metric = this.activeOperations.get(metricId);
    if (metric) {
      metric.retryCount = retryCount;
    }
  }

  /**
   * Marks that an operation used fallback strategy
   * @param metricId - The metric ID
   */
  public markFallbackUsed(metricId: string): void {
    const metric = this.activeOperations.get(metricId);
    if (metric) {
      metric.usedFallback = true;
    }
  }

  /**
   * Gets all metrics for a time period
   * @param startTime - Start of period (ms since epoch)
   * @param endTime - End of period (ms since epoch)
   * @returns Array of metrics within the period
   */
  public getMetrics(startTime?: number, endTime?: number): BatchMetric[] {
    const metrics = Array.from(this.metrics.values());

    if (startTime === undefined && endTime === undefined) {
      return metrics;
    }

    const start = startTime || 0;
    const end = endTime || Date.now();

    return metrics.filter(m => m.startTime >= start && m.startTime <= end);
  }

  /**
   * Gets aggregated metrics for analysis
   * @param startTime - Optional start of period
   * @param endTime - Optional end of period
   * @returns Aggregated metrics object
   *
   * @example
   * ```typescript
   * // Get metrics for last hour
   * const hourAgo = Date.now() - 3600000;
   * const metrics = monitor.getAggregatedMetrics(hourAgo);
   *
   * console.log(`Success rate: ${metrics.successRate}%`);
   * console.log(`Average duration: ${metrics.averageDuration}ms`);
   * console.log(`P95 duration: ${metrics.p95Duration}ms`);
   * ```
   */
  public getAggregatedMetrics(startTime?: number, endTime?: number): AggregatedMetrics {
    const metrics = this.getMetrics(startTime, endTime);

    if (metrics.length === 0) {
      return this.getEmptyAggregatedMetrics();
    }

    // Calculate basic counts
    const successCount = metrics.filter(m => m.success).length;
    const failureCount = metrics.length - successCount;
    const successRate = Math.round((successCount / metrics.length) * 100);

    // Calculate durations
    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const averageDuration = Math.round(
      durations.reduce((sum, d) => sum + d, 0) / durations.length
    );
    const medianDuration = durations[Math.floor(durations.length / 2)];
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Duration = durations[p95Index] || durations[durations.length - 1];

    // Calculate retry statistics
    const retryCounts = metrics.map(m => m.retryCount);
    const averageRetryCount = retryCounts.length > 0
      ? retryCounts.reduce((sum, r) => sum + r, 0) / retryCounts.length
      : 0;

    // Calculate batch size statistics
    const batchSizes = metrics.map(m => m.batchSize);
    const averageBatchSize = batchSizes.length > 0
      ? Math.round(batchSizes.reduce((sum, s) => sum + s, 0) / batchSizes.length)
      : 0;

    // Count fallback usage
    const fallbackCount = metrics.filter(m => m.usedFallback).length;

    // Error breakdown
    const errorBreakdown = new Map<string, number>();
    metrics
      .filter(m => !m.success && m.errorType)
      .forEach(m => {
        const count = errorBreakdown.get(m.errorType!) || 0;
        errorBreakdown.set(m.errorType!, count + 1);
      });

    // Retry patterns
    const retryPatterns = {
      immediateSuccess: metrics.filter(m => m.success && m.retryCount === 0).length,
      retriedOnce: metrics.filter(m => m.success && m.retryCount === 1).length,
      retriedMultiple: metrics.filter(m => m.success && m.retryCount > 1).length,
      maxRetriesExceeded: metrics.filter(m => !m.success && m.retryCount >= 5).length,
    };

    return {
      period: {
        start: Math.min(...metrics.map(m => m.startTime)),
        end: Math.max(...metrics.map(m => m.endTime)),
      },
      totalOperations: metrics.length,
      successCount,
      failureCount,
      successRate,
      averageDuration,
      medianDuration,
      p95Duration,
      averageRetryCount,
      averageBatchSize,
      fallbackCount,
      errorBreakdown,
      retryPatterns,
    };
  }

  /**
   * Gets current success rate percentage
   * @returns Success rate (0-100)
   */
  public getSuccessRate(): number {
    const metrics = this.getAggregatedMetrics();
    return metrics.successRate;
  }

  /**
   * Gets average retry count
   * @returns Average number of retries
   */
  public getAverageRetryCount(): number {
    const metrics = this.getAggregatedMetrics();
    return Math.round(metrics.averageRetryCount * 100) / 100;
  }

  /**
   * Logs metrics to console in development mode
   * @param metric - The metric to log
   */
  private logMetric(metric: BatchMetric): void {
    if (process.env.NODE_ENV === 'production') {
      return; // Don't log in production
    }

    const status = metric.success ? '✅' : '❌';
    const retries = metric.retryCount > 0 ? ` (${metric.retryCount} retries)` : '';
    const fallback = metric.usedFallback ? ' [FALLBACK]' : '';

    console.log(
      `${status} ${metric.operationType}: ${metric.duration}ms for ${metric.batchSize} items${retries}${fallback}`
    );

    if (!metric.success && metric.errorMessage) {
      console.log(`  Error: ${metric.errorType} - ${metric.errorMessage}`);
    }
  }

  /**
   * Categorizes errors for analysis
   * @param error - The error to categorize
   * @returns Error category string
   */
  private categorizeError(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('network') || message.includes('fetch')) {
        return 'network';
      }
      if (message.includes('permission') || message.includes('denied')) {
        return 'permission';
      }
      if (message.includes('quota') || message.includes('limit')) {
        return 'quota';
      }
      if (message.includes('timeout')) {
        return 'timeout';
      }
    }

    return 'unknown';
  }

  /**
   * Generates a unique metric ID
   * @returns Unique ID string
   */
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Returns empty aggregated metrics object
   */
  private getEmptyAggregatedMetrics(): AggregatedMetrics {
    return {
      period: { start: Date.now(), end: Date.now() },
      totalOperations: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 100,
      averageDuration: 0,
      medianDuration: 0,
      p95Duration: 0,
      averageRetryCount: 0,
      averageBatchSize: 0,
      fallbackCount: 0,
      errorBreakdown: new Map(),
      retryPatterns: {
        immediateSuccess: 0,
        retriedOnce: 0,
        retriedMultiple: 0,
        maxRetriesExceeded: 0,
      },
    };
  }

  /**
   * Removes oldest metrics when size limit exceeded
   */
  private pruneOldestMetrics(): void {
    const metrics = Array.from(this.metrics.entries())
      .sort((a, b) => a[1].startTime - b[1].startTime);

    // Remove oldest 10%
    const removeCount = Math.floor(this.maxMetricsSize * 0.1);
    metrics.slice(0, removeCount).forEach(([id]) => {
      this.metrics.delete(id);
    });
  }

  /**
   * Starts periodic cleanup of old metrics
   */
  private startCleanupTimer(): void {
    // Clean up metrics older than 24 hours every hour
    this.cleanupInterval = setInterval(() => {
      const dayAgo = Date.now() - 86400000;
      const oldMetrics: string[] = [];

      this.metrics.forEach((metric, id) => {
        if (metric.endTime < dayAgo) {
          oldMetrics.push(id);
        }
      });

      oldMetrics.forEach(id => this.metrics.delete(id));

      if (oldMetrics.length > 0 && process.env.NODE_ENV === 'development') {
        console.log(`Cleaned up ${oldMetrics.length} old performance metrics`);
      }
    }, 3600000); // Every hour
  }

  /**
   * Clears all metrics
   */
  public clear(): void {
    this.metrics.clear();
    this.activeOperations.clear();
  }

  /**
   * Destroys the monitor and cleans up resources
   */
  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Export singleton getter for convenience
export const getPerformanceMonitor = PerformanceMonitor.getInstance;