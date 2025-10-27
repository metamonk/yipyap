import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  onSnapshot,
  Query,
  DocumentData
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { Message, User } from '../types/models';
import { DashboardSummary, AIPerformanceMetrics, PriorityMessageFeedItem } from '../types/dashboard';
import { getUserProfile } from './userService';

/**
 * Service class for managing dashboard operations and data aggregation
 *
 * @remarks
 * This service aggregates data from all AI features (Stories 5.2-5.6) into unified
 * dashboard views. It provides daily summaries, priority message feeds, AI performance
 * metrics, and real-time updates with throttling.
 *
 * @class DashboardService
 */
export class DashboardService {
  /**
   * Get daily summary aggregating all overnight activity
   *
   * @remarks
   * Aggregates data from:
   * - Story 5.2: Message categorization
   * - Story 5.3: Sentiment analysis and crisis detection
   * - Story 5.4: FAQ detection and auto-responses
   * - Story 5.5: Voice-matched suggestions
   * - Story 5.6: Business opportunity scoring
   *
   * @param userId - Creator's user ID
   * @returns Promise resolving to dashboard summary with all metrics
   * @throws {Error} When Firebase query fails or user has no conversations
   *
   * @example
   * ```typescript
   * const summary = await dashboardService.getDailySummary('user123');
   * console.log(`Total overnight messages: ${summary.messagingMetrics.totalMessages}`);
   * ```
   */
  async getDailySummary(userId: string): Promise<DashboardSummary> {
    try {
      const firestore = getFirebaseDb();

      // Calculate overnight period (yesterday 10pm to today 8am)
      const now = new Date();
      const overnightStart = new Date(now);
      overnightStart.setDate(overnightStart.getDate() - 1);
      overnightStart.setHours(22, 0, 0, 0);

      const overnightEnd = new Date(now);
      overnightEnd.setHours(8, 0, 0, 0);

      // Query user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Query overnight messages across all conversations (parallel execution)
      const messageQueries = conversationIds.map(async (convId) => {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('timestamp', '>=', Timestamp.fromDate(overnightStart)),
          where('timestamp', '<=', Timestamp.fromDate(overnightEnd)),
          orderBy('timestamp', 'desc')
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        return messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          conversationId: convId,
          ...doc.data(),
        })) as Message[];
      });

      const messageArrays = await Promise.all(messageQueries);
      const overnightMessages = messageArrays.flat();

      // Calculate metrics from overnight messages
      const messagingMetrics = {
        totalMessages: overnightMessages.length,
        byCategory: {
          fan_engagement: 0,
          business_opportunity: 0,
          spam: 0,
          urgent: 0,
          general: 0,
        },
        highValueOpportunities: 0,
        crisisMessages: 0,
      };

      const sentimentMetrics = {
        positiveCount: 0,
        negativeCount: 0,
        neutralCount: 0,
        mixedCount: 0,
        averageSentimentScore: 0,
        crisisDetections: 0,
      };

      let sentimentScoreSum = 0;
      let sentimentCount = 0;

      overnightMessages.forEach(msg => {
        // Category metrics (Story 5.2)
        if (msg.metadata?.category) {
          messagingMetrics.byCategory[msg.metadata.category as keyof typeof messagingMetrics.byCategory]++;
        }

        // Opportunity metrics (Story 5.6)
        if (msg.metadata?.opportunityScore && msg.metadata.opportunityScore >= 70) {
          messagingMetrics.highValueOpportunities++;
        }

        // Sentiment metrics (Story 5.3)
        if (msg.metadata?.sentiment) {
          const sentimentKey = `${msg.metadata.sentiment}Count` as keyof typeof sentimentMetrics;
          if (sentimentKey in sentimentMetrics && typeof sentimentMetrics[sentimentKey] === 'number') {
            (sentimentMetrics[sentimentKey] as number)++;
          }

          if (msg.metadata.sentimentScore !== undefined) {
            sentimentScoreSum += msg.metadata.sentimentScore;
            sentimentCount++;
          }

          // Crisis detection (negative sentiment + urgent category)
          if (msg.metadata.sentiment === 'negative' && msg.metadata.category === 'urgent') {
            messagingMetrics.crisisMessages++;
            sentimentMetrics.crisisDetections++;
          }
        }
      });

      sentimentMetrics.averageSentimentScore = sentimentCount > 0
        ? sentimentScoreSum / sentimentCount
        : 0;

      // FAQ metrics (Story 5.4) - Query FAQ auto-responses
      const faqMessages = overnightMessages.filter(msg =>
        msg.metadata?.autoResponseSent === true
      );

      const faqMetrics = {
        newQuestionsDetected: overnightMessages.filter(msg =>
          msg.metadata?.isFAQ === true && !msg.metadata?.faqTemplateId
        ).length,
        autoResponsesSent: faqMessages.length,
        faqMatchRate: overnightMessages.length > 0
          ? (faqMessages.length / overnightMessages.length) * 100
          : 0,
      };

      // Voice matching metrics (Story 5.5) - Query user's sent messages with suggestions
      const voiceMatchingMessages = overnightMessages.filter(msg =>
        msg.senderId === userId && msg.metadata?.suggestedResponse !== undefined
      );

      const voiceMatchingMetrics = {
        suggestionsGenerated: voiceMatchingMessages.length,
        suggestionsAccepted: voiceMatchingMessages.filter(msg =>
          msg.metadata?.suggestionUsed === true
        ).length,
        suggestionsEdited: voiceMatchingMessages.filter(msg =>
          msg.metadata?.suggestionEdited === true
        ).length,
        suggestionsRejected: voiceMatchingMessages.filter(msg =>
          msg.metadata?.suggestionRejected === true
        ).length,
        acceptanceRate: 0,
      };

      voiceMatchingMetrics.acceptanceRate = voiceMatchingMetrics.suggestionsGenerated > 0
        ? (voiceMatchingMetrics.suggestionsAccepted / voiceMatchingMetrics.suggestionsGenerated) * 100
        : 0;

      // Get previous day's summary for comparison
      // TODO: Store daily summaries in Firestore for historical comparison
      const comparisonWithPrevious = {
        messageCountChange: 0, // Percentage change
        opportunityCountChange: 0,
        sentimentScoreChange: 0,
      };

      return {
        userId,
        period: 'overnight',
        periodStart: Timestamp.fromDate(overnightStart),
        periodEnd: Timestamp.fromDate(overnightEnd),
        messagingMetrics,
        sentimentMetrics,
        faqMetrics,
        voiceMatchingMetrics,
        comparisonWithPrevious,
        lastUpdated: Timestamp.now(),
      };
    } catch (error) {
      console.error('Error getting daily summary:', error);
      throw new Error('Failed to retrieve daily summary');
    }
  }

  /**
   * Get priority messages feed (urgent + high-value opportunities)
   *
   * @remarks
   * Priority scoring:
   * - Crisis (negative sentiment + urgent): 100
   * - High-value opportunity (score >= 80): 85-95
   * - Medium opportunity (score 70-79): 75-84
   * - Urgent category: 70
   *
   * @param userId - Creator's user ID
   * @param maxResults - Maximum number of results to return (default: 20)
   * @returns Promise resolving to array of priority messages sorted by priority score
   * @throws {Error} When Firebase query fails
   *
   * @example
   * ```typescript
   * const priorities = await dashboardService.getPriorityMessages('user123', 10);
   * priorities.forEach(msg => {
   *   console.log(`Priority ${msg.priorityScore}: ${msg.messageText}`);
   * });
   * ```
   */
  async getPriorityMessages(
    userId: string,
    maxResults: number = 20
  ): Promise<PriorityMessageFeedItem[]> {
    try {
      const firestore = getFirebaseDb();

      // Get user's conversations
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Query priority messages across conversations (parallel execution)
      const messageQueries = conversationIds.map(async (convId) => {
        // Query messages with urgent category OR high opportunity score
        const urgentQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('metadata.category', '==', 'urgent'),
          orderBy('timestamp', 'desc'),
          limit(5)
        );

        const opportunityQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('metadata.opportunityScore', '>=', 70),
          orderBy('metadata.opportunityScore', 'desc'),
          orderBy('timestamp', 'desc'),
          limit(5)
        );

        const [urgentSnapshot, oppSnapshot] = await Promise.all([
          getDocs(urgentQuery),
          getDocs(opportunityQuery),
        ]);

        const messages = [
          ...urgentSnapshot.docs.map(doc => ({
            id: doc.id,
            conversationId: convId,
            ...doc.data(),
          })),
          ...oppSnapshot.docs.map(doc => ({
            id: doc.id,
            conversationId: convId,
            ...doc.data(),
          })),
        ] as Message[];

        // Deduplicate by message ID
        const uniqueMessages = Array.from(
          new Map(messages.map(msg => [msg.id, msg])).values()
        );

        return uniqueMessages;
      });

      const messageArrays = await Promise.all(messageQueries);
      const allPriorityMessages = messageArrays.flat();

      // Fetch sender profiles for all priority messages
      const uniqueSenderIds = Array.from(new Set(allPriorityMessages.map(msg => msg.senderId)));
      const senderProfiles: Record<string, User> = {};

      await Promise.all(
        uniqueSenderIds.map(async (senderId) => {
          try {
            const user = await getUserProfile(senderId);
            if (user) {
              senderProfiles[senderId] = user;
            }
          } catch (err) {
            console.error(`Failed to fetch user ${senderId}:`, err);
          }
        })
      );

      // Calculate priority score for each message
      const priorityFeedItems: PriorityMessageFeedItem[] = allPriorityMessages.map(msg => {
        let priorityScore = 0;
        let priorityType: 'crisis' | 'high_value_opportunity' | 'urgent' = 'urgent';

        // Crisis: negative sentiment + urgent category
        const isCrisis = msg.metadata?.sentiment === 'negative' &&
                        msg.metadata?.category === 'urgent';
        if (isCrisis) {
          priorityScore = 100;
          priorityType = 'crisis';
        }
        // High-value opportunity
        else if (msg.metadata?.opportunityScore && msg.metadata.opportunityScore >= 70) {
          priorityScore = msg.metadata.opportunityScore;
          priorityType = 'high_value_opportunity';
        }
        // Regular urgent
        else if (msg.metadata?.category === 'urgent') {
          priorityScore = 70;
          priorityType = 'urgent';
        }

        // Get sender name from fetched profiles
        const sender = senderProfiles[msg.senderId];
        const senderName = sender?.displayName || 'Unknown';

        return {
          id: msg.id,
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          senderName,
          messageText: msg.text,
          timestamp: msg.timestamp,
          priorityScore,
          priorityType,
          sentiment: msg.metadata?.sentiment,
          sentimentScore: msg.metadata?.sentimentScore,
          isCrisis,
          opportunityScore: msg.metadata?.opportunityScore,
          opportunityType: msg.metadata?.opportunityType,
          category: msg.metadata?.category,
        };
      });

      // Sort by priority score DESC, then timestamp DESC
      const sorted = priorityFeedItems.sort((a, b) => {
        const scoreDiff = b.priorityScore - a.priorityScore;
        if (scoreDiff !== 0) return scoreDiff;
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      });

      return sorted.slice(0, maxResults);
    } catch (error) {
      console.error('Error getting priority messages:', error);
      throw new Error('Failed to retrieve priority messages');
    }
  }

  /**
   * Get AI performance metrics for specified period
   *
   * @remarks
   * Calculates metrics across all AI features:
   * - Categorization accuracy and latency
   * - Time saved estimates
   * - Cost tracking (OpenAI API usage)
   * - Performance trends over time
   *
   * @param userId - Creator's user ID
   * @param period - Time period ('7days', '30days', '90days')
   * @returns Promise resolving to AI performance metrics with trends
   * @throws {Error} When Firebase query fails
   *
   * @example
   * ```typescript
   * const metrics = await dashboardService.getAIPerformanceMetrics('user123', '7days');
   * console.log(`Total cost: $${metrics.costMetrics.totalCostUSD}`);
   * console.log(`Time saved: ${metrics.timeSavedMetrics.totalMinutesSaved} minutes`);
   * ```
   */
  async getAIPerformanceMetrics(
    userId: string,
    period: '7days' | '30days' | '90days' = '7days'
  ): Promise<AIPerformanceMetrics> {
    try {
      const firestore = getFirebaseDb();

      // Calculate period start date
      const periodDays = parseInt(period.replace('days', ''));
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);

      // Query user's conversations and messages in period
      const conversationsQuery = query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', userId)
      );
      const conversationsSnapshot = await getDocs(conversationsQuery);
      const conversationIds = conversationsSnapshot.docs.map(doc => doc.id);

      // Query messages in period across all conversations
      const messageQueries = conversationIds.map(async (convId) => {
        const messagesQuery = query(
          collection(firestore, 'conversations', convId, 'messages'),
          where('timestamp', '>=', Timestamp.fromDate(periodStart)),
          orderBy('timestamp', 'desc')
        );

        const messagesSnapshot = await getDocs(messagesQuery);
        return messagesSnapshot.docs.map(doc => ({
          id: doc.id,
          conversationId: convId,
          ...doc.data(),
        })) as Message[];
      });

      const messageArrays = await Promise.all(messageQueries);
      const periodMessages = messageArrays.flat();

      // Calculate categorization metrics
      const categorizedMessages = periodMessages.filter(msg => msg.metadata?.category);
      const categorizationMetrics = {
        totalCategorized: categorizedMessages.length,
        accuracy: 95.0, // TODO: Calculate from user feedback on category corrections
        averageLatency: 450, // TODO: Calculate from actual latency data
      };

      // Calculate time saved metrics
      const autoResponseCount = periodMessages.filter(msg => msg.metadata?.autoResponseSent).length;
      const acceptedSuggestionsCount = periodMessages.filter(msg =>
        msg.metadata?.suggestionUsed || msg.metadata?.suggestionEdited
      ).length;

      const timeSavedMetrics = {
        fromAutoResponses: autoResponseCount * 2, // 2 minutes per auto-response
        fromSuggestions: acceptedSuggestionsCount * 1.5, // 1.5 minutes per suggestion
        fromCategorization: categorizedMessages.length * 0.25, // 0.25 minutes per categorization
        totalMinutesSaved: 0,
      };
      timeSavedMetrics.totalMinutesSaved =
        timeSavedMetrics.fromAutoResponses +
        timeSavedMetrics.fromSuggestions +
        timeSavedMetrics.fromCategorization;

      // Calculate cost metrics
      // Using OpenAI pricing: GPT-4o-mini ($0.15/$0.60 per 1M tokens), GPT-4 Turbo ($10/$30 per 1M)
      const categorizationCost = categorizedMessages.length * 0.0005; // ~500 tokens per categorization
      const sentimentCost = categorizedMessages.length * 0.0003; // ~300 tokens per sentiment
      const opportunityCost = periodMessages.filter(msg =>
        msg.metadata?.opportunityScore
      ).length * 0.002; // ~2000 tokens per opportunity scoring
      const voiceCost = acceptedSuggestionsCount * 0.003; // ~3000 tokens per voice suggestion
      const faqCost = autoResponseCount * 0.0008; // ~800 tokens per FAQ detection

      const costMetrics = {
        categorization: categorizationCost,
        sentiment: sentimentCost,
        opportunityScoring: opportunityCost,
        voiceMatching: voiceCost,
        faqDetection: faqCost,
        totalCostUSD: 0,
        averageCostPerMessage: 0,
      };
      costMetrics.totalCostUSD =
        costMetrics.categorization +
        costMetrics.sentiment +
        costMetrics.opportunityScoring +
        costMetrics.voiceMatching +
        costMetrics.faqDetection;
      costMetrics.averageCostPerMessage = periodMessages.length > 0
        ? costMetrics.totalCostUSD / periodMessages.length
        : 0;

      // Calculate daily trends
      const performanceTrends = this.calculateDailyTrends(periodMessages, periodDays);

      return {
        userId,
        period,
        periodStart: Timestamp.fromDate(periodStart),
        categorizationMetrics,
        timeSavedMetrics,
        costMetrics: {
          totalCostUSD: costMetrics.totalCostUSD,
          byCost: {
            categorization: costMetrics.categorization,
            sentiment: costMetrics.sentiment,
            opportunityScoring: costMetrics.opportunityScoring,
            voiceMatching: costMetrics.voiceMatching,
            faqDetection: costMetrics.faqDetection,
          },
          averageCostPerMessage: costMetrics.averageCostPerMessage,
        },
        performanceTrends,
        lastCalculated: Timestamp.now(),
      };
    } catch (error) {
      console.error('Error getting AI performance metrics:', error);
      throw new Error('Failed to retrieve AI performance metrics');
    }
  }

  /**
   * Subscribe to dashboard updates in real-time
   *
   * @remarks
   * Throttled to max 1 update per second to prevent UI jank.
   * Subscribes to user's conversations for new messages and triggers
   * dashboard recalculation when changes occur.
   *
   * @param userId - Creator's user ID
   * @param callback - Called with updated dashboard data (throttled)
   * @returns Unsubscribe function to stop listening
   *
   * @example
   * ```typescript
   * const unsubscribe = dashboardService.subscribeToDashboardUpdates('user123', (summary) => {
   *   console.log('Dashboard updated:', summary);
   * });
   *
   * // Later, stop listening
   * unsubscribe();
   * ```
   */
  subscribeToDashboardUpdates(
    userId: string,
    callback: (summary: DashboardSummary) => void
  ): () => void {
    const firestore = getFirebaseDb();
    let lastUpdate = 0;
    const throttleMs = 1000; // Max 1 update per second

    // Subscribe to user's conversations for new messages
    const conversationsQuery = query(
      collection(firestore, 'conversations'),
      where('participantIds', 'array-contains', userId),
      orderBy('lastMessageTimestamp', 'desc'),
      limit(30)
    );

    const unsubscribe = onSnapshot(conversationsQuery, async () => {
      const now = Date.now();
      if (now - lastUpdate < throttleMs) {
        return; // Skip update if within throttle window
      }

      lastUpdate = now;
      try {
        const summary = await this.getDailySummary(userId);
        callback(summary);
      } catch (error) {
        console.error('Error in dashboard subscription:', error);
      }
    });

    return unsubscribe;
  }

  /**
   * Calculate daily performance trends from messages
   *
   * @remarks
   * Private helper method to aggregate metrics by day for trend charts.
   *
   * @param messages - Array of messages to analyze
   * @param periodDays - Number of days to analyze
   * @returns Array of daily trend data points
   */
  private calculateDailyTrends(messages: Message[], periodDays: number): Array<{
    date: string;
    accuracy: number;
    timeSaved: number;
    cost: number;
  }> {
    const trends: Map<string, { accuracy: number; timeSaved: number; cost: number }> = new Map();

    // Initialize all dates in period
    for (let i = 0; i < periodDays; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      trends.set(dateStr, { accuracy: 95.0, timeSaved: 0, cost: 0 });
    }

    // Aggregate metrics by date
    messages.forEach(msg => {
      const dateStr = msg.timestamp.toDate().toISOString().split('T')[0];
      const existing = trends.get(dateStr) || { accuracy: 95.0, timeSaved: 0, cost: 0 };

      // Time saved calculations
      if (msg.metadata?.autoResponseSent) {
        existing.timeSaved += 2;
      }
      if (msg.metadata?.suggestionUsed || msg.metadata?.suggestionEdited) {
        existing.timeSaved += 1.5;
      }
      if (msg.metadata?.category) {
        existing.timeSaved += 0.25;
      }

      // Cost calculations (simplified)
      if (msg.metadata?.category) {
        existing.cost += 0.0005; // Categorization
        existing.cost += 0.0003; // Sentiment
      }
      if (msg.metadata?.opportunityScore) {
        existing.cost += 0.002; // Opportunity scoring
      }
      if (msg.metadata?.suggestionUsed || msg.metadata?.suggestionEdited) {
        existing.cost += 0.003; // Voice matching
      }
      if (msg.metadata?.autoResponseSent) {
        existing.cost += 0.0008; // FAQ detection
      }

      trends.set(dateStr, existing);
    });

    // Convert to array and sort by date
    return Array.from(trends.entries())
      .map(([date, metrics]) => ({ date, ...metrics }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

/**
 * Singleton instance of DashboardService
 * @remarks
 * Use this exported instance throughout the application for consistency
 */
export const dashboardService = new DashboardService();
