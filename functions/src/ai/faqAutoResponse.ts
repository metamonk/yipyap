/**
 * Cloud Functions for FAQ Auto-Response
 * @module functions/ai/faqAutoResponse
 *
 * @remarks
 * Story 5.4 - FAQ Detection & Auto-Response
 * Automatically sends FAQ template responses when incoming messages match FAQ patterns.
 * Triggered by Firestore onCreate events on messages with FAQ detection metadata.
 *
 * Features:
 * - Firestore trigger on new message creation
 * - Checks FAQ confidence threshold (>= 0.85 for auto-response)
 * - Respects conversation-level auto-response settings
 * - Sends auto-response as creator's message
 * - Updates FAQ template usage statistics
 * - Maintains message ordering integrity
 * - Links auto-response to original message
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import type { Change, EventContext } from 'firebase-functions/v1';
import type { QueryDocumentSnapshot } from 'firebase-functions/v1/firestore';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Minimum confidence threshold for automatic FAQ response
 * Matches are below this threshold are not auto-responded
 */
const AUTO_RESPONSE_CONFIDENCE_THRESHOLD = 0.85;

/**
 * Delay before sending auto-response to allow for manual override (milliseconds)
 * Gives creator 500ms to send a manual response before auto-response triggers
 */
const AUTO_RESPONSE_DELAY_MS = 500;

/**
 * Message document data structure
 */
interface MessageData {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: 'sending' | 'delivered' | 'read';
  readBy: string[];
  timestamp: admin.firestore.Timestamp;
  metadata?: {
    // FAQ Detection (Story 5.4)
    isFAQ?: boolean;
    faqTemplateId?: string;
    faqMatchConfidence?: number;
    autoResponseSent?: boolean;
    autoResponseId?: string;

    // AI Processing
    aiProcessed?: boolean;
    aiProcessedAt?: admin.firestore.Timestamp;
    aiVersion?: string;

    // Other metadata from previous stories
    category?: string;
    sentiment?: string;
  };
}

/**
 * Conversation document data structure
 */
interface ConversationData {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  creatorId?: string;
  groupName?: string;

  // FAQ Auto-Response Settings (Story 5.4)
  autoResponseEnabled?: boolean;
  autoResponseSettings?: {
    enabled: boolean;
    maxPerDay?: number;
    requireApproval?: boolean;
  };
}

/**
 * FAQ Template document data structure
 */
interface FAQTemplateData {
  id: string;
  creatorId: string;
  question: string;
  answer: string;
  keywords: string[];
  category: string;
  isActive: boolean;
  useCount: number;
  lastUsedAt?: admin.firestore.Timestamp;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}

/**
 * Checks if auto-response is enabled for a conversation
 *
 * @param conversationData - The conversation document data
 * @returns True if auto-response should be sent
 */
function isAutoResponseEnabled(conversationData: ConversationData): boolean {
  // Check conversation-level setting (default: true)
  if (conversationData.autoResponseEnabled === false) {
    return false;
  }

  // Check nested settings if present
  if (conversationData.autoResponseSettings?.enabled === false) {
    return false;
  }

  return true;
}

/**
 * Determines the creator ID for the conversation
 * For direct conversations, finds the non-sender participant
 * For group conversations, uses the explicit creatorId
 *
 * @param conversationData - The conversation document data
 * @param messageSenderId - The ID of the message sender
 * @returns The creator user ID
 */
function getCreatorId(conversationData: ConversationData, messageSenderId: string): string | null {
  if (conversationData.type === 'group' && conversationData.creatorId) {
    return conversationData.creatorId;
  }

  // For direct conversations, the creator is the other participant
  const creator = conversationData.participantIds.find((id) => id !== messageSenderId);
  return creator || null;
}

/**
 * Checks if creator has sent a manual message recently (within 1 second)
 * This prevents auto-response from being sent if creator is actively typing
 *
 * @param conversationId - The conversation ID
 * @param creatorId - The creator user ID
 * @param sinceTimestamp - Timestamp to check from
 * @returns True if creator sent a manual message recently
 */
async function hasRecentManualMessage(
  conversationId: string,
  creatorId: string,
  sinceTimestamp: admin.firestore.Timestamp
): Promise<boolean> {
  const oneSecondAgo = new admin.firestore.Timestamp(
    sinceTimestamp.seconds - 1,
    sinceTimestamp.nanoseconds
  );

  const recentMessages = await db
    .collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .where('senderId', '==', creatorId)
    .where('timestamp', '>', oneSecondAgo)
    .limit(1)
    .get();

  return !recentMessages.empty;
}

/**
 * Sleep utility for auto-response delay
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Firestore Trigger: Automatically sends FAQ response when message matches FAQ
 *
 * Cloud Function (Firestore onCreate Trigger)
 *
 * @remarks
 * This function is triggered when a new message is created in any conversation.
 * It checks if the message matches an FAQ template with high confidence and
 * automatically sends the FAQ answer as a response from the conversation creator.
 *
 * Trigger Path: `conversations/{conversationId}/messages/{messageId}`
 *
 * Auto-Response Flow:
 * 1. Check if message has isFAQ metadata flag
 * 2. Verify confidence threshold >= 0.85
 * 3. Check if auto-response is enabled for conversation
 * 4. Wait 500ms to allow manual override
 * 5. Check if creator sent manual message in last 1 second
 * 6. Fetch FAQ template answer text
 * 7. Create auto-response message as creator
 * 8. Update original message with autoResponseId
 * 9. Update FAQ template usage statistics
 *
 * Integration Verification (IV1, IV2, IV3):
 * - IV1: Message ordering maintained via Firestore serverTimestamp
 * - IV2: Read receipts work normally (auto-response is standard message)
 * - IV3: Manual messages override auto-response (1-second check)
 *
 * @param snapshot - The message document snapshot
 * @param context - Event context with conversationId and messageId params
 *
 * @example
 * // Message created with FAQ detection:
 * {
 *   senderId: 'user123',
 *   text: 'What are your rates?',
 *   metadata: {
 *     isFAQ: true,
 *     faqTemplateId: 'faq456',
 *     faqMatchConfidence: 0.92
 *   }
 * }
 * // Auto-response is sent:
 * {
 *   senderId: 'creator789',
 *   text: 'My rates start at $100 per hour.',
 *   metadata: {
 *     autoResponseSent: true,
 *     faqTemplateId: 'faq456'
 *   }
 * }
 */
export const onFAQDetected = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onUpdate(async (change: Change<QueryDocumentSnapshot>, context: EventContext) => {
    const beforeData = change.before.data() as MessageData;
    const afterData = change.after.data() as MessageData;
    const { conversationId, messageId } = context.params;

    // DEBUG: Log all onUpdate triggers
    functions.logger.info('[onFAQDetected] Trigger fired', {
      conversationId,
      messageId,
      beforeIsFAQ: beforeData.metadata?.isFAQ,
      afterIsFAQ: afterData.metadata?.isFAQ,
    });

    // Only trigger if isFAQ was just set to true (metadata was updated)
    const wasNotFAQ = !beforeData.metadata?.isFAQ;
    const isNowFAQ = afterData.metadata?.isFAQ === true;

    if (!wasNotFAQ || !isNowFAQ) {
      // FAQ metadata wasn't just added, skip
      return null;
    }

    const messageData = afterData;

    functions.logger.info('FAQ auto-response trigger started', {
      conversationId,
      messageId,
      hasFAQMetadata: !!messageData.metadata?.isFAQ,
    });

    // Check if message has FAQ detection metadata (AC: Subtask 6.3)
    if (!messageData.metadata?.isFAQ) {
      functions.logger.debug('Message is not an FAQ, skipping auto-response', { messageId });
      return null;
    }

    // Verify confidence threshold for auto-response (AC: Subtask 6.3)
    const confidence = messageData.metadata.faqMatchConfidence || 0;
    if (confidence < AUTO_RESPONSE_CONFIDENCE_THRESHOLD) {
      functions.logger.info('FAQ confidence below threshold, skipping auto-response', {
        messageId,
        confidence,
        threshold: AUTO_RESPONSE_CONFIDENCE_THRESHOLD,
      });
      return null;
    }

    // Check if FAQ template ID is present
    const faqTemplateId = messageData.metadata.faqTemplateId;
    if (!faqTemplateId) {
      functions.logger.warn('FAQ detected but no template ID provided', { messageId });
      return null;
    }

    try {
      // Get conversation document (AC: Subtask 6.4)
      const conversationDoc = await db.collection('conversations').doc(conversationId).get();

      if (!conversationDoc.exists) {
        functions.logger.error('Conversation not found', { conversationId });
        return null;
      }

      const conversationData = conversationDoc.data() as ConversationData;

      // Check if auto-response is enabled for this conversation (AC: 6, Subtask 6.4)
      if (!isAutoResponseEnabled(conversationData)) {
        functions.logger.info('Auto-response disabled for conversation', { conversationId });
        return null;
      }

      // Get creator ID
      const creatorId = getCreatorId(conversationData, messageData.senderId);
      if (!creatorId) {
        functions.logger.error('Could not determine creator ID', { conversationId });
        return null;
      }

      // Wait before sending auto-response to allow manual override (AC: IV3, Subtask 15.1)
      await sleep(AUTO_RESPONSE_DELAY_MS);

      // Check if creator has sent a manual message recently (AC: IV3, Subtask 15.2)
      const hasManualMessage = await hasRecentManualMessage(
        conversationId,
        creatorId,
        messageData.timestamp
      );

      if (hasManualMessage) {
        functions.logger.info('Creator sent manual message, skipping auto-response', {
          conversationId,
          messageId,
        });
        return null;
      }

      // Fetch FAQ template (AC: Subtask 6.5)
      const faqDoc = await db.collection('faq_templates').doc(faqTemplateId).get();

      if (!faqDoc.exists) {
        functions.logger.error('FAQ template not found', { faqTemplateId });
        return null;
      }

      const faqTemplate = faqDoc.data() as FAQTemplateData;

      // Verify FAQ template is active
      if (!faqTemplate.isActive) {
        functions.logger.warn('FAQ template is inactive', { faqTemplateId });
        return null;
      }

      // Create auto-response message (AC: 3, Subtask 6.5)
      const autoResponseMessage: Partial<MessageData> = {
        conversationId,
        senderId: creatorId,
        text: faqTemplate.answer,
        status: 'delivered',
        readBy: [creatorId],
        timestamp: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        metadata: {
          autoResponseSent: true,
          faqTemplateId: faqTemplate.id,
          aiProcessed: true,
          aiVersion: 'faq-auto-response-v1',
          aiProcessedAt: admin.firestore.FieldValue.serverTimestamp() as admin.firestore.Timestamp,
        },
      };

      // Add auto-response message to conversation (AC: 3)
      const autoResponseRef = await db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .add(autoResponseMessage);

      functions.logger.info('Auto-response message sent', {
        conversationId,
        originalMessageId: messageId,
        autoResponseId: autoResponseRef.id,
        faqTemplateId,
      });

      // Update original message metadata with auto-response ID (AC: Subtask 6.6)
      await change.after.ref.update({
        'metadata.autoResponseId': autoResponseRef.id,
      });

      // Update FAQ template usage statistics (AC: 5, Subtask 6.7)
      await faqDoc.ref.update({
        useCount: admin.firestore.FieldValue.increment(1),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      functions.logger.info('FAQ auto-response completed successfully', {
        conversationId,
        messageId,
        autoResponseId: autoResponseRef.id,
        faqTemplateId,
      });

      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      functions.logger.error('Error in FAQ auto-response', {
        conversationId,
        messageId,
        error: errorMessage,
      });

      // Don't throw error - auto-response is non-critical
      // Message delivery should not be blocked by auto-response failures
      return null;
    }
  });
