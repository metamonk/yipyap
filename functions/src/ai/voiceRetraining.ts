/**
 * Scheduled Voice Profile Retraining Cloud Function (Story 5.5)
 * @module functions/src/ai/voiceRetraining
 *
 * @remarks
 * Automatically retrains voice profiles on a weekly schedule to keep them
 * up-to-date as creators' communication styles evolve over time.
 * Runs every Monday at 2 AM UTC via Cloud Scheduler.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Minimum number of messages required for retraining
 * @constant
 */
const MIN_TRAINING_SAMPLES = 50;

/**
 * Maximum number of messages to analyze for retraining
 * @constant
 */
const MAX_TRAINING_SAMPLES = 200;

/**
 * GPT-4 Turbo model identifier for voice analysis
 * @constant
 */
const VOICE_ANALYSIS_MODEL = 'gpt-4-turbo-preview';

/**
 * Batch size for processing users (Task 15, Subtask 15.1)
 * Process users in batches to prevent Cloud Function timeout
 * @constant
 */
const BATCH_SIZE = 10;

/**
 * Voice characteristics structure from AI analysis
 * @interface
 */
interface VoiceCharacteristicsResponse {
  tone: string;
  vocabulary: string[];
  sentenceStructure: string;
  punctuationStyle: string;
  emojiUsage: 'none' | 'occasional' | 'frequent';
  writingPatterns?: string;
}

/**
 * Retraining job tracking document (Task 15, Subtask 15.2)
 *
 * Stored in Firestore collection: retraining_jobs/{jobId}
 * Documents the progress and results of scheduled retraining jobs
 *
 * @interface
 */
export interface RetrainingJob {
  jobId: string;
  schedule: 'weekly' | 'biweekly' | 'monthly';
  status: 'running' | 'completed' | 'failed';
  startedAt: admin.firestore.FieldValue;
  completedAt?: admin.firestore.FieldValue;
  totalUsers: number;
  successfulRetrains: number;
  failedRetrains: number;
  durationMs?: number;
  errors?: string[];
}

/**
 * Performance metrics for individual user retraining (Task 15, Subtask 15.4)
 * @interface
 */
export interface UserRetrainingMetrics {
  userId: string;
  success: boolean;
  durationMs: number;
  messageFetchMs: number;
  aiAnalysisMs: number;
  firestoreUpdateMs: number;
  error?: string;
}

/**
 * Retrains a single user's voice profile with performance tracking (Task 15, Subtask 15.4)
 *
 * @param userId - User ID to retrain profile for
 * @returns Promise resolving to performance metrics and status
 */
async function retrainUserProfile(userId: string): Promise<UserRetrainingMetrics> {
  const startTime = Date.now();
  let messageFetchStart = 0;
  let aiAnalysisStart = 0;
  let firestoreUpdateStart = 0;

  try {
    console.log(`[VoiceRetraining] Starting retraining for user ${userId}`);

    // Fetch creator's message history (Track performance)
    messageFetchStart = Date.now();
    const messagesSnapshot = await admin
      .firestore()
      .collectionGroup('messages')
      .where('senderId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(MAX_TRAINING_SAMPLES)
      .get();
    const messageFetchMs = Date.now() - messageFetchStart;

    // Validate sufficient training data
    if (messagesSnapshot.size < MIN_TRAINING_SAMPLES) {
      const errorMsg = `Insufficient training data: ${messagesSnapshot.size}/${MIN_TRAINING_SAMPLES} messages`;
      console.log(`[VoiceRetraining] Skipping user ${userId}: ${errorMsg}`);
      return {
        userId,
        success: false,
        durationMs: Date.now() - startTime,
        messageFetchMs,
        aiAnalysisMs: 0,
        firestoreUpdateMs: 0,
        error: errorMsg,
      };
    }

    // Extract message texts
    const messageSamples: string[] = [];
    messagesSnapshot.forEach((doc) => {
      const messageData = doc.data();
      if (messageData.text && typeof messageData.text === 'string') {
        messageSamples.push(messageData.text);
      }
    });

    console.log(`[VoiceRetraining] Extracted ${messageSamples.length} message samples for user ${userId}`);

    // Generate voice profile using GPT-4 Turbo (Track performance)
    aiAnalysisStart = Date.now();
    const analysisPrompt = `Analyze the following ${messageSamples.length} messages from a creator and generate a detailed voice profile.

Messages:
${messageSamples.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

Analyze their communication style and provide a JSON response with the following structure:
{
  "tone": "friendly|professional|casual|enthusiastic|warm|confident|etc",
  "vocabulary": ["array", "of", "common", "words", "phrases", "they", "use"],
  "sentenceStructure": "short|medium|complex",
  "punctuationStyle": "minimal|moderate|expressive",
  "emojiUsage": "none|occasional|frequent",
  "writingPatterns": "Any notable patterns in how they write (optional)"
}

Focus on:
1. Overall tone and emotional style
2. Common words, phrases, and expressions they frequently use
3. Sentence length and complexity patterns
4. How they use punctuation (minimal, lots of exclamation marks, etc.)
5. How often they use emojis
6. Any unique writing patterns or quirks

Return ONLY valid JSON, no additional text.`;

    const { text: aiResponse } = await generateText({
      model: openai(VOICE_ANALYSIS_MODEL),
      prompt: analysisPrompt,
      temperature: 0.3, // Lower temperature for consistent analysis
    });
    const aiAnalysisMs = Date.now() - aiAnalysisStart;

    // Parse AI response
    let voiceCharacteristics: VoiceCharacteristicsResponse;
    try {
      voiceCharacteristics = JSON.parse(aiResponse) as VoiceCharacteristicsResponse;
    } catch (parseError) {
      console.error(`[VoiceRetraining] Failed to parse AI response for user ${userId}:`, aiResponse);
      return {
        userId,
        success: false,
        durationMs: Date.now() - startTime,
        messageFetchMs,
        aiAnalysisMs,
        firestoreUpdateMs: 0,
        error: 'Failed to parse AI voice analysis',
      };
    }

    // Validate required fields
    if (
      !voiceCharacteristics.tone ||
      !Array.isArray(voiceCharacteristics.vocabulary) ||
      !voiceCharacteristics.sentenceStructure ||
      !voiceCharacteristics.punctuationStyle ||
      !voiceCharacteristics.emojiUsage
    ) {
      console.error(`[VoiceRetraining] Invalid AI response structure for user ${userId}:`, voiceCharacteristics);
      return {
        userId,
        success: false,
        durationMs: Date.now() - startTime,
        messageFetchMs,
        aiAnalysisMs,
        firestoreUpdateMs: 0,
        error: 'AI returned incomplete voice analysis',
      };
    }

    // Get existing profile to preserve metrics and update (Track performance)
    firestoreUpdateStart = Date.now();
    const profileRef = admin.firestore().collection('voice_profiles').doc(userId);
    const existingProfile = await profileRef.get();

    // Update voice profile
    const profileData: any = {
      userId,
      characteristics: voiceCharacteristics,
      trainingSampleCount: messageSamples.length,
      lastTrainedAt: admin.firestore.FieldValue.serverTimestamp(),
      modelVersion: VOICE_ANALYSIS_MODEL,
      metrics: existingProfile.exists && existingProfile.data()?.metrics
        ? existingProfile.data()!.metrics
        : {
            totalSuggestionsGenerated: 0,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 0,
            averageSatisfactionRating: 0,
          },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store updated profile
    await profileRef.set(profileData, { merge: true });
    const firestoreUpdateMs = Date.now() - firestoreUpdateStart;

    const totalDuration = Date.now() - startTime;
    console.log(
      `[VoiceRetraining] Successfully retrained profile for user ${userId} ` +
      `(${totalDuration}ms total: fetch=${messageFetchMs}ms, ai=${aiAnalysisMs}ms, update=${firestoreUpdateMs}ms)`
    );

    return {
      userId,
      success: true,
      durationMs: totalDuration,
      messageFetchMs,
      aiAnalysisMs,
      firestoreUpdateMs,
    };
  } catch (error: any) {
    console.error(`[VoiceRetraining] Error retraining user ${userId}:`, error);
    return {
      userId,
      success: false,
      durationMs: Date.now() - startTime,
      messageFetchMs: messageFetchStart > 0 ? Date.now() - messageFetchStart : 0,
      aiAnalysisMs: aiAnalysisStart > 0 ? Date.now() - aiAnalysisStart : 0,
      firestoreUpdateMs: firestoreUpdateStart > 0 ? Date.now() - firestoreUpdateStart : 0,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Scheduled Cloud Function to retrain voice profiles weekly
 *
 * @remarks
 * Runs every Monday at 2 AM UTC via Cloud Scheduler.
 * Queries all users with voice matching enabled and weekly retraining schedule,
 * then retrains each user's voice profile with their latest messages.
 *
 * **Schedule:** Every Monday at 2 AM UTC (cron: `0 2 * * 1`)
 *
 * **Processing:**
 * 1. Queries users with voice matching enabled
 * 2. Filters for users with weekly retraining schedule
 * 3. Retrains each user's voice profile sequentially
 * 4. Logs progress and errors for monitoring
 * 5. Uses Promise.allSettled to handle individual failures gracefully
 *
 * **Error Handling:**
 * - Individual user failures don't stop the batch
 * - All errors are logged for debugging
 * - Summary statistics logged at completion
 *
 * @example
 * ```typescript
 * // Deployed automatically, runs on schedule
 * // Manual trigger for testing:
 * // gcloud functions call weeklyVoiceRetraining
 * ```
 */
export const weeklyVoiceRetraining = functions.pubsub
  .schedule('0 2 * * 1') // Every Monday at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    const startTime = Date.now();
    const jobId = `weekly-${Date.now()}`;
    console.log(`[VoiceRetraining] Starting weekly voice profile retraining job (ID: ${jobId})`);

    // Create job tracking record (Task 15, Subtask 15.2)
    const jobRef = admin.firestore().collection('retraining_jobs').doc(jobId);

    try {
      // Query users with voice matching enabled
      const usersSnapshot = await admin
        .firestore()
        .collection('users')
        .where('settings.voiceMatching.enabled', '==', true)
        .where('settings.voiceMatching.retrainingSchedule', '==', 'weekly')
        .get();

      console.log(`[VoiceRetraining] Found ${usersSnapshot.size} users for weekly retraining`);

      // Create initial job record
      await jobRef.set({
        jobId,
        schedule: 'weekly',
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers: usersSnapshot.size,
        successfulRetrains: 0,
        failedRetrains: 0,
      });

      if (usersSnapshot.size === 0) {
        await jobRef.update({
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          durationMs: Date.now() - startTime,
        });
        console.log('[VoiceRetraining] No users to retrain, job complete');
        return null;
      }

      // Process users in batches to prevent timeout (Task 15, Subtask 15.1)
      const userBatches: admin.firestore.QueryDocumentSnapshot[][] = [];
      for (let i = 0; i < usersSnapshot.docs.length; i += BATCH_SIZE) {
        userBatches.push(usersSnapshot.docs.slice(i, i + BATCH_SIZE));
      }

      console.log(`[VoiceRetraining] Processing ${usersSnapshot.size} users in ${userBatches.length} batches of ${BATCH_SIZE}`);

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];
      const performanceMetrics: UserRetrainingMetrics[] = [];

      // Process each batch sequentially (Task 15, Subtask 15.1)
      for (let batchIndex = 0; batchIndex < userBatches.length; batchIndex++) {
        const batch = userBatches[batchIndex];
        console.log(`[VoiceRetraining] Processing batch ${batchIndex + 1}/${userBatches.length} (${batch.length} users)`);

        // Retrain users in batch concurrently
        const batchPromises = batch.map((userDoc) => retrainUserProfile(userDoc.id));
        const batchResults = await Promise.allSettled(batchPromises);

        // Aggregate batch results
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            const metrics = result.value;
            performanceMetrics.push(metrics);

            if (metrics.success) {
              successCount++;
            } else {
              failureCount++;
              errors.push(`User ${metrics.userId}: ${metrics.error}`);
            }
          } else {
            const userId = batch[index].id;
            failureCount++;
            errors.push(`User ${userId}: ${result.reason}`);
          }
        });

        // Update job progress after each batch
        await jobRef.update({
          successfulRetrains: successCount,
          failedRetrains: failureCount,
        });
      }

      const duration = Date.now() - startTime;

      // Calculate average performance metrics (Task 15, Subtask 15.4)
      const successfulMetrics = performanceMetrics.filter((m) => m.success);
      const avgMetrics = successfulMetrics.length > 0
        ? {
            avgTotalMs: Math.round(successfulMetrics.reduce((sum, m) => sum + m.durationMs, 0) / successfulMetrics.length),
            avgFetchMs: Math.round(successfulMetrics.reduce((sum, m) => sum + m.messageFetchMs, 0) / successfulMetrics.length),
            avgAiMs: Math.round(successfulMetrics.reduce((sum, m) => sum + m.aiAnalysisMs, 0) / successfulMetrics.length),
            avgUpdateMs: Math.round(successfulMetrics.reduce((sum, m) => sum + m.firestoreUpdateMs, 0) / successfulMetrics.length),
          }
        : null;

      // Update final job status
      await jobRef.update({
        status: failureCount === usersSnapshot.size ? 'failed' : 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: duration,
        errors: errors.length > 0 ? errors.slice(0, 100) : [], // Limit to first 100 errors
      });

      // Log summary with performance metrics
      console.log('[VoiceRetraining] Weekly retraining job complete:');
      console.log(`  - Job ID: ${jobId}`);
      console.log(`  - Total users: ${usersSnapshot.size}`);
      console.log(`  - Successful: ${successCount}`);
      console.log(`  - Failed: ${failureCount}`);
      console.log(`  - Total duration: ${duration}ms`);

      if (avgMetrics) {
        console.log(`  - Avg per-user timing: total=${avgMetrics.avgTotalMs}ms, fetch=${avgMetrics.avgFetchMs}ms, ai=${avgMetrics.avgAiMs}ms, update=${avgMetrics.avgUpdateMs}ms`);
      }

      if (errors.length > 0) {
        console.error(`[VoiceRetraining] ${errors.length} errors encountered (showing first 10):`);
        errors.slice(0, 10).forEach((error) => console.error(`  - ${error}`));
      }

      return null;
    } catch (error: any) {
      // Update job status to failed
      await jobRef.update({
        status: 'failed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - startTime,
        errors: [error.message || 'Unknown error'],
      });

      console.error('[VoiceRetraining] Fatal error in weekly retraining job:', error);
      throw error;
    }
  });

/**
 * Biweekly voice profile retraining (every other Monday at 2 AM UTC)
 *
 * @remarks
 * Similar to weekly retraining but runs every 2 weeks.
 * For users who prefer less frequent updates.
 */
export const biweeklyVoiceRetraining = functions.pubsub
  .schedule('0 2 1,15 * *') // 1st and 15th of each month at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    const startTime = Date.now();
    console.log('[VoiceRetraining] Starting biweekly voice profile retraining job');

    try {
      const usersSnapshot = await admin
        .firestore()
        .collection('users')
        .where('settings.voiceMatching.enabled', '==', true)
        .where('settings.voiceMatching.retrainingSchedule', '==', 'biweekly')
        .get();

      console.log(`[VoiceRetraining] Found ${usersSnapshot.size} users for biweekly retraining`);

      if (usersSnapshot.size === 0) {
        console.log('[VoiceRetraining] No users to retrain, job complete');
        return null;
      }

      const retrainingPromises = usersSnapshot.docs.map((userDoc) =>
        retrainUserProfile(userDoc.id)
      );

      const results = await Promise.allSettled(retrainingPromises);

      let successCount = 0;
      let failureCount = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[VoiceRetraining] Biweekly retraining complete: ${successCount} successful, ${failureCount} failed (${duration}ms)`);

      return null;
    } catch (error: any) {
      console.error('[VoiceRetraining] Fatal error in biweekly retraining job:', error);
      throw error;
    }
  });

/**
 * Monthly voice profile retraining (1st of each month at 2 AM UTC)
 *
 * @remarks
 * Least frequent retraining option.
 * For users who prefer minimal automatic updates.
 */
export const monthlyVoiceRetraining = functions.pubsub
  .schedule('0 2 1 * *') // 1st of each month at 2 AM UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    const startTime = Date.now();
    console.log('[VoiceRetraining] Starting monthly voice profile retraining job');

    try {
      const usersSnapshot = await admin
        .firestore()
        .collection('users')
        .where('settings.voiceMatching.enabled', '==', true)
        .where('settings.voiceMatching.retrainingSchedule', '==', 'monthly')
        .get();

      console.log(`[VoiceRetraining] Found ${usersSnapshot.size} users for monthly retraining`);

      if (usersSnapshot.size === 0) {
        console.log('[VoiceRetraining] No users to retrain, job complete');
        return null;
      }

      const retrainingPromises = usersSnapshot.docs.map((userDoc) =>
        retrainUserProfile(userDoc.id)
      );

      const results = await Promise.allSettled(retrainingPromises);

      let successCount = 0;
      let failureCount = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          failureCount++;
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[VoiceRetraining] Monthly retraining complete: ${successCount} successful, ${failureCount} failed (${duration}ms)`);

      return null;
    } catch (error: any) {
      console.error('[VoiceRetraining] Fatal error in monthly retraining job:', error);
      throw error;
    }
  });
