/**
 * Cloud Scheduler for Daily Agent Workflow
 * @module functions/ai/daily-agent-scheduler
 *
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent (Task 4)
 * Schedules and triggers daily agent workflow for all enabled users
 * Handles timezone-aware scheduling and user-specific execution times
 */

import * as scheduler from 'firebase-functions/v2/scheduler';
import * as https from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { orchestrateWorkflow } from './daily-agent-workflow';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Parses time string in HH:mm format to hours and minutes
 * @param timeString - Time in HH:mm format (e.g., "09:00")
 * @returns Object with hours and minutes as numbers
 */
function parseTimeString(timeString: string): { hours: number; minutes: number } {
  const [hoursStr, minutesStr] = timeString.split(':');
  return {
    hours: parseInt(hoursStr, 10),
    minutes: parseInt(minutesStr, 10),
  };
}

/**
 * Gets current time in a specific timezone
 * @param timezone - IANA timezone identifier (e.g., "America/Los_Angeles")
 * @returns Object with hours and minutes in the specified timezone
 */
function getCurrentTimeInTimezone(timezone: string): { hours: number; minutes: number } {
  const now = new Date();

  // Format time in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  return { hours, minutes };
}

/**
 * Checks if the current time matches the scheduled time (within 5-minute window)
 * @param scheduledTime - Scheduled time in HH:mm format
 * @param currentTime - Current time as hours and minutes
 * @returns True if current time is within 5 minutes of scheduled time
 *
 * @remarks
 * Uses a 5-minute window to account for Cloud Scheduler execution variability
 */
function isTimeToRun(
  scheduledTime: string,
  currentTime: { hours: number; minutes: number }
): boolean {
  const scheduled = parseTimeString(scheduledTime);

  // Convert both times to minutes since midnight
  const scheduledMinutes = scheduled.hours * 60 + scheduled.minutes;
  const currentMinutes = currentTime.hours * 60 + currentTime.minutes;

  // Check if within 5-minute window
  const diff = Math.abs(currentMinutes - scheduledMinutes);
  return diff <= 5;
}

/**
 * Fetches all users who have daily workflow enabled
 * @returns Array of user IDs with their configurations
 */
async function getEnabledUsers(): Promise<
  Array<{
    userId: string;
    scheduledTime: string;
    timezone: string;
  }>
> {
  const enabledUsers: Array<{
    userId: string;
    scheduledTime: string;
    timezone: string;
  }> = [];

  try {
    // Query all users
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Fetch user's daily agent config
      const configDoc = await db
        .collection('users')
        .doc(userId)
        .collection('ai_workflow_config')
        .doc(userId)
        .get();

      if (!configDoc.exists) {
        continue;
      }

      const config = configDoc.data();

      // Check if daily workflow is enabled
      if (config?.features?.dailyWorkflowEnabled === true) {
        enabledUsers.push({
          userId,
          scheduledTime: config.workflowSettings?.dailyWorkflowTime || '09:00',
          timezone: config.workflowSettings?.timezone || 'America/Los_Angeles',
        });
      }
    }

    return enabledUsers;
  } catch (error) {
    console.error('Error fetching enabled users:', error);
    throw error;
  }
}

/**
 * Daily Agent Scheduler Function
 *
 * @remarks
 * Runs every hour to check if any users' scheduled time has arrived.
 * For each user whose schedule matches:
 * 1. Checks timezone-adjusted time
 * 2. Triggers workflow if within 5-minute window
 * 3. Logs execution attempts
 *
 * Deployment:
 * - Scheduled via Firebase Cloud Scheduler (Gen2)
 * - Runs every hour: "0 * * * *"
 * - Extended timeout for processing multiple users
 * - Timezone: UTC (handles all timezones internally)
 *
 * @example
 * ```bash
 * # Deploy function
 * firebase deploy --only functions:dailyAgentScheduler
 * ```
 */
export const dailyAgentScheduler = scheduler.onSchedule(
  {
    schedule: '0 * * * *', // Run at the top of every hour
    timeZone: 'UTC', // Use UTC, handle timezones internally
    timeoutSeconds: 540, // 9 minutes timeout
    memory: '1GiB',
    maxInstances: 1, // Prevent concurrent runs
  },
  async (event) => {
    console.log('Daily Agent Scheduler triggered at', new Date().toISOString());

    try {
      // Get all users with daily workflow enabled
      const enabledUsers = await getEnabledUsers();
      console.log(`Found ${enabledUsers.length} users with daily workflow enabled`);

      if (enabledUsers.length === 0) {
        console.log('No users with daily workflow enabled. Exiting.');
        return;
      }

      // Track execution attempts
      const executionAttempts: Array<{
        userId: string;
        status: 'success' | 'skipped' | 'error';
        reason?: string;
      }> = [];

      // Check each user's schedule
      for (const user of enabledUsers) {
        try {
          // Get current time in user's timezone
          const currentTime = getCurrentTimeInTimezone(user.timezone);

          // Check if it's time to run for this user
          if (isTimeToRun(user.scheduledTime, currentTime)) {
            console.log(
              `Triggering workflow for user ${user.userId} (scheduled: ${user.scheduledTime} ${user.timezone})`
            );

            // Trigger workflow asynchronously (don't wait for completion)
            orchestrateWorkflow(user.userId)
              .then((result) => {
                console.log(
                  `Workflow completed for user ${user.userId}:`,
                  result.success ? 'Success' : 'Failed'
                );
              })
              .catch((error) => {
                console.error(`Workflow failed for user ${user.userId}:`, error);
              });

            executionAttempts.push({
              userId: user.userId,
              status: 'success',
              reason: 'Workflow triggered',
            });
          } else {
            // Not time to run yet
            executionAttempts.push({
              userId: user.userId,
              status: 'skipped',
              reason: `Current time ${currentTime.hours}:${currentTime.minutes} doesn't match scheduled ${user.scheduledTime}`,
            });
          }
        } catch (error) {
          console.error(`Error processing user ${user.userId}:`, error);
          executionAttempts.push({
            userId: user.userId,
            status: 'error',
            reason: (error as Error).message,
          });
        }
      }

      // Log summary
      const triggered = executionAttempts.filter((a) => a.status === 'success').length;
      const skipped = executionAttempts.filter((a) => a.status === 'skipped').length;
      const errors = executionAttempts.filter((a) => a.status === 'error').length;

      console.log(
        `Scheduler run complete: ${triggered} triggered, ${skipped} skipped, ${errors} errors`
      );

      // Log to Firestore for monitoring
      await db.collection('scheduler_logs').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        totalUsers: enabledUsers.length,
        triggered,
        skipped,
        errors,
        attempts: executionAttempts,
      });
    } catch (error) {
      console.error('Scheduler error:', error);
      throw error;
    }
  }
);

/**
 * Manual trigger function for testing
 *
 * @remarks
 * Allows manual triggering of workflow for a specific user
 * Useful for testing without waiting for scheduled time
 *
 * @example
 * ```bash
 * # Call via HTTP
 * curl -X POST https://REGION-PROJECT.cloudfunctions.net/triggerDailyAgentManual \
 *   -H "Content-Type: application/json" \
 *   -d '{"userId": "user123"}'
 * ```
 */
export const triggerDailyAgentManual = https.onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request: https.CallableRequest<{ userId?: string }>) => {
    // Verify authentication
    if (!request.auth) {
      throw new https.HttpsError(
        'unauthenticated',
        'User must be authenticated to trigger workflow'
      );
    }

    const userId = request.data.userId || request.auth.uid;

    // Verify user is triggering their own workflow or is admin
    if (userId !== request.auth.uid) {
      // TODO: Check if user is admin
      throw new https.HttpsError(
        'permission-denied',
        'Users can only trigger their own workflow'
      );
    }

    try {
      console.log(`Manual trigger requested for user ${userId}`);

      const result = await orchestrateWorkflow(userId, { bypassOnlineCheck: true });

      return {
        success: result.success,
        executionId: result.executionId,
        results: result.results,
        metrics: result.metrics,
        message: 'Workflow triggered successfully',
      };
    } catch (error) {
      console.error(`Manual trigger failed for user ${userId}:`, error);
      throw new https.HttpsError(
        'internal',
        'Failed to trigger workflow',
        (error as Error).message
      );
    }
  }
);
