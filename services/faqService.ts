/**
 * FAQ service for managing FAQ templates and auto-responses
 *
 * @remarks
 * This service handles all FAQ template CRUD operations including:
 * - Creating FAQ templates with automatic embedding generation
 * - Updating templates with re-embedding support
 * - Deleting templates with Pinecone cleanup
 * - Real-time subscription to user's FAQ templates
 * - Toggling template active status
 * Never access Firestore directly from components - always use this service layer.
 *
 * @module services/faqService
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  FirestoreError,
  onSnapshot,
  Unsubscribe,
  increment,
} from 'firebase/firestore';
import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { getFirebaseDb, getFirebaseAuth, getFunctions } from './firebase';
import { sendMessage } from './messageService';
import { getConversation } from './conversationService';
import type {
  FAQTemplate,
  CreateFAQTemplateInput,
  UpdateFAQTemplateInput,
  FAQAnalytics,
} from '@/types/faq';
import type { Message } from '@/types/models';
// DEPRECATED: Imports for client-side FAQ detection (no longer used)
// import { trackOperationStart, trackOperationEnd } from './aiPerformanceService';
// import {
//   generateCacheKey,
//   getCachedResult,
//   setCachedResult,
//   isCachingEnabled,
// } from './aiCacheService';
// import { checkUserBudgetStatus } from './aiAvailabilityService';
// import { checkRateLimit, incrementOperationCount } from './aiRateLimitService';
// import { Config } from '@/constants/Config';

/**
 * Result type for FAQ template creation
 */
export interface CreateFAQTemplateResult {
  /** Created FAQ template with server-assigned ID and timestamps */
  template: FAQTemplate;

  /** Whether embedding generation was successfully triggered */
  embeddingTriggered: boolean;

  /** Error message if embedding generation failed (non-critical) */
  embeddingError?: string;
}

/**
 * Result type for FAQ template update
 */
export interface UpdateFAQTemplateResult {
  /** Updated FAQ template */
  template: FAQTemplate;

  /** Whether re-embedding was successfully triggered */
  reEmbeddingTriggered: boolean;

  /** Error message if re-embedding failed (non-critical) */
  reEmbeddingError?: string;
}

/**
 * Result type for FAQ template deletion
 */
export interface DeleteFAQTemplateResult {
  /** Whether the Firestore document was deleted */
  firestoreDeleted: boolean;

  /** Whether Pinecone cleanup was triggered (best-effort) */
  pineconeCleanupAttempted: boolean;

  /** Error message if deletion failed */
  error?: string;
}

/**
 * Parameters for Cloud Function: generateFAQEmbedding
 */
interface GenerateFAQEmbeddingParams {
  /** FAQ template ID */
  faqId: string;

  /** FAQ question text to generate embedding from */
  question: string;
}

/**
 * Response from Cloud Function: generateFAQEmbedding
 */
interface GenerateFAQEmbeddingResponse {
  /** Whether the operation succeeded */
  success: boolean;

  /** Embedding dimension (1536 for text-embedding-3-small) */
  embeddingDimension?: number;

  /** Error message if operation failed */
  error?: string;

  /** Number of retry attempts made */
  retryAttempts?: number;
}

/**
 * Creates a new FAQ template and triggers embedding generation
 *
 * @param input - FAQ template creation data (question, answer, keywords, category)
 * @returns Promise resolving to creation result with embedding status
 * @throws {Error} When validation fails, user is not authenticated, or Firestore write fails
 *
 * @remarks
 * - Requires user to be authenticated
 * - Sets creatorId to current user
 * - Initializes useCount to 0
 * - Sets isActive to true by default
 * - Triggers Cloud Function for embedding generation (non-blocking)
 * - Embedding failures are logged but don't block template creation
 *
 * @example
 * ```typescript
 * const result = await createFAQTemplate({
 *   question: 'What are your rates?',
 *   answer: 'My rates start at $100 per hour.',
 *   keywords: ['pricing', 'rates', 'cost'],
 *   category: 'pricing',
 * });
 *
 * if (result.embeddingTriggered) {
 *   console.log('Embedding generation started');
 * }
 * ```
 */
export async function createFAQTemplate(
  input: CreateFAQTemplateInput
): Promise<CreateFAQTemplateResult> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to create FAQ templates');
  }

  // Validate input
  if (!input.question || input.question.trim().length === 0) {
    throw new Error('Question is required');
  }

  if (input.question.length > 500) {
    throw new Error('Question must be 500 characters or less');
  }

  if (!input.answer || input.answer.trim().length === 0) {
    throw new Error('Answer is required');
  }

  if (input.answer.length > 2000) {
    throw new Error('Answer must be 2000 characters or less');
  }

  if (!input.category || input.category.trim().length === 0) {
    throw new Error('Category is required');
  }

  if (!Array.isArray(input.keywords)) {
    throw new Error('Keywords must be an array');
  }

  // Create FAQ template document
  const templateRef = doc(collection(db, 'faq_templates'));
  const now = serverTimestamp() as Timestamp;

  const template: Omit<FAQTemplate, 'id'> & { id?: string } = {
    creatorId: currentUser.uid,
    question: input.question.trim(),
    answer: input.answer.trim(),
    keywords: input.keywords,
    category: input.category.trim(),
    isActive: input.isActive !== undefined ? input.isActive : true,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Write template to Firestore
    await setDoc(templateRef, template);

    const createdTemplate: FAQTemplate = {
      ...template,
      id: templateRef.id,
    };

    // Trigger embedding generation (non-blocking, best-effort)
    let embeddingTriggered = false;
    let embeddingError: string | undefined;

    try {
      const functions = getFunctions();
      const generateEmbedding = httpsCallable<
        GenerateFAQEmbeddingParams,
        GenerateFAQEmbeddingResponse
      >(functions, 'generateFAQEmbedding');

      const result: HttpsCallableResult<GenerateFAQEmbeddingResponse> = await generateEmbedding({
        faqId: templateRef.id,
        question: input.question.trim(),
      });

      if (result.data.success) {
        embeddingTriggered = true;
      } else {
        embeddingError = result.data.error || 'Embedding generation failed';
      }
    } catch (error) {
      // Log but don't throw - embedding generation is non-critical
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      embeddingError = `Failed to trigger embedding generation: ${errorMessage}`;
      console.warn('Embedding generation failed:', embeddingError);
    }

    return {
      template: createdTemplate,
      embeddingTriggered,
      embeddingError,
    };
  } catch (error) {
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to create FAQ template: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Updates an existing FAQ template and triggers re-embedding if question changed
 *
 * @param templateId - ID of the FAQ template to update
 * @param input - Fields to update (question, answer, keywords, category, isActive)
 * @returns Promise resolving to update result with re-embedding status
 * @throws {Error} When template not found, user is not authenticated, or Firestore update fails
 *
 * @remarks
 * - Requires user to be authenticated
 * - Only the creator can update their own templates (enforced by security rules)
 * - If question is updated, triggers re-embedding
 * - Re-embedding failures are logged but don't block template update
 * - Updates updatedAt timestamp automatically
 *
 * @example
 * ```typescript
 * const result = await updateFAQTemplate('faq123', {
 *   answer: 'Updated rates: $150 per hour.',
 *   keywords: ['pricing', 'rates', 'updated'],
 * });
 *
 * if (result.reEmbeddingTriggered) {
 *   console.log('Re-embedding started');
 * }
 * ```
 */
export async function updateFAQTemplate(
  templateId: string,
  input: UpdateFAQTemplateInput
): Promise<UpdateFAQTemplateResult> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to update FAQ templates');
  }

  if (!templateId || templateId.trim().length === 0) {
    throw new Error('Template ID is required');
  }

  // Validate input
  if (input.question !== undefined) {
    if (input.question.trim().length === 0) {
      throw new Error('Question cannot be empty');
    }
    if (input.question.length > 500) {
      throw new Error('Question must be 500 characters or less');
    }
  }

  if (input.answer !== undefined) {
    if (input.answer.trim().length === 0) {
      throw new Error('Answer cannot be empty');
    }
    if (input.answer.length > 2000) {
      throw new Error('Answer must be 2000 characters or less');
    }
  }

  if (input.category !== undefined && input.category.trim().length === 0) {
    throw new Error('Category cannot be empty');
  }

  if (input.keywords !== undefined && !Array.isArray(input.keywords)) {
    throw new Error('Keywords must be an array');
  }

  try {
    const templateRef = doc(db, 'faq_templates', templateId);

    // Verify template exists
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) {
      throw new Error('FAQ template not found');
    }

    // Build update data
    const updateData: Partial<FAQTemplate> & { updatedAt: Timestamp } = {
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (input.question !== undefined) {
      updateData.question = input.question.trim();
    }

    if (input.answer !== undefined) {
      updateData.answer = input.answer.trim();
    }

    if (input.keywords !== undefined) {
      updateData.keywords = input.keywords;
    }

    if (input.category !== undefined) {
      updateData.category = input.category.trim();
    }

    if (input.isActive !== undefined) {
      updateData.isActive = input.isActive;
    }

    // Update template in Firestore
    await updateDoc(templateRef, updateData);

    // Get updated template
    const updatedSnap = await getDoc(templateRef);
    const updatedTemplate = {
      id: templateId,
      ...updatedSnap.data(),
    } as FAQTemplate;

    // Trigger re-embedding if question was updated (non-blocking, best-effort)
    let reEmbeddingTriggered = false;
    let reEmbeddingError: string | undefined;

    if (input.question !== undefined) {
      try {
        const functions = getFunctions();
        const generateEmbedding = httpsCallable<
          GenerateFAQEmbeddingParams,
          GenerateFAQEmbeddingResponse
        >(functions, 'generateFAQEmbedding');

        const result: HttpsCallableResult<GenerateFAQEmbeddingResponse> = await generateEmbedding({
          faqId: templateId,
          question: input.question.trim(),
        });

        if (result.data.success) {
          reEmbeddingTriggered = true;
        } else {
          reEmbeddingError = result.data.error || 'Re-embedding failed';
        }
      } catch (error) {
        // Log but don't throw - re-embedding is non-critical
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        reEmbeddingError = `Failed to trigger re-embedding: ${errorMessage}`;
        console.warn('Re-embedding failed:', reEmbeddingError);
      }
    }

    return {
      template: updatedTemplate,
      reEmbeddingTriggered,
      reEmbeddingError,
    };
  } catch (error) {
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to update FAQ template: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Deletes an FAQ template and attempts Pinecone cleanup
 *
 * @param templateId - ID of the FAQ template to delete
 * @returns Promise resolving to deletion result
 * @throws {Error} When template not found, user is not authenticated, or Firestore delete fails
 *
 * @remarks
 * - Requires user to be authenticated
 * - Only the creator can delete their own templates (enforced by security rules)
 * - Deletes Firestore document immediately
 * - Pinecone cleanup is best-effort (failures are logged but don't block deletion)
 * - Once deleted, the template cannot be recovered
 *
 * @example
 * ```typescript
 * const result = await deleteFAQTemplate('faq123');
 *
 * if (result.firestoreDeleted) {
 *   console.log('Template deleted successfully');
 * }
 * ```
 */
export async function deleteFAQTemplate(templateId: string): Promise<DeleteFAQTemplateResult> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to delete FAQ templates');
  }

  if (!templateId || templateId.trim().length === 0) {
    throw new Error('Template ID is required');
  }

  try {
    const templateRef = doc(db, 'faq_templates', templateId);

    // Verify template exists
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) {
      throw new Error('FAQ template not found');
    }

    // Delete from Firestore
    await deleteDoc(templateRef);

    // TODO: Implement Pinecone cleanup
    // This would require a Cloud Function to delete the vector from Pinecone
    // For now, we mark it as "attempted" but not implemented
    const pineconeCleanupAttempted = false;

    return {
      firestoreDeleted: true,
      pineconeCleanupAttempted,
    };
  } catch (error) {
    if (error instanceof FirestoreError) {
      return {
        firestoreDeleted: false,
        pineconeCleanupAttempted: false,
        error: error.message,
      };
    }
    throw error;
  }
}

/**
 * Subscribes to real-time updates for user's FAQ templates
 *
 * @param userId - User ID to fetch templates for
 * @param onUpdate - Callback invoked when templates change
 * @param onError - Optional callback invoked on subscription errors
 * @returns Unsubscribe function to stop listening
 *
 * @remarks
 * - Returns templates ordered by creation date (newest first)
 * - Only returns templates where creatorId matches userId
 * - Automatically updates when templates are created, updated, or deleted
 * - Call the returned function to unsubscribe and stop listening
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeFAQTemplates(
 *   'user123',
 *   (templates) => {
 *     console.log('Templates updated:', templates.length);
 *     setTemplates(templates);
 *   },
 *   (error) => {
 *     console.error('Subscription error:', error);
 *   }
 * );
 *
 * // Later: stop listening
 * unsubscribe();
 * ```
 */
export function subscribeFAQTemplates(
  userId: string,
  onUpdate: (templates: FAQTemplate[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId || userId.trim().length === 0) {
    throw new Error('User ID is required');
  }

  const db = getFirebaseDb();

  const templatesQuery = query(
    collection(db, 'faq_templates'),
    where('creatorId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    templatesQuery,
    (snapshot) => {
      const templates: FAQTemplate[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as FAQTemplate[];

      onUpdate(templates);
    },
    (error) => {
      console.error('FAQ templates subscription error:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Subscription error'));
      }
    }
  );
}

/**
 * Toggles the active status of an FAQ template
 *
 * @param templateId - ID of the FAQ template to toggle
 * @param isActive - New active status (true to activate, false to deactivate)
 * @returns Promise resolving to updated template
 * @throws {Error} When template not found, user is not authenticated, or Firestore update fails
 *
 * @remarks
 * - Requires user to be authenticated
 * - Only the creator can toggle their own templates (enforced by security rules)
 * - Inactive templates are not included in FAQ detection queries
 * - Deactivating a template does not delete it - can be reactivated later
 * - Updates updatedAt timestamp automatically
 *
 * @example
 * ```typescript
 * // Deactivate template
 * const template = await toggleFAQActive('faq123', false);
 * console.log('Template deactivated:', template.isActive); // false
 *
 * // Reactivate template
 * const reactivated = await toggleFAQActive('faq123', true);
 * console.log('Template reactivated:', reactivated.isActive); // true
 * ```
 */
export async function toggleFAQActive(templateId: string, isActive: boolean): Promise<FAQTemplate> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to toggle FAQ templates');
  }

  if (!templateId || templateId.trim().length === 0) {
    throw new Error('Template ID is required');
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('isActive must be a boolean');
  }

  try {
    const templateRef = doc(db, 'faq_templates', templateId);

    // Verify template exists
    const templateSnap = await getDoc(templateRef);
    if (!templateSnap.exists()) {
      throw new Error('FAQ template not found');
    }

    // Update active status
    await updateDoc(templateRef, {
      isActive,
      updatedAt: serverTimestamp(),
    });

    // Get updated template
    const updatedSnap = await getDoc(templateRef);
    return {
      id: templateId,
      ...updatedSnap.data(),
    } as FAQTemplate;
  } catch (error) {
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to toggle FAQ template: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Sends a suggested FAQ response manually (Story 5.4 - Task 11)
 *
 * @param originalMessage - The message that triggered the FAQ suggestion
 * @param templateId - ID of the FAQ template to send
 * @param answer - FAQ answer text to send
 * @returns Promise resolving to the sent message
 * @throws {Error} When validation fails, conversation not found, or message send fails
 *
 * @remarks
 * - Used when creator manually approves a medium-confidence FAQ suggestion (0.70-0.84)
 * - Sends the FAQ answer as a new message from the creator
 * - Updates original message metadata to track manual FAQ approval
 * - Updates FAQ template usage statistics (useCount, lastUsedAt)
 * - Different from auto-response: metadata.manualFAQSend = true (not autoResponseSent)
 *
 * Workflow:
 * 1. Validate inputs
 * 2. Get conversation to find participantIds
 * 3. Send message with FAQ answer
 * 4. Update original message metadata to link to FAQ response
 * 5. Increment FAQ template usage statistics
 *
 * @example
 * ```typescript
 * const responseMessage = await sendSuggestedFAQ(
 *   originalMessage,
 *   'faq123',
 *   'My rates start at $150 per hour.'
 * );
 * ```
 */
export async function sendSuggestedFAQ(
  originalMessage: Message,
  templateId: string,
  answer: string
): Promise<Message> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    throw new Error('User must be authenticated to send FAQ responses');
  }

  if (!templateId || templateId.trim().length === 0) {
    throw new Error('Template ID is required');
  }

  if (!answer || answer.trim().length === 0) {
    throw new Error('FAQ answer cannot be empty');
  }

  if (!originalMessage || !originalMessage.conversationId) {
    throw new Error('Original message with conversation ID is required');
  }

  try {
    // Get conversation to find participantIds
    const conversation = await getConversation(originalMessage.conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Send message with FAQ answer
    const responseMessage = await sendMessage(
      {
        conversationId: originalMessage.conversationId,
        senderId: currentUser.uid,
        text: answer.trim(),
      },
      conversation.participantIds
    );

    // Update original message metadata to track manual FAQ send
    try {
      const originalMessageRef = doc(
        db,
        'conversations',
        originalMessage.conversationId,
        'messages',
        originalMessage.id
      );

      await updateDoc(originalMessageRef, {
        'metadata.manualFAQSend': true,
        'metadata.manualFAQResponseId': responseMessage.id,
        'metadata.approvedFAQTemplateId': templateId,
      });
    } catch (metadataError) {
      // Log but don't throw - metadata update is non-critical
      console.warn('Failed to update original message metadata:', metadataError);
    }

    // Update FAQ template usage stats (best-effort, non-blocking)
    try {
      const templateRef = doc(db, 'faq_templates', templateId);

      await updateDoc(templateRef, {
        useCount: increment(1),
        lastUsedAt: serverTimestamp(),
      });
    } catch (statsError) {
      // Log but don't throw - stats update is non-critical
      console.warn('Failed to update FAQ template stats:', statsError);
    }

    return responseMessage;
  } catch (error) {
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to send FAQ response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Calculates FAQ analytics for a creator (Story 5.4 - Task 12)
 *
 * @param userId - User ID to calculate analytics for
 * @returns Promise resolving to FAQ analytics data
 * @throws {Error} When user is not authenticated or data fetch fails
 *
 * @remarks
 * - Aggregates statistics from all FAQ templates
 * - Calculates total auto-responses from template useCount
 * - Estimates time saved (assumes 2 minutes per response)
 * - Returns top 10 FAQs sorted by usage count
 * - Calculates usage breakdown by category
 *
 * Time Saved Calculation:
 * - Assumes average manual response time: 2 minutes
 * - Formula: totalAutoResponses × 2 minutes
 * - Provides creators tangible value metric
 *
 * @example
 * ```typescript
 * const analytics = await getFAQAnalytics('user123');
 * console.log(`Time saved: ${analytics.timeSavedMinutes} minutes`);
 * console.log(`Top FAQ: ${analytics.topFAQs[0].question}`);
 * ```
 */
export async function getFAQAnalytics(userId: string): Promise<FAQAnalytics> {
  if (!userId || userId.trim().length === 0) {
    throw new Error('User ID is required');
  }

  const db = getFirebaseDb();

  try {
    // Fetch all FAQ templates for the user
    const templatesQuery = query(collection(db, 'faq_templates'), where('creatorId', '==', userId));

    const snapshot = await getDocs(templatesQuery);

    const templates: FAQTemplate[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as FAQTemplate[];

    // Calculate analytics
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter((t) => t.isActive).length;

    // Total auto-responses is sum of all useCount
    const totalAutoResponses = templates.reduce((sum, t) => sum + (t.useCount || 0), 0);

    // Time saved: assume 2 minutes per manual response
    const MINUTES_PER_RESPONSE = 2;
    const timeSavedMinutes = totalAutoResponses * MINUTES_PER_RESPONSE;

    // Top FAQs by usage count (limit to 10)
    const topFAQs = templates
      .map((t) => ({
        id: t.id,
        question: t.question,
        useCount: t.useCount || 0,
        category: t.category,
      }))
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, 10);

    // Usage by category
    const usageByCategory: Record<string, number> = {};
    templates.forEach((t) => {
      const category = t.category || 'general';
      usageByCategory[category] = (usageByCategory[category] || 0) + (t.useCount || 0);
    });

    return {
      totalTemplates,
      activeTemplates,
      totalAutoResponses,
      timeSavedMinutes,
      topFAQs,
      usageByCategory,
    };
  } catch (error) {
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to fetch FAQ analytics: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Detects FAQ matches for a new message and updates message metadata (Story 5.4 - QA Fix INTEGRATION-001)
 *
 * @param message - The message to check for FAQ matches
 * @returns Promise resolving when FAQ detection completes (fire-and-forget safe)
 *
 * @remarks
 * - Runs asynchronously without blocking message delivery (same pattern as categorization)
 * - Determines creator from conversation: for direct = other participant, for group = conversation.creatorId
 * - Calls Edge Function at /api/detect-faq for semantic similarity matching
 * - Updates message metadata with FAQ detection results (isFAQ, faqTemplateId, faqMatchConfidence, suggestedFAQ)
 * - Failures are logged but don't affect message delivery
 * - Auto-response is triggered by Cloud Function watching for isFAQ=true metadata
 *
 * Workflow:
 * 1. Get conversation to determine creatorId
 * 2. Call Edge Function for FAQ detection
 * 3. Update message metadata with detection results
 * 4. Cloud Function (faqAutoResponse) handles actual response sending
 *
 * @example
 * ```typescript
 * // Call without await to avoid blocking message delivery
 * detectFAQForNewMessage(message).catch(err =>
 *   console.error('Background FAQ detection failed:', err)
 * );
 * ```
 */
export async function detectFAQForNewMessage(_message: Message): Promise<void> {
  // FAQ detection is now handled entirely server-side by Cloud Function onMessageCreatedDetectFAQ
  // This function is kept for backwards compatibility but does nothing
  // Client-side FAQ detection has been removed to prevent duplicate processing and 504 errors
  return;

  /* DEPRECATED CODE BELOW - Kept for reference only
  // Client-side FAQ detection that called /api/detect-faq Edge Function
  // This caused 504 errors and duplicate processing
  // All FAQ detection is now handled by Cloud Function onMessageCreatedDetectFAQ

  const operationId = `faq_detection_${message.id}_${Date.now()}`;

  try {
    // Skip if already processed for FAQ
    if (message.metadata.isFAQ !== undefined) {
      console.log(`Message ${message.id} already processed for FAQ detection`);
      return;
    }

    // Get conversation to determine creator ID
    const conversation = await getConversation(message.conversationId);
    if (!conversation) {
      console.warn(`Conversation ${message.conversationId} not found, skipping FAQ detection`);
      return;
    }

    // Determine creator ID based on conversation type
    let creatorId: string;
    if (conversation.type === 'group') {
      // For group conversations, use the creatorId field
      if (!conversation.creatorId) {
        console.warn(
          `Group conversation ${message.conversationId} missing creatorId, skipping FAQ detection`
        );
        return;
      }
      creatorId = conversation.creatorId;
    } else {
      // For direct conversations, creator is the OTHER participant (not the sender)
      const otherParticipantId = conversation.participantIds.find((id) => id !== message.senderId);
      if (!otherParticipantId) {
        console.warn(
          `Could not determine creator for direct conversation ${message.conversationId}`
        );
        return;
      }
      creatorId = otherParticipantId;
    }

    console.log(`Starting FAQ detection for message ${message.id} (creator: ${creatorId})`);

    // Check if user's AI features are disabled due to budget
    const budgetStatus = await checkUserBudgetStatus(creatorId);
    if (!budgetStatus.enabled) {
      console.warn(
        `[faqService] AI features disabled for user ${creatorId}: ${budgetStatus.disabledReason}`
      );
      return; // Silently skip FAQ detection if budget exceeded
    }

    // Check rate limit for FAQ detection operation
    const rateLimitCheck = await checkRateLimit(creatorId, 'faq_detection');
    if (!rateLimitCheck.allowed) {
      console.warn(
        `[faqService] Rate limit exceeded for user ${creatorId}: ${rateLimitCheck.reason}`
      );
      return; // Silently skip FAQ detection if rate limit exceeded
    }

    // Start tracking the AI operation
    trackOperationStart(operationId, 'faq_detection');

    // Check cache first if caching is enabled
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any; // Type from Edge Function API response
    let cacheHit = false;
    let cacheKey: string | undefined;

    if (isCachingEnabled('faq_detection')) {
      // Generate cache key from normalized message text
      cacheKey = generateCacheKey(message.text.toLowerCase().trim(), 'faq_detection');

      // Try to get cached result
      const cachedResult = await getCachedResult(cacheKey, creatorId);

      if (cachedResult) {
        console.log(`FAQ detection cache hit for message ${message.id}`);
        result = cachedResult;
        cacheHit = true;
      }
    }

    // If cache miss, call Edge Function
    if (!cacheHit) {
      // Call Edge Function for FAQ detection
      const apiUrl = Config.ai.vercelEdgeUrl || 'https://api.yipyap.wtf';
      // eslint-disable-next-line no-undef
      const response = await fetch(`${apiUrl}/api/detect-faq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId: message.id,
          messageText: message.text,
          creatorId,
        }),
      });

      if (!response.ok) {
        throw new Error(`FAQ detection API returned ${response.status}: ${response.statusText}`);
      }

      result = await response.json();

      // Store result in cache for future use
      if (cacheKey && isCachingEnabled('faq_detection')) {
        await setCachedResult(cacheKey, creatorId, 'faq_detection', result).catch((error) => {
          console.error('[faqService] Failed to cache FAQ detection result:', error);
        });
      }
    }

    console.log(`FAQ detection result for message ${message.id}:`, {
      isFAQ: result.isFAQ,
      matchConfidence: result.matchConfidence,
      latency: result.latency,
      cacheHit,
    });

    // Track successful operation
    trackOperationEnd(operationId, {
      userId: creatorId,
      operation: 'faq_detection',
      success: true,
      modelUsed: 'text-embedding-3-small', // FAQ detection uses embeddings
      tokensUsed: {
        prompt: 0, // TODO: Get actual token counts from Edge Function response
        completion: 0,
        total: 0,
      },
      costCents: cacheHit ? 0 : 0, // TODO: Get actual cost from Edge Function response, cache hits are free
      cacheHit,
      cacheKey,
    }).catch((error) => {
      console.error('[faqService] Failed to track performance:', error);
    });

    // Increment rate limit counter for successful operation (only if not a cache hit)
    if (!cacheHit) {
      await incrementOperationCount(creatorId, 'faq_detection');
    }

    // Update message metadata with FAQ detection results
    const db = getFirebaseDb();
    const messageRef = doc(db, 'conversations', message.conversationId, 'messages', message.id);

    // Build update object based on detection result
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      // Dynamic fields for Firestore updateDoc
      'metadata.isFAQ': result.isFAQ || false,
      'metadata.faqMatchConfidence': result.matchConfidence || 0,
    };

    // High confidence (>= 0.85): Auto-response will be triggered by Cloud Function
    if (result.isFAQ && result.faqTemplateId) {
      updateData['metadata.faqTemplateId'] = result.faqTemplateId;
    }

    // Medium confidence (0.70-0.84): Store suggested FAQ for manual approval
    if (result.suggestedFAQ) {
      updateData['metadata.suggestedFAQ'] = result.suggestedFAQ;
    }

    await updateDoc(messageRef, updateData);

    console.log(`Successfully updated FAQ detection metadata for message ${message.id}`);
  } catch (error) {
    // Track failed operation
    trackOperationEnd(operationId, {
      userId: message.senderId, // Use senderId as fallback for error tracking
      operation: 'faq_detection',
      success: false,
      errorType: 'network',
      modelUsed: 'text-embedding-3-small',
      tokensUsed: {
        prompt: 0,
        completion: 0,
        total: 0,
      },
      costCents: 0,
      cacheHit: false,
    }).catch((trackError) => {
      console.error('[faqService] Failed to track performance:', trackError);
    });

    // Log error but don't throw - FAQ detection failure shouldn't break messaging
    console.error('FAQ detection failed:', {
      messageId: message.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
  */
}
