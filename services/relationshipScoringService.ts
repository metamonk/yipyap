/**
 * Relationship Scoring Service
 *
 * Calculates relationship scores for messages to prioritize the "Meaningful 10" daily digest.
 * Combines category, sentiment, opportunity, and relationship context to rank messages.
 *
 * @module services/relationshipScoringService
 */

import { Message, Conversation } from '../types/models';
import { getFirestore, Timestamp } from 'firebase/firestore';

/**
 * Relationship scoring weights configuration
 *
 * @remarks
 * These weights can be tuned via remote config for live adjustments.
 * Higher weights = greater impact on final score (0-100 scale).
 */
export interface ScoringWeights {
  /** Business opportunity messages (e.g., brand partnerships) */
  business_opportunity: number;

  /** Urgent time-sensitive messages */
  urgent: number;

  /** Crisis sentiment (very negative, needs immediate attention) */
  crisis_sentiment: number;

  /** VIP relationship bonus (long-term supporters) */
  vip_relationship: number;

  /** Message count bonus (active conversations) */
  message_count_bonus: number;

  /** Recent interaction bonus (engaged in last 7 days) */
  recent_interaction: number;
}

/**
 * Default scoring weights
 *
 * @remarks
 * Designed to prioritize: Crisis > Business > Urgent > VIP > Engagement
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  business_opportunity: 50,
  urgent: 40,
  crisis_sentiment: 100, // Always prioritize crisis
  vip_relationship: 30,
  message_count_bonus: 30,
  recent_interaction: 15,
};

/**
 * Relationship score breakdown
 *
 * @remarks
 * Provides transparency into why a message received a particular score.
 * Useful for debugging and tuning the scoring algorithm.
 */
export interface ScoreBreakdown {
  /** Points from category (Business, Urgent, etc.) */
  category: number;

  /** Points from sentiment analysis */
  sentiment: number;

  /** Points from opportunity score */
  opportunity: number;

  /** Points from relationship context (VIP, message count, recency) */
  relationship: number;

  /** Total score (0-100, capped) */
  total: number;
}

/**
 * Relationship context for a conversation
 *
 * @remarks
 * Aggregates conversation metadata to inform scoring.
 */
export interface RelationshipContext {
  /** Days since conversation started */
  conversationAge: number;

  /** Timestamp of last interaction */
  lastInteraction: Timestamp;

  /** Total message count in conversation */
  messageCount: number;

  /** Whether this is a VIP relationship */
  isVIP: boolean;
}

/**
 * Complete relationship score result
 */
export interface RelationshipScore {
  /** Final score (0-100) */
  score: number;

  /** Score breakdown for transparency */
  breakdown: ScoreBreakdown;

  /** Priority tier assignment */
  priority: 'high' | 'medium' | 'low';
}

/**
 * Calculate the number of days between two timestamps
 *
 * @param start - Earlier timestamp
 * @param end - Later timestamp
 * @returns Number of days (can be fractional)
 */
function daysBetween(start: Timestamp, end: Timestamp): number {
  const diffMs = end.toMillis() - start.toMillis();
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Calculate relationship context for a conversation
 *
 * @param conversationId - The conversation ID to analyze
 * @returns Relationship context metadata
 *
 * @remarks
 * In shadow mode, this will be called for all messages to gather context.
 * Performance target: < 100ms per conversation (batched)
 */
export async function calculateRelationshipContext(
  conversationId: string
): Promise<RelationshipContext> {
  const db = getFirestore();

  try {
    // Fetch conversation document
    const conversationRef = db.collection('conversations').doc(conversationId);
    const conversationDoc = await conversationRef.get();

    if (!conversationDoc.exists) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const conversation = conversationDoc.data() as Conversation;
    const now = Timestamp.now();

    // Calculate conversation age
    const conversationAge = conversation.createdAt
      ? daysBetween(conversation.createdAt, now)
      : 0;

    // Get last interaction timestamp
    const lastInteraction = conversation.lastMessageTimestamp || conversation.createdAt;

    // Get message count (from conversation metadata)
    const messageCount = conversation.messageCount || 0;

    // Determine VIP status
    // VIP criteria: > 10 messages AND conversation > 30 days old
    const isVIP = messageCount > 10 && conversationAge > 30;

    return {
      conversationAge,
      lastInteraction,
      messageCount,
      isVIP,
    };
  } catch (error) {
    console.error(`Error calculating relationship context for ${conversationId}:`, error);

    // Return safe defaults on error
    return {
      conversationAge: 0,
      lastInteraction: Timestamp.now(),
      messageCount: 0,
      isVIP: false,
    };
  }
}

/**
 * Calculate relationship score for a single message
 *
 * @param message - The message to score
 * @param relationshipContext - Pre-calculated relationship context
 * @param weights - Scoring weights (defaults to DEFAULT_WEIGHTS)
 * @returns Complete relationship score with breakdown
 *
 * @remarks
 * Core scoring algorithm for Epic 6. Uses metadata from:
 * - Story 5.2: Category (Business, Urgent, Fan, Spam)
 * - Story 5.3: Sentiment (-1.0 to 1.0)
 * - Story 5.6: Opportunity score (0-100)
 * - Story 6.1: Relationship context (NEW)
 *
 * @example
 * ```typescript
 * const context = await calculateRelationshipContext(message.conversationId);
 * const score = calculateRelationshipScore(message, context);
 * console.log(`Score: ${score.score}, Priority: ${score.priority}`);
 * ```
 */
export function calculateRelationshipScore(
  message: Message,
  relationshipContext: RelationshipContext,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): RelationshipScore {
  const breakdown: ScoreBreakdown = {
    category: 0,
    sentiment: 0,
    opportunity: 0,
    relationship: 0,
    total: 0,
  };

  // 1. Category score (from Story 5.2)
  if (message.metadata?.category === 'Business') {
    breakdown.category += weights.business_opportunity;
  }
  if (message.metadata?.category === 'Urgent') {
    breakdown.category += weights.urgent;
  }

  // 2. Sentiment score (from Story 5.3)
  // Crisis sentiment (< -0.7) gets maximum priority
  if (message.metadata?.sentiment !== undefined) {
    if (message.metadata.sentiment < -0.7) {
      breakdown.sentiment += weights.crisis_sentiment;
    }
  }

  // 3. Opportunity score (from Story 5.6)
  // High opportunity (> 80) adds business priority
  if (message.metadata?.opportunityScore !== undefined) {
    if (message.metadata.opportunityScore > 80) {
      breakdown.opportunity += weights.business_opportunity;
    }
  }

  // 4. Relationship context (NEW - Story 6.1)
  if (relationshipContext.isVIP) {
    breakdown.relationship += weights.vip_relationship;
  }

  if (relationshipContext.messageCount > 10) {
    breakdown.relationship += weights.message_count_bonus;
  }

  const daysSinceInteraction = daysBetween(
    relationshipContext.lastInteraction,
    Timestamp.now()
  );

  if (daysSinceInteraction < 7) {
    breakdown.relationship += weights.recent_interaction;
  }

  // Calculate total score (capped at 100)
  breakdown.total = Math.min(
    100,
    breakdown.category + breakdown.sentiment + breakdown.opportunity + breakdown.relationship
  );

  // Assign priority tier
  const priority = assignPriorityTier(breakdown.total);

  return {
    score: breakdown.total,
    breakdown,
    priority,
  };
}

/**
 * Assign priority tier based on score
 *
 * @param score - Final relationship score (0-100)
 * @returns Priority tier classification
 *
 * @remarks
 * Thresholds:
 * - High: >= 70 (top 3 messages)
 * - Medium: >= 40 (next 2-7 messages)
 * - Low: < 40 (auto-handled or archived)
 */
export function assignPriorityTier(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

/**
 * Score multiple messages by relationship (batched)
 *
 * @param messages - Array of messages to score
 * @param weights - Optional custom weights
 * @returns Map of messageId -> RelationshipScore
 *
 * @remarks
 * Optimized for batch processing in daily workflow.
 * Performance target: < 2 seconds for 50 messages
 *
 * @example
 * ```typescript
 * const scores = await scoreMessagesByRelationship(messages);
 * const sortedMessages = messages.sort((a, b) =>
 *   scores.get(b.id)!.score - scores.get(a.id)!.score
 * );
 * ```
 */
export async function scoreMessagesByRelationship(
  messages: Message[],
  weights?: ScoringWeights
): Promise<Map<string, RelationshipScore>> {
  const startTime = Date.now();
  const scores = new Map<string, RelationshipScore>();

  // Batch fetch relationship contexts
  const conversationIds = [...new Set(messages.map(m => m.conversationId))];
  const contexts = new Map<string, RelationshipContext>();

  // Fetch all conversation contexts in parallel
  await Promise.all(
    conversationIds.map(async (convId) => {
      const context = await calculateRelationshipContext(convId);
      contexts.set(convId, context);
    })
  );

  // Score each message
  for (const message of messages) {
    const context = contexts.get(message.conversationId);
    if (!context) {
      console.warn(`No context found for conversation ${message.conversationId}`);
      continue;
    }

    const score = calculateRelationshipScore(message, context, weights);
    scores.set(message.id, score);
  }

  const duration = Date.now() - startTime;

  // Performance logging
  console.info('Relationship scoring completed', {
    messageCount: messages.length,
    conversationCount: conversationIds.length,
    duration,
    avgPerMessage: Math.round(duration / messages.length),
  });

  return scores;
}

/**
 * Shadow mode: Log relationship scores without affecting production
 *
 * @param messages - Messages to score
 * @param weights - Optional custom weights
 *
 * @remarks
 * Week 0 validation mode. Runs scoring algorithm and logs results
 * for comparison against production digest. Does NOT modify any data.
 *
 * Success criteria:
 * - No errors for 1 week
 * - Performance < 3 seconds for 50 messages
 * - 80%+ accuracy on manual spot-checks
 *
 * @example
 * ```typescript
 * // In daily-agent-workflow.ts
 * if (config.shadowMode.relationshipScoring) {
 *   await shadowModeRelationshipScoring(messages);
 * }
 * ```
 */
export async function shadowModeRelationshipScoring(
  messages: Message[],
  weights?: ScoringWeights
): Promise<void> {
  try {
    const startTime = Date.now();

    console.info('[SHADOW MODE] Starting relationship scoring', {
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });

    // Run scoring algorithm
    const scores = await scoreMessagesByRelationship(messages, weights);

    // Sort messages by score
    const sortedMessages = messages
      .map(m => ({
        message: m,
        score: scores.get(m.id),
      }))
      .filter(item => item.score !== undefined)
      .sort((a, b) => b.score!.score - a.score!.score);

    // Simulate Meaningful 10 digest structure
    const meaningful10 = {
      highPriority: sortedMessages.slice(0, 3).map(item => ({
        messageId: item.message.id,
        conversationId: item.message.conversationId,
        score: item.score!.score,
        priority: item.score!.priority,
        breakdown: item.score!.breakdown,
      })),
      mediumPriority: sortedMessages.slice(3, 10).map(item => ({
        messageId: item.message.id,
        conversationId: item.message.conversationId,
        score: item.score!.score,
        priority: item.score!.priority,
        breakdown: item.score!.breakdown,
      })),
      low: sortedMessages.slice(10).map(item => ({
        messageId: item.message.id,
        score: item.score!.score,
      })),
    };

    const duration = Date.now() - startTime;

    // Detailed logging for validation
    console.info('[SHADOW MODE] Relationship scoring results', {
      messageCount: messages.length,
      highPriorityCount: meaningful10.highPriority.length,
      mediumPriorityCount: meaningful10.mediumPriority.length,
      lowPriorityCount: meaningful10.low.length,
      duration,
      performanceTarget: duration < 3000 ? 'PASS' : 'FAIL',
      topScores: meaningful10.highPriority.map(m => ({
        messageId: m.messageId,
        score: m.score,
        breakdown: m.breakdown,
      })),
    });

    // Log score distribution for analysis
    const scoreDistribution = {
      high: sortedMessages.filter(m => m.score!.priority === 'high').length,
      medium: sortedMessages.filter(m => m.score!.priority === 'medium').length,
      low: sortedMessages.filter(m => m.score!.priority === 'low').length,
    };

    console.info('[SHADOW MODE] Score distribution', scoreDistribution);

  } catch (error) {
    console.error('[SHADOW MODE] Relationship scoring failed', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    // Shadow mode errors should NOT break the workflow
    // Just log and continue
  }
}
