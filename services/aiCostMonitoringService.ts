/**
 * AI Cost Monitoring Service
 *
 * @module services/aiCostMonitoringService
 * @description
 * Tracks AI operation costs, token usage, and budget limits.
 * Calculates costs based on OpenAI pricing model.
 * Aggregates costs by daily and monthly periods.
 */

import { getFirestore, doc, getDoc, setDoc, updateDoc, Timestamp, increment } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';
import type { CostMetrics } from '../types/ai';

/**
 * OpenAI pricing per 1 million tokens (as of 2025-10-24)
 * Source: https://openai.com/api/pricing/
 * @remarks Update these constants when OpenAI changes pricing
 */
const OPENAI_PRICING = {
  'gpt-4o-mini': {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  'gpt-4-turbo': {
    input: 10.0, // $10.00 per 1M input tokens
    output: 30.0, // $30.00 per 1M output tokens
  },
  'gpt-4-turbo-preview': {
    input: 10.0, // $10.00 per 1M input tokens
    output: 30.0, // $30.00 per 1M output tokens
  },
} as const;

/**
 * Default daily budget limit in USD cents
 * $5.00 per day
 */
const DEFAULT_DAILY_BUDGET_CENTS = 500;

/**
 * Budget alert threshold (80% of budget)
 */
const BUDGET_ALERT_THRESHOLD = 0.8;

/**
 * Gets the Firestore instance using lazy initialization
 * @returns Firestore instance
 */
const getDb = () => {
  return getFirestore(getFirebaseApp());
};

/**
 * Calculate operation cost in USD cents based on token usage and model
 *
 * @param modelUsed - AI model identifier
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @returns Cost in USD cents
 *
 * @remarks
 * Uses OpenAI pricing structure: separate rates for input/output tokens.
 * Costs are calculated in cents to avoid floating point issues.
 * Falls back to gpt-4o-mini pricing for unknown models.
 *
 * @example
 * ```typescript
 * const cost = calculateOperationCost('gpt-4o-mini', 100, 50);
 * console.log(`Cost: ${cost} cents`); // Cost: 0.045 cents
 * ```
 */
export function calculateOperationCost(
  modelUsed: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Extract base model name (handle variants like "gpt-4o-mini + gpt-4-turbo")
  const baseModel = modelUsed.split('+')[0].trim() as keyof typeof OPENAI_PRICING;

  // Get pricing for model (fallback to gpt-4o-mini if unknown)
  const pricing = OPENAI_PRICING[baseModel] || OPENAI_PRICING['gpt-4o-mini'];

  // Calculate cost per token in cents
  const inputCostCents = (promptTokens * pricing.input) / 1_000_000 * 100;
  const outputCostCents = (completionTokens * pricing.output) / 1_000_000 * 100;

  // Round to 2 decimal places (fractional cents)
  return Math.round((inputCostCents + outputCostCents) * 100) / 100;
}

/**
 * Track model usage and update cost metrics for a specific time period
 *
 * @param userId - User ID this usage belongs to
 * @param operation - Type of AI operation
 * @param modelUsed - AI model identifier
 * @param promptTokens - Number of input tokens
 * @param completionTokens - Number of output tokens
 * @param period - Time period ('daily' or 'monthly')
 *
 * @remarks
 * Updates cost aggregation documents in Firestore.
 * Creates document if it doesn't exist.
 * Uses atomic increment operations to avoid race conditions.
 * Non-blocking to avoid impacting AI operations.
 *
 * @example
 * ```typescript
 * await trackModelUsage(
 *   'user123',
 *   'categorization',
 *   'gpt-4o-mini',
 *   100,
 *   50,
 *   'daily'
 * );
 * ```
 */
export async function trackModelUsage(
  userId: string,
  operation: string,
  modelUsed: string,
  promptTokens: number,
  completionTokens: number,
  period: 'daily' | 'monthly'
): Promise<void> {
  try {
    const db = getDb();
    const cost = calculateOperationCost(modelUsed, promptTokens, completionTokens);
    const totalTokens = promptTokens + completionTokens;

    // Generate period-based document ID
    const now = new Date();
    const periodId = period === 'daily'
      ? `daily-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      : `monthly-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const costMetricsRef = doc(db, `users/${userId}/ai_cost_metrics`, periodId);

    // Get existing document or create new one
    const costMetricsDoc = await getDoc(costMetricsRef);

    if (costMetricsDoc.exists()) {
      // Update existing document with atomic increments
      const data = costMetricsDoc.data() as CostMetrics;

      await updateDoc(costMetricsRef, {
        totalCostCents: increment(cost),
        [`costByOperation.${operation}`]: increment(cost),
        [`costByModel.${modelUsed}`]: increment(cost),
        totalTokens: increment(totalTokens),
        [`tokensByOperation.${operation}`]: increment(totalTokens),
        updatedAt: Timestamp.now(),
      });

      // Check if we need to update budget status
      const newTotalCost = (data.totalCostCents || 0) + cost;
      const budgetLimit = data.budgetLimitCents || DEFAULT_DAILY_BUDGET_CENTS;
      const budgetUsedPercent = (newTotalCost / budgetLimit) * 100;

      // Update budget status if thresholds crossed
      if (budgetUsedPercent >= 80 && !data.budgetAlertSent) {
        await updateDoc(costMetricsRef, {
          budgetUsedPercent,
          budgetAlertSent: true,
        });
      } else if (budgetUsedPercent >= 100 && !data.budgetExceeded) {
        await updateDoc(costMetricsRef, {
          budgetUsedPercent,
          budgetExceeded: true,
        });
      } else {
        await updateDoc(costMetricsRef, {
          budgetUsedPercent,
        });
      }
    } else {
      // Create new document
      const periodStart = period === 'daily'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), 1);

      const periodEnd = period === 'daily'
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
        : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const newCostMetrics: Omit<CostMetrics, 'userId'> & { userId: string } = {
        userId,
        period,
        periodStart: Timestamp.fromDate(periodStart),
        periodEnd: Timestamp.fromDate(periodEnd),
        totalCostCents: cost,
        costByOperation: { [operation]: cost },
        costByModel: { [modelUsed]: cost },
        budgetLimitCents: DEFAULT_DAILY_BUDGET_CENTS,
        budgetUsedPercent: (cost / DEFAULT_DAILY_BUDGET_CENTS) * 100,
        budgetAlertSent: false,
        budgetExceeded: false,
        totalTokens,
        tokensByOperation: { [operation]: totalTokens },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await setDoc(costMetricsRef, newCostMetrics);
    }
  } catch (error) {
    // Circuit breaker: monitoring failures don't break AI operations
    console.error('[aiCostMonitoringService] Failed to track model usage:', error);
  }
}

/**
 * Get daily cost metrics for a specific date
 *
 * @param userId - User ID to retrieve costs for
 * @param date - Date to get costs for (defaults to today)
 * @returns Daily cost metrics or null if not found
 *
 * @throws {Error} When Firestore query fails
 *
 * @example
 * ```typescript
 * const todayCosts = await getDailyCosts('user123');
 * if (todayCosts) {
 *   console.log(`Today's cost: $${todayCosts.totalCostCents / 100}`);
 * }
 * ```
 */
export async function getDailyCosts(userId: string, date?: Date): Promise<CostMetrics | null> {
  try {
    const db = getDb();
    const targetDate = date || new Date();

    const periodId = `daily-${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const costMetricsRef = doc(db, `users/${userId}/ai_cost_metrics`, periodId);
    const costMetricsDoc = await getDoc(costMetricsRef);

    if (!costMetricsDoc.exists()) {
      return null;
    }

    return {
      userId,
      ...costMetricsDoc.data(),
    } as CostMetrics;
  } catch (error) {
    console.error('[aiCostMonitoringService] Failed to retrieve daily costs:', error);
    throw new Error('Unable to load daily cost metrics. Please try again.');
  }
}

/**
 * Get monthly cost metrics for a specific month
 *
 * @param userId - User ID to retrieve costs for
 * @param year - Year (defaults to current year)
 * @param month - Month (1-12, defaults to current month)
 * @returns Monthly cost metrics or null if not found
 *
 * @throws {Error} When Firestore query fails
 *
 * @example
 * ```typescript
 * const octCosts = await getMonthlyCosts('user123', 2025, 10);
 * if (octCosts) {
 *   console.log(`October cost: $${octCosts.totalCostCents / 100}`);
 * }
 * ```
 */
export async function getMonthlyCosts(
  userId: string,
  year?: number,
  month?: number
): Promise<CostMetrics | null> {
  try {
    const db = getDb();
    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    const periodId = `monthly-${targetYear}-${String(targetMonth).padStart(2, '0')}`;

    const costMetricsRef = doc(db, `users/${userId}/ai_cost_metrics`, periodId);
    const costMetricsDoc = await getDoc(costMetricsRef);

    if (!costMetricsDoc.exists()) {
      return null;
    }

    return {
      userId,
      ...costMetricsDoc.data(),
    } as CostMetrics;
  } catch (error) {
    console.error('[aiCostMonitoringService] Failed to retrieve monthly costs:', error);
    throw new Error('Unable to load monthly cost metrics. Please try again.');
  }
}

/**
 * Check if user has exceeded budget threshold
 *
 * @param userId - User ID to check
 * @param threshold - Threshold percentage (0-1, defaults to 0.8 for 80%)
 * @returns Object with threshold status and current usage
 *
 * @remarks
 * Checks today's daily budget by default.
 * Returns exceeded=true if threshold crossed.
 * Used for alerting and UI warnings.
 *
 * @example
 * ```typescript
 * const status = await checkBudgetThreshold('user123', 0.8);
 * if (status.exceeded) {
 *   console.warn(`Budget ${status.usedPercent}% used!`);
 * }
 * ```
 */
export async function checkBudgetThreshold(
  userId: string,
  threshold: number = BUDGET_ALERT_THRESHOLD
): Promise<{
  exceeded: boolean;
  usedPercent: number;
  totalCostCents: number;
  budgetLimitCents: number;
}> {
  try {
    const costs = await getDailyCosts(userId);

    if (!costs) {
      // No costs recorded today
      return {
        exceeded: false,
        usedPercent: 0,
        totalCostCents: 0,
        budgetLimitCents: DEFAULT_DAILY_BUDGET_CENTS,
      };
    }

    const usedPercent = costs.budgetUsedPercent / 100; // Convert from percentage to decimal
    const exceeded = usedPercent >= threshold;

    return {
      exceeded,
      usedPercent: costs.budgetUsedPercent,
      totalCostCents: costs.totalCostCents,
      budgetLimitCents: costs.budgetLimitCents,
    };
  } catch (error) {
    console.error('[aiCostMonitoringService] Failed to check budget threshold:', error);
    // Return safe default on error
    return {
      exceeded: false,
      usedPercent: 0,
      totalCostCents: 0,
      budgetLimitCents: DEFAULT_DAILY_BUDGET_CENTS,
    };
  }
}
