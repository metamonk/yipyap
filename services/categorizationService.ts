/**
 * Categorization Service for automatic message categorization
 * @remarks
 * This service handles automatic categorization of messages and updating related metadata.
 * Never call AI services directly from components - use this service layer.
 * Categorization runs asynchronously to avoid blocking message delivery.
 */

import { doc, updateDoc, collection, query, where, getDocs, getDoc, limit, writeBatch, Firestore } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import { aiClientService, type MessageCategory, type OpportunityType } from './aiClientService';
import type { Message } from '@/types/models';

/**
 * Result from batch categorization operation
 */
export interface BatchCategorizationResult {
  /** Whether the overall batch operation succeeded */
  success: boolean;
  /** Number of messages successfully categorized */
  categorizedCount: number;
  /** Number of messages that failed to categorize */
  failedCount: number;
  /** Total number of messages processed */
  totalCount: number;
  /** Operation duration in milliseconds */
  duration: number;
  /** Array of error details for failed messages */
  errors: Array<{
    messageId: string;
    error: string;
  }>;
}

/**
 * Categorization Service class
 * Handles automatic message categorization and category statistics
 */
class CategorizationService {
  /**
   * Lazy-loaded Firestore instance
   * Uses getter to ensure Firebase is initialized before access
   */
  private get db(): Firestore {
    return getFirebaseDb();
  }

  /**
   * Update message metadata with category, sentiment, and opportunity information (Story 5.6)
   *
   * @param messageId - Message ID to update
   * @param conversationId - Parent conversation ID
   * @param category - Assigned category
   * @param confidence - Confidence score (0-1)
   * @param sentiment - Sentiment classification ('positive', 'negative', 'neutral', 'mixed')
   * @param sentimentScore - Sentiment score (-1 to 1)
   * @param emotionalTone - Array of emotional tones detected
   * @param opportunityScore - Business opportunity score (0-100, optional)
   * @param opportunityType - Type of business opportunity (optional)
   * @param opportunityIndicators - Detected business keywords (optional)
   * @param opportunityAnalysis - AI-generated opportunity summary (optional)
   * @returns Promise resolving when update completes
   * @throws {Error} When Firestore update fails
   *
   * @example
   * ```typescript
   * await categorizationService.updateMessageMetadata(
   *   'msg123',
   *   'conv456',
   *   'business_opportunity',
   *   0.95,
   *   'positive',
   *   0.85,
   *   ['excited', 'grateful'],
   *   95,
   *   'sponsorship',
   *   ['brand deal', 'budget discussion'],
   *   'High-value brand sponsorship with clear budget'
   * );
   * ```
   */
  async updateMessageMetadata(
    messageId: string,
    conversationId: string,
    category: MessageCategory,
    confidence: number,
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
    sentimentScore: number,
    emotionalTone: string[],
    opportunityScore?: number,
    opportunityType?: OpportunityType,
    opportunityIndicators?: string[],
    opportunityAnalysis?: string
  ): Promise<void> {
    try {
      const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);

      // Build update object with required fields
      const updateData: any = {
        'metadata.category': category,
        'metadata.categoryConfidence': confidence,
        'metadata.sentiment': sentiment,
        'metadata.sentimentScore': sentimentScore,
        'metadata.emotionalTone': emotionalTone,
        'metadata.aiProcessed': true,
        'metadata.aiProcessedAt': new Date(),
        'metadata.aiVersion': 'gpt-4o-mini',
      };

      // Add opportunity fields if present (Story 5.6)
      if (opportunityScore !== undefined) {
        updateData['metadata.opportunityScore'] = opportunityScore;
      }
      if (opportunityType !== undefined) {
        updateData['metadata.opportunityType'] = opportunityType;
      }
      if (opportunityIndicators !== undefined) {
        updateData['metadata.opportunityIndicators'] = opportunityIndicators;
      }
      if (opportunityAnalysis !== undefined) {
        updateData['metadata.opportunityAnalysis'] = opportunityAnalysis;
      }

      await updateDoc(messageRef, updateData);

      const logMessage = opportunityScore !== undefined
        ? `Updated message ${messageId} with category ${category}, sentiment ${sentiment} (score: ${sentimentScore}), and opportunity score ${opportunityScore}`
        : `Updated message ${messageId} with category ${category} and sentiment ${sentiment} (score: ${sentimentScore})`;

      console.log(logMessage);
    } catch (error) {
      console.error('Failed to update message metadata:', error);
      throw new Error(`Failed to update message metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Legacy method for updating only category (deprecated - use updateMessageMetadata)
   * @deprecated Use updateMessageMetadata instead
   * @private
   */
  private async updateMessageCategory(
    messageId: string,
    conversationId: string,
    category: MessageCategory,
    confidence: number
  ): Promise<void> {
    try {
      const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);

      await updateDoc(messageRef, {
        'metadata.category': category,
        'metadata.categoryConfidence': confidence,
        'metadata.aiProcessed': true,
      });

      console.log(`Updated message ${messageId} with category ${category} (confidence: ${confidence})`);
    } catch (error) {
      console.error('Failed to update message category:', error);
      throw new Error(`Failed to update message category: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update conversation category statistics
   *
   * @param conversationId - Conversation ID to update
   * @param category - Category to add/update in stats
   * @returns Promise resolving when update completes
   * @throws {Error} When Firestore update fails
   *
   * @example
   * ```typescript
   * await categorizationService.updateConversationCategoryStats(
   *   'conv456',
   *   'urgent'
   * );
   * ```
   */
  async updateConversationCategoryStats(
    conversationId: string,
    category: MessageCategory
  ): Promise<void> {
    try {
      const conversationRef = doc(this.db, 'conversations', conversationId);

      // Get current stats
      const conversationDoc = await getDoc(conversationRef);

      let categoryCounts: Record<string, number> = {};
      let hasUrgent = false;

      if (conversationDoc.exists()) {
        const data = conversationDoc.data();
        categoryCounts = data.categoryStats?.categoryCounts || {};
        hasUrgent = data.categoryStats?.hasUrgent || false;
      }

      // Update counts
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      // Update hasUrgent flag
      if (category === 'urgent') {
        hasUrgent = true;
      }

      // Update conversation document
      await updateDoc(conversationRef, {
        'categoryStats.lastCategory': category,
        'categoryStats.categoryCounts': categoryCounts,
        'categoryStats.hasUrgent': hasUrgent,
      });

      console.log(`Updated conversation ${conversationId} category stats: ${category}`);
    } catch (error) {
      console.error('Failed to update conversation category stats:', error);
      // Don't throw - category stats update is non-critical
      // Message categorization should succeed even if stats update fails
    }
  }

  /**
   * Update conversation sentiment statistics (Story 5.3)
   *
   * @param conversationId - Conversation ID to update
   * @param sentiment - Sentiment classification
   * @param sentimentScore - Sentiment score (-1 to 1)
   * @param crisisDetected - Whether crisis was detected
   * @returns Promise resolving when update completes
   *
   * @example
   * ```typescript
   * await categorizationService.updateConversationSentimentStats(
   *   'conv456',
   *   'negative',
   *   -0.75,
   *   true
   * );
   * ```
   */
  async updateConversationSentimentStats(
    conversationId: string,
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
    sentimentScore: number,
    crisisDetected: boolean
  ): Promise<void> {
    try {
      const conversationRef = doc(this.db, 'conversations', conversationId);

      // Get current stats
      const conversationDoc = await getDoc(conversationRef);

      let negativeCount = 0;

      if (conversationDoc.exists()) {
        const data = conversationDoc.data();
        negativeCount = data.sentimentStats?.negativeCount || 0;
      }

      // Increment negative count if sentiment is negative (score < -0.3)
      if (sentimentScore < -0.3) {
        negativeCount++;
      }

      // Build update object
      const updateData: any = {
        'sentimentStats.lastSentiment': sentiment,
        'sentimentStats.lastSentimentScore': sentimentScore,
        'sentimentStats.negativeCount': negativeCount,
        'sentimentStats.hasCrisis': crisisDetected,
      };

      // Add crisis timestamp if crisis detected
      if (crisisDetected) {
        updateData['sentimentStats.lastCrisisAt'] = new Date();
      }

      // Update conversation document
      await updateDoc(conversationRef, updateData);

      console.log(
        `Updated conversation ${conversationId} sentiment stats: ${sentiment} (score: ${sentimentScore}, crisis: ${crisisDetected})`
      );
    } catch (error) {
      console.error('Failed to update conversation sentiment stats:', error);
      // Don't throw - sentiment stats update is non-critical
      // Message analysis should succeed even if stats update fails
    }
  }

  /**
   * Automatically categorize a new message
   * Runs asynchronously without blocking message delivery
   *
   * @param message - Message to categorize
   * @returns Promise resolving when categorization completes (fire-and-forget safe)
   *
   * @example
   * ```typescript
   * // Call without await to avoid blocking message delivery
   * categorizationService.categorizeNewMessage(message).catch(err =>
   *   console.error('Background categorization failed:', err)
   * );
   * ```
   */
  async categorizeNewMessage(message: Message): Promise<void> {
    try {
      // Check if AI is available
      if (!aiClientService.isAvailable()) {
        console.log('AI categorization not available, skipping');
        return;
      }

      // Skip if already categorized
      if (message.metadata.category) {
        console.log(`Message ${message.id} already categorized as ${message.metadata.category}`);
        return;
      }

      console.log(`Starting categorization and sentiment analysis for message ${message.id}`);

      // Call AI client service for categorization and sentiment analysis
      const result = await aiClientService.categorizeMessage(
        message.id,
        message.text,
        message.conversationId,
        message.senderId
      );

      console.log(`Analysis result for message ${message.id}:`, {
        category: result.category,
        confidence: result.confidence,
        sentiment: result.sentiment,
        sentimentScore: result.sentimentScore,
        crisisDetected: result.crisisDetected,
        latency: result.latency,
      });

      // Check if sentiment data is available (Story 5.3)
      const hasSentiment =
        result.sentiment !== undefined &&
        result.sentimentScore !== undefined &&
        result.emotionalTone !== undefined;

      if (hasSentiment) {
        // Update message metadata with category, sentiment, and opportunity scores (Story 5.6)
        await this.updateMessageMetadata(
          message.id,
          message.conversationId,
          result.category,
          result.confidence,
          result.sentiment,
          result.sentimentScore,
          result.emotionalTone,
          result.opportunityScore,      // Story 5.6
          result.opportunityType,        // Story 5.6
          result.opportunityIndicators,  // Story 5.6
          result.opportunityAnalysis     // Story 5.6
        );

        // Update conversation sentiment stats
        await this.updateConversationSentimentStats(
          message.conversationId,
          result.sentiment,
          result.sentimentScore,
          result.crisisDetected || false
        );

        // Story 5.6 - Task 10: Trigger opportunity notification if high-value opportunity detected
        // Fire-and-forget to avoid blocking categorization
        if (result.opportunityScore && result.opportunityScore >= 70) {
          (async () => {
            try {
              const { shouldSendOpportunityNotification, sendOpportunityNotification } =
                await import('./notificationService');
              const { getConversation } = await import('./conversationService');
              const { getUserProfile } = await import('./userService');

              // Get conversation to find recipient(s)
              const conversation = await getConversation(message.conversationId);
              if (!conversation) return;

              // Get sender info
              const sender = await getUserProfile(message.senderId);
              const senderName = sender?.displayName || 'Someone';

              // Determine conversation name (for groups)
              const conversationName =
                conversation.type === 'group' ? conversation.groupName : undefined;

              // Send notification to each participant (except sender)
              const recipients = conversation.participantIds.filter(
                (id) => id !== message.senderId
              );

              for (const recipientId of recipients) {
                const shouldNotify = await shouldSendOpportunityNotification(recipientId, {
                  ...message,
                  metadata: {
                    ...message.metadata,
                    opportunityScore: result.opportunityScore,
                    opportunityType: result.opportunityType,
                    opportunityIndicators: result.opportunityIndicators,
                    opportunityAnalysis: result.opportunityAnalysis,
                  },
                });

                if (shouldNotify) {
                  await sendOpportunityNotification(
                    {
                      ...message,
                      metadata: {
                        ...message.metadata,
                        opportunityScore: result.opportunityScore,
                        opportunityType: result.opportunityType,
                        opportunityIndicators: result.opportunityIndicators,
                        opportunityAnalysis: result.opportunityAnalysis,
                      },
                    },
                    senderName,
                    conversationName
                  );
                  console.log(
                    `Sent opportunity notification to ${recipientId} for message ${message.id}`
                  );
                }
              }
            } catch (error) {
              console.error('Failed to send opportunity notification (non-blocking):', error);
            }
          })();
        }
      } else {
        // Fallback: Update only category if sentiment unavailable
        console.warn(`Sentiment data unavailable for message ${message.id}, updating category only`);
        await this.updateMessageCategory(
          message.id,
          message.conversationId,
          result.category,
          result.confidence
        );
      }

      // Update conversation category stats
      await this.updateConversationCategoryStats(message.conversationId, result.category);

      console.log(
        `Successfully analyzed message ${message.id}: category=${result.category}, sentiment=${result.sentiment}`
      );
    } catch (error) {
      // Log error but don't throw - analysis failure shouldn't break messaging
      console.error('Message analysis failed:', {
        messageId: message.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback: Set category to "general" with neutral sentiment on error
      try {
        await this.updateMessageCategory(message.id, message.conversationId, 'general', 0);
        console.log(`Set fallback category "general" for message ${message.id}`);
      } catch (fallbackError) {
        console.error('Failed to set fallback category:', fallbackError);
        // Even fallback failed - just log and continue
      }
    }
  }

  /**
   * Batch categorize existing messages in a conversation
   * Processes messages in batches with delays to respect rate limits
   *
   * @param conversationId - Conversation to process
   * @param maxMessages - Maximum number of messages to categorize (default: 100)
   * @returns Promise resolving to batch operation result
   *
   * @example
   * ```typescript
   * const result = await categorizationService.batchCategorizeMessages('conv456', 50);
   * console.log(`Categorized ${result.categorizedCount}/${result.totalCount} messages`);
   * ```
   */
  async batchCategorizeMessages(
    conversationId: string,
    maxMessages: number = 100
  ): Promise<BatchCategorizationResult> {
    const startTime = Date.now();
    let categorizedCount = 0;
    let failedCount = 0;
    const errors: Array<{ messageId: string; error: string }> = [];

    try {
      // Check if AI is available
      if (!aiClientService.isAvailable()) {
        throw new Error('AI categorization not available');
      }

      console.log(`Starting batch categorization for conversation ${conversationId}`);

      // Fetch uncategorized messages
      const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
      const uncategorizedQuery = query(
        messagesRef,
        where('metadata.category', '==', null),
        limit(maxMessages)
      );

      const snapshot = await getDocs(uncategorizedQuery);
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      const totalCount = messages.length;

      if (totalCount === 0) {
        console.log('No uncategorized messages found');
        return {
          success: true,
          categorizedCount: 0,
          failedCount: 0,
          totalCount: 0,
          duration: Date.now() - startTime,
          errors: [],
        };
      }

      console.log(`Found ${totalCount} uncategorized messages`);

      // Process in batches of 10 to respect rate limits
      const BATCH_SIZE = 10;
      const DELAY_BETWEEN_BATCHES = 1000; // 1 second

      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, Math.min(i + BATCH_SIZE, messages.length));

        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} messages)`);

        // Process batch in parallel
        const batchResults = await Promise.allSettled(
          batch.map(async (message) => {
            try {
              const result = await aiClientService.categorizeMessage(
                message.id,
                message.text,
                message.conversationId,
                message.senderId
              );

              // Update with category, sentiment, and opportunity scores (Story 5.6)
              await this.updateMessageMetadata(
                message.id,
                message.conversationId,
                result.category,
                result.confidence,
                result.sentiment,
                result.sentimentScore,
                result.emotionalTone,
                result.opportunityScore,      // Story 5.6
                result.opportunityType,        // Story 5.6
                result.opportunityIndicators,  // Story 5.6
                result.opportunityAnalysis     // Story 5.6
              );

              return { success: true, messageId: message.id };
            } catch (error) {
              throw new Error(
                `Failed to analyze message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
              );
            }
          })
        );

        // Count results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            categorizedCount++;
          } else {
            failedCount++;
            errors.push({
              messageId: 'unknown',
              error: result.reason.message || 'Unknown error',
            });
          }
        }

        // Delay between batches (except after last batch)
        if (i + BATCH_SIZE < messages.length) {
          console.log(`Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
          await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        }
      }

      // Update conversation stats one final time
      if (categorizedCount > 0) {
        // Get most recent category from messages
        const lastMessage = messages[messages.length - 1];
        if (lastMessage.metadata.category) {
          await this.updateConversationCategoryStats(
            conversationId,
            lastMessage.metadata.category as MessageCategory
          );
        }
      }

      const duration = Date.now() - startTime;

      console.log(`Batch categorization complete:`, {
        conversationId,
        categorizedCount,
        failedCount,
        totalCount,
        duration,
      });

      return {
        success: failedCount === 0,
        categorizedCount,
        failedCount,
        totalCount,
        duration,
        errors,
      };
    } catch (error) {
      console.error('Batch categorization failed:', error);

      return {
        success: false,
        categorizedCount,
        failedCount,
        totalCount: categorizedCount + failedCount,
        duration: Date.now() - startTime,
        errors: [
          ...errors,
          {
            messageId: 'batch',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }
}

/**
 * Singleton instance of CategorizationService
 */
export const categorizationService = new CategorizationService();
