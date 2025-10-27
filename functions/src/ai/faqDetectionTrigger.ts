/**
 * Cloud Function to trigger FAQ detection on incoming messages (Story 5.4, migrated to OpenAI SDK in Story 6.10)
 * @module functions/ai/faqDetectionTrigger
 *
 * @remarks
 * Story 5.4 - FAQ Detection & Auto-Response
 * Triggers FAQ detection for ALL new messages created in any conversation.
 * This ensures FAQ detection runs on messages from OTHER users, not just your own sent messages.
 *
 * **Migration Notes (Story 6.10):**
 * - Migrated from Vercel AI SDK to official OpenAI SDK for embeddings
 * - Using local Pinecone client from `utils/pineconeClient.ts`
 * - All thresholds and logic remain identical
 * - Output parity maintained with original implementation
 *
 * Features:
 * - Firestore trigger on message creation
 * - Generates embeddings using OpenAI SDK
 * - Queries Pinecone for semantic FAQ matching
 * - Updates message metadata with FAQ detection results
 * - Handles both direct and group conversations
 * - Skips messages that already have FAQ metadata
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';
import OpenAI from 'openai';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Import Pinecone utilities from local client
import { PINECONE_CONFIG, queryFAQMatches } from '../utils/pineconeClient';

/**
 * FAQ confidence thresholds
 */
const CONFIDENCE_THRESHOLDS = {
  AUTO_RESPONSE: 0.85,
  SUGGEST: 0.7,
} as const;

/**
 * Message document data structure
 */
interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: admin.firestore.Timestamp;
  metadata?: {
    isFAQ?: boolean;
    faqMatchConfidence?: number;
    faqTemplateId?: string;
    sentimentScore?: number;
    suggestedFAQ?: {
      templateId: string;
      question: string;
      answer: string;
      confidence: number;
    };
  };
}

/**
 * Conversation document data structure
 */
interface ConversationData {
  type: 'direct' | 'group';
  participantIds: string[];
  creatorId?: string;
}

/**
 * Edge Function response structure
 */
interface FAQDetectionResponse {
  success: boolean;
  isFAQ: boolean;
  matchConfidence: number;
  faqTemplateId?: string;
  faqAnswer?: string;
  suggestedFAQ?: {
    templateId: string;
    question: string;
    answer: string;
    confidence: number;
  };
  error?: string;
}

/**
 * Cloud Function that triggers FAQ detection on new message creation
 *
 * @remarks
 * Triggered when any message is created in any conversation.
 * Determines the creator (recipient of the message) and calls Edge Function for FAQ detection.
 * Updates message metadata with detection results.
 *
 * **Processing:**
 * 1. Skip if message already has FAQ metadata (avoid duplicate processing)
 * 2. Get conversation to determine creator ID
 * 3. Call Edge Function /api/detect-faq
 * 4. Update message metadata with results
 *
 * **Error Handling:**
 * - All errors are logged but don't fail the function
 * - FAQ detection failures shouldn't break messaging
 *
 * @param snapshot - Firestore snapshot of the created message
 * @param context - Function context with params
 */
export const onMessageCreatedDetectFAQ = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snapshot: QueryDocumentSnapshot, context) => {
    const messageData = snapshot.data() as MessageData;
    const { conversationId, messageId } = context.params;

    try {
      functions.logger.info(`[FAQ Detection Trigger] New message created: ${messageId}`);

      // Skip if message already has FAQ metadata (avoid duplicate processing)
      if (messageData.metadata?.faqMatchConfidence !== undefined) {
        functions.logger.info(
          `[FAQ Detection Trigger] Message ${messageId} already has FAQ metadata, skipping`
        );
        return;
      }

      // Skip empty messages
      if (!messageData.text || messageData.text.trim().length === 0) {
        functions.logger.info(`[FAQ Detection Trigger] Message ${messageId} has no text, skipping`);
        return;
      }

      // Get conversation to determine creator ID
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();

      if (!conversationDoc.exists) {
        console.warn(`[FAQ Detection Trigger] Conversation ${conversationId} not found, skipping`);
        return;
      }

      const conversation = conversationDoc.data() as ConversationData;

      // Determine creator ID based on conversation type
      let creatorId: string;

      if (conversation.type === 'group') {
        // For group conversations, use the creatorId field
        if (!conversation.creatorId) {
          console.warn(
            `[FAQ Detection Trigger] Group conversation ${conversationId} missing creatorId, skipping`
          );
          return;
        }
        creatorId = conversation.creatorId;
      } else {
        // For direct conversations, creator is the OTHER participant (not the sender)
        const otherParticipantId = conversation.participantIds.find(
          (id) => id !== messageData.senderId
        );
        if (!otherParticipantId) {
          console.warn(
            `[FAQ Detection Trigger] Could not determine creator for direct conversation ${conversationId}`
          );
          return;
        }
        creatorId = otherParticipantId;
      }

      functions.logger.info(
        `[FAQ Detection Trigger] Starting FAQ detection for message ${messageId} (creator: ${creatorId})`
      );

      // P1 FIX: Check if FAQ detection is enabled for this creator
      const userConfigDoc = await db
        .collection('users')
        .doc(creatorId)
        .collection('ai_workflow_config')
        .doc(creatorId)
        .get();

      const userConfig = userConfigDoc.exists ? userConfigDoc.data() : undefined;
      const faqDetectionEnabled = userConfig?.features?.faqDetectionEnabled ?? true; // Default to true

      if (!faqDetectionEnabled) {
        functions.logger.info(
          `[FAQ Detection Trigger] FAQ detection disabled for creator ${creatorId}, skipping`
        );
        return;
      }

      // Step 1: Generate embedding using OpenAI SDK (Story 6.10)
      functions.logger.info(`[FAQ Detection Trigger] Generating embedding...`);
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: messageData.text,
      });

      const embedding = embeddingResponse.data[0]?.embedding;

      // Validate embedding dimension
      if (!embedding || embedding.length !== PINECONE_CONFIG.dimension) {
        throw new Error(
          `Invalid embedding dimension: expected ${PINECONE_CONFIG.dimension}, got ${embedding?.length || 0}`
        );
      }

      functions.logger.info(
        `[FAQ Detection Trigger] Embedding generated (${embedding.length} dimensions)`
      );

      // Step 2: Query Pinecone for similar FAQ templates using local client
      functions.logger.info(`[FAQ Detection Trigger] Querying Pinecone...`);
      const faqMatches = await queryFAQMatches(embedding, {
        creatorId,
        activeOnly: true,
        topK: 3,
        minScore: CONFIDENCE_THRESHOLDS.SUGGEST,
      });

      functions.logger.info(
        `[FAQ Detection Trigger] Found ${faqMatches.length} matches above threshold`
      );

      // Step 3: Build result based on matches
      let result: FAQDetectionResponse;

      if (faqMatches.length === 0) {
        // No matches found
        result = {
          success: true,
          isFAQ: false,
          matchConfidence: 0,
        };
      } else {
        const bestMatch = faqMatches[0];
        const matchScore = bestMatch.score;

        // High confidence (0.85+) - auto-response
        if (matchScore >= CONFIDENCE_THRESHOLDS.AUTO_RESPONSE) {
          // Fetch FAQ answer from Firestore
          const faqDoc = await db.collection('faq_templates').doc(bestMatch.id).get();
          const faqAnswer = faqDoc.exists ? faqDoc.data()?.answer || null : null;

          result = {
            success: true,
            isFAQ: true,
            matchConfidence: matchScore,
            faqTemplateId: bestMatch.id,
            faqAnswer: faqAnswer || undefined,
          };
        }
        // Medium confidence (0.70-0.84) - suggest
        else if (matchScore >= CONFIDENCE_THRESHOLDS.SUGGEST) {
          // Fetch FAQ answer from Firestore
          const faqDoc = await db.collection('faq_templates').doc(bestMatch.id).get();
          const faqData = faqDoc.data();
          const faqAnswer = faqDoc.exists ? faqData?.answer || null : null;

          result = {
            success: true,
            isFAQ: false,
            matchConfidence: matchScore,
            suggestedFAQ: {
              templateId: bestMatch.id,
              question: bestMatch.metadata.question || '',
              answer: faqAnswer || '',
              confidence: matchScore,
            },
          };
        } else {
          // Below threshold
          result = {
            success: true,
            isFAQ: false,
            matchConfidence: matchScore,
          };
        }
      }

      functions.logger.info(
        `[FAQ Detection Trigger] FAQ detection result for message ${messageId}:`,
        {
          success: result.success,
          isFAQ: result.isFAQ,
          matchConfidence: result.matchConfidence,
        }
      );

      // User configuration already fetched above for feature toggle check, reuse it
      const requireApproval = userConfig?.workflowSettings?.requireApproval ?? false; // Default to false (auto-responses enabled)
      const maxAutoResponses = userConfig?.workflowSettings?.maxAutoResponses ?? 20; // Default to 20
      const escalationThreshold = userConfig?.workflowSettings?.escalationThreshold ?? 0.3; // Default to 0.3

      functions.logger.info(
        `[FAQ Detection Trigger] User config - requireApproval: ${requireApproval}, maxAutoResponses: ${maxAutoResponses}, escalationThreshold: ${escalationThreshold}`
      );

      // P0 FIX #1: Check maxAutoResponses limit (count auto-responses sent today)
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      // Use collection group query for efficient counting (uses composite index)
      const messagesSnapshot = await db
        .collectionGroup('messages')
        .where('metadata.autoResponseSent', '==', true)
        .where('senderId', '==', creatorId)
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .get();

      const autoResponsesSentToday = messagesSnapshot.size;

      functions.logger.info(
        `[FAQ Detection Trigger] Auto-responses sent today: ${autoResponsesSentToday}/${maxAutoResponses}`
      );

      // Skip auto-response if limit reached
      if (autoResponsesSentToday >= maxAutoResponses) {
        functions.logger.info(
          `[FAQ Detection Trigger] maxAutoResponses limit reached (${autoResponsesSentToday}/${maxAutoResponses}), storing for approval instead`
        );

        // Store as pending review instead of auto-responding
        const updateDataLimit: Record<string, unknown> = {
          'metadata.isFAQ': result.isFAQ || false,
          'metadata.faqMatchConfidence': result.matchConfidence || 0,
        };

        if (result.isFAQ && result.faqTemplateId) {
          const faqDoc = await db.collection('faq_templates').doc(result.faqTemplateId).get();
          if (faqDoc.exists) {
            const faqTemplate = faqDoc.data();
            updateDataLimit['metadata.faqTemplateId'] = result.faqTemplateId;
            updateDataLimit['metadata.suggestedResponse'] = faqTemplate?.answer;
            updateDataLimit['metadata.pendingReview'] = true;
            updateDataLimit['metadata.autoResponseLimitReached'] = true;
          }
        }

        if (result.suggestedFAQ) {
          updateDataLimit['metadata.suggestedFAQ'] = result.suggestedFAQ;
        }

        await snapshot.ref.update(updateDataLimit);
        functions.logger.info(
          `[FAQ Detection Trigger] Stored suggested response due to limit (message ${messageId})`
        );
        return;
      }

      // P0 FIX #2: Check escalationThreshold (skip auto-response for negative sentiment)
      const messageSentimentScore = messageData.metadata?.sentimentScore;

      if (messageSentimentScore !== undefined && messageSentimentScore < escalationThreshold) {
        functions.logger.info(
          `[FAQ Detection Trigger] Message sentiment score (${messageSentimentScore}) below escalation threshold (${escalationThreshold}), skipping auto-response`
        );

        // Store as pending review instead of auto-responding
        const updateDataSentiment: Record<string, unknown> = {
          'metadata.isFAQ': result.isFAQ || false,
          'metadata.faqMatchConfidence': result.matchConfidence || 0,
        };

        if (result.isFAQ && result.faqTemplateId) {
          const faqDoc = await db.collection('faq_templates').doc(result.faqTemplateId).get();
          if (faqDoc.exists) {
            const faqTemplate = faqDoc.data();
            updateDataSentiment['metadata.faqTemplateId'] = result.faqTemplateId;
            updateDataSentiment['metadata.suggestedResponse'] = faqTemplate?.answer;
            updateDataSentiment['metadata.pendingReview'] = true;
            updateDataSentiment['metadata.escalatedDueToSentiment'] = true;
          }
        }

        if (result.suggestedFAQ) {
          updateDataSentiment['metadata.suggestedFAQ'] = result.suggestedFAQ;
        }

        await snapshot.ref.update(updateDataSentiment);
        functions.logger.info(
          `[FAQ Detection Trigger] Stored suggested response due to negative sentiment (message ${messageId})`
        );
        return;
      }

      // Build update object based on detection result
      const updateData: Record<string, unknown> = {
        'metadata.isFAQ': result.isFAQ || false,
        'metadata.faqMatchConfidence': result.matchConfidence || 0,
      };

      // High confidence (>= 0.85): Send auto-response or store for approval
      if (
        result.isFAQ &&
        result.faqTemplateId &&
        result.matchConfidence >= CONFIDENCE_THRESHOLDS.AUTO_RESPONSE
      ) {
        updateData['metadata.faqTemplateId'] = result.faqTemplateId;

        // Fetch FAQ template
        const faqDoc = await db.collection('faq_templates').doc(result.faqTemplateId).get();

        if (!faqDoc.exists) {
          functions.logger.warn(
            `[FAQ Detection Trigger] FAQ template not found: ${result.faqTemplateId}`
          );
        } else {
          const faqTemplate = faqDoc.data();

          if (!faqTemplate?.isActive) {
            functions.logger.info(
              `[FAQ Detection Trigger] FAQ template inactive, skipping auto-response`
            );
          } else if (requireApproval) {
            // Store suggested response for manual approval (Story 5.8 - Daily Agent Settings)
            functions.logger.info(
              `[FAQ Detection Trigger] requireApproval=true, storing suggested response for review`
            );

            updateData['metadata.suggestedResponse'] = faqTemplate.answer;
            updateData['metadata.pendingReview'] = true;
            updateData['metadata.faqTemplateId'] = result.faqTemplateId;
          } else {
            // Send auto-response immediately (requireApproval=false)
            try {
              functions.logger.info(
                `[FAQ Detection Trigger] requireApproval=false, sending auto-response for high-confidence match...`
              );
              // Fetch creator's profile to include display name as fallback
              let senderDisplayName = 'Unknown';
              try {
                const creatorDoc = await db.collection('users').doc(creatorId).get();
                if (creatorDoc.exists) {
                  const creatorData = creatorDoc.data();
                  senderDisplayName = creatorData?.displayName || 'Unknown';
                }
              } catch (error) {
                functions.logger.warn(
                  `[FAQ Detection Trigger] Could not fetch creator profile: ${error}`
                );
              }

              // Create auto-response message
              const autoResponseMessage = {
                conversationId,
                senderId: creatorId,
                text: faqTemplate.answer,
                status: 'delivered',
                readBy: [creatorId],
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                metadata: {
                  autoResponseSent: true,
                  faqTemplateId: result.faqTemplateId,
                  senderDisplayName, // Include sender name as fallback
                  aiProcessed: true,
                  aiVersion: 'faq-auto-response-v1',
                  aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
              };

              // Send auto-response
              const autoResponseRef = await db
                .collection('conversations')
                .doc(conversationId)
                .collection('messages')
                .add(autoResponseMessage);

              functions.logger.info(
                `[FAQ Detection Trigger] Auto-response sent: ${autoResponseRef.id}`
              );

              // Add autoResponseId to update data
              updateData['metadata.autoResponseId'] = autoResponseRef.id;

              // Update FAQ template usage stats
              await faqDoc.ref.update({
                useCount: admin.firestore.FieldValue.increment(1),
                lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            } catch (error) {
              functions.logger.error(`[FAQ Detection Trigger] Error sending auto-response:`, error);
              // Continue with metadata update even if auto-response fails
            }
          }
        }
      }

      // Medium confidence (0.70-0.84): Store suggested FAQ for manual approval
      if (result.suggestedFAQ) {
        updateData['metadata.suggestedFAQ'] = result.suggestedFAQ;
      }

      // Update message metadata
      await snapshot.ref.update(updateData);

      functions.logger.info(
        `[FAQ Detection Trigger] Successfully updated FAQ metadata for message ${messageId}`
      );
    } catch (error) {
      // Log error but don't fail the function - FAQ detection failures shouldn't break messaging
      functions.logger.error(
        `[FAQ Detection Trigger] Error processing message ${messageId}:`,
        error
      );
    }
  });
