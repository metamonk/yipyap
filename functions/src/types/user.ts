/**
 * User types for Cloud Functions
 * Re-exports types from main application for use in Cloud Functions
 */

import { Timestamp } from 'firebase-admin/firestore';

/**
 * Suggestion priority levels for capacity adjustments
 */
export type SuggestionPriority = 'low' | 'medium' | 'high';

/**
 * Capacity adjustment suggestion (Story 6.5)
 */
export interface CapacitySuggestion {
  /** Suggested new daily capacity limit */
  adjustCapacity?: number;

  /** Human-readable explanation for the suggestion */
  reason: string;

  /** Priority level of the suggestion */
  priority: SuggestionPriority;
}

/**
 * Weekly capacity report metrics (Story 6.5)
 */
export interface CapacityMetrics {
  /** Daily capacity setting during the report period */
  capacitySet: number;

  /** Average daily usage (messages handled per day) */
  avgDailyUsage: number;

  /** Usage rate as percentage (avgDailyUsage / capacitySet) */
  usageRate: number;

  /** Total deep conversations this week */
  totalDeep: number;

  /** Total FAQ auto-responses this week */
  totalFAQ: number;

  /** Total auto-archived messages this week */
  totalArchived: number;
}

/**
 * Weekly capacity report document (Story 6.5)
 */
export interface CapacityReport {
  /** Unique report ID */
  id: string;

  /** User ID this report belongs to */
  userId: string;

  /** Start of report period (Sunday 00:00) */
  weekStartDate: Timestamp;

  /** End of report period (Saturday 23:59) */
  weekEndDate: Timestamp;

  /** Aggregated metrics for the week */
  metrics: CapacityMetrics;

  /** AI-generated suggestions for capacity adjustments */
  suggestions: CapacitySuggestion[];

  /** Server timestamp when report was created */
  createdAt: Timestamp;
}

/**
 * Capacity management settings (Story 6.3+)
 */
export interface CapacitySettings {
  dailyLimit: number;
  boundaryMessage: string;
  autoArchiveEnabled: boolean;
  requireEditingForBusiness: boolean;
  weeklyReportsEnabled: boolean;
  lastReportSent?: Timestamp;
}

/**
 * User settings interface
 */
export interface UserSettings {
  sendReadReceipts: boolean;
  notificationsEnabled: boolean;
  capacity?: CapacitySettings;
  links?: {
    faqUrl?: string;
    communityUrl?: string;
  };
}

// =============================================
// Epic 6: Engagement Health Dashboard (Story 6.6)
// =============================================

/**
 * Burnout risk level assessment
 */
export type BurnoutRisk = 'low' | 'medium' | 'high';

/**
 * Engagement metrics snapshot for a specific time period (Story 6.6)
 */
export interface EngagementMetrics {
  /** Unique metrics identifier */
  id: string;

  /** User ID this metrics record belongs to */
  userId: string;

  /** Time period type for this metrics snapshot */
  period: 'daily' | 'weekly' | 'monthly';

  /** Start timestamp of the metrics period */
  startDate: Timestamp;

  /** End timestamp of the metrics period */
  endDate: Timestamp;

  /** Core engagement quality metrics */
  metrics: {
    qualityScore: number;
    personalResponseRate: number;
    avgResponseTime: number;
    conversationDepth: number;
    capacityUsage: number;
    burnoutRisk: BurnoutRisk;
  };

  /** Week-over-week trend comparisons (optional) */
  trends?: {
    qualityScoreDiff: number;
    personalResponseRateDiff: number;
    avgResponseTimeDiff: number;
    conversationDepthDiff: number;
  };

  /** Timestamp when metrics were calculated */
  createdAt: Timestamp;
}

/**
 * Health score calculation components (Story 6.6)
 */
export interface HealthScoreComponents {
  personalResponseRate: number;
  avgResponseTime: number;
  conversationDepth: number;
  capacityUsage: number;
}

/**
 * Raw metrics data for health score calculation (Story 6.6)
 */
export interface RawEngagementMetrics {
  personalResponseRate: number;
  avgResponseTime: number;
  conversationDepth: number;
  capacityUsage: number;
  daysAtMax?: number;
}
