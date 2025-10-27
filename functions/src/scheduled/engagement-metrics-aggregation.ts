// @ts-nocheck
/**
 * Engagement Metrics Aggregation Cloud Function (Story 6.6)
 *
 * Calculates and stores engagement health metrics for all users.
 * Runs daily at midnight to aggregate quality-focused metrics.
 *
 * Features:
 * - Daily health score calculation
 * - Weekly and monthly rollups
 * - Burnout risk assessment
 * - Trend analysis (week-over-week comparisons)
 * - Performance optimized (< 5 seconds per user)
 */

import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  EngagementMetrics,
  HealthScoreComponents,
  RawEngagementMetrics,
  BurnoutRisk,
} from '../types/user';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled function to aggregate daily engagement metrics
 * Runs every day at midnight UTC
 */
export const aggregateDailyEngagementMetrics = scheduler.onSchedule(
  {
    schedule: '0 0 * * *', // Cron: Daily at 00:00 UTC
    timeZone: 'UTC',
  },
  async (event) => {
    console.log('Starting daily engagement metrics aggregation');

    try {
      // Get all active users
      const usersSnapshot = await db.collection('users').get();

      console.log(`Aggregating metrics for ${usersSnapshot.size} users`);

      const aggregationPromises = usersSnapshot.docs.map(async (userDoc) => {
        try {
          const userId = userDoc.id;
          return await aggregateUserMetrics(userId, 'daily');
        } catch (error) {
          console.error(`Failed to aggregate metrics for user ${userDoc.id}:`, error);
          return null;
        }
      });

      const results = await Promise.all(aggregationPromises);
      const successCount = results.filter((r) => r !== null).length;

      console.log(`Successfully aggregated ${successCount}/${usersSnapshot.size} metrics`);

      // Check if today is Sunday for weekly rollups
      const today = new Date();
      if (today.getDay() === 0) {
        console.log('Sunday detected - running weekly rollups');
        await aggregateWeeklyMetrics();
      }

      // Check if today is the last day of the month for monthly rollups
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (tomorrow.getDate() === 1) {
        console.log('End of month detected - running monthly rollups');
        await aggregateMonthlyMetrics();
      }
    } catch (error) {
      console.error('Error in daily metrics aggregation:', error);
      throw error;
    }
  }
);

/**
 * Aggregates engagement metrics for a specific user and period
 * @param userId - The user ID to aggregate metrics for
 * @param period - Time period ('daily', 'weekly', or 'monthly')
 * @returns The generated engagement metrics
 */
export async function aggregateUserMetrics(
  userId: string,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<EngagementMetrics | null> {
  console.log(`Aggregating ${period} metrics for user ${userId}`);

  try {
    // Get user document to check capacity settings
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found, skipping`);
      return null;
    }

    const userData = userDoc.data();
    const dailyLimit = userData?.settings?.capacity?.dailyLimit || 10;

    // Determine number of days to analyze
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;

    // Calculate raw metrics
    const rawMetrics = await calculateRawMetrics(userId, days, dailyLimit, period);

    // Assess burnout risk
    const burnoutRisk = await assessBurnoutRisk(userId, rawMetrics);

    // Normalize metrics for health score calculation
    const components: HealthScoreComponents = {
      personalResponseRate: rawMetrics.personalResponseRate, // Already 0-100
      avgResponseTime: normalizeResponseTime(rawMetrics.avgResponseTime),
      conversationDepth: rawMetrics.conversationDepth, // Already 0-100
      capacityUsage: normalizeCapacityUsage(rawMetrics.capacityUsage),
    };

    // Calculate overall health score
    const qualityScore = calculateHealthScore(components);

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

    // Get previous period metrics for trend calculation
    const trends = await calculateTrends(userId, period, qualityScore, rawMetrics);

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
        personalResponseRate: rawMetrics.personalResponseRate,
        avgResponseTime: rawMetrics.avgResponseTime,
        conversationDepth: rawMetrics.conversationDepth,
        capacityUsage: rawMetrics.capacityUsage,
        burnoutRisk,
      },
      trends,
      createdAt: Timestamp.now(),
    };

    // Save to Firestore
    await db.collection('engagement_metrics').doc(metricsId).set(engagementMetrics);

    console.log(`Successfully aggregated ${period} metrics for user ${userId}`);
    return engagementMetrics;
  } catch (error) {
    console.error(`Error aggregating ${period} metrics for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Calculates raw engagement metrics from message data
 * @param userId - User ID to calculate metrics for
 * @param days - Number of days to analyze
 * @param dailyLimit - User's daily capacity limit
 * @param period - Time period for capacity calculation
 * @returns Raw engagement metrics
 */
async function calculateRawMetrics(
  userId: string,
  days: number,
  dailyLimit: number,
  period: 'daily' | 'weekly' | 'monthly'
): Promise<RawEngagementMetrics> {
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  // Get user's conversations
  const conversationsSnapshot = await db
    .collection('conversations')
    .where('participantIds', 'array-contains', userId)
    .get();

  const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

  // Fetch messages in parallel
  const messagePromises = conversationIds.map(async (convId) => {
    const messagesSnapshot = await db
      .collection('conversations')
      .doc(convId)
      .collection('messages')
      .where('timestamp', '>=', Timestamp.fromDate(startDate))
      .where('timestamp', '<=', Timestamp.fromDate(endDate))
      .orderBy('timestamp', 'asc')
      .get();

    return messagesSnapshot.docs.map((doc) => ({
      id: doc.id,
      conversationId: convId,
      ...doc.data(),
    } as any));
  });

  const messageArrays = await Promise.all(messagePromises);
  const allMessages = messageArrays.flat() as any[];

  // Calculate personal response rate
  const creatorMessages = allMessages.filter((msg) => msg.senderId === userId);
  const draftedMessages = creatorMessages.filter((msg) => msg.metadata?.isAIDraft === true);
  const editedDrafts = draftedMessages.filter((msg) => msg.metadata?.wasEdited === true);
  const personalResponseRate =
    draftedMessages.length > 0 ? Math.round((editedDrafts.length / draftedMessages.length) * 100) : 100;

  // Calculate average response time
  const responseTimes: number[] = [];
  const messagesByConversation = allMessages.reduce((acc, msg) => {
    if (!acc[msg.conversationId]) {
      acc[msg.conversationId] = [];
    }
    acc[msg.conversationId].push(msg);
    return acc;
  }, {} as Record<string, any[]>);

  Object.values(messagesByConversation).forEach((messages) => {
    for (let i = 0; i < messages.length - 1; i++) {
      const currentMsg = messages[i];
      const nextMsg = messages[i + 1];

      if (currentMsg.senderId !== userId && nextMsg.senderId === userId) {
        const fanTimestamp = currentMsg.timestamp.toMillis();
        const creatorTimestamp = nextMsg.timestamp.toMillis();
        const diffMs = creatorTimestamp - fanTimestamp;
        const diffHours = diffMs / (1000 * 60 * 60);
        responseTimes.push(diffHours);
      }
    }
  });

  const avgResponseTime =
    responseTimes.length > 0
      ? Math.round((responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length) * 10) / 10
      : 0;

  // Calculate conversation depth
  const conversationMessageCounts = Object.values(messagesByConversation).map((msgs) => msgs.length);
  const activeConversations = conversationMessageCounts.filter((count) => count > 0);
  const multiTurnCount = activeConversations.filter((count) => count >= 3).length;
  const conversationDepth =
    activeConversations.length > 0 ? Math.round((multiTurnCount / activeConversations.length) * 100) : 0;

  // Calculate capacity usage
  let capacityUsage: number;
  if (period === 'daily') {
    capacityUsage = Math.min(Math.round((creatorMessages.length / dailyLimit) * 100), 100);
  } else {
    const periodLimit = period === 'weekly' ? dailyLimit * 7 : dailyLimit * 30;
    capacityUsage = Math.min(Math.round((creatorMessages.length / periodLimit) * 100), 100);
  }

  return {
    personalResponseRate,
    avgResponseTime,
    conversationDepth,
    capacityUsage,
  };
}

/**
 * Calculate health score from individual metric components
 * @param components - Normalized component scores (all 0-100)
 * @returns Overall health score (0-100)
 */
function calculateHealthScore(components: HealthScoreComponents): number {
  const weights = {
    personalResponseRate: 0.35, // 35% weight
    avgResponseTime: 0.25, // 25% weight
    conversationDepth: 0.2, // 20% weight
    capacityUsage: 0.2, // 20% weight
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
 * @param hours - Average response time in hours
 * @returns Normalized score (0-100)
 */
function normalizeResponseTime(hours: number): number {
  if (hours < 12) return 100;
  if (hours < 24) return 80;
  if (hours < 48) return 40;
  return 0;
}

/**
 * Normalize capacity usage to 0-100 score
 * @param usage - Capacity usage percentage (0-100)
 * @returns Normalized score (0-100)
 */
function normalizeCapacityUsage(usage: number): number {
  if (usage >= 70 && usage <= 80) return 100;
  if (usage >= 60 && usage <= 90) return 80;
  if (usage >= 90) return 60;
  return 40;
}

/**
 * Assess burnout risk based on multiple indicators
 * @param userId - User ID
 * @param metrics - Raw engagement metrics
 * @returns Burnout risk level
 */
async function assessBurnoutRisk(userId: string, metrics: RawEngagementMetrics): Promise<BurnoutRisk> {
  let riskScore = 0;

  // High capacity usage (100% for 7+ days)
  if (metrics.capacityUsage === 100) {
    const daysAtMax = await getDaysAtMaxCapacity(userId);
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
}

/**
 * Get number of consecutive days at maximum capacity
 * @param userId - User ID
 * @returns Number of consecutive days at max capacity
 */
async function getDaysAtMaxCapacity(userId: string): Promise<number> {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return 0;

  const userData = userDoc.data();
  const dailyLimit = userData?.settings?.capacity?.dailyLimit || 10;

  const today = new Date();
  let consecutiveDays = 0;

  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    checkDate.setHours(0, 0, 0, 0);

    const endOfDay = new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Query messages for this day
    const conversationsSnapshot = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .get();

    const conversationIds = conversationsSnapshot.docs.map((doc) => doc.id);

    const messagePromises = conversationIds.map(async (convId) => {
      const messagesSnapshot = await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .where('senderId', '==', userId)
        .where('timestamp', '>=', Timestamp.fromDate(checkDate))
        .where('timestamp', '<=', Timestamp.fromDate(endOfDay))
        .get();

      return messagesSnapshot.size;
    });

    const messageCounts = await Promise.all(messagePromises);
    const totalMessages = messageCounts.reduce((sum, count) => sum + count, 0);

    if (totalMessages >= dailyLimit) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  return consecutiveDays;
}

/**
 * Calculate week-over-week trends
 * @param userId - User ID
 * @param period - Current period
 * @param currentScore - Current quality score
 * @param currentMetrics - Current raw metrics
 * @returns Trend differences
 */
async function calculateTrends(
  userId: string,
  period: 'daily' | 'weekly' | 'monthly',
  currentScore: number,
  currentMetrics: RawEngagementMetrics
): Promise<EngagementMetrics['trends']> {
  try {
    // Get previous period's metrics
    const previousDate = new Date();
    if (period === 'daily') {
      previousDate.setDate(previousDate.getDate() - 1);
    } else if (period === 'weekly') {
      previousDate.setDate(previousDate.getDate() - 7);
    } else {
      previousDate.setMonth(previousDate.getMonth() - 1);
    }

    const previousMetricsId = `${period}-${previousDate.toISOString().split('T')[0]}-${userId}`;
    const previousDoc = await db.collection('engagement_metrics').doc(previousMetricsId).get();

    if (!previousDoc.exists) {
      return undefined; // No previous data to compare
    }

    const previousData = previousDoc.data() as EngagementMetrics;

    return {
      qualityScoreDiff: currentScore - previousData.metrics.qualityScore,
      personalResponseRateDiff: currentMetrics.personalResponseRate - previousData.metrics.personalResponseRate,
      avgResponseTimeDiff: currentMetrics.avgResponseTime - previousData.metrics.avgResponseTime,
      conversationDepthDiff: currentMetrics.conversationDepth - previousData.metrics.conversationDepth,
    };
  } catch (error) {
    console.error(`Error calculating trends for user ${userId}:`, error);
    return undefined;
  }
}

/**
 * Aggregate weekly metrics for all users
 */
async function aggregateWeeklyMetrics(): Promise<void> {
  console.log('Aggregating weekly metrics for all users');

  try {
    const usersSnapshot = await db.collection('users').get();

    const weeklyPromises = usersSnapshot.docs.map(async (userDoc) => {
      try {
        return await aggregateUserMetrics(userDoc.id, 'weekly');
      } catch (error) {
        console.error(`Failed to aggregate weekly metrics for user ${userDoc.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(weeklyPromises);
    const successCount = results.filter((r) => r !== null).length;

    console.log(`Successfully aggregated weekly metrics for ${successCount}/${usersSnapshot.size} users`);
  } catch (error) {
    console.error('Error aggregating weekly metrics:', error);
    throw error;
  }
}

/**
 * Aggregate monthly metrics for all users
 */
async function aggregateMonthlyMetrics(): Promise<void> {
  console.log('Aggregating monthly metrics for all users');

  try {
    const usersSnapshot = await db.collection('users').get();

    const monthlyPromises = usersSnapshot.docs.map(async (userDoc) => {
      try {
        return await aggregateUserMetrics(userDoc.id, 'monthly');
      } catch (error) {
        console.error(`Failed to aggregate monthly metrics for user ${userDoc.id}:`, error);
        return null;
      }
    });

    const results = await Promise.all(monthlyPromises);
    const successCount = results.filter((r) => r !== null).length;

    console.log(`Successfully aggregated monthly metrics for ${successCount}/${usersSnapshot.size} users`);
  } catch (error) {
    console.error('Error aggregating monthly metrics:', error);
    throw error;
  }
}
