/**
 * Opportunity Service for business opportunity tracking and analytics (Story 5.6)
 *
 * @remarks
 * This service handles fetching, tracking, and analyzing business opportunities.
 * Uses a two-phase query pattern for optimal performance:
 * 1. Query user's conversations (limited set)
 * 2. Parallel queries to each conversation's messages subcollection
 *
 * @see architecture/firestore-query-optimization.md for query patterns
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  Firestore,
  Unsubscribe,
  QuerySnapshot,
  DocumentChange,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import type { Message } from '@/types/models';
import type { OpportunityAnalytics, DailySummary } from '@/types/dashboard';

/**
 * Opportunity Service class
 * Handles business opportunity queries and real-time subscriptions
 */
class OpportunityService {
  /**
   * Lazy-loaded Firestore instance
   * Uses getter to ensure Firebase is initialized before access
   */
  private get db(): Firestore {
    return getFirebaseDb();
  }

  /**
   * Cache for high-value opportunities with 5-minute TTL (Story 5.6 - Task 15.2)
   */
  private opportunityCache: Map<string, { data: Message[]; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Performance monitoring data (Story 5.6 - Task 15.5)
   */
  private performanceMetrics: {
    lastQueryTime?: number;
    averageQueryTime: number;
    queryCount: number;
  } = {
    averageQueryTime: 0,
    queryCount: 0,
  };

  /**
   * Clear expired cache entries (Story 5.6 - Task 15.2)
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.opportunityCache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL_MS) {
        this.opportunityCache.delete(key);
      }
    }
  }

  /**
   * Get cache key for opportunity queries
   */
  private getCacheKey(userId: string, minScore: number, maxResults: number): string {
    return `${userId}:${minScore}:${maxResults}`;
  }

  /**
   * Record query performance metrics (Story 5.6 - Task 15.5)
   */
  private recordQueryPerformance(durationMs: number): void {
    this.performanceMetrics.lastQueryTime = durationMs;
    this.performanceMetrics.queryCount += 1;
    
    // Update moving average
    const prevTotal = this.performanceMetrics.averageQueryTime * (this.performanceMetrics.queryCount - 1);
    this.performanceMetrics.averageQueryTime = (prevTotal + durationMs) / this.performanceMetrics.queryCount;
  }

  /**
   * Get performance metrics (Story 5.6 - Task 15.5)
   */
  getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get high-value opportunities (score >= threshold)
   *
   * Query Pattern: Fetches user's conversations, then queries each conversation's
   * messages subcollection in parallel for opportunities. This approach is necessary
   * because messages don't have recipient fields for collection group queries.
   *
   * @param userId - Creator's user ID
   * @param minScore - Minimum opportunity score (default: 70)
   * @param maxResults - Max results to return (default: 20)
   * @returns Array of messages with high opportunity scores
   *
   * @see architecture/firestore-query-optimization.md for query patterns
   *
   * @example
   * ```typescript
   * const opportunities = await opportunityService.getHighValueOpportunities(
   *   'user123',
   *   70,
   *   20
   * );
   * console.log(`Found ${opportunities.length} high-value opportunities`);
   * ```
   */
  /**
   * Get high-value opportunities (score >= threshold)
   * 
   * Story 5.6 - Task 15: Enhanced with caching and performance monitoring
   *
   * Query Pattern: Fetches user's conversations, then queries each conversation's
   * messages subcollection in parallel for opportunities. This approach is necessary
   * because messages don't have recipient fields for collection group queries.
   *
   * Performance optimizations (Task 15):
   * - 5-minute cache to reduce Firestore reads
   * - Performance monitoring for query times
   * - Parallel execution of subcollection queries
   *
   * @param userId - User ID to fetch opportunities for
   * @param minScore - Minimum opportunity score threshold (default: 70)
   * @param maxResults - Maximum number of opportunities to return (default: 20)
   * @param useCache - Whether to use cached results (default: true, Task 15.2)
   * @returns Array of high-value opportunity messages
   */
  async getHighValueOpportunities(
    userId: string,
    minScore: number = 70,
    maxResults: number = 20,
    useCache: boolean = true
  ): Promise<Message[]> {
    const startTime = Date.now();

    try {
      // Check cache first (Task 15.2)
      if (useCache) {
        this.clearExpiredCache();
        const cacheKey = this.getCacheKey(userId, minScore, maxResults);
        const cached = this.opportunityCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
          const duration = Date.now() - startTime;
          console.log(`Cache hit for opportunities (${duration}ms)`);
          return cached.data;
        }
      }

      console.log(`Fetching high-value opportunities for user ${userId} (minScore: ${minScore})`);

      // Step 1: Query conversations where user is participant
      const conversationsQuery = query(
        collection(this.db, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      console.log(`Found ${conversationIds.length} conversations for user ${userId}`);

      if (conversationIds.length === 0) {
        const duration = Date.now() - startTime;
        this.recordQueryPerformance(duration);
        return [];
      }

      // Step 2: Query messages with high opportunity scores across user's conversations
      // Use Promise.all() for parallel execution (optimization per firestore-query-optimization.md)
      const messageQueries = conversationIds.map(async (convId) => {
        try {
          const messagesQuery = query(
            collection(this.db, 'conversations', convId, 'messages'),
            where('metadata.opportunityScore', '>=', minScore),
            orderBy('metadata.opportunityScore', 'desc'),
            orderBy('timestamp', 'desc'),
            limit(5) // Limit per conversation to prevent over-fetching
          );

          const messagesSnapshot = await getDocs(messagesQuery);
          return messagesSnapshot.docs.map((doc) => ({
            id: doc.id,
            conversationId: convId,
            ...doc.data(),
          })) as Message[];
        } catch (error) {
          console.error(`Failed to query messages for conversation ${convId}:`, error);
          // Return empty array for this conversation instead of failing entire operation
          return [];
        }
      });

      // Execute all queries in parallel
      const messageArrays = await Promise.all(messageQueries);
      const opportunities = messageArrays.flat();

      console.log(`Found ${opportunities.length} opportunities across all conversations`);

      // Sort by score DESC, then timestamp DESC, and return top N
      const sortedOpportunities = opportunities
        .sort((a, b) => {
          const scoreDiff = (b.metadata.opportunityScore || 0) - (a.metadata.opportunityScore || 0);
          if (scoreDiff !== 0) return scoreDiff;
          return b.timestamp.toMillis() - a.timestamp.toMillis();
        })
        .slice(0, maxResults);

      console.log(`Returning top ${sortedOpportunities.length} opportunities`);

      // Cache the results (Task 15.2)
      if (useCache) {
        const cacheKey = this.getCacheKey(userId, minScore, maxResults);
        this.opportunityCache.set(cacheKey, {
          data: sortedOpportunities,
          timestamp: Date.now(),
        });
      }

      // Record performance metrics (Task 15.5)
      const duration = Date.now() - startTime;
      this.recordQueryPerformance(duration);
      console.log(`Query completed in ${duration}ms (target: <200ms)`);

      return sortedOpportunities;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordQueryPerformance(duration);
      
      console.error('Failed to fetch high-value opportunities:', error);
      throw new Error(
        `Failed to fetch opportunities: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get opportunity analytics for a time period
   *
   * @param userId - Creator's user ID
   * @param periodDays - Number of days to analyze (default: 30)
   * @returns Analytics metrics
   *
   * @example
   * ```typescript
   * const analytics = await opportunityService.getOpportunityAnalytics('user123', 30);
   * console.log(`Total opportunities: ${analytics.totalOpportunities}`);
   * console.log(`High-value: ${analytics.highValueCount}`);
   * console.log(`Average score: ${analytics.averageScore}`);
   * ```
   */
  async getOpportunityAnalytics(
    userId: string,
    periodDays: number = 30
  ): Promise<OpportunityAnalytics> {
    try {
      console.log(`Calculating opportunity analytics for user ${userId} (${periodDays} days)`);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Query all opportunities in period (use minScore: 0 to get all)
      const opportunities = await this.getHighValueOpportunities(userId, 0, 1000);

      // Filter to period
      const periodOpportunities = opportunities.filter(
        (msg) => msg.timestamp.toDate() >= startDate
      );

      console.log(`Found ${periodOpportunities.length} opportunities in the last ${periodDays} days`);

      // Calculate metrics
      const totalOpportunities = periodOpportunities.length;
      const highValueCount = periodOpportunities.filter(
        (msg) => (msg.metadata.opportunityScore || 0) >= 70
      ).length;

      const averageScore =
        totalOpportunities > 0
          ? periodOpportunities.reduce((sum, msg) => sum + (msg.metadata.opportunityScore || 0), 0) /
            totalOpportunities
          : 0;

      const byType = periodOpportunities.reduce(
        (acc, msg) => {
          const type = msg.metadata.opportunityType || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      const analytics: OpportunityAnalytics = {
        totalOpportunities,
        highValueCount,
        averageScore: Math.round(averageScore * 10) / 10, // Round to 1 decimal place
        byType,
        periodDays,
      };

      console.log('Analytics calculated:', analytics);

      return analytics;
    } catch (error) {
      console.error('Failed to calculate opportunity analytics:', error);
      throw new Error(
        `Failed to calculate analytics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Subscribe to new high-value opportunities in real-time
   *
   * @param userId - Creator's user ID
   * @param minScore - Minimum opportunity score
   * @param callback - Called when new opportunity arrives
   * @returns Unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = opportunityService.subscribeToOpportunities(
   *   'user123',
   *   70,
   *   (newOpportunity) => {
   *     console.log('New high-value opportunity:', newOpportunity);
   *     showNotification(newOpportunity);
   *   }
   * );
   *
   * // Later: Stop listening
   * unsubscribe();
   * ```
   */
  subscribeToOpportunities(
    userId: string,
    minScore: number,
    callback: (message: Message) => void
  ): Unsubscribe {
    console.log(`Setting up real-time subscription for user ${userId} (minScore: ${minScore})`);

    // Track conversation subscriptions for cleanup
    const conversationUnsubscribes: Unsubscribe[] = [];

    // Subscribe to user's conversations
    const conversationsQuery = query(
      collection(this.db, 'conversations'),
      where('participantIds', 'array-contains', userId)
    );

    const conversationsUnsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot: QuerySnapshot) => {
        snapshot.docs.forEach((convDoc) => {
          // Subscribe to messages in this conversation with high opportunity scores
          const messagesQuery = query(
            collection(this.db, 'conversations', convDoc.id, 'messages'),
            where('metadata.opportunityScore', '>=', minScore),
            orderBy('metadata.opportunityScore', 'desc'),
            orderBy('timestamp', 'desc'),
            limit(1) // Only latest opportunity
          );

          const messageUnsubscribe = onSnapshot(messagesQuery, (msgSnapshot: QuerySnapshot) => {
            msgSnapshot.docChanges().forEach((change: DocumentChange) => {
              if (change.type === 'added') {
                const message = {
                  id: change.doc.id,
                  conversationId: convDoc.id,
                  ...change.doc.data(),
                } as Message;

                console.log(
                  `New opportunity detected: ${message.id} (score: ${message.metadata.opportunityScore})`
                );

                callback(message);
              }
            });
          });

          conversationUnsubscribes.push(messageUnsubscribe);
        });
      },
      (error) => {
        console.error('Opportunity subscription error:', error);
      }
    );

    // Return combined unsubscribe function
    return () => {
      console.log('Unsubscribing from opportunity updates');
      conversationsUnsubscribe();
      conversationUnsubscribes.forEach((unsub) => unsub());
    };
  }

  /**
   * Calculate daily summary with comparison to previous day (Story 5.6 - Task 11)
   *
   * @param userId - User ID to get summary for
   * @param minScore - Minimum score for high-value opportunities (default: 70)
   * @returns Daily summary metrics with previous day comparison
   *
   * @example
   * ```typescript
   * const summary = await opportunityService.getDailySummary('user123');
   * console.log(`Today: ${summary.newOpportunities} opportunities`);
   * console.log(`Change: ${summary.comparisonWithPreviousDay?.opportunitiesChange}`);
   * ```
   */
  async getDailySummary(userId: string, minScore: number = 70): Promise<DailySummary> {
    try {
      console.log(`Calculating daily summary for user ${userId}`);

      // Get current time boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);

      // Step 1: Get user's conversations
      const conversationsQuery = query(
        collection(this.db, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      if (conversationIds.length === 0) {
        return {
          newOpportunities: 0,
          highValueOpportunities: 0,
          topScore: 0,
        };
      }

      // Step 2: Query today's and yesterday's opportunities in parallel
      const [todayMessages, yesterdayMessages] = await Promise.all([
        this.getMessagesForPeriod(conversationIds, todayStart, now),
        this.getMessagesForPeriod(conversationIds, yesterdayStart, todayStart),
      ]);

      // Calculate today's metrics
      const todayOpportunities = todayMessages.filter(
        (msg) => (msg.metadata.opportunityScore || 0) > 0
      );
      const todayHighValue = todayOpportunities.filter(
        (msg) => (msg.metadata.opportunityScore || 0) >= minScore
      );
      const todayTopScore = Math.max(
        0,
        ...todayOpportunities.map((msg) => msg.metadata.opportunityScore || 0)
      );

      // Calculate yesterday's metrics for comparison
      const yesterdayOpportunities = yesterdayMessages.filter(
        (msg) => (msg.metadata.opportunityScore || 0) > 0
      );
      const yesterdayTopScore = Math.max(
        0,
        ...yesterdayOpportunities.map((msg) => msg.metadata.opportunityScore || 0)
      );

      // Build summary
      const summary: DailySummary = {
        newOpportunities: todayOpportunities.length,
        highValueOpportunities: todayHighValue.length,
        topScore: todayTopScore,
        comparisonWithPreviousDay: {
          opportunitiesChange: todayOpportunities.length - yesterdayOpportunities.length,
          scoreChange: todayTopScore - yesterdayTopScore,
        },
      };

      console.log('Daily summary calculated:', summary);

      return summary;
    } catch (error) {
      console.error('Failed to calculate daily summary:', error);
      throw new Error(
        `Failed to calculate daily summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get opportunities grouped by date for historical tracking (Story 5.6 - Task 12)
   *
   * @param userId - User ID to get opportunities for
   * @param periodDays - Number of days to analyze (7, 30, or 90)
   * @returns Array of daily opportunity counts with dates
   *
   * @example
   * ```typescript
   * const history = await opportunityService.getOpportunitiesByDate('user123', 30);
   * // Returns: [
   * //   { date: '2025-10-24', count: 5, averageScore: 75.5 },
   * //   { date: '2025-10-23', count: 3, averageScore: 82.0 },
   * //   ...
   * // ]
   * ```
   */
  async getOpportunitiesByDate(
    userId: string,
    periodDays: number = 30
  ): Promise<Array<{ date: string; count: number; averageScore: number }>> {
    try {
      console.log(`Fetching opportunities by date for user ${userId} (${periodDays} days)`);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);
      startDate.setHours(0, 0, 0, 0);

      // Get user's conversations
      const conversationsQuery = query(
        collection(this.db, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );

      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      if (conversationIds.length === 0) {
        return [];
      }

      // Get all opportunities in the period
      const now = new Date();
      const messages = await this.getMessagesForPeriod(conversationIds, startDate, now);

      // Group by date
      const byDate = messages.reduce(
        (acc, msg) => {
          const date = msg.timestamp.toDate().toISOString().split('T')[0]; // YYYY-MM-DD
          if (!acc[date]) {
            acc[date] = { count: 0, totalScore: 0 };
          }
          acc[date].count++;
          acc[date].totalScore += msg.metadata.opportunityScore || 0;
          return acc;
        },
        {} as Record<string, { count: number; totalScore: number }>
      );

      // Convert to array format
      const result = Object.entries(byDate)
        .map(([date, data]) => ({
          date,
          count: data.count,
          averageScore: data.count > 0 ? Math.round((data.totalScore / data.count) * 10) / 10 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)); // Sort chronologically

      console.log(`Found opportunities for ${result.length} different dates`);

      return result;
    } catch (error) {
      console.error('Failed to get opportunities by date:', error);
      throw new Error(
        `Failed to get opportunities by date: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Helper: Get messages with opportunity scores for a specific time period
   * @private
   */
  private async getMessagesForPeriod(
    conversationIds: string[],
    startTime: Date,
    endTime: Date
  ): Promise<Message[]> {
    const startTimestamp = Timestamp.fromDate(startTime);
    const endTimestamp = Timestamp.fromDate(endTime);

    const messageQueries = conversationIds.map(async (convId) => {
      try {
        const messagesQuery = query(
          collection(this.db, 'conversations', convId, 'messages'),
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<', endTimestamp),
          where('metadata.opportunityScore', '>', 0)
        );

        const snapshot = await getDocs(messagesQuery);
        return snapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              conversationId: convId,
              ...doc.data(),
            }) as Message
        );
      } catch (error) {
        console.error(`Error fetching messages for conversation ${convId}:`, error);
        return [];
      }
    });

    const results = await Promise.all(messageQueries);
    return results.flat();
  }
}

/**
 * Singleton instance of OpportunityService
 */
export const opportunityService = new OpportunityService();
