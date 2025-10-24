import AsyncStorage from '@react-native-async-storage/async-storage';
import { Timestamp } from 'firebase/firestore';
import type { DashboardSummary } from '@/types/dashboard';
import type { Message } from '@/types/models';

/**
 * Cache keys for different data types
 */
const CACHE_KEYS = {
  DASHBOARD_SUMMARY: (userId: string) => `dashboard_summary_${userId}`,
  OPPORTUNITIES: (userId: string) => `opportunities_${userId}`,
};

/**
 * Cache time-to-live: 5 minutes
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Serializable version of DashboardSummary with ISO string timestamps
 */
interface SerializedDashboardSummary extends Omit<DashboardSummary, 'periodStart' | 'periodEnd' | 'lastUpdated'> {
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
}

/**
 * Serializable version of Message with ISO string timestamp
 */
interface SerializedMessage extends Omit<Message, 'timestamp'> {
  timestamp: string;
}

/**
 * Serialize DashboardSummary for AsyncStorage
 * CRITICAL: Convert Timestamp objects to ISO strings
 *
 * @param summary - Dashboard summary to serialize
 * @returns JSON string safe for AsyncStorage
 *
 * @example
 * ```typescript
 * const serialized = serializeDashboardSummary(summary);
 * await AsyncStorage.setItem(key, serialized);
 * ```
 */
export function serializeDashboardSummary(summary: DashboardSummary): string {
  const serialized: SerializedDashboardSummary = {
    ...summary,
    periodStart: summary.periodStart.toDate().toISOString(),
    periodEnd: summary.periodEnd.toDate().toISOString(),
    lastUpdated: summary.lastUpdated.toDate().toISOString(),
  };
  return JSON.stringify(serialized);
}

/**
 * Deserialize DashboardSummary from AsyncStorage
 * CRITICAL: Convert ISO strings back to Timestamp objects
 *
 * @param cached - JSON string from AsyncStorage
 * @returns Dashboard summary with Timestamp objects
 *
 * @example
 * ```typescript
 * const cached = await AsyncStorage.getItem(key);
 * if (cached) {
 *   const summary = deserializeDashboardSummary(cached);
 * }
 * ```
 */
export function deserializeDashboardSummary(cached: string): DashboardSummary {
  const parsed: SerializedDashboardSummary = JSON.parse(cached);
  return {
    ...parsed,
    periodStart: Timestamp.fromDate(new Date(parsed.periodStart)),
    periodEnd: Timestamp.fromDate(new Date(parsed.periodEnd)),
    lastUpdated: Timestamp.fromDate(new Date(parsed.lastUpdated)),
  };
}

/**
 * Cache dashboard summary
 *
 * @param userId - User ID
 * @param summary - Dashboard summary to cache
 * @returns Promise that resolves when cache is written
 *
 * @example
 * ```typescript
 * // Fire and forget caching (don't await)
 * cacheDashboardSummary(userId, summary);
 * ```
 */
export async function cacheDashboardSummary(
  userId: string,
  summary: DashboardSummary
): Promise<void> {
  try {
    const key = CACHE_KEYS.DASHBOARD_SUMMARY(userId);
    const serialized = serializeDashboardSummary(summary);
    await AsyncStorage.setItem(key, serialized);
  } catch (error) {
    console.error('Failed to cache dashboard summary:', error);
    // Don't throw - caching failures should not break the app
  }
}

/**
 * Get cached dashboard summary
 *
 * @param userId - User ID
 * @returns Cached dashboard summary or null if not found/expired
 *
 * @example
 * ```typescript
 * const cached = await getCachedDashboardSummary(userId);
 * if (cached) {
 *   setDashboardData(cached); // Show cached data immediately
 * }
 * ```
 */
export async function getCachedDashboardSummary(
  userId: string
): Promise<DashboardSummary | null> {
  try {
    const key = CACHE_KEYS.DASHBOARD_SUMMARY(userId);
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const summary = deserializeDashboardSummary(cached);

    // Check TTL
    const age = Date.now() - summary.lastUpdated.toMillis();
    if (age > CACHE_TTL) {
      // Cache expired - remove it
      await AsyncStorage.removeItem(key);
      return null;
    }

    return summary;
  } catch (error) {
    console.error('Failed to get cached dashboard summary:', error);
    return null;
  }
}

/**
 * Cache opportunities (serialize Timestamps)
 *
 * @param userId - User ID
 * @param opportunities - Array of opportunity messages to cache
 * @returns Promise that resolves when cache is written
 *
 * @example
 * ```typescript
 * // Fire and forget caching (don't await)
 * cacheOpportunities(userId, opportunities);
 * ```
 */
export async function cacheOpportunities(
  userId: string,
  opportunities: Message[]
): Promise<void> {
  try {
    const key = CACHE_KEYS.OPPORTUNITIES(userId);
    const serialized: SerializedMessage[] = opportunities.map(opp => ({
      ...opp,
      timestamp: opp.timestamp.toDate().toISOString(),
    }));
    await AsyncStorage.setItem(key, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to cache opportunities:', error);
    // Don't throw - caching failures should not break the app
  }
}

/**
 * Get cached opportunities
 *
 * @param userId - User ID
 * @returns Cached opportunities or null if not found
 *
 * @example
 * ```typescript
 * const cached = await getCachedOpportunities(userId);
 * if (cached) {
 *   setOpportunities(cached); // Show cached data immediately
 * }
 * ```
 */
export async function getCachedOpportunities(
  userId: string
): Promise<Message[] | null> {
  try {
    const key = CACHE_KEYS.OPPORTUNITIES(userId);
    const cached = await AsyncStorage.getItem(key);

    if (!cached) return null;

    const parsed: SerializedMessage[] = JSON.parse(cached);
    return parsed.map((opp) => ({
      ...opp,
      timestamp: Timestamp.fromDate(new Date(opp.timestamp)),
    }));
  } catch (error) {
    console.error('Failed to get cached opportunities:', error);
    return null;
  }
}

/**
 * Clear all cached data for a user
 *
 * @param userId - User ID
 * @returns Promise that resolves when cache is cleared
 *
 * @example
 * ```typescript
 * // Clear cache on logout or manual refresh
 * await clearCache(userId);
 * ```
 */
export async function clearCache(userId: string): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.removeItem(CACHE_KEYS.DASHBOARD_SUMMARY(userId)),
      AsyncStorage.removeItem(CACHE_KEYS.OPPORTUNITIES(userId)),
    ]);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
