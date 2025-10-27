/**
 * Cloud Functions for Daily Agent Workflow Orchestration
 * @module functions/ai/daily-agent-workflow
 *
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent
 * Orchestrates the multi-step daily workflow for processing overnight messages.
 * Handles fetching, categorization, FAQ detection, response drafting, and digest generation.
 *
 * Features:
 * - Multi-step workflow orchestration
 * - Message fetching with filtering (last 12 hours, exclude active conversations)
 * - Batch categorization via Edge Function
 * - FAQ detection and auto-response
 * - Voice-matched response drafting
 * - Daily digest generation with notification
 * - Error handling and rollback
 * - Performance metrics and cost tracking
 */

import * as functions from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { categorizeMessage } from './categorization';
import { scoreOpportunity } from './opportunity-scoring';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

// =============================================
// Story 6.4: Auto-Archive Helper Functions
// =============================================

/**
 * Default boundary message template (Story 6.4)
 */
const DEFAULT_BOUNDARY_MESSAGE_TEMPLATE = `Hi! I get hundreds of messages daily and can't personally respond to everyone.

For quick questions, check out my FAQ: {{faqUrl}}
For deeper connection, join my community: {{communityUrl}}

I read every message, but I focus on responding to those I can give thoughtful attention to. If this is time-sensitive, feel free to follow up and I'll prioritize it.

Thank you for understanding! 💙

[This message was sent automatically]`;

/**
 * Renders boundary message template (Server-side version for Cloud Functions)
 */
function renderBoundaryTemplateServerSide(
  template: string,
  vars: { creatorName?: string; faqUrl?: string; communityUrl?: string }
): string {
  let rendered = template;
  rendered = rendered.replace(/\{\{creatorName\}\}/g, vars.creatorName || '[Creator]');
  rendered = rendered.replace(/\{\{faqUrl\}\}/g, vars.faqUrl || '[FAQ not configured]');
  rendered = rendered.replace(/\{\{communityUrl\}\}/g, vars.communityUrl || '[Community not configured]');
  return rendered;
}

/**
 * Checks if current time is within user's quiet hours (Server-side version)
 */
function isQuietHoursServerSide(quietHours: any): boolean {
  if (!quietHours || !quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = quietHours.end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Safety check: Determines if a message should NOT be auto-archived (Server-side version)
 */
function shouldNotArchiveServerSide(message: any): boolean {
  const metadata = message.metadata || {};

  // Business category
  if (metadata.category === 'Business') {
    return true;
  }

  // Urgent category
  if (metadata.category === 'Urgent') {
    return true;
  }

  // VIP relationship
  if (metadata.conversationIsVIP || metadata.relationshipContext?.isVIP) {
    return true;
  }

  // Crisis sentiment (sentimentScore < -0.7 indicates crisis)
  if (metadata.sentimentScore !== undefined && metadata.sentimentScore < -0.7) {
    return true;
  }

  return false;
}

/**
 * Auto-archive messages with kind boundary (Server-side version for Cloud Functions)
 */
async function autoArchiveMessagesServerSide(
  userId: string,
  lowPriorityMessages: any[]
): Promise<{
  archivedCount: number;
  boundariesSent: number;
  rateLimited: number;
  safetyBlocked: number;
}> {
  const result = {
    archivedCount: 0,
    boundariesSent: 0,
    rateLimited: 0,
    safetyBlocked: 0,
  };

  // Fetch user settings
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    console.error(`User not found: ${userId}`);
    return result;
  }

  const userData = userDoc.data();
  const settings = userData?.settings || {};
  const capacitySettings = settings.capacity;
  const quietHours = settings.opportunityNotifications?.quietHours;

  // Check if auto-archive is enabled
  if (!capacitySettings?.autoArchiveEnabled) {
    console.log(`[Auto-Archive] Auto-archive disabled for user: ${userId}`);
    return result;
  }

  const boundaryTemplate = capacitySettings.boundaryMessage || DEFAULT_BOUNDARY_MESSAGE_TEMPLATE;

  // Process each low-priority message
  for (const message of lowPriorityMessages) {
    // Safety checks
    if (shouldNotArchiveServerSide(message)) {
      result.safetyBlocked++;
      continue;
    }

    try {
      // Archive conversation
      await db
        .collection('conversations')
        .doc(message.conversationId)
        .update({
          [`archivedBy.${userId}`]: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      result.archivedCount++;

      // Check rate limiting (max 1 boundary per fan per week)
      const rateLimitKey = `${userId}_${message.senderId}`;
      const rateLimitRef = db.collection('rate_limits').doc('boundary_messages').collection('limits').doc(rateLimitKey);
      const rateLimitDoc = await rateLimitRef.get();

      if (rateLimitDoc.exists) {
        const lastSent = rateLimitDoc.data()?.lastBoundarySent;
        const elapsed = Date.now() - lastSent.toMillis();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;

        if (elapsed < sevenDays) {
          result.rateLimited++;
          // Still create undo record (without boundary message)
          await createUndoRecordServerSide(userId, message.conversationId, message.id, false);
          continue;
        }
      }

      // Check quiet hours
      if (isQuietHoursServerSide(quietHours)) {
        console.log(`[Auto-Archive] Quiet hours - skipping boundary message for now`);
        await createUndoRecordServerSide(userId, message.conversationId, message.id, false);
        continue;
      }

      // Send boundary message
      const rendered = renderBoundaryTemplateServerSide(boundaryTemplate, {
        creatorName: userData?.displayName || 'Creator',
        faqUrl: undefined, // TODO: Add FAQ URL to user settings (Story 6.5)
        communityUrl: undefined, // TODO: Add community URL to user settings (Story 6.5)
      });

      await db
        .collection('conversations')
        .doc(message.conversationId)
        .collection('messages')
        .add({
          conversationId: message.conversationId,
          senderId: userId,
          text: rendered,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          readBy: [userId],
          status: 'delivered',
          metadata: {
            isAutoBoundary: true,
            boundaryReason: 'low_priority',
            originalMessageId: message.id,
          },
        });

      result.boundariesSent++;

      // Set rate limit key
      await rateLimitRef.set({
        fanId: message.senderId,
        creatorId: userId,
        lastBoundarySent: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      // Create undo record
      await createUndoRecordServerSide(userId, message.conversationId, message.id, true);
    } catch (error) {
      console.error(`[Auto-Archive] Error archiving message ${message.id}:`, error);
      // Continue processing other messages even if one fails
    }
  }

  return result;
}

/**
 * Creates undo archive record (Server-side version)
 */
async function createUndoRecordServerSide(
  userId: string,
  conversationId: string,
  messageId: string,
  boundaryMessageSent: boolean
): Promise<void> {
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

  await db.collection('undo_archive').add({
    userId,
    conversationId,
    messageId,
    archivedAt: now,
    expiresAt,
    boundaryMessageSent,
    canUndo: true,
  });
}

/**
 * Workflow execution context
 *
 * @remarks
 * Tracks state, configuration, metrics, and performance across all workflow steps.
 * Initialized at the start of each workflow execution and passed to all step functions.
 * Updated incrementally as each step completes.
 *
 * @property {string} userId - The user ID for whom the workflow is executing
 * @property {string} executionId - Unique identifier for this workflow execution
 * @property {admin.firestore.Timestamp} startTime - Workflow start timestamp (for timeout tracking)
 * @property {object} config - User's workflow configuration settings
 * @property {number} config.maxAutoResponses - Maximum FAQ auto-responses allowed per execution
 * @property {boolean} config.requireApproval - Whether responses require manual approval before sending
 * @property {number} config.escalationThreshold - Sentiment score below which messages are escalated (0.0-1.0)
 * @property {object} results - Execution results counters
 * @property {number} results.messagesFetched - Total messages retrieved from Firestore
 * @property {number} results.messagesCategorized - Messages successfully categorized
 * @property {number} results.faqsDetected - FAQs detected via embedding search
 * @property {number} results.autoResponsesSent - Auto-responses sent (not requiring approval)
 * @property {number} results.responsesDrafted - Responses drafted and marked for review
 * @property {number} results.messagesNeedingReview - Messages flagged for manual review
 * @property {object} costs - Cost tracking in USD dollars
 * @property {number} costs.categorization - Cost for GPT-4o-mini categorization API calls
 * @property {number} costs.faqDetection - Cost for FAQ embedding search and matching
 * @property {number} costs.responseGeneration - Estimated cost for GPT-4 Turbo response generation
 * @property {number} costs.total - Total cost across all steps
 * @property {object} [performance] - Performance metrics (Task 15) - optional until first step completes
 * @property {number} performance.fetchDuration - Time to fetch messages (milliseconds)
 * @property {number} performance.categorizationDuration - Time to categorize messages (milliseconds)
 * @property {number} performance.faqDetectionDuration - Time for FAQ detection and response (milliseconds)
 * @property {number} performance.responseDraftingDuration - Time to draft voice-matched responses (milliseconds)
 * @property {number} performance.digestGenerationDuration - Time to generate digest and notification (milliseconds)
 * @property {number} performance.totalDuration - Total workflow execution time (milliseconds)
 * @property {string[]} performance.timeoutWarnings - Steps that exceeded warning thresholds
 *
 * @example
 * const ctx: WorkflowContext = {
 *   userId: 'user123',
 *   executionId: 'exec_1234567890_user123',
 *   startTime: admin.firestore.Timestamp.now(),
 *   config: { maxAutoResponses: 20, requireApproval: true, escalationThreshold: 0.3 },
 *   results: { messagesFetched: 0, messagesCategorized: 0, faqsDetected: 0, ... },
 *   costs: { categorization: 0, faqDetection: 0, responseGeneration: 0, total: 0 },
 * };
 */
interface WorkflowContext {
  userId: string;
  executionId: string;
  startTime: admin.firestore.Timestamp;
  config: {
    maxAutoResponses: number;
    requireApproval: boolean;
    escalationThreshold: number;
  };
  results: {
    messagesFetched: number;
    messagesCategorized: number;
    faqsDetected: number;
    autoResponsesSent: number;
    responsesDrafted: number;
    messagesNeedingReview: number;
  };
  costs: {
    categorization: number; // USD dollars
    faqDetection: number;
    responseGeneration: number;
    total: number;
  };
  // Performance tracking (Task 15)
  performance?: {
    fetchDuration: number; // milliseconds
    categorizationDuration: number;
    faqDetectionDuration: number;
    responseDraftingDuration: number;
    digestGenerationDuration: number;
    totalDuration: number;
    timeoutWarnings: string[]; // Track which steps approached timeout
  };
}

/**
 * Step 1: Fetch unprocessed messages from last 12 hours
 *
 * @param userId - User ID to fetch messages for
 * @param ctx - Workflow execution context
 * @returns Array of message documents to process
 *
 * @remarks
 * Filters:
 * - Messages from last 12 hours
 * - NOT already aiProcessed OR processed but pending review
 * - Excludes crisis messages (negative sentiment)
 * - Excludes active conversations (activity within last hour)
 */
/**
 * Maximum workflow execution time (Task 15: Performance Optimization)
 *
 * @constant
 * @type {number}
 * @default 300000 (5 minutes in milliseconds)
 *
 * @remarks
 * The workflow will abort if total execution time exceeds this limit.
 * Cloud Function timeout is set to 9 minutes (540 seconds) to allow buffer for cleanup.
 * Timeout checks occur between each workflow step (after categorization, FAQ detection, etc.).
 *
 * @see {@link isWorkflowTimedOut} for timeout checking logic
 * @see {@link orchestrateWorkflow} for timeout enforcement
 */
const WORKFLOW_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total

/**
 * Per-step performance warning thresholds (Task 15: Performance Optimization)
 *
 * @constant
 * @type {Object.<string, number>}
 *
 * @remarks
 * When a step exceeds its warning threshold, a warning is logged to `ctx.performance.timeoutWarnings`.
 * These warnings help identify bottlenecks in production without failing the workflow.
 *
 * Thresholds are based on expected performance for 100 messages:
 * - fetch: 30s - Firestore queries across all user conversations
 * - categorize: 60s - Batch Edge Function calls to GPT-4o-mini
 * - faq_detect: 45s - Batch Pinecone embedding search and matching
 * - draft_responses: 90s - Voice matching preparation (not actual generation)
 * - generate_summary: 15s - Digest creation and push notification
 *
 * @property {number} fetch - Warning threshold for message fetching (30 seconds)
 * @property {number} categorize - Warning threshold for categorization (60 seconds)
 * @property {number} faq_detect - Warning threshold for FAQ detection (45 seconds)
 * @property {number} draft_responses - Warning threshold for response drafting (90 seconds)
 * @property {number} generate_summary - Warning threshold for digest generation (15 seconds)
 *
 * @see {@link trackStepPerformance} for warning tracking implementation
 */
const STEP_TIMEOUT_WARNINGS = {
  fetch: 30 * 1000, // 30 seconds
  categorize: 60 * 1000, // 60 seconds
  faq_detect: 45 * 1000, // 45 seconds
  draft_responses: 90 * 1000, // 90 seconds
  generate_summary: 15 * 1000, // 15 seconds
};

/**
 * Checks if workflow is approaching timeout
 * @param ctx - Workflow context
 * @returns True if workflow should abort due to timeout
 */
function isWorkflowTimedOut(ctx: WorkflowContext): boolean {
  const now = admin.firestore.Timestamp.now();
  const elapsed = (now.seconds - ctx.startTime.seconds) * 1000;
  return elapsed > WORKFLOW_TIMEOUT_MS;
}

/**
 * Tracks performance for a workflow step
 * @param ctx - Workflow context
 * @param stepName - Name of the step
 * @param duration - Duration in milliseconds
 */
function trackStepPerformance(
  ctx: WorkflowContext,
  stepName: string,
  duration: number
): void {
  if (!ctx.performance) {
    ctx.performance = {
      fetchDuration: 0,
      categorizationDuration: 0,
      faqDetectionDuration: 0,
      responseDraftingDuration: 0,
      digestGenerationDuration: 0,
      totalDuration: 0,
      timeoutWarnings: [],
    };
  }

  // Record duration
  switch (stepName) {
    case 'fetch':
      ctx.performance.fetchDuration = duration;
      break;
    case 'categorize':
      ctx.performance.categorizationDuration = duration;
      break;
    case 'faq_detect':
      ctx.performance.faqDetectionDuration = duration;
      break;
    case 'draft_responses':
      ctx.performance.responseDraftingDuration = duration;
      break;
    case 'generate_summary':
      ctx.performance.digestGenerationDuration = duration;
      break;
  }

  // Check for timeout warning
  const warningThreshold = STEP_TIMEOUT_WARNINGS[stepName as keyof typeof STEP_TIMEOUT_WARNINGS];
  if (warningThreshold && duration > warningThreshold) {
    const warning = `Step '${stepName}' took ${duration}ms (warning threshold: ${warningThreshold}ms)`;
    ctx.performance.timeoutWarnings.push(warning);
    console.warn(`[Performance] ${warning}`);
  }
}

async function fetchUnprocessedMessages(
  userId: string,
  ctx: WorkflowContext
): Promise<admin.firestore.QueryDocumentSnapshot[]> {
  const stepStart = Date.now(); // Performance tracking
  try {
    await logWorkflowStep(ctx, 'fetch', 'running', 'Fetching unprocessed messages...');

    const now = admin.firestore.Timestamp.now();
    const twelveHoursAgo = new admin.firestore.Timestamp(
      now.seconds - 12 * 60 * 60,
      now.nanoseconds
    );
    const oneHourAgo = new admin.firestore.Timestamp(
      now.seconds - 60 * 60,
      now.nanoseconds
    );

    console.log(`[DEBUG] Fetching conversations for user ${userId}`);
    console.log(`[DEBUG] Current time: ${now.toDate().toISOString()}`);
    console.log(`[DEBUG] One hour ago: ${oneHourAgo.toDate().toISOString()}`);
    console.log(`[DEBUG] Twelve hours ago: ${twelveHoursAgo.toDate().toISOString()}`);

    // Fetch all conversations where user is a participant
    // This includes both direct messages and group conversations
    const conversationsSnap = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userId)
      .get();

    console.log(`[DEBUG] Found ${conversationsSnap.size} total conversations`);

    // PERFORMANCE OPTIMIZATION: Filter conversations first, then fetch messages in parallel
    // This reduces sequential Firestore queries from N to 1 batch operation
    const eligibleConversations: Array<{
      doc: admin.firestore.QueryDocumentSnapshot;
      data: admin.firestore.DocumentData;
    }> = [];
    const conversationContexts = new Map();
    let conversationsSkipped = 0;

    // Pre-filter conversations and cache context data
    for (const convDoc of conversationsSnap.docs) {
      const convData = convDoc.data();
      const lastMsgTime = convData.lastMessageTimestamp?.toDate?.() || 'N/A';

      console.log(`[DEBUG] Conversation ${convDoc.id}:`);
      console.log(`[DEBUG]   lastMessageTimestamp: ${lastMsgTime}`);

      // Skip conversations with recent activity (< 1 hour)
      if (
        convData.lastMessageTimestamp &&
        convData.lastMessageTimestamp.seconds > oneHourAgo.seconds
      ) {
        console.log(`[DEBUG]   SKIPPED: Recent activity (< 1 hour)`);
        conversationsSkipped++;
        continue;
      }

      eligibleConversations.push({ doc: convDoc, data: convData });

      // Cache conversation context for later use (avoids duplicate fetching in scoring)
      const createdAt = convData.createdAt || now;
      const messageCount = convData.messageCount || 0;
      const conversationAge = (now.toMillis() - createdAt.toMillis()) / (1000 * 60 * 60 * 24);
      const isVIP = messageCount > 10 && conversationAge > 30;

      conversationContexts.set(convDoc.id, {
        conversationAge,
        lastInteraction: convData.lastMessageTimestamp || createdAt,
        messageCount,
        isVIP,
      });
    }

    console.log(`[DEBUG] Eligible conversations: ${eligibleConversations.length}`);
    console.log(`[DEBUG] Skipped conversations (recent activity): ${conversationsSkipped}`);

    // PERFORMANCE OPTIMIZATION: Fetch messages from all conversations in parallel
    // Expected improvement: 15-25s → 3-5s for 50 conversations
    const messageResults = await Promise.all(
      eligibleConversations.map(async ({ doc: convDoc }) => {
        console.log(`[DEBUG]   Processing messages for conversation ${convDoc.id}...`);

        // Fetch messages from this conversation
        // Note: We can't use both >= and != filters in Firestore, so we filter senderId in code
        const messagesSnap = await db
          .collection('conversations')
          .doc(convDoc.id)
          .collection('messages')
          .where('timestamp', '>=', twelveHoursAgo)
          .orderBy('timestamp', 'desc')
          .get();

        console.log(`[DEBUG]   Found ${messagesSnap.size} messages in conversation ${convDoc.id}`);

        return {
          conversationId: convDoc.id,
          messages: messagesSnap.docs,
        };
      })
    );

    // Process and filter messages
    const messages: admin.firestore.QueryDocumentSnapshot[] = [];
    let totalMessagesSkippedOwnMessages = 0;
    let totalMessagesSkippedProcessed = 0;
    let totalMessagesSkippedCrisis = 0;

    for (const result of messageResults) {
      let messagesAdded = 0;
      let messagesSkippedOwnMessages = 0;
      let messagesSkippedProcessed = 0;
      let messagesSkippedCrisis = 0;

      for (const msgDoc of result.messages) {
        const msgData = msgDoc.data();

        // Skip messages from the user themselves
        if (msgData.senderId === userId) {
          messagesSkippedOwnMessages++;
          totalMessagesSkippedOwnMessages++;
          continue;
        }

        // Skip if already processed (unless pending review)
        if (msgData.metadata?.aiProcessed && !msgData.metadata?.pendingReview) {
          messagesSkippedProcessed++;
          totalMessagesSkippedProcessed++;
          continue;
        }

        // Skip crisis messages (require immediate human attention)
        if (
          msgData.metadata?.sentiment &&
          msgData.metadata.sentimentScore !== undefined &&
          msgData.metadata.sentimentScore < ctx.config.escalationThreshold
        ) {
          messagesSkippedCrisis++;
          totalMessagesSkippedCrisis++;
          continue;
        }

        messages.push(msgDoc);
        messagesAdded++;
      }

      console.log(`[DEBUG]   Conversation ${result.conversationId}: Added ${messagesAdded}, Skipped ${messagesSkippedOwnMessages} own, ${messagesSkippedProcessed} processed, ${messagesSkippedCrisis} crisis`);
    }

    // Store conversation contexts in workflow context for reuse
    (ctx as any).conversationContexts = conversationContexts;

    console.log(`[DEBUG] Summary:`);
    console.log(`[DEBUG]   Conversations processed: ${eligibleConversations.length}`);
    console.log(`[DEBUG]   Conversations skipped (recent activity): ${conversationsSkipped}`);
    console.log(`[DEBUG]   Total messages to process: ${messages.length}`);
    console.log(`[DEBUG]   Skipped ${totalMessagesSkippedOwnMessages} own messages`);
    console.log(`[DEBUG]   Skipped ${totalMessagesSkippedProcessed} already processed`);
    console.log(`[DEBUG]   Skipped ${totalMessagesSkippedCrisis} crisis messages`);

    ctx.results.messagesFetched = messages.length;

    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'fetch', stepDuration);

    await logWorkflowStep(
      ctx,
      'fetch',
      'completed',
      `Fetched ${messages.length} messages in ${stepDuration}ms`
    );

    return messages;
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'fetch', stepDuration);

    console.error(`[DEBUG] Error in fetchUnprocessedMessages:`, error);

    await logWorkflowStep(
      ctx,
      'fetch',
      'failed',
      `Error fetching messages: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Step 2: Categorize messages using local AI functions
 *
 * @param messages - Message documents to categorize
 * @param ctx - Workflow execution context
 * @returns Updated context with categorization results
 *
 * @remarks
 * - Calls local categorization function (no HTTP overhead)
 * - Batch processes 50 messages at a time
 * - Uses GPT-4o-mini for cost efficiency
 * - Updates message metadata with category and sentiment
 */
async function categorizeMessages(
  messages: admin.firestore.QueryDocumentSnapshot[],
  ctx: WorkflowContext,
  sentimentAnalysisEnabled: boolean = true
): Promise<void> {
  const stepStart = Date.now(); // Performance tracking
  try {
    await logWorkflowStep(ctx, 'categorize', 'running', 'Categorizing messages...');

    const batchSize = 50;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    let categorized = 0;
    let categoryCost = 0;

    // Process in batches of 50
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (msgDoc) => {
          const msgData = msgDoc.data();

          try {
            // Call local categorization function (replaces HTTP call to Edge Function)
            const result = await categorizeMessage(msgData.text, apiKey);

            console.log(`[DEBUG] Categorization result for message ${msgDoc.id}:`, result);

            // Determine if message is a business opportunity that needs scoring
            const needsOpportunityScore = result.category === 'business_opportunity';

            let opportunityScore: any = null;
            if (needsOpportunityScore) {
              try {
                // Call local opportunity scoring function
                opportunityScore = await scoreOpportunity(msgData.text, apiKey);
                console.log(`[DEBUG] Opportunity score for message ${msgDoc.id}:`, opportunityScore);
              } catch (error) {
                console.error(`[DEBUG] Error scoring opportunity for message ${msgDoc.id}:`, error);
                // Continue without opportunity score (non-critical)
              }
            }

            // Update message metadata with categorization results
            const updates: any = {
              'metadata.category': result.category,
              'metadata.confidence': result.confidence,
              'metadata.aiProcessed': true,
              'metadata.aiProcessedAt': admin.firestore.FieldValue.serverTimestamp(),
            };

            // P1 FIX: Conditionally add sentiment fields if sentiment analysis is enabled
            if (sentimentAnalysisEnabled) {
              updates['metadata.sentiment'] = result.sentiment;
              updates['metadata.sentimentScore'] = result.sentimentScore;
              updates['metadata.emotionalTone'] = result.emotionalTone;
              updates['metadata.crisisDetected'] = result.crisisDetected;
            }

            // Add opportunity score if available
            if (opportunityScore) {
              updates['metadata.opportunityScore'] = opportunityScore.score;
              updates['metadata.opportunityType'] = opportunityScore.type;
              updates['metadata.opportunityIndicators'] = opportunityScore.indicators;
              updates['metadata.opportunityAnalysis'] = opportunityScore.analysis;
            }

            await msgDoc.ref.update(updates);

            categorized++;
            // Cost estimate: $0.05 per categorization (GPT-4o-mini)
            // + $1.50 per opportunity score (GPT-4 Turbo, if business opportunity)
            categoryCost += 0.05 + (opportunityScore ? 1.5 : 0);
          } catch (error) {
            console.error(`[DEBUG] Error categorizing message ${msgDoc.id}:`, error);
            console.error(`[DEBUG] Error details:`, (error as Error).message);
            // Continue with other messages
          }
        })
      );
    }

    ctx.results.messagesCategorized = categorized;
    ctx.costs.categorization = categoryCost;
    ctx.costs.total += categoryCost;

    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'categorize', stepDuration);

    await logWorkflowStep(
      ctx,
      'categorize',
      'completed',
      `Categorized ${categorized} messages in ${stepDuration}ms (cost: $${categoryCost.toFixed(2)})`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'categorize', stepDuration);

    await logWorkflowStep(
      ctx,
      'categorize',
      'failed',
      `Error categorizing messages: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Step 3: Detect FAQs and send auto-responses
 *
 * @param messages - Categorized message documents
 * @param ctx - Workflow execution context
 * @returns Updated context with FAQ detection results
 *
 * @remarks
 * - Calls Edge Function POST /api/detect-faq for each message
 * - Auto-responds if confidence > 80%
 * - Enforces maxAutoResponses limit from config
 * - Updates FAQ template usage statistics
 */
async function detectAndRespondFAQs(
  messages: admin.firestore.QueryDocumentSnapshot[],
  ctx: WorkflowContext
): Promise<void> {
  const stepStart = Date.now(); // Performance tracking
  try {
    await logWorkflowStep(ctx, 'faq_detect', 'running', 'Detecting FAQs...');

    console.log(`[DEBUG] FAQ Detection - Starting with ${messages.length} messages`);

    const edgeFunctionUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}/api/detect-faq`
      : 'http://localhost:3000/api/detect-faq';

    console.log(`[DEBUG] FAQ Detection - Edge function URL: ${edgeFunctionUrl}`);

    let faqsDetected = 0;
    let autoResponsesSent = 0;
    let faqCost = 0;

    // PERFORMANCE OPTIMIZATION: Process FAQ detection in batches of 50 (matches categorization)
    // Batch size rationale:
    // - Previously: batch size 20 (conservative, caused artificial bottleneck)
    // - Now: batch size 50 (matches categorization, better parallelism)
    // - FAQ detection cost is minimal ($0.03 + embedding search)
    // - Early termination still works (check maxAutoResponses per batch)
    // Expected improvement: 5-12 seconds for 100 messages
    const batchSize = 50;

    // Process messages in batches, with early termination if maxAutoResponses reached
    for (let i = 0; i < messages.length; i += batchSize) {
      // Check if we've hit the max auto-responses limit (global check per batch)
      if (autoResponsesSent >= ctx.config.maxAutoResponses) {
        console.log(`[FAQ Detection] Reached max auto-responses limit (${ctx.config.maxAutoResponses}), stopping FAQ detection`);
        break;
      }

      const batch = messages.slice(i, i + batchSize);

      // Process batch in parallel (all messages in batch execute simultaneously)
      // Benefits: 8x faster than sequential processing for 20 messages
      await Promise.all(
        batch.map(async (msgDoc) => {
          // Check limit again per message (in case parallel execution crosses threshold)
          if (autoResponsesSent >= ctx.config.maxAutoResponses) {
            return;
          }

          const msgData = msgDoc.data();

          try {
            console.log(`[DEBUG] FAQ Detection - Checking message: "${msgData.text?.substring(0, 50)}..."`);

            const response = await fetch(edgeFunctionUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                // Service-to-service authentication (Cloud Functions to Edge Function)
                // Using OpenAI API key as a shared secret for MVP
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'service-token'}`,
              },
              body: JSON.stringify({
                messageId: msgDoc.id,
                messageText: msgData.text,
                creatorId: ctx.userId,
              }),
            });

            console.log(`[DEBUG] FAQ Detection - Response status: ${response.status} ${response.statusText}`);

            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[DEBUG] FAQ Detection - Error response: ${errorText}`);
              return; // Skip this message
            }

            const result = await response.json();
            console.log(`[DEBUG] FAQ Detection - Result: isFAQ=${result.isFAQ}, confidence=${result.confidence}`);
            faqCost += result.cost || 0.03; // Estimate $0.03 per FAQ detection

            if (result.isFAQ && result.confidence >= 0.8) {
              faqsDetected++;

              // IV2: Check for manual override before auto-responding
              // Scenario: User manually responds while daily agent workflow is running
              // - Workflow starts at 9:00 AM (ctx.startTime)
              // - Message received at 9:01 AM
              // - User manually responds at 9:02 AM
              // - Daily agent checks at 9:03 AM → detects manual override, skips auto-response
              // This prevents duplicate/conflicting responses
              const hasManualOverride = await hasManualMessagesAfter(
                ctx.userId,
                msgData.conversationId,
                ctx.startTime
              );

              if (hasManualOverride) {
                // Creator has manually responded, skip auto-response to avoid duplication
                await msgDoc.ref.update({
                  'metadata.manualOverride': true,
                  'metadata.manualOverrideAt': admin.firestore.FieldValue.serverTimestamp(),
                  'metadata.aiProcessed': true,
                  'metadata.skippedReason': 'Creator sent manual message',
                });
                return;
              }

              // Send auto-response if approval not required
              if (!ctx.config.requireApproval) {
                // Create auto-response message
                await db
                  .collection('conversations')
                  .doc(msgData.conversationId)
                  .collection('messages')
                  .add({
                    conversationId: msgData.conversationId,
                    senderId: ctx.userId,
                    text: result.suggestedResponse,
                    status: 'delivered',
                    readBy: [ctx.userId],
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    metadata: {
                      isAutoResponse: true,
                      originalMessageId: msgDoc.id,
                      faqTemplateId: result.templateId,
                      aiProcessed: true,
                      aiProcessedAt: admin.firestore.FieldValue.serverTimestamp(),
                    },
                  });

                autoResponsesSent++;

                // Mark original message as auto-responded
                await msgDoc.ref.update({
                  'metadata.autoResponseSent': true,
                  'metadata.faqTemplateId': result.templateId,
                });
              } else {
                // Store suggested response for review
                await msgDoc.ref.update({
                  'metadata.isFAQ': true,
                  'metadata.faqTemplateId': result.templateId,
                  'metadata.suggestedResponse': result.suggestedResponse,
                  'metadata.pendingReview': true,
                });
              }
            }
          } catch (error) {
            console.error(`Error detecting FAQ for message ${msgDoc.id}:`, error);
            // Continue with other messages
          }
        })
      );
    }

    ctx.results.faqsDetected = faqsDetected;
    ctx.results.autoResponsesSent = autoResponsesSent;
    ctx.costs.faqDetection = faqCost;
    ctx.costs.total += faqCost;

    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'faq_detect', stepDuration);

    await logWorkflowStep(
      ctx,
      'faq_detect',
      'completed',
      `Detected ${faqsDetected} FAQs, sent ${autoResponsesSent} auto-responses in ${stepDuration}ms (cost: $${faqCost.toFixed(2)})`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'faq_detect', stepDuration);
    
    await logWorkflowStep(
      ctx,
      'faq_detect',
      'failed',
      `Error detecting FAQs: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Step 4: Draft voice-matched responses for non-FAQ messages
 *
 * @param messages - Message documents (non-FAQ)
 * @param ctx - Workflow execution context
 * @returns Updated context with response drafting results
 *
 * @remarks
 * - Calls voice matching Cloud Function for each non-FAQ message
 * - Uses GPT-4 Turbo for quality
 * - Stores drafted responses in message metadata
 * - Marks messages as pending review
 */
async function draftVoiceMatchedResponses(
  messages: admin.firestore.QueryDocumentSnapshot[],
  ctx: WorkflowContext
): Promise<void> {
  const stepStart = Date.now(); // Performance tracking
  try {
    await logWorkflowStep(ctx, 'draft_responses', 'running', 'Drafting responses...');

    let responsesDrafted = 0;
    let draftCost = 0;

    // Filter out messages that already have FAQ responses
    const nonFaqMessages = messages.filter((msgDoc) => {
      const msgData = msgDoc.data();
      return !msgData.metadata?.isFAQ && !msgData.metadata?.autoResponseSent;
    });

    for (const msgDoc of nonFaqMessages) {
      try {
        // Mark message as needing voice-matched response
        // Actual generation happens via separate Edge Function or manual trigger
        await msgDoc.ref.update({
          'metadata.needsVoiceResponse': true,
          'metadata.pendingReview': true,
        });

        responsesDrafted++;
        draftCost += 1.5; // Estimate $1.50 per GPT-4 Turbo response
      } catch (error) {
        console.error(`Error marking message for response drafting ${msgDoc.id}:`, error);
        // Continue with other messages
      }
    }

    ctx.results.responsesDrafted = responsesDrafted;
    ctx.results.messagesNeedingReview = responsesDrafted;
    ctx.costs.responseGeneration = draftCost;
    ctx.costs.total += draftCost;

    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'draft_responses', stepDuration);

    await logWorkflowStep(
      ctx,
      'draft_responses',
      'completed',
      `Drafted ${responsesDrafted} responses in ${stepDuration}ms (cost: $${draftCost.toFixed(2)})`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'draft_responses', stepDuration);
    
    await logWorkflowStep(
      ctx,
      'draft_responses',
      'failed',
      `Error drafting responses: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * EPIC 6 - Week 0: Shadow Mode Relationship Scoring
 *
 * @param messages - All unprocessed messages
 * @param ctx - Workflow execution context
 *
 * @remarks
 * Shadow mode validation for Story 6.1 relationship scoring algorithm.
 * Runs scoring in logging-only mode without affecting production digest.
 *
 * Success criteria:
 * - No errors for 1 week
 * - Performance < 3 seconds for 50 messages
 * - 80%+ accuracy on manual spot-checks
 *
 * This will be replaced by full implementation in Week 1.
 */
async function shadowModeRelationshipScoring(
  messages: any[],
  ctx: WorkflowContext
): Promise<void> {
  const stepStart = Date.now();

  try {
    await logWorkflowStep(
      ctx,
      'shadow_mode_scoring',
      'running',
      '[SHADOW MODE] Starting relationship scoring validation'
    );

    // Default scoring weights (tunable via remote config in future)
    const weights = {
      business_opportunity: 50,
      urgent: 40,
      crisis_sentiment: 100,
      vip_relationship: 30,
      message_count_bonus: 30,
      recent_interaction: 15,
    };

    // Batch fetch conversation contexts
    const conversationIds = [...new Set(messages.map(m => m.conversationId))];
    const conversationContexts = new Map();

    // Fetch all conversations in parallel
    await Promise.all(
      conversationIds.map(async (convId) => {
        try {
          const convDoc = await db.collection('conversations').doc(convId).get();
          if (convDoc.exists) {
            const convData = convDoc.data();
            const now = admin.firestore.Timestamp.now();
            const createdAt = convData?.createdAt || now;
            const lastMessageTimestamp = convData?.lastMessageTimestamp || createdAt;
            const messageCount = convData?.messageCount || 0;

            // Calculate conversation age in days
            const conversationAge = (now.toMillis() - createdAt.toMillis()) / (1000 * 60 * 60 * 24);

            // VIP criteria: > 10 messages AND conversation > 30 days old
            const isVIP = messageCount > 10 && conversationAge > 30;

            conversationContexts.set(convId, {
              conversationAge,
              lastInteraction: lastMessageTimestamp,
              messageCount,
              isVIP,
            });
          }
        } catch (error) {
          console.warn(`[SHADOW MODE] Error fetching conversation ${convId}:`, error);
        }
      })
    );

    // Score each message
    const scores = [];
    for (const message of messages) {
      const context = conversationContexts.get(message.conversationId);
      if (!context) continue;

      let score = 0;
      const breakdown = {
        category: 0,
        sentiment: 0,
        opportunity: 0,
        relationship: 0,
      };

      // 1. Category score (from Story 5.2)
      if (message.metadata?.category === 'Business') {
        breakdown.category += weights.business_opportunity;
      }
      if (message.metadata?.category === 'Urgent') {
        breakdown.category += weights.urgent;
      }

      // 2. Sentiment score (from Story 5.3)
      if (message.metadata?.sentiment !== undefined && message.metadata.sentiment < -0.7) {
        breakdown.sentiment += weights.crisis_sentiment;
      }

      // 3. Opportunity score (from Story 5.6)
      if (message.metadata?.opportunityScore !== undefined && message.metadata.opportunityScore > 80) {
        breakdown.opportunity += weights.business_opportunity;
      }

      // 4. Relationship context (NEW - Story 6.1)
      if (context.isVIP) {
        breakdown.relationship += weights.vip_relationship;
      }
      if (context.messageCount > 10) {
        breakdown.relationship += weights.message_count_bonus;
      }

      const daysSinceInteraction =
        (admin.firestore.Timestamp.now().toMillis() - context.lastInteraction.toMillis()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceInteraction < 7) {
        breakdown.relationship += weights.recent_interaction;
      }

      // Calculate total score (capped at 100)
      score = Math.min(
        100,
        breakdown.category + breakdown.sentiment + breakdown.opportunity + breakdown.relationship
      );

      // Assign priority tier
      let priority: 'high' | 'medium' | 'low' = 'low';
      if (score >= 70) priority = 'high';
      else if (score >= 40) priority = 'medium';

      scores.push({
        messageId: message.id,
        conversationId: message.conversationId,
        score,
        priority,
        breakdown,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Simulate Meaningful 10 digest structure
    const meaningful10 = {
      highPriority: scores.filter(s => s.priority === 'high').slice(0, 3),
      mediumPriority: scores.filter(s => s.priority === 'medium').slice(0, 7),
      low: scores.filter(s => s.priority === 'low'),
    };

    const stepDuration = Date.now() - stepStart;

    // Detailed logging for validation
    console.info('[SHADOW MODE] Relationship scoring results', {
      userId: ctx.userId,
      executionId: ctx.executionId,
      messageCount: messages.length,
      conversationCount: conversationIds.length,
      highPriorityCount: meaningful10.highPriority.length,
      mediumPriorityCount: meaningful10.mediumPriority.length,
      lowPriorityCount: meaningful10.low.length,
      duration: stepDuration,
      performanceTarget: stepDuration < 3000 ? 'PASS' : 'FAIL',
      topScores: meaningful10.highPriority.map(m => ({
        messageId: m.messageId,
        score: m.score,
        breakdown: m.breakdown,
      })),
    });

    // Log score distribution
    const scoreDistribution = {
      high: scores.filter(s => s.priority === 'high').length,
      medium: scores.filter(s => s.priority === 'medium').length,
      low: scores.filter(s => s.priority === 'low').length,
    };

    console.info('[SHADOW MODE] Score distribution', {
      userId: ctx.userId,
      executionId: ctx.executionId,
      distribution: scoreDistribution,
    });

    trackStepPerformance(ctx, 'shadow_mode_scoring', stepDuration);

    await logWorkflowStep(
      ctx,
      'shadow_mode_scoring',
      'completed',
      `[SHADOW MODE] Scoring completed in ${stepDuration}ms: ${meaningful10.highPriority.length} high, ${meaningful10.mediumPriority.length} medium`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'shadow_mode_scoring', stepDuration);

    // Shadow mode errors should NOT break the workflow
    console.error('[SHADOW MODE] Relationship scoring failed', {
      userId: ctx.userId,
      executionId: ctx.executionId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    await logWorkflowStep(
      ctx,
      'shadow_mode_scoring',
      'failed',
      `[SHADOW MODE] Error: ${(error as Error).message}`
    );

    // Don't throw - shadow mode should not break production
  }
}

/**
 * PRODUCTION: Generate Meaningful 10 digest with relationship scoring
 *
 * This function:
 * 1. Calculates relationship scores for all messages
 * 2. Writes scores to message metadata in Firestore
 * 3. Generates priority-tiered digest (High/Medium/Auto-handled)
 * 4. Saves Meaningful 10 digest to Firestore
 *
 * Replaces the old flat daily digest structure (Story 5.4) with
 * the new tiered Meaningful 10 structure (Story 6.1).
 */
async function generateMeaningful10Digest(
  messages: any[],
  ctx: WorkflowContext
): Promise<void> {
  const stepStart = Date.now();

  console.log(`[DEBUG] generateMeaningful10Digest called with ${messages.length} messages`);
  console.log(`[DEBUG] Execution ID: ${ctx.executionId}, User ID: ${ctx.userId}`);

  try {
    await logWorkflowStep(
      ctx,
      'generate_meaningful10',
      'running',
      'Generating Meaningful 10 digest with relationship scoring'
    );

    // Default scoring weights (tunable via remote config)
    const weights = {
      business_opportunity: 50,
      urgent: 40,
      crisis_sentiment: 100,
      vip_relationship: 30,
      message_count_bonus: 30,
      recent_interaction: 15,
    };

    // PERFORMANCE OPTIMIZATION: Use cached conversation contexts from fetchUnprocessedMessages
    // This avoids duplicate Firestore queries (saves 2-5 seconds)
    // IMPORTANT: Must use .data() to access document fields on QueryDocumentSnapshot objects
    // Common bug: m.conversationId returns undefined (snapshot property, not data field)
    // Correct: m.data().conversationId (accesses document data)
    const conversationIds = [...new Set(messages.map(m => m.data().conversationId))];

    // Retrieve cached contexts (populated during message fetching)
    let conversationContexts = (ctx as any).conversationContexts || new Map();

    console.log(`[SCORING] Found ${conversationIds.length} unique conversations for ${messages.length} messages`);
    console.log(`[SCORING] Using ${conversationContexts.size} cached conversation contexts`);
    await logWorkflowStep(ctx, 'scoring_prep', 'info',
      `Preparing to score ${messages.length} messages from ${conversationIds.length} conversations (${conversationContexts.size} cached)`);

    // If contexts weren't cached (shouldn't happen), fetch them as fallback
    if (conversationContexts.size === 0) {
      console.warn(`[SCORING] No cached contexts found, fetching from Firestore (performance degraded)`);
      conversationContexts = new Map();

      await Promise.all(
        conversationIds.map(async (convId) => {
          try {
            const convDoc = await db.collection('conversations').doc(convId).get();
            console.log(`[SCORING] Conversation ${convId}: exists=${convDoc.exists}`);
            if (convDoc.exists) {
              const convData = convDoc.data();
              const now = admin.firestore.Timestamp.now();
              const createdAt = convData?.createdAt || now;
              const lastMessageTimestamp = convData?.lastMessageTimestamp || createdAt;
              const messageCount = convData?.messageCount || 0;

              const conversationAge = (now.toMillis() - createdAt.toMillis()) / (1000 * 60 * 60 * 24);
              const isVIP = messageCount > 10 && conversationAge > 30;

              conversationContexts.set(convId, {
                conversationAge,
                lastInteraction: lastMessageTimestamp,
                messageCount,
                isVIP,
              });
            }
          } catch (error) {
            console.warn(`Error fetching conversation ${convId}:`, error);
          }
        })
      );
    }

    // Score each message AND write to Firestore
    const scoredMessages = [];
    const batch = db.batch();

    console.log(`[SCORING] Starting to score ${messages.length} messages`);
    console.log(`[SCORING] Context map has ${conversationContexts.size} entries`);
    await logWorkflowStep(ctx, 'scoring_start', 'info',
      `Scoring ${messages.length} messages with ${conversationContexts.size} conversation contexts`);

    let skippedNoContext = 0;
    for (const message of messages) {
      // Extract message data once - messages are QueryDocumentSnapshot objects
      // IMPORTANT: Always access fields via .data(), not directly on snapshot
      const msgData = message.data();
      const context = conversationContexts.get(msgData.conversationId);
      if (!context) {
        console.log(`[SCORING] SKIPPED message ${message.id}: No context for conversation ${msgData.conversationId}`);
        skippedNoContext++;
        continue;
      }

      let score = 0;
      let priority: 'high' | 'medium' | 'low' = 'low';
      const breakdown = {
        category: 0,
        sentiment: 0,
        opportunity: 0,
        relationship: 0,
      };

      // Check if relationshipScore already exists (e.g., from test data or previous scoring)
      const existingScore = msgData.metadata?.relationshipScore;
      if (existingScore !== undefined && existingScore !== null) {
        // Use existing relationship score (0-1 scale), convert to 0-100 scale
        score = typeof existingScore === 'number' && existingScore <= 1
          ? existingScore * 100
          : existingScore;

        // Determine priority from existing score
        if (score >= 70) priority = 'high';
        else if (score >= 30) priority = 'medium'; // Note: Using 30 threshold to match 0.3 from original scale
        else priority = 'low';

        console.log(`[DEBUG] Using existing relationshipScore for message ${message.id}: ${existingScore} -> ${score} (${priority})`);
      } else {
        // Calculate score from scratch (same logic as shadow mode)
        if (msgData.metadata?.category === 'Business') {
          breakdown.category += weights.business_opportunity;
        }
        if (msgData.metadata?.category === 'Urgent') {
          breakdown.category += weights.urgent;
        }
        if (msgData.metadata?.sentiment !== undefined && msgData.metadata.sentiment < -0.7) {
          breakdown.sentiment += weights.crisis_sentiment;
        }
        if (msgData.metadata?.opportunityScore !== undefined && msgData.metadata.opportunityScore > 80) {
          breakdown.opportunity += weights.business_opportunity;
        }
        if (context.isVIP) {
          breakdown.relationship += weights.vip_relationship;
        }
        if (context.messageCount > 10) {
          breakdown.relationship += weights.message_count_bonus;
        }

        const daysSinceInteraction =
          (admin.firestore.Timestamp.now().toMillis() - context.lastInteraction.toMillis()) /
          (1000 * 60 * 60 * 24);

        if (daysSinceInteraction < 7) {
          breakdown.relationship += weights.recent_interaction;
        }

        score = Math.min(
          100,
          breakdown.category + breakdown.sentiment + breakdown.opportunity + breakdown.relationship
        );

        // Determine priority from calculated score
        if (score >= 70) priority = 'high';
        else if (score >= 40) priority = 'medium';
        else priority = 'low';

        console.log(`[DEBUG] Calculated relationshipScore for message ${message.id}: ${score} (${priority})`);
      }

      // **WRITE SCORE TO MESSAGE METADATA**
      const messageRef = db
        .collection('conversations')
        .doc(msgData.conversationId)
        .collection('messages')
        .doc(message.id);

      batch.update(messageRef, {
        'metadata.relationshipScore': score,
        'metadata.relationshipPriority': priority,
        'metadata.relationshipBreakdown': breakdown,
        'metadata.relationshipContext': context,
      });

      scoredMessages.push({
        id: message.id,
        conversationId: msgData.conversationId,
        content: msgData.text || '',
        timestamp: msgData.timestamp,
        score,
        priority,
        breakdown,
        relationshipContext: context,
        estimatedResponseTime: msgData.metadata?.category === 'Business' ? 30 : 10, // minutes
      });
    }

    console.log(`[SCORING] Scoring complete: ${scoredMessages.length} scored, ${skippedNoContext} skipped (no context)`);
    await logWorkflowStep(ctx, 'scoring_complete', 'info',
      `Scored ${scoredMessages.length} messages, skipped ${skippedNoContext} (no conversation context)`);

    // Commit score updates
    await batch.commit();

    // Sort by score
    scoredMessages.sort((a, b) => b.score - a.score);

    // =============================================
    // Story 6.4: Auto-Archive Beyond Capacity
    // =============================================

    // Fetch user capacity settings
    const userDoc = await db.collection('users').doc(ctx.userId).get();
    const userData = userDoc.data();
    const capacitySettings = userData?.settings?.capacity;
    const dailyLimit = capacitySettings?.dailyLimit || 10; // Default: 10 (Meaningful 10)

    // Split messages: meaningful vs. beyond capacity
    const meaningful = scoredMessages.slice(0, dailyLimit);
    const beyondCapacity = scoredMessages.slice(dailyLimit);

    // Auto-archive low-priority messages beyond capacity (Story 6.4)
    let autoArchiveResult = {
      archivedCount: 0,
      boundariesSent: 0,
      rateLimited: 0,
      safetyBlocked: 0,
    };

    if (beyondCapacity.length > 0) {
      // Convert scored messages back to full message objects for auto-archive
      const messagesToArchive = messages.filter((m) =>
        beyondCapacity.some((scored) => scored.id === m.id && scored.conversationId === m.conversationId)
      );

      // Import auto-archive function (Story 6.4)
      // Note: This will be imported from client-side service, but for Cloud Functions
      // we'll implement a server-side version using admin SDK
      try {
        autoArchiveResult = await autoArchiveMessagesServerSide(ctx.userId, messagesToArchive);
        console.info('Auto-archive completed', {
          userId: ctx.userId,
          executionId: ctx.executionId,
          ...autoArchiveResult,
        });
      } catch (error) {
        console.error('Auto-archive failed (non-fatal):', error);
        // Continue workflow even if auto-archive fails
      }
    }

    // Build Meaningful 10 digest structure with capacity-aware selection
    // Map to Meaningful10DigestMessage format (relationshipScore instead of score)
    const mapToDigestMessage = (m: any) => ({
      id: m.id,
      conversationId: m.conversationId,
      content: m.content,
      timestamp: m.timestamp,
      relationshipScore: m.score, // Map score -> relationshipScore
      relationshipContext: m.relationshipContext,
      category: m.breakdown?.category || 'general',
      estimatedResponseTime: m.estimatedResponseTime || 10,
    });

    const highPriority = meaningful
      .filter(m => m.priority === 'high')
      .slice(0, 3)
      .map(mapToDigestMessage);
    const mediumPriority = meaningful
      .filter(m => m.priority === 'medium')
      .slice(0, 7)
      .map(mapToDigestMessage);

    // Count auto-handled messages (FAQ auto-responses from Story 5.8 + Auto-archived from Story 6.4)
    const autoHandledCount = messages.filter(m => m.metadata?.autoResponseSent === true).length;
    const faqCount = messages.filter(m => m.metadata?.faqTemplateUsed).length;
    const archivedCount = autoArchiveResult.archivedCount;

    const meaningful10Digest = {
      highPriority,
      mediumPriority,
      autoHandled: {
        faqCount: faqCount,
        archivedCount: archivedCount,
        total: autoHandledCount,
        boundaryMessageSent: autoArchiveResult.boundariesSent > 0,
      },
      capacityUsed: highPriority.length + mediumPriority.length + autoHandledCount,
      estimatedTimeCommitment: [
        ...highPriority,
        ...mediumPriority,
      ].reduce((sum, m) => sum + m.estimatedResponseTime, 0),
    };

    // **SAVE MEANINGFUL 10 DIGEST TO FIRESTORE**
    // Generate date string in YYYY-MM-DD format for document ID
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    console.log(`[DEBUG] About to save Meaningful 10 digest to Firestore`);
    console.log(`[DEBUG] Path: /users/${ctx.userId}/meaningful10_digests/${dateStr}`);
    console.log(`[DEBUG] Digest data:`, JSON.stringify(meaningful10Digest, null, 2));

    const digestRef = db
      .collection('users')
      .doc(ctx.userId)
      .collection('meaningful10_digests')
      .doc(dateStr);

    await digestRef.set({
      ...meaningful10Digest,
      date: admin.firestore.Timestamp.now(),
      dateStr: dateStr,
      generatedAt: admin.firestore.Timestamp.now(),
      executionId: ctx.executionId,
    });

    console.log(`[DEBUG] Successfully saved Meaningful 10 digest to Firestore`);

    const stepDuration = Date.now() - stepStart;

    console.info('Meaningful 10 digest generated', {
      userId: ctx.userId,
      executionId: ctx.executionId,
      highPriorityCount: highPriority.length,
      mediumPriorityCount: mediumPriority.length,
      autoHandledCount,
      capacityUsed: meaningful10Digest.capacityUsed,
      estimatedTimeCommitment: meaningful10Digest.estimatedTimeCommitment,
      duration: stepDuration,
    });

    trackStepPerformance(ctx, 'generate_meaningful10', stepDuration);

    await logWorkflowStep(
      ctx,
      'generate_meaningful10',
      'completed',
      `Meaningful 10 generated: ${highPriority.length} high, ${mediumPriority.length} medium, ${autoHandledCount} auto-handled`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'generate_meaningful10', stepDuration);

    console.error('Failed to generate Meaningful 10 digest', {
      userId: ctx.userId,
      executionId: ctx.executionId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    await logWorkflowStep(
      ctx,
      'generate_meaningful10',
      'failed',
      `Error: ${(error as Error).message}`
    );

    throw error; // This is production, not shadow mode - errors should fail the workflow
  }
}

/**
 * Step 5: Generate daily digest and send notification
 *
 * @param ctx - Workflow execution context
 * @returns Updated context with digest generation results
 *
 * @remarks
 * - Creates DailyDigest document in Firestore
 * - Formats summary: "X handled, Y need review"
 * - Sends push notification to user
 */
/**
 * Sends push notification for daily digest completion (Story 5.8 - Task 13)
 * @param userId - User to notify
 * @param digestSummary - Summary data for notification
 * @returns Promise that resolves when notification is sent
 * @remarks
 * Respects user's notification settings and quiet hours.
 * Sends via FCM/APNs for native tokens.
 */
async function sendDailyDigestPushNotification(
  userId: string,
  digestSummary: {
    totalHandled: number;
    needReview: number;
    errors: number;
    digestId: string;
    date: string;
  }
): Promise<void> {
  try {
    // Fetch user data to get FCM tokens
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.warn('[sendDailyDigestPushNotification] User not found:', userId);
      return;
    }

    const userData = userDoc.data();
    const fcmTokens = userData?.fcmTokens || [];

    if (fcmTokens.length === 0) {
      console.warn('[sendDailyDigestPushNotification] No FCM tokens for user:', userId);
      return;
    }

    // Check notification preferences
    const notificationsEnabled = userData?.settings?.notifications?.enabled !== false;
    if (!notificationsEnabled) {
      console.log('[sendDailyDigestPushNotification] Notifications disabled for user:', userId);
      return;
    }

    // Check quiet hours (if configured)
    const quietHours = userData?.settings?.notifications?.quietHours;
    if (quietHours?.enabled && quietHours.start && quietHours.end) {
      const now = new Date();
      // Format current time as "HH:mm" for comparison with quiet hours settings
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const { start, end } = quietHours;

      // Handle two cases:
      // 1. Overnight quiet hours (e.g., 22:00 to 08:00)
      //    - In quiet hours if: currentTime >= 22:00 OR currentTime < 08:00
      // 2. Same-day quiet hours (e.g., 13:00 to 15:00)
      //    - In quiet hours if: currentTime >= 13:00 AND currentTime < 15:00
      const inQuietHours = start > end
        ? currentTime >= start || currentTime < end  // Overnight case: start > end
        : currentTime >= start && currentTime < end; // Same-day case: start < end

      if (inQuietHours) {
        console.log('[sendDailyDigestPushNotification] In quiet hours, skipping notification for user:', userId);
        return;
      }
    }

    const { totalHandled, needReview, errors } = digestSummary;

    // Build notification body
    let body = '';
    if (errors > 0) {
      body = `⚠️ ${errors} error${errors > 1 ? 's' : ''} occurred. Please review.`;
    } else if (needReview > 0) {
      body = `${totalHandled} handled, ${needReview} need${needReview > 1 ? '' : 's'} your review`;
    } else if (totalHandled > 0) {
      body = `${totalHandled} conversation${totalHandled > 1 ? 's' : ''} handled automatically`;
    } else {
      body = 'Your daily digest is ready';
    }

    // Collect native FCM/APNs tokens
    const nativeTokens: string[] = fcmTokens
      .filter((tokenObj: any) => tokenObj.token && tokenObj.type !== 'expo')
      .map((tokenObj: any) => tokenObj.token);

    if (nativeTokens.length === 0) {
      console.warn('[sendDailyDigestPushNotification] No native tokens for user:', userId);
      return;
    }

    // Build notification data for deep linking
    const notificationData = {
      type: 'daily_digest',
      digestId: digestSummary.digestId,
      date: digestSummary.date,
      userId,
      screen: 'daily-digest',
      timestamp: new Date().toISOString(),
    };

    // Send to native FCM/APNs tokens
    const payload: admin.messaging.MulticastMessage = {
      tokens: nativeTokens,
      notification: {
        title: '📊 Daily Digest Ready',
        body,
      },
      data: notificationData,
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: 'default',
            contentAvailable: true,
          },
        },
      },
      android: {
        priority: 'normal',
        notification: {
          channelId: 'daily_digest',
          priority: 'default',
          sound: 'default',
        },
      },
    };

    const result = await messaging.sendEachForMulticast(payload);

    console.log(
      `[sendDailyDigestPushNotification] Sent to ${userId}: ${result.successCount}/${nativeTokens.length} succeeded`
    );
  } catch (error) {
    console.error('[sendDailyDigestPushNotification] Error sending notification:', error);
    // Non-critical error, don't throw - workflow should complete even if notification fails
  }
}

async function generateDailyDigest(ctx: WorkflowContext): Promise<void> {
  const stepStart = Date.now(); // Performance tracking
  try {
    await logWorkflowStep(ctx, 'generate_summary', 'running', 'Generating digest...');

    const summaryText = `${ctx.results.autoResponsesSent} handled, ${ctx.results.messagesNeedingReview} need review`;

    // Create daily digest document and capture the ID
    const digestRef = await db.collection('users').doc(ctx.userId).collection('daily_digests').add({
      userId: ctx.userId,
      executionId: ctx.executionId,
      date: admin.firestore.FieldValue.serverTimestamp(),
      summary: {
        totalHandled: ctx.results.autoResponsesSent,
        totalNeedingReview: ctx.results.messagesNeedingReview,
        summaryText: summaryText,
      },
      handledMessages: [], // Populated separately
      pendingMessages: [], // Populated separately
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Send push notification (Story 5.8 - Task 13)
    // Get current date in YYYY-MM-DD format
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;

    await sendDailyDigestPushNotification(ctx.userId, {
      totalHandled: ctx.results.autoResponsesSent,
      needReview: ctx.results.messagesNeedingReview,
      errors: 0, // TODO: Track errors in context if needed
      digestId: digestRef.id,
      date: dateStr,
    });

    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'generate_summary', stepDuration);

    await logWorkflowStep(
      ctx,
      'generate_summary',
      'completed',
      `Generated digest in ${stepDuration}ms: ${summaryText}`
    );
  } catch (error) {
    const stepDuration = Date.now() - stepStart;
    trackStepPerformance(ctx, 'generate_summary', stepDuration);
    
    await logWorkflowStep(
      ctx,
      'generate_summary',
      'failed',
      `Error generating digest: ${(error as Error).message}`
    );
    throw error;
  }
}

/**
 * Logs a workflow step to the agent execution log
 *
 * @param ctx - Workflow execution context
 * @param step - Step identifier
 * @param status - Step status
 * @param message - Log message
 */
async function logWorkflowStep(
  ctx: WorkflowContext,
  step: string,
  status: string,
  message: string
): Promise<void> {
  try {
    await db.collection('users').doc(ctx.userId).collection('agent_logs').add({
      executionId: ctx.executionId,
      userId: ctx.userId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      level: status === 'failed' ? 'error' : 'info',
      message: message,
      metadata: {
        step: step,
        status: status,
      },
    });
  } catch (error) {
    console.error('Error logging workflow step:', error);
    // Non-critical error, don't throw
  }
}

/**
 * Checks if user is currently online/active
 * @param userId - User ID to check
 * @param activeThresholdMinutes - Minutes to consider as "active" (default: 30)
 * @returns True if user is online or was active within threshold
 *
 * @remarks
 * Story 5.8 - Task 12 (IV3): Online/Offline Status Checks
 */
async function isUserOnlineOrActive(
  userId: string,
  activeThresholdMinutes: number = 30
): Promise<boolean> {
  try {
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    if (!userData?.presence) {
      return false;
    }

    // Check if user is explicitly online
    if (userData.presence.status === 'online') {
      return true;
    }

    // Check if user was active within threshold
    if (userData.presence.lastSeen) {
      const now = admin.firestore.Timestamp.now();
      const thresholdSeconds = activeThresholdMinutes * 60;
      const timeSinceActive = now.seconds - userData.presence.lastSeen.seconds;

      return timeSinceActive < thresholdSeconds;
    }

    return false;
  } catch (error) {
    console.error('Error checking user online status:', error);
    // If error, assume user might be active to be safe
    return true;
  }
}

/**
 * Checks if user has sent any manual messages in a conversation after a given timestamp
 * @param userId - User ID to check
 * @param conversationId - Conversation ID to check
 * @param afterTimestamp - Check for messages after this timestamp
 * @returns True if user has sent manual messages
 *
 * @remarks
 * Story 5.8 - Task 11 (IV2): Manual Override Logic
 */
async function hasManualMessagesAfter(
  userId: string,
  conversationId: string,
  afterTimestamp: admin.firestore.Timestamp
): Promise<boolean> {
  try {
    const manualMessagesSnap = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .where('senderId', '==', userId)
      .where('timestamp', '>', afterTimestamp)
      .limit(1)
      .get();

    return !manualMessagesSnap.empty;
  } catch (error) {
    console.error('Error checking for manual messages:', error);
    // If error, assume manual override to be safe
    return true;
  }
}

/**
 * Main workflow orchestration function
 *
 * @param userId - User ID to run workflow for
 * @returns Execution result with statistics
 *
 * @remarks
 * Orchestrates all 5 workflow steps:
 * 1. Fetch unprocessed messages
 * 2. Categorize messages
 * 3. Detect FAQs and auto-respond
 * 4. Draft voice-matched responses
 * 5. Generate daily digest
 *
 * Implements error handling and rollback for failed steps.
 * Tracks performance metrics and costs.
 *
 * Integration Verification:
 * - IV1: Skips active conversations (< 1 hour activity)
 * - IV2: Checks for manual override messages
 * - IV3: Skips if creator is online/active
 */
export async function orchestrateWorkflow(
  userId: string,
  options?: { bypassOnlineCheck?: boolean }
): Promise<{
  success: boolean;
  executionId: string;
  results: any;
  metrics: any;
}> {
  const executionId = `exec_${Date.now()}_${userId}`;
  const startTime = admin.firestore.Timestamp.now();

  // VERSION CHECK - RELATIONSHIP SCORE FIX DEPLOYED
  const VERSION = 'v14.0-RELATIONSHIP-SCORE-FIX';
  console.log(`[VERSION] orchestrateWorkflow ${VERSION} - Uses pre-set relationshipScore if exists`);
  console.log('[CRITICAL] If you see this log, the new code IS running!');
  await logWorkflowStep({ userId, executionId, startTime, config: {}, results: {}, costs: {} } as any,
    'version_check', 'info', `[VERSION] ${VERSION} - Relationship score fix active`);

  // Fetch user configuration
  const configDoc = await db
    .collection('users')
    .doc(userId)
    .collection('ai_workflow_config')
    .doc(userId)
    .get();

  const configData = configDoc.exists ? configDoc.data() : undefined;
  const config = configData || {
    workflowSettings: {
      maxAutoResponses: 20,
      requireApproval: true,
      escalationThreshold: 0.3,
      activeThresholdMinutes: 30, // Default: 30 minutes
    },
    features: {
      dailyWorkflowEnabled: false,
      categorizationEnabled: true,
      faqDetectionEnabled: true,
      voiceMatchingEnabled: true,
      sentimentAnalysisEnabled: true,
    },
  };

  // Apply defaults for missing feature flags (backward compatibility)
  const features = {
    dailyWorkflowEnabled: config.features?.dailyWorkflowEnabled ?? false,
    categorizationEnabled: config.features?.categorizationEnabled ?? true,
    faqDetectionEnabled: config.features?.faqDetectionEnabled ?? true,
    voiceMatchingEnabled: config.features?.voiceMatchingEnabled ?? true,
    sentimentAnalysisEnabled: config.features?.sentimentAnalysisEnabled ?? true,
  };

  // IV3: Check if user is online/active before starting workflow
  // Rationale: Don't run daily agent if user is actively using the app
  // - If user has status = 'online' → skip workflow
  // - If user was active within last 30 minutes (default) → skip workflow
  // This prevents disrupting real-time conversations with automated responses
  // BYPASS: For manual testing via Test Daily Agent screen
  const isActive =
    !options?.bypassOnlineCheck &&
    (await isUserOnlineOrActive(userId, config.workflowSettings.activeThresholdMinutes || 30));

  if (isActive) {
    // User is online/active, skip workflow execution and log to daily_executions
    const skipExecutionId = `exec_${Date.now()}_${userId}`;
    await db.collection('users').doc(userId).collection('daily_executions').doc(skipExecutionId).set({
      id: skipExecutionId,
      userId,
      executionDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'skipped',
      results: {
        messagesFetched: 0,
        messagesCategorized: 0,
        faqsDetected: 0,
        autoResponsesSent: 0,
        responsesDrafted: 0,
        messagesNeedingReview: 0,
      },
      metrics: {
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        endTime: admin.firestore.FieldValue.serverTimestamp(),
        duration: 0,
        costIncurred: 0,
      },
      steps: [],
      digestSummary: 'Skipped: Creator is currently online/active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      executionId: skipExecutionId,
      results: {
        messagesFetched: 0,
        messagesCategorized: 0,
        faqsDetected: 0,
        autoResponsesSent: 0,
        responsesDrafted: 0,
        messagesNeedingReview: 0,
      },
      metrics: {
        duration: 0,
        costIncurred: 0,
      },
    };
  }

  // Initialize workflow context
  const ctx: WorkflowContext = {
    userId,
    executionId,
    startTime,
    config: config.workflowSettings,
    results: {
      messagesFetched: 0,
      messagesCategorized: 0,
      faqsDetected: 0,
      autoResponsesSent: 0,
      responsesDrafted: 0,
      messagesNeedingReview: 0,
    },
    costs: {
      categorization: 0,
      faqDetection: 0,
      responseGeneration: 0,
      total: 0,
    },
  };

  try {
    // Create execution document
    await db.collection('users').doc(userId).collection('daily_executions').doc(executionId).set({
      id: executionId,
      userId,
      executionDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'running',
      results: ctx.results,
      metrics: {
        startTime: admin.firestore.FieldValue.serverTimestamp(),
        endTime: null,
        duration: 0,
        costIncurred: 0,
      },
      steps: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Step 1: Fetch messages
    const messages = await fetchUnprocessedMessages(userId, ctx);

    if (messages.length === 0) {
      // No messages to process, mark as completed
      const endTime = admin.firestore.Timestamp.now();
      await db.collection('users').doc(userId).collection('daily_executions').doc(executionId).update({
        status: 'completed',
        digestSummary: '0 handled, 0 need review',
        'metrics.endTime': admin.firestore.FieldValue.serverTimestamp(),
        'metrics.duration': (endTime.seconds - startTime.seconds) * 1000,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        executionId,
        results: ctx.results,
        metrics: {
          duration: (endTime.seconds - startTime.seconds) * 1000,
          costIncurred: 0,
        },
      };
    }

    // Step 2: Categorize messages (P1 FIX: Check feature toggle)
    if (features.categorizationEnabled) {
      await categorizeMessages(messages, ctx, features.sentimentAnalysisEnabled);

      // Check timeout after categorization (Task 15: Timeout handling)
      // If workflow has been running > 5 minutes, abort with error
      // This check prevents Cloud Function from hitting the 9-minute hard limit
      if (isWorkflowTimedOut(ctx)) {
        throw new Error('Workflow timeout: exceeded 5 minute limit after categorization');
      }
    } else {
      console.log('[Categorization] Skipped - categorizationEnabled=false');
      await logWorkflowStep(ctx, 'categorize', 'info', 'Categorization disabled by user settings');
    }

    // Step 3: Detect FAQs and auto-respond (P1 FIX: Check feature toggle)
    if (features.faqDetectionEnabled) {
      await detectAndRespondFAQs(messages, ctx);

      // Check timeout after FAQ detection
      if (isWorkflowTimedOut(ctx)) {
        throw new Error('Workflow timeout: exceeded 5 minute limit after FAQ detection');
      }
    } else {
      console.log('[FAQ Detection] Skipped - faqDetectionEnabled=false');
      await logWorkflowStep(ctx, 'faq_detect', 'info', 'FAQ detection disabled by user settings');
    }

    // Step 4: Draft voice-matched responses (P1 FIX: Check feature toggle)
    if (features.voiceMatchingEnabled) {
      await draftVoiceMatchedResponses(messages, ctx);
    } else {
      console.log('[Voice Matching] Skipped - voiceMatchingEnabled=false');
      await logWorkflowStep(ctx, 'draft_responses', 'info', 'Voice matching disabled by user settings');
    }

    // Check timeout after response drafting
    if (isWorkflowTimedOut(ctx)) {
      throw new Error('Workflow timeout: exceeded 5 minute limit after response drafting');
    }

    // EPIC 6 - PRODUCTION: Meaningful 10 Digest Generation
    // Generates priority-tiered digest with relationship scoring
    // Feature flag: meaningful10.enabled (default: true - FULL DEPLOYMENT)
    // RISK: Unvalidated algorithm deployed to 100% users immediately
    console.log('[DEBUG] Feature flag check - configData:', JSON.stringify(configData));
    console.log('[DEBUG] configData?.meaningful10:', configData?.meaningful10);
    console.log('[DEBUG] configData?.meaningful10?.enabled:', configData?.meaningful10?.enabled);
    const meaningful10Enabled = configData?.meaningful10?.enabled !== false; // Default true
    console.log('[DEBUG] meaningful10Enabled result:', meaningful10Enabled);

    // Add debug logging to agent_logs for immediate visibility
    await logWorkflowStep(ctx, 'feature_flag_check', 'info',
      `Feature flag check: meaningful10.enabled = ${configData?.meaningful10?.enabled}, ` +
      `evaluated to: ${meaningful10Enabled} (should be TRUE for production)`);

    if (meaningful10Enabled) {
      console.log('[DEBUG] Running PRODUCTION: generateMeaningful10Digest');
      await logWorkflowStep(ctx, 'meaningful10_mode', 'info', '[PRODUCTION MODE] Running generateMeaningful10Digest');
      await generateMeaningful10Digest(messages, ctx);
    } else {
      console.log('[DEBUG] Running SHADOW MODE: shadowModeRelationshipScoring');
      await logWorkflowStep(ctx, 'meaningful10_mode', 'info', '[SHADOW MODE] Running shadowModeRelationshipScoring');
      // Fallback: Keep shadow mode for emergency rollback
      await shadowModeRelationshipScoring(messages, ctx);
    }

    // Step 5: Generate daily digest
    await generateDailyDigest(ctx);

    // Mark execution as completed
    const endTime = admin.firestore.Timestamp.now();
    const duration = (endTime.seconds - startTime.seconds) * 1000;

    // Calculate total performance duration from steps
    if (ctx.performance) {
      ctx.performance.totalDuration = duration;
    }

    await db.collection('users').doc(userId).collection('daily_executions').doc(executionId).update({
      status: 'completed',
      results: ctx.results,
      digestSummary: `${ctx.results.autoResponsesSent} handled, ${ctx.results.messagesNeedingReview} need review`,
      metrics: {
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        costIncurred: Math.round(ctx.costs.total * 100), // Convert to cents
        // Performance breakdown (Task 15)
        performance: ctx.performance || {},
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      executionId,
      results: ctx.results,
      metrics: {
        duration,
        costIncurred: ctx.costs.total,
      },
    };
  } catch (error) {
    console.error('Workflow execution failed:', error);

    // Mark execution as failed
    const endTime = admin.firestore.Timestamp.now();
    await db.collection('users').doc(userId).collection('daily_executions').doc(executionId).update({
      status: 'failed',
      results: ctx.results,
      'metrics.endTime': admin.firestore.FieldValue.serverTimestamp(),
      'metrics.duration': (endTime.seconds - startTime.seconds) * 1000,
      'metrics.costIncurred': Math.round(ctx.costs.total * 100),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    throw error;
  }
}

/**
 * Cloud Function: Daily Agent Workflow
 * HTTP callable function for orchestrating daily agent workflow
 */
export const dailyAgentWorkflow = functions.onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new functions.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const result = await orchestrateWorkflow(userId);
      return result;
    } catch (error) {
      console.error('Daily agent workflow error:', error);
      throw new functions.HttpsError('internal', `Workflow failed: ${(error as Error).message}`);
    }
  }
);

// WORKAROUND for Firebase Gen2 caching bug - Copy of dailyAgentWorkflow
// The old function was stuck serving cached code despite deployments
// This new function name forces Firebase to use fresh code
export const dailyAgentWorkflowV2 = functions.onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new functions.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const result = await orchestrateWorkflow(userId);
      return result;
    } catch (error) {
      console.error('Daily agent workflow V2 error:', error);
      throw new functions.HttpsError('internal', `Workflow failed: ${(error as Error).message}`);
    }
  }
);

// WORKAROUND V3 - Caching bug struck again on V2!
// V2 deployment succeeded but continued serving old code
// Creating V3 with relationship score fix
export const dailyAgentWorkflowV3 = functions.onCall(
  {
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
  },
  async (request) => {
    const userId = request.auth?.uid;

    if (!userId) {
      throw new functions.HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      console.log('[V3] Daily agent workflow triggered for user:', userId);
      const result = await orchestrateWorkflow(userId);
      return result;
    } catch (error) {
      console.error('[V3] Daily agent workflow error:', error);
      throw new functions.HttpsError('internal', `Workflow failed: ${(error as Error).message}`);
    }
  }
);
