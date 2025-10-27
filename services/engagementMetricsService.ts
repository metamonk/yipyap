import {
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
  doc,
  setDoc,
  getDoc,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import {
  EngagementMetrics,
  HealthScoreComponents,
  RawEngagementMetrics,
  BurnoutRisk,
} from '../types/user';
import { Message } from '../types/models';
import { DraftMessageMetadata } from '../types/ai';

/**
 * Service class for calculating and managing engagement health metrics
 *
 * @remarks
 * This service calculates quality-focused metrics for creator engagement health (Story 6.6).
 * Provides composite health scoring, burnout risk assessment, and trend analysis.
 * All metrics are calculated from historical message and draft data.
 *
 * @class EngagementMetricsService
 */
export class EngagementMetricsService {
  /**
   * Calculate overall health score from individual metric components
   *
   * @remarks
   * Uses weighted composite scoring:
   * - Personal response rate: 35% (most important)
   * - Average response time: 25%
   * - Conversation depth: 20%
   * - Capacity usage: 20%
   *
   * @param components - Normalized component scores (all 0-100)
   * @returns Overall health score (0-100)
   *
   * @example
   * ```typescript
   * const components: HealthScoreComponents = {
   *   personalResponseRate: 82,
   *   avgResponseTime: 80,
   *   conversationDepth: 45,
   *   capacityUsage: 85
   * };
   * const score = service.calculateHealthScore(components);
   * // Returns: 75 (weighted average)
   * ```
   */
  calculateHealthScore(components: HealthScoreComponents): number {
    const weights = {
      personalResponseRate: 0.35, // 35% weight (most important)
      avgResponseTime: 0.25, // 25% weight
      conversationDepth: 0.20, // 20% weight
      capacityUsage: 0.20, // 20% weight
    };

    const score =
      components.personalResponseRate * weights.personalResponseRate +
      components.avgResponseTime * weights.avgResponseTime +
      components.conversationDepth * weights.conversationDepth +
      components.capacityUsage * weights.capacityUsage;

    return Math.round(score);
  }

  /**
   * Normalize response time to 0-100 score
   *
   * @remarks
   * Scoring scale:
   * - < 12 hours: 100 (excellent)
   * - < 24 hours: 80 (good)
   * - < 48 hours: 40 (at risk)
   * - >= 48 hours: 0 (unhealthy)
   *
   * @param hours - Average response time in hours
   * @returns Normalized score (0-100)
   */
  private normalizeResponseTime(hours: number): number {
    if (hours < 12) return 100;
    if (hours < 24) return 80;
    if (hours < 48) return 40;
    return 0;
  }

  /**
   * Normalize capacity usage to 0-100 score
   *
   * @remarks
   * Scoring scale:
   * - 70-80%: 100 (optimal utilization)
   * - 60-90%: 80 (good)
   * - 90-100%: 60 (high, approaching burnout)
   * - < 60%: 40 (underutilized)
   *
   * @param usage - Capacity usage percentage (0-100)
   * @returns Normalized score (0-100)
   */
  private normalizeCapacityUsage(usage: number): number {
    // Optimal range: 70-80%
    if (usage >= 70 && usage <= 80) return 100;

    // Good range: 60-90%
    if (usage >= 60 && usage <= 90) return 80;

    // High usage: 90-100%
    if (usage >= 90) return 60;

    // Low usage: < 60%
    return 40;
  }

  /**
   * Calculate personal response rate from message history
   *
   * @remarks
   * Fetches last 30 days of creator messages and calculates what percentage
   * of AI-generated drafts were edited before sending.
   * 100% = all responses were personally edited (highly authentic)
   * 0% = all AI drafts sent without editing (low authenticity)
   *
   * @param userId - Creator's user ID
   * @param days - Number of days to analyze (default: 30)
   * @returns Promise resolving to personal response rate (0-100)
   * @throws {Error} When Firebase query fails
   *
   * @example
   * ```typescript
   * const rate = await service.calculatePersonalResponseRate('user123', 30);
   * // Returns: 82 (82% of drafts were edited)
   * ```
   */
  async calculatePersonalResponseRate(userId: string, days: number = 30): Promise<number> {
    try {
      const firestore = getFirebaseDb();

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      // Query messages from creator in the last 30 days
      const messageQueries = conversationIds.map(async (convId) => {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('senderId', '==', userId),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate)),
          orderBy('timestamp', 'desc')
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        return messagesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[];
      });

      const messageArrays = await Promise.all(messageQueries);
      const creatorMessages = messageArrays.flat();

      // Filter AI-drafted messages
      const draftedMessages = creatorMessages.filter((msg) => {
        const metadata = msg.metadata as DraftMessageMetadata | undefined;
        return metadata?.isAIDraft === true;
      });

      // If no AI drafts, assume 100% personal responses
      if (draftedMessages.length === 0) return 100;

      // Count how many were edited before sending
      const editedCount = draftedMessages.filter((msg) => {
        const metadata = msg.metadata as DraftMessageMetadata | undefined;
        return metadata?.wasEdited === true;
      }).length;

      const rate = (editedCount / draftedMessages.length) * 100;
      return Math.round(rate);
    } catch (error) {
      console.error('Failed to calculate personal response rate:', error);
      throw new Error('Failed to calculate personal response rate');
    }
  }

  /**
   * Calculate average response time in hours
   *
   * @remarks
   * Analyzes conversations to determine how quickly the creator responds to fan messages.
   * Only considers conversations where creator has responded.
   * Time is calculated from fan message timestamp to creator's reply timestamp.
   *
   * @param userId - Creator's user ID
   * @param days - Number of days to analyze (default: 30)
   * @returns Promise resolving to average response time in hours
   * @throws {Error} When Firebase query fails
   *
   * @example
   * ```typescript
   * const avgTime = await service.calculateAvgResponseTime('user123', 30);
   * // Returns: 18.5 (average 18.5 hours to respond)
   * ```
   */
  async calculateAvgResponseTime(userId: string, days: number = 30): Promise<number> {
    try {
      const firestore = getFirebaseDb();

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      // Collect all messages from all conversations
      const messageQueries = conversationIds.map(async (convId) => {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate)),
          orderBy('timestamp', 'asc')
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        return messagesSnapshot.docs.map((doc) => ({
          id: doc.id,
          conversationId: convId,
          ...doc.data(),
        })) as Message[];
      });

      const messageArrays = await Promise.all(messageQueries);
      const allMessages = messageArrays.flat();

      // Group messages by conversation
      const messagesByConversation = allMessages.reduce((acc, msg) => {
        if (!acc[msg.conversationId]) {
          acc[msg.conversationId] = [];
        }
        acc[msg.conversationId].push(msg);
        return acc;
      }, {} as Record<string, Message[]>);

      // Calculate response times for each conversation
      const responseTimes: number[] = [];

      Object.values(messagesByConversation).forEach((messages) => {
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];

          // Check if currentMsg is from fan and nextMsg is from creator
          if (currentMsg.senderId !== userId && nextMsg.senderId === userId) {
            const fanTimestamp = (currentMsg.timestamp as Timestamp).toMillis();
            const creatorTimestamp = (nextMsg.timestamp as Timestamp).toMillis();
            const diffMs = creatorTimestamp - fanTimestamp;
            const diffHours = diffMs / (1000 * 60 * 60);

            responseTimes.push(diffHours);
          }
        }
      });

      // If no responses found, return 0
      if (responseTimes.length === 0) return 0;

      // Calculate average
      const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      return Math.round(avgResponseTime * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Failed to calculate average response time:', error);
      throw new Error('Failed to calculate average response time');
    }
  }

  /**
   * Calculate conversation depth percentage
   *
   * @remarks
   * Determines what percentage of conversations have 3+ message exchanges.
   * Multi-turn conversations indicate deeper relationship building.
   * Higher percentages suggest quality engagement over quantity.
   *
   * @param userId - Creator's user ID
   * @param days - Number of days to analyze (default: 30)
   * @returns Promise resolving to conversation depth percentage (0-100)
   * @throws {Error} When Firebase query fails
   *
   * @example
   * ```typescript
   * const depth = await service.calculateConversationDepth('user123', 30);
   * // Returns: 45 (45% of conversations have 3+ exchanges)
   * ```
   */
  async calculateConversationDepth(userId: string, days: number = 30): Promise<number> {
    try {
      const firestore = getFirebaseDb();

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      // Count messages per conversation
      const conversationMessageCounts = await Promise.all(
        conversationIds.map(async (convId) => {
          const messagesQuery = query(
            collection(firestore, 'conversations', convId, 'messages'),
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate))
          );

          const messagesSnapshot = await getDocs(messagesQuery);
          return messagesSnapshot.size;
        })
      );

      // Filter out conversations with no messages in the period
      const activeConversations = conversationMessageCounts.filter((count) => count > 0);

      // If no active conversations, return 0
      if (activeConversations.length === 0) return 0;

      // Count conversations with 3+ messages (multi-turn)
      const multiTurnCount = activeConversations.filter((count) => count >= 3).length;

      const depth = (multiTurnCount / activeConversations.length) * 100;
      return Math.round(depth);
    } catch (error) {
      console.error('Failed to calculate conversation depth:', error);
      throw new Error('Failed to calculate conversation depth');
    }
  }

  /**
   * Calculate capacity usage percentage for a time period
   *
   * @remarks
   * Compares messages handled against the user's daily capacity limit.
   * Includes both daily and weekly aggregations.
   *
   * @param userId - Creator's user ID
   * @param period - Time period ('daily' or 'weekly')
   * @returns Promise resolving to capacity usage percentage (0-100)
   * @throws {Error} When Firebase query fails or user not found
   *
   * @example
   * ```typescript
   * const usage = await service.calculateCapacityUsage('user123', 'daily');
   * // Returns: 70 (7 out of 10 daily messages handled)
   * ```
   */
  async calculateCapacityUsage(userId: string, period: 'daily' | 'weekly' = 'daily'): Promise<number> {
    try {
      const firestore = getFirebaseDb();

      // Get user's capacity settings
      const userDoc = await getDoc(doc(firestore, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const dailyLimit = userData.settings?.capacity?.dailyLimit || 10;

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      if (period === 'daily') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // Weekly: last 7 days
        startDate.setDate(startDate.getDate() - 7);
      }

      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

      // Count messages sent by creator in the period
      const messageQueries = conversationIds.map(async (convId) => {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('senderId', '==', userId),
          where('timestamp', '>=', Timestamp.fromDate(startDate)),
          where('timestamp', '<=', Timestamp.fromDate(endDate))
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        return messagesSnapshot.size;
      });

      const messageCounts = await Promise.all(messageQueries);
      const totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);

      // Calculate usage percentage
      let usage: number;
      if (period === 'daily') {
        usage = (totalMessages / dailyLimit) * 100;
      } else {
        // Weekly: total messages vs 7 * daily limit
        const weeklyLimit = dailyLimit * 7;
        usage = (totalMessages / weeklyLimit) * 100;
      }

      // Cap at 100%
      return Math.min(Math.round(usage), 100);
    } catch (error) {
      console.error('Failed to calculate capacity usage:', error);
      throw new Error('Failed to calculate capacity usage');
    }
  }

  /**
   * Get number of consecutive days at maximum capacity
   *
   * @remarks
   * Used for burnout risk assessment.
   * 7+ consecutive days at 100% capacity is a high burnout risk indicator.
   *
   * @param userId - Creator's user ID
   * @returns Promise resolving to number of consecutive days at max capacity
   * @throws {Error} When Firebase query fails
   */
  async getDaysAtMaxCapacity(userId: string): Promise<number> {
    try {
      const firestore = getFirebaseDb();

      // Get user's capacity settings
      const userDoc = await getDoc(doc(firestore, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const dailyLimit = userData.settings?.capacity?.dailyLimit || 10;

      // Check last 14 days
      const today = new Date();
      let consecutiveDays = 0;

      for (let i = 0; i < 14; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        checkDate.setHours(0, 0, 0, 0);

        const endOfDay = new Date(checkDate);
        endOfDay.setHours(23, 59, 59, 999);

        // Query user's conversations
        const conversationsQuery = query(
          collection(firestore, 'conversations'),
          where('participantIds', 'array-contains', userId)
        );
        const conversationsSnapshot = await getDocs(conversationsQuery);
        const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

        // Count messages sent by creator on this day
        const messageQueries = conversationIds.map(async (convId) => {
          const messagesQuery = query(
            collection(firestore, 'conversations', convId, 'messages'),
            where('senderId', '==', userId),
            where('timestamp', '>=', Timestamp.fromDate(checkDate)),
            where('timestamp', '<=', Timestamp.fromDate(endOfDay))
          );

          const messagesSnapshot = await getDocs(messagesQuery);
          return messagesSnapshot.size;
        });

        const messageCounts = await Promise.all(messageQueries);
        const totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);

        // Check if at or above capacity
        if (totalMessages >= dailyLimit) {
          consecutiveDays++;
        } else {
          // Break streak
          break;
        }
      }

      return consecutiveDays;
    } catch (error) {
      console.error('Failed to get days at max capacity:', error);
      throw new Error('Failed to get days at max capacity');
    }
  }

  /**
   * Assess burnout risk based on multiple indicators
   *
   * @remarks
   * Risk scoring algorithm:
   * - 100% capacity for 7+ days: +3 points
   * - Personal response rate < 60%: +2 points
   * - Avg response time > 48h: +2 points
   * - Conversation depth < 25%: +1 point
   *
   * Risk levels:
   * - High: score >= 5
   * - Medium: score >= 3
   * - Low: score < 3
   *
   * @param userId - Creator's user ID
   * @param metrics - Raw engagement metrics
   * @returns Promise resolving to burnout risk level
   * @throws {Error} When data fetching fails
   *
   * @example
   * ```typescript
   * const risk = await service.assessBurnoutRisk('user123', rawMetrics);
   * // Returns: 'high' | 'medium' | 'low'
   * ```
   */
  async assessBurnoutRisk(userId: string, metrics: RawEngagementMetrics): Promise<BurnoutRisk> {
    try {
      let riskScore = 0;

      // High capacity usage (100% for 7+ days)
      if (metrics.capacityUsage === 100) {
        const daysAtMax = await this.getDaysAtMaxCapacity(userId);
        if (daysAtMax >= 7) {
          riskScore += 3;
        }
      }

      // Low personal response rate (< 60%)
      if (metrics.personalResponseRate < 60) {
        riskScore += 2;
      }

      // Slow response times (> 48 hours)
      if (metrics.avgResponseTime > 48) {
        riskScore += 2;
      }

      // Low conversation depth (< 25%)
      if (metrics.conversationDepth < 25) {
        riskScore += 1;
      }

      // Determine risk level
      if (riskScore >= 5) return 'high';
      if (riskScore >= 3) return 'medium';
      return 'low';
    } catch (error) {
      console.error('Failed to assess burnout risk:', error);
      throw new Error('Failed to assess burnout risk');
    }
  }

  /**
   * Calculate complete engagement metrics for a user
   *
   * @remarks
   * Aggregates all health metrics and calculates composite score.
   * This is the main entry point for generating engagement health data.
   * Results can be cached and stored in Firestore for dashboard display.
   *
   * @param userId - Creator's user ID
   * @param period - Time period for metrics calculation
   * @returns Promise resolving to complete engagement metrics
   * @throws {Error} When metric calculations fail
   *
   * @example
   * ```typescript
   * const metrics = await service.calculateEngagementMetrics('user123', 'daily');
   * console.log(`Health score: ${metrics.metrics.qualityScore}/100`);
   * console.log(`Burnout risk: ${metrics.metrics.burnoutRisk}`);
   * ```
   */
  async calculateEngagementMetrics(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<EngagementMetrics | null> {
    try {
      // Determine number of days to analyze
      const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

      // Check if user has any conversations first
      const firestore = getFirebaseDb();
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId),
        firestoreLimit(1)
      );
      const hasConversations = !(await getDocs(conversationsQuery)).empty;

      // If no conversations, return null (insufficient data)
      if (!hasConversations) {
        console.warn('No conversations found for user, returning null metrics');
        return null;
      }

      // Calculate all raw metrics in parallel
      const [personalResponseRate, avgResponseTime, conversationDepth, capacityUsage] = await Promise.all([
        this.calculatePersonalResponseRate(userId, days),
        this.calculateAvgResponseTime(userId, days),
        this.calculateConversationDepth(userId, days),
        this.calculateCapacityUsage(userId, period === 'daily' ? 'daily' : 'weekly'),
      ]);

      // Prepare raw metrics
      const rawMetrics: RawEngagementMetrics = {
        personalResponseRate,
        avgResponseTime,
        conversationDepth,
        capacityUsage,
      };

      // Assess burnout risk
      const burnoutRisk = await this.assessBurnoutRisk(userId, rawMetrics);

      // Normalize metrics for health score calculation
      const components: HealthScoreComponents = {
        personalResponseRate, // Already 0-100
        avgResponseTime: this.normalizeResponseTime(avgResponseTime),
        conversationDepth, // Already 0-100
        capacityUsage: this.normalizeCapacityUsage(capacityUsage),
      };

      // Calculate overall health score
      const qualityScore = this.calculateHealthScore(components);

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date(endDate);
      if (period === 'daily') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (period === 'weekly') {
        startDate.setDate(startDate.getDate() - 7);
      } else {
        startDate.setDate(startDate.getDate() - 30);
      }

      // Create engagement metrics document
      const metricsId = `${period}-${endDate.toISOString().split('T')[0]}-${userId}`;
      const engagementMetrics: EngagementMetrics = {
        id: metricsId,
        userId,
        period,
        startDate: Timestamp.fromDate(startDate),
        endDate: Timestamp.fromDate(endDate),
        metrics: {
          qualityScore,
          personalResponseRate,
          avgResponseTime,
          conversationDepth,
          capacityUsage,
          burnoutRisk,
        },
        createdAt: Timestamp.now(),
      };

      return engagementMetrics;
    } catch (error) {
      console.error('Failed to calculate engagement metrics:', error);
      // Return null instead of throwing - let caller handle gracefully
      return null;
    }
  }

  /**
   * Save engagement metrics to Firestore
   *
   * @remarks
   * Stores calculated metrics in `/engagement_metrics/{metricId}` collection.
   * Metrics are indexed by userId and period for efficient querying.
   *
   * @param metrics - Complete engagement metrics to store
   * @throws {Error} When Firestore write fails
   */
  async saveEngagementMetrics(metrics: EngagementMetrics): Promise<void> {
    try {
      const firestore = getFirebaseDb();
      const metricsRef = doc(firestore, 'engagement_metrics', metrics.id);
      await setDoc(metricsRef, metrics);
    } catch (error) {
      console.error('Failed to save engagement metrics:', error);
      throw new Error('Failed to save engagement metrics');
    }
  }

  /**
   * Get latest engagement metrics for a user
   *
   * @remarks
   * Retrieves most recent metrics from Firestore cache.
   * Falls back to calculating fresh metrics if none exist.
   *
   * @param userId - Creator's user ID
   * @param period - Time period for metrics
   * @returns Promise resolving to engagement metrics
   * @throws {Error} When retrieval or calculation fails
   */
  async getLatestEngagementMetrics(
    userId: string,
    period: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<EngagementMetrics | null> {
    try {
      const firestore = getFirebaseDb();

      // Query for latest metrics
      const metricsQuery = query(
        collection(firestore, 'engagement_metrics'),
        where('userId', '==', userId),
        where('period', '==', period),
        orderBy('createdAt', 'desc'),
        firestoreLimit(1)
      );

      const metricsSnapshot = await getDocs(metricsQuery);

      if (!metricsSnapshot.empty) {
        const doc = metricsSnapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data(),
        } as EngagementMetrics;
      }

      // No cached metrics found, try to calculate fresh
      // This may return null if there's insufficient data
      return await this.calculateEngagementMetrics(userId, period);
    } catch (error) {
      console.error('Failed to get latest engagement metrics:', error);
      // Return null instead of throwing - let UI handle gracefully
      return null;
    }
  }
}

/**
 * Singleton instance of EngagementMetricsService
 * @remarks
 * Use this exported instance for all engagement metrics operations
 */
export const engagementMetricsService = new EngagementMetricsService();
