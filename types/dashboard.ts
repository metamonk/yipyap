import { Message } from './models';
import { Timestamp } from 'firebase/firestore';

/**
 * Analytics metrics for business opportunity tracking
 *
 * @remarks
 * Provides aggregated statistics about business opportunities over a time period.
 * Used by the Opportunity Dashboard to display historical trends and insights.
 *
 * @example
 * ```typescript
 * const analytics: OpportunityAnalytics = {
 *   totalOpportunities: 45,
 *   highValueCount: 12,
 *   averageScore: 62.5,
 *   byType: {
 *     sponsorship: 8,
 *     collaboration: 15,
 *     partnership: 10,
 *     sale: 12
 *   },
 *   periodDays: 30
 * };
 * ```
 */
export interface OpportunityAnalytics {
  /** Total number of business opportunities detected in the period */
  totalOpportunities: number;

  /**
   * Count of high-value opportunities (score >= 70)
   * @remarks
   * High-value opportunities trigger priority notifications
   */
  highValueCount: number;

  /**
   * Average opportunity score across all opportunities in the period
   * @remarks
   * Score range: 0-100, where higher scores indicate more valuable opportunities
   */
  averageScore: number;

  /**
   * Breakdown of opportunities by type
   * @remarks
   * Maps opportunity type to count of opportunities of that type
   */
  byType: Record<'sponsorship' | 'collaboration' | 'partnership' | 'sale' | 'unknown', number>;

  /**
   * Number of days analyzed in this analytics period
   * @remarks
   * Common values: 7 (week), 30 (month), 90 (quarter)
   */
  periodDays: number;
}

/**
 * Daily summary metrics for opportunity tracking
 *
 * @remarks
 * Provides a snapshot of opportunity activity for display in the daily summary widget.
 * Typically shows overnight or last 24 hours of activity.
 *
 * @example
 * ```typescript
 * const summary: DailySummary = {
 *   newOpportunities: 5,
 *   highValueOpportunities: 2,
 *   topScore: 95,
 *   comparisonWithPreviousDay: {
 *     opportunitiesChange: +2,
 *     scoreChange: +5.3
 *   }
 * };
 * ```
 */
export interface DailySummary {
  /** Number of new opportunities received today */
  newOpportunities: number;

  /** Number of high-value opportunities (score >= 70) received today */
  highValueOpportunities: number;

  /**
   * Highest opportunity score received today
   * @remarks
   * Range: 0-100
   */
  topScore: number;

  /** Comparison metrics with previous day (optional) */
  comparisonWithPreviousDay?: {
    /**
     * Change in opportunity count compared to previous day
     * @remarks
     * Positive values indicate increase, negative indicate decrease
     */
    opportunitiesChange: number;

    /**
     * Change in average score compared to previous day
     * @remarks
     * Positive values indicate higher quality opportunities
     */
    scoreChange: number;
  };
}

/**
 * Grouped opportunities by date for timeline display
 *
 * @remarks
 * Used to organize opportunities chronologically in the dashboard feed.
 *
 * @example
 * ```typescript
 * const grouped: GroupedOpportunities = {
 *   '2025-10-23': [opportunity1, opportunity2],
 *   '2025-10-22': [opportunity3, opportunity4, opportunity5]
 * };
 * ```
 */
export type GroupedOpportunities = Record<string, Message[]>;

/**
 * Filter options for opportunity feed
 *
 * @remarks
 * Allows users to filter opportunities by type, score range, and date range.
 *
 * @example
 * ```typescript
 * const filters: OpportunityFilters = {
 *   types: ['sponsorship', 'collaboration'],
 *   minScore: 70,
 *   maxScore: 100,
 *   dateRange: {
 *     start: new Date('2025-10-01'),
 *     end: new Date('2025-10-23')
 *   }
 * };
 * ```
 */
export interface OpportunityFilters {
  /**
   * Filter by opportunity types
   * @remarks
   * If empty or undefined, show all types
   */
  types?: Array<'sponsorship' | 'collaboration' | 'partnership' | 'sale'>;

  /**
   * Minimum opportunity score to display (0-100)
   * @remarks
   * Default: 70 (high-value only)
   */
  minScore?: number;

  /**
   * Maximum opportunity score to display (0-100)
   * @remarks
   * Default: 100
   */
  maxScore?: number;

  /**
   * Date range filter (optional)
   */
  dateRange?: {
    /** Start date (inclusive) */
    start: Date;
    /** End date (inclusive) */
    end: Date;
  };
}

/**
 * Sort options for opportunity feed
 *
 * @remarks
 * Determines the order in which opportunities are displayed.
 */
export type OpportunitySortBy = 'score-desc' | 'score-asc' | 'date-desc' | 'date-asc' | 'type';

/**
 * State for opportunity feed pagination
 *
 * @remarks
 * Manages infinite scroll or page-based loading for large opportunity lists.
 *
 * @example
 * ```typescript
 * const pagination: OpportunityPagination = {
 *   page: 1,
 *   pageSize: 20,
 *   totalCount: 150,
 *   hasMore: true
 * };
 * ```
 */
export interface OpportunityPagination {
  /** Current page number (0-indexed) */
  page: number;

  /** Number of opportunities per page */
  pageSize: number;

  /** Total count of opportunities matching current filters */
  totalCount: number;

  /** Whether there are more opportunities to load */
  hasMore: boolean;
}

/**
 * Comprehensive dashboard summary aggregating all overnight activity
 *
 * @remarks
 * Provides a complete snapshot of overnight activity from all AI features:
 * - Message categorization (Story 5.2)
 * - Sentiment analysis and crisis detection (Story 5.3)
 * - FAQ detection and auto-responses (Story 5.4)
 * - Voice-matched suggestions (Story 5.5)
 * - Business opportunity scoring (Story 5.6)
 *
 * @example
 * ```typescript
 * const summary: DashboardSummary = {
 *   userId: 'user123',
 *   period: 'overnight',
 *   periodStart: Timestamp.fromDate(new Date('2025-10-23T22:00:00')),
 *   periodEnd: Timestamp.fromDate(new Date('2025-10-24T08:00:00')),
 *   messagingMetrics: {
 *     totalMessages: 42,
 *     byCategory: { fan_engagement: 20, business_opportunity: 8, spam: 2, urgent: 5, general: 7 },
 *     highValueOpportunities: 3,
 *     crisisMessages: 1
 *   },
 *   sentimentMetrics: { positiveCount: 25, negativeCount: 5, neutralCount: 10, mixedCount: 2, averageSentimentScore: 0.45, crisisDetections: 1 },
 *   faqMetrics: { newQuestionsDetected: 4, autoResponsesSent: 8, faqMatchRate: 19.05 },
 *   voiceMatchingMetrics: { suggestionsGenerated: 15, suggestionsAccepted: 12, suggestionsEdited: 2, suggestionsRejected: 1, acceptanceRate: 80 },
 *   comparisonWithPrevious: { messageCountChange: 15.5, opportunityCountChange: 50.0, sentimentScoreChange: 0.1 },
 *   lastUpdated: Timestamp.now()
 * };
 * ```
 */
export interface DashboardSummary {
  /** User ID of the creator this summary belongs to */
  userId: string;

  /**
   * Time period covered by this summary
   * @remarks
   * - 'overnight': Yesterday 10pm to today 8am
   * - 'today': Today 12am to current time
   * - 'week': Last 7 days
   * - 'month': Last 30 days
   */
  period: 'overnight' | 'today' | 'week' | 'month';

  /** Start timestamp of the summary period */
  periodStart: Timestamp;

  /** End timestamp of the summary period */
  periodEnd: Timestamp;

  /**
   * Messaging activity metrics
   * @remarks
   * Aggregates message counts by category and priority
   */
  messagingMetrics: {
    /** Total message count in the period */
    totalMessages: number;

    /**
     * Message count breakdown by category (Story 5.2)
     * @remarks
     * Categories: fan_engagement, business_opportunity, spam, urgent, general
     */
    byCategory: {
      /** Fan engagement messages (interactions, praise, questions) */
      fan_engagement: number;
      /** Business opportunity messages (sponsorships, collaborations, partnerships) */
      business_opportunity: number;
      /** Spam messages (promotional, irrelevant) */
      spam: number;
      /** Urgent messages requiring immediate attention */
      urgent: number;
      /** General messages not fitting other categories */
      general: number;
    };

    /**
     * Count of high-value business opportunities (score >= 70) (Story 5.6)
     * @remarks
     * Subset of business_opportunity category with high scores
     */
    highValueOpportunities: number;

    /**
     * Count of crisis messages (Story 5.3)
     * @remarks
     * Messages with negative sentiment AND urgent category
     */
    crisisMessages: number;
  };

  /**
   * Sentiment analysis metrics (Story 5.3)
   */
  sentimentMetrics: {
    /** Count of positive sentiment messages */
    positiveCount: number;
    /** Count of negative sentiment messages */
    negativeCount: number;
    /** Count of neutral sentiment messages */
    neutralCount: number;
    /** Count of mixed sentiment messages */
    mixedCount: number;

    /**
     * Average sentiment score across all messages
     * @remarks
     * Range: -1 (very negative) to 1 (very positive)
     */
    averageSentimentScore: number;

    /**
     * Count of crisis detections
     * @remarks
     * Crisis = negative sentiment + urgent category
     */
    crisisDetections: number;
  };

  /**
   * FAQ detection and auto-response metrics (Story 5.4)
   */
  faqMetrics: {
    /**
     * New FAQ questions detected but not yet added to library
     * @remarks
     * Messages flagged as FAQ but no matching template found
     */
    newQuestionsDetected: number;

    /** Count of auto-responses sent using FAQ templates */
    autoResponsesSent: number;

    /**
     * Percentage of messages that matched FAQ templates
     * @remarks
     * Range: 0-100
     */
    faqMatchRate: number;
  };

  /**
   * Voice-matched response suggestion metrics (Story 5.5)
   */
  voiceMatchingMetrics: {
    /** Total number of AI suggestions generated */
    suggestionsGenerated: number;

    /** Number of suggestions accepted without editing */
    suggestionsAccepted: number;

    /** Number of suggestions accepted but edited before sending */
    suggestionsEdited: number;

    /** Number of suggestions rejected by creator */
    suggestionsRejected: number;

    /**
     * Percentage of suggestions accepted (with or without editing)
     * @remarks
     * Range: 0-100, calculated as (accepted + edited) / generated * 100
     */
    acceptanceRate: number;
  };

  /**
   * Comparison with previous period
   * @remarks
   * Used to show trending indicators (up/down arrows, percentage changes)
   */
  comparisonWithPrevious: {
    /**
     * Percentage change in message count
     * @remarks
     * Positive = increase, negative = decrease
     */
    messageCountChange: number;

    /**
     * Percentage change in high-value opportunity count
     * @remarks
     * Positive = more opportunities, negative = fewer opportunities
     */
    opportunityCountChange: number;

    /**
     * Delta in average sentiment score
     * @remarks
     * Range: -2 to 2 (difference of two -1 to 1 values)
     */
    sentimentScoreChange: number;
  };

  /** Timestamp when this summary was last calculated */
  lastUpdated: Timestamp;
}

/**
 * AI performance metrics tracking across all AI features
 *
 * @remarks
 * Provides performance analytics, time savings, and cost tracking for all AI operations.
 * Used by the AI Metrics Dashboard to show ROI and performance trends.
 *
 * @example
 * ```typescript
 * const metrics: AIPerformanceMetrics = {
 *   userId: 'user123',
 *   period: '7days',
 *   periodStart: Timestamp.fromDate(new Date('2025-10-17')),
 *   categorizationMetrics: { totalCategorized: 250, accuracy: 92.5, averageLatency: 450 },
 *   timeSavedMetrics: { totalMinutesSaved: 180, fromAutoResponses: 120, fromSuggestions: 45, fromCategorization: 15 },
 *   costMetrics: { totalCostUSD: 4.50, byCost: { categorization: 1.20, sentiment: 0.80, opportunityScoring: 1.00, voiceMatching: 1.20, faqDetection: 0.30 }, averageCostPerMessage: 0.018 },
 *   performanceTrends: [{ date: '2025-10-24', accuracy: 93.0, timeSaved: 28, cost: 0.65 }],
 *   lastCalculated: Timestamp.now()
 * };
 * ```
 */
export interface AIPerformanceMetrics {
  /** User ID of the creator these metrics belong to */
  userId: string;

  /**
   * Time period for metrics calculation
   * @remarks
   * - '7days': Last week
   * - '30days': Last month
   * - '90days': Last quarter
   */
  period: '7days' | '30days' | '90days';

  /** Start timestamp of the metrics period */
  periodStart: Timestamp;

  /**
   * Message categorization performance metrics (Story 5.2)
   */
  categorizationMetrics: {
    /** Total number of messages categorized by AI */
    totalCategorized: number;

    /**
     * Categorization accuracy percentage
     * @remarks
     * Range: 0-100, based on user feedback (category corrections)
     */
    accuracy: number;

    /**
     * Average categorization latency in milliseconds
     * @remarks
     * Time from message receipt to category assignment
     */
    averageLatency: number;
  };

  /**
   * Time saved metrics across all AI features
   * @remarks
   * Estimates time saved compared to manual handling
   */
  timeSavedMetrics: {
    /** Total minutes saved across all AI features */
    totalMinutesSaved: number;

    /**
     * Minutes saved from FAQ auto-responses (Story 5.4)
     * @remarks
     * Assumes 2 minutes per auto-response
     */
    fromAutoResponses: number;

    /**
     * Minutes saved from voice-matched suggestions (Story 5.5)
     * @remarks
     * Assumes 1.5 minutes per accepted suggestion
     */
    fromSuggestions: number;

    /**
     * Minutes saved from automatic categorization (Story 5.2)
     * @remarks
     * Assumes 0.25 minutes per categorized message (reading + tagging)
     */
    fromCategorization: number;
  };

  /**
   * AI cost metrics
   * @remarks
   * Tracks OpenAI API costs for transparency and budgeting
   */
  costMetrics: {
    /** Total AI cost in USD for the period */
    totalCostUSD: number;

    /**
     * Cost breakdown by AI feature
     * @remarks
     * All values in USD
     */
    byCost: {
      /** Cost of message categorization (GPT-4o-mini) */
      categorization: number;
      /** Cost of sentiment analysis (GPT-4o-mini) */
      sentiment: number;
      /** Cost of opportunity scoring (GPT-4 Turbo) */
      opportunityScoring: number;
      /** Cost of voice-matched suggestions (GPT-4 Turbo) */
      voiceMatching: number;
      /** Cost of FAQ detection (GPT-4o-mini + embeddings) */
      faqDetection: number;
    };

    /**
     * Average cost per message processed
     * @remarks
     * Total cost divided by total messages
     */
    averageCostPerMessage: number;
  };

  /**
   * Daily performance trends
   * @remarks
   * Array of daily data points for trend charts
   */
  performanceTrends: Array<{
    /** Date in YYYY-MM-DD format */
    date: string;
    /** Categorization accuracy percentage for this date */
    accuracy: number;
    /** Minutes saved on this date */
    timeSaved: number;
    /** Total AI cost in USD for this date */
    cost: number;
  }>;

  /** Timestamp when these metrics were last calculated */
  lastCalculated: Timestamp;
}

/**
 * Priority message feed item combining urgent messages and opportunities
 *
 * @remarks
 * Unified feed showing messages requiring attention, sorted by priority.
 * Priority scoring:
 * - Crisis (negative sentiment + urgent): 100
 * - High-value opportunity (score >= 80): 85-95
 * - Medium opportunity (score 70-79): 75-84
 * - Urgent category: 70
 *
 * @example
 * ```typescript
 * const item: PriorityMessageFeedItem = {
 *   id: 'msg123',
 *   conversationId: 'conv456',
 *   senderId: 'user789',
 *   senderName: 'Jane Doe',
 *   messageText: 'Urgent: Collaboration opportunity for Q1 2026!',
 *   timestamp: Timestamp.now(),
 *   priorityScore: 85,
 *   priorityType: 'high_value_opportunity',
 *   sentiment: 'positive',
 *   sentimentScore: 0.8,
 *   isCrisis: false,
 *   opportunityScore: 85,
 *   opportunityType: 'collaboration',
 *   category: 'business_opportunity'
 * };
 * ```
 */
export interface PriorityMessageFeedItem {
  /** Unique message identifier */
  id: string;

  /** ID of the conversation this message belongs to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Display name of the sender */
  senderName: string;

  /** Message text content (preview) */
  messageText: string;

  /** Message timestamp */
  timestamp: Timestamp;

  /**
   * Calculated priority score
   * @remarks
   * Range: 0-100, determines feed ordering
   */
  priorityScore: number;

  /**
   * Type of priority
   * @remarks
   * - 'crisis': Negative sentiment + urgent category (score: 100)
   * - 'high_value_opportunity': Business opportunity with score >= 70 (score: 70-95)
   * - 'urgent': Urgent category without crisis markers (score: 70)
   */
  priorityType: 'crisis' | 'high_value_opportunity' | 'urgent';

  /**
   * Sentiment classification (Story 5.3)
   * @remarks
   * Optional - only present if sentiment analysis was performed
   */
  sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';

  /**
   * Sentiment score (Story 5.3)
   * @remarks
   * Range: -1 (very negative) to 1 (very positive)
   */
  sentimentScore?: number;

  /**
   * Crisis flag (Story 5.3)
   * @remarks
   * True if message has negative sentiment AND urgent category
   */
  isCrisis?: boolean;

  /**
   * Business opportunity score (Story 5.6)
   * @remarks
   * Range: 0-100, only present for business_opportunity category
   */
  opportunityScore?: number;

  /**
   * Type of business opportunity (Story 5.6)
   * @remarks
   * Only present for business_opportunity category
   */
  opportunityType?: 'sponsorship' | 'collaboration' | 'partnership' | 'sale';

  /**
   * Message category (Story 5.2)
   * @remarks
   * AI-assigned category: fan_engagement, business_opportunity, spam, urgent, general
   */
  category?: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
}

/**
 * Dashboard widget configuration settings
 *
 * @remarks
 * User-customizable dashboard layout and preferences.
 * Stored in User.settings.dashboardConfig.
 *
 * @example
 * ```typescript
 * const config: DashboardConfig = {
 *   userId: 'user123',
 *   widgetVisibility: {
 *     dailySummary: true,
 *     priorityFeed: true,
 *     aiMetrics: true,
 *     quickActions: true,
 *     opportunityAnalytics: true
 *   },
 *   widgetOrder: ['dailySummary', 'priorityFeed', 'opportunityAnalytics', 'aiMetrics', 'quickActions'],
 *   refreshInterval: 60,
 *   metricsDisplayPeriod: '7days',
 *   showCostMetrics: false,
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface DashboardConfig {
  /** User ID this configuration belongs to */
  userId: string;

  /**
   * Widget visibility toggles
   * @remarks
   * Each widget can be shown or hidden independently
   */
  widgetVisibility: {
    /** Show Daily Summary widget (default: true) */
    dailySummary: boolean;
    /** Show Priority Message Feed (default: true) */
    priorityFeed: boolean;
    /** Show AI Performance Metrics (default: true) */
    aiMetrics: boolean;
    /** Show Quick Actions panel (default: true) */
    quickActions: boolean;
    /** Show Opportunity Analytics from Story 5.6 (default: true) */
    opportunityAnalytics: boolean;
  };

  /**
   * Order of widgets in the dashboard
   * @remarks
   * Array of widget IDs determining display order from top to bottom.
   * Valid IDs: 'dailySummary', 'priorityFeed', 'aiMetrics', 'quickActions', 'opportunityAnalytics'
   */
  widgetOrder: string[];

  /**
   * Dashboard refresh interval in seconds
   * @remarks
   * Range: 30-300 seconds (default: 60)
   */
  refreshInterval: number;

  /**
   * Time period for AI metrics display
   * @remarks
   * Options: '7days', '30days', '90days' (default: '7days')
   */
  metricsDisplayPeriod: '7days' | '30days' | '90days';

  /**
   * Show AI cost metrics
   * @remarks
   * Opt-in transparency feature (default: false)
   * When enabled, shows API costs in AI Metrics Dashboard
   */
  showCostMetrics: boolean;

  /** Timestamp when configuration was last updated */
  updatedAt: Timestamp;
}
