/**
 * Cloud Function to trigger FAQ detection on incoming messages
 * @module functions/ai/faqDetectionTrigger
 *
 * @remarks
 * Story 5.4 - FAQ Detection & Auto-Response
 * Triggers FAQ detection for ALL new messages created in any conversation.
 * This ensures FAQ detection runs on messages from OTHER users, not just your own sent messages.
 *
 * Features:
 * - Firestore trigger on message creation
 * - Calls Edge Function /api/detect-faq for semantic matching
 * - Updates message metadata with FAQ detection results
 * - Handles both direct and group conversations
 * - Skips messages that already have FAQ metadata
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Pinecone configuration
 */
const PINECONE_CONFIG = {
  indexName: 'yipyap-faq-embeddings',
  dimension: 1536,
} as const;

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

      // Step 1: Generate embedding using OpenAI
      functions.logger.info(`[FAQ Detection Trigger] Generating embedding...`);
      const { embedding } = await embed({
        model: openai.embedding('text-embedding-3-small'),
        value: messageData.text,
      });

      // Validate embedding dimension
      if (embedding.length !== PINECONE_CONFIG.dimension) {
        throw new Error(
          `Invalid embedding dimension: expected ${PINECONE_CONFIG.dimension}, got ${embedding.length}`
        );
      }

      functions.logger.info(
        `[FAQ Detection Trigger] Embedding generated (${embedding.length} dimensions)`
      );

      // Step 2: Query Pinecone for similar FAQ templates
      functions.logger.info(`[FAQ Detection Trigger] Querying Pinecone...`);
      const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
      const index = pinecone.index(PINECONE_CONFIG.indexName);

      const queryResponse = await index.query({
        vector: embedding,
        topK: 3,
        includeMetadata: true,
        filter: {
          creatorId: { $eq: creatorId },
          isActive: { $eq: true },
        },
      });

      const matches = (queryResponse.matches || [])
        .filter((match) => match.score && match.score >= CONFIDENCE_THRESHOLDS.SUGGEST)
        .sort((a, b) => (b.score || 0) - (a.score || 0));

      functions.logger.info(
        `[FAQ Detection Trigger] Found ${matches.length} matches above threshold`
      );

      // Step 3: Build result based on matches
      let result: FAQDetectionResponse;

      if (matches.length === 0) {
        // No matches found
        result = {
          success: true,
          isFAQ: false,
          matchConfidence: 0,
        };
      } else {
        const bestMatch = matches[0];
        const matchScore = bestMatch.score || 0;

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
          const metadata = bestMatch.metadata as Record<string, unknown> | undefined;

          result = {
            success: true,
            isFAQ: false,
            matchConfidence: matchScore,
            suggestedFAQ: {
              templateId: bestMatch.id,
              question: (metadata?.question as string) || '',
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

      // Build update object based on detection result
      const updateData: Record<string, unknown> = {
        'metadata.isFAQ': result.isFAQ || false,
        'metadata.faqMatchConfidence': result.matchConfidence || 0,
      };

      // High confidence (>= 0.85): Send auto-response immediately
      if (
        result.isFAQ &&
        result.faqTemplateId &&
        result.matchConfidence >= CONFIDENCE_THRESHOLDS.AUTO_RESPONSE
      ) {
        updateData['metadata.faqTemplateId'] = result.faqTemplateId;

        try {
          functions.logger.info(
            `[FAQ Detection Trigger] Sending auto-response for high-confidence match...`
          );

          // Fetch FAQ template
          const faqDoc = await db.collection('faq_templates').doc(result.faqTemplateId).get();

          if (faqDoc.exists) {
            const faqTemplate = faqDoc.data();

            if (faqTemplate?.isActive) {
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
            } else {
              functions.logger.info(
                `[FAQ Detection Trigger] FAQ template inactive, skipping auto-response`
              );
            }
          } else {
            functions.logger.warn(
              `[FAQ Detection Trigger] FAQ template not found: ${result.faqTemplateId}`
            );
          }
        } catch (error) {
          functions.logger.error(`[FAQ Detection Trigger] Error sending auto-response:`, error);
          // Continue with metadata update even if auto-response fails
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
