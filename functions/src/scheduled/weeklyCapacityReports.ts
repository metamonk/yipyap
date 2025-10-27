/**
 * Weekly Capacity Reports Cloud Function (Story 6.5)
 *
 * Generates weekly capacity usage reports for creators with weeklyReportsEnabled=true.
 * Runs on Sundays at midnight (configurable timezone).
 *
 * Features:
 * - Aggregates weekly engagement metrics
 * - Generates capacity adjustment suggestions
 * - Sends in-app notification with report
 * - Stores report in capacity_reports collection
 */

import * as scheduler from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  CapacityReport,
  CapacityMetrics,
  CapacitySuggestion,
  UserSettings,
} from '../types/user';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Scheduled function to generate weekly capacity reports
 * Runs every Sunday at midnight UTC
 */
export const generateWeeklyCapacityReports = scheduler.onSchedule(
  {
    schedule: '0 0 * * 0', // Cron: Sunday at 00:00 UTC
    timeZone: 'UTC',
  },
  async (event) => {
    console.log('Starting weekly capacity report generation');

    try {
      // Get all users with weeklyReportsEnabled=true
      const usersSnapshot = await db
        .collection('users')
        .where('settings.capacity.weeklyReportsEnabled', '==', true)
        .get();

      console.log(`Found ${usersSnapshot.size} users with weekly reports enabled`);

      const reportPromises = usersSnapshot.docs.map(async (userDoc) => {
        try {
          const userId = userDoc.id;
          return await generateWeeklyReport(userId);
        } catch (error) {
          console.error(`Failed to generate report for user ${userDoc.id}:`, error);
          return null;
        }
      });

      const reports = await Promise.all(reportPromises);
      const successCount = reports.filter((r) => r !== null).length;

      console.log(`Successfully generated ${successCount}/${usersSnapshot.size} reports`);
    } catch (error) {
      console.error('Error in weekly report generation:', error);
      throw error;
    }
  }
);
/**
 * Generates a weekly capacity report for a specific user
 * @param userId - The user ID to generate report for
 * @returns The generated capacity report
 */
export async function generateWeeklyReport(userId: string): Promise<CapacityReport | null> {
  console.log(`Generating weekly report for user ${userId}`);

  // Get user settings
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data();

  if (!userData || !userData.settings?.capacity) {
    console.log(`User ${userId} has no capacity settings, skipping`);
    return null;
  }

  const settings = userData.settings as UserSettings;

  // Skip if weekly reports disabled
  if (!settings.capacity?.weeklyReportsEnabled) {
    console.log(`Weekly reports disabled for user ${userId}, skipping`);
    return null;
  }

  // Check if we already sent a report this week
  const now = Timestamp.now();
  const lastReportSent = settings.capacity.lastReportSent;
  if (lastReportSent && isWithinCurrentWeek(lastReportSent.toDate(), now.toDate())) {
    console.log(`Already sent report this week for user ${userId}, skipping`);
    return null;
  }

  // Calculate week boundaries (Sunday to Saturday)
  const { weekStart, weekEnd } = getWeekBoundaries();

  // Fetch last 7 days of meaningful10_digests data
  const digestsSnapshot = await db
    .collection('meaningful10_digests')
    .where('userId', '==', userId)
    .where('createdAt', '>=', weekStart)
    .where('createdAt', '<=', weekEnd)
    .orderBy('createdAt', 'asc')
    .get();

  console.log(`Found ${digestsSnapshot.size} digests for user ${userId}`);

  // Calculate metrics
  const metrics = calculateWeeklyMetrics(digestsSnapshot.docs, settings);

  // Generate suggestions
  const suggestions = generateSuggestions(metrics, settings);

  // Create report document
  const report: CapacityReport = {
    id: db.collection('capacity_reports').doc().id,
    userId,
    weekStartDate: weekStart,
    weekEndDate: weekEnd,
    metrics,
    suggestions,
    createdAt: now,
  };

  // Save report to Firestore
  await db.collection('capacity_reports').doc(report.id).set(report);

  // Update lastReportSent in user settings
  await db.collection('users').doc(userId).update({
    'settings.capacity.lastReportSent': now,
  });

  // Send notification
  await sendWeeklyReportNotification(userId, report);

  console.log(`Successfully generated report ${report.id} for user ${userId}`);
  return report;
}

/**
 * Calculates weekly capacity metrics from digest data
 * @param digestDocs - Firestore documents for the week's digests
 * @param settings - User settings with capacity configuration
 * @returns Aggregated weekly metrics
 */
function calculateWeeklyMetrics(
  digestDocs: admin.firestore.QueryDocumentSnapshot[],
  settings: UserSettings
): CapacityMetrics {
  const capacitySet = settings.capacity?.dailyLimit || 10;

  let totalDeep = 0;
  let totalFAQ = 0;
  let totalArchived = 0;
  let totalMessages = 0;
  let daysWithData = 0;

  digestDocs.forEach((doc) => {
    const data = doc.data();

    // Count deep conversations (priority >= 70, personalized responses)
    const deep = data.deep || 0;
    totalDeep += deep;

    // Count FAQ responses
    const faq = data.faq || 0;
    totalFAQ += faq;

    // Count archived messages
    const archived = data.archived || 0;
    totalArchived += archived;

    totalMessages += deep + faq + archived;

    if (deep + faq + archived > 0) {
      daysWithData++;
    }
  });

  // Calculate average daily usage
  const avgDailyUsage = daysWithData > 0 ? totalMessages / daysWithData : 0;

  // Calculate usage rate
  const usageRate = capacitySet > 0 ? avgDailyUsage / capacitySet : 0;

  return {
    capacitySet,
    avgDailyUsage: Math.round(avgDailyUsage * 10) / 10, // Round to 1 decimal
    usageRate: Math.round(usageRate * 100) / 100, // Round to 2 decimals
    totalDeep,
    totalFAQ,
    totalArchived,
  };
}

/**
 * Generates capacity adjustment suggestions based on weekly metrics
 * @param metrics - Weekly capacity metrics
 * @param settings - User settings
 * @returns Array of suggestions for capacity adjustments
 */
function generateSuggestions(
  metrics: CapacityMetrics,
  settings: UserSettings
): CapacitySuggestion[] {
  const suggestions: CapacitySuggestion[] = [];

  // Under-utilized capacity (< 50%)
  if (metrics.usageRate < 0.5) {
    const suggestedCapacity = Math.max(5, Math.round(metrics.avgDailyUsage * 1.2));
    suggestions.push({
      adjustCapacity: suggestedCapacity,
      reason: `You're only using ${Math.round(metrics.usageRate * 100)}% of your capacity. Lowering to ${suggestedCapacity} would reduce pressure while maintaining coverage.`,
      priority: 'medium',
    });
  }

  // Over-capacity (> 90%)
  if (metrics.usageRate > 0.9) {
    const suggestedCapacity = Math.max(5, metrics.capacitySet - 3);
    suggestions.push({
      adjustCapacity: suggestedCapacity,
      reason: `You're at ${Math.round(metrics.usageRate * 100)}% capacity. Consider reducing to ${suggestedCapacity} for sustainability.`,
      priority: 'high',
    });
  }

  // High archive rate (> 60%)
  const totalMessages = metrics.totalDeep + metrics.totalFAQ + metrics.totalArchived;
  const archiveRate = totalMessages > 0 ? metrics.totalArchived / totalMessages : 0;

  if (archiveRate > 0.6 && metrics.capacitySet < 20) {
    const suggestedCapacity = Math.min(20, metrics.capacitySet + 2);
    suggestions.push({
      adjustCapacity: suggestedCapacity,
      reason: `${Math.round(archiveRate * 100)}% of messages are being archived. If you have bandwidth, consider increasing capacity to ${suggestedCapacity}.`,
      priority: 'low',
    });
  }

  // No suggestions if everything looks good
  if (suggestions.length === 0) {
    suggestions.push({
      reason: 'Your capacity settings look well-balanced. No adjustments needed.',
      priority: 'low',
    });
  }

  return suggestions;
}

/**
 * Sends in-app notification to user about new weekly report
 * @param userId - User ID to send notification to
 * @param report - The generated capacity report
 */
async function sendWeeklyReportNotification(
  userId: string,
  report: CapacityReport
): Promise<void> {
  const usagePercent = Math.round(report.metrics.usageRate * 100);

  await db.collection('notifications').add({
    userId,
    type: 'weekly_capacity_report',
    title: 'Your Weekly Engagement Report',
    body: `This week: ${usagePercent}% capacity usage. ${report.suggestions.length} suggestion(s) available.`,
    data: {
      reportId: report.id,
      screen: 'WeeklyCapacityReport',
    },
    read: false,
    createdAt: Timestamp.now(),
  });

  console.log(`Sent notification for report ${report.id} to user ${userId}`);
}

/**
 * Gets the start and end timestamps for the current week (Sunday-Saturday)
 * @returns Week boundaries as Firestore Timestamps
 */
function getWeekBoundaries(): { weekStart: Timestamp; weekEnd: Timestamp } {
  const now = new Date();

  // Get last Sunday at 00:00:00
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Go back to Sunday
  weekStart.setHours(0, 0, 0, 0);

  // Get last Saturday at 23:59:59
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get Saturday
  weekEnd.setHours(23, 59, 59, 999);

  return {
    weekStart: Timestamp.fromDate(weekStart),
    weekEnd: Timestamp.fromDate(weekEnd),
  };
}

/**
 * Checks if a date is within the current week
 * @param date - Date to check
 * @param now - Current date
 * @returns True if date is in current week
 */
function isWithinCurrentWeek(date: Date, now: Date): boolean {
  const { weekStart, weekEnd } = getWeekBoundaries();
  const timestamp = date.getTime();
  return timestamp >= weekStart.toDate().getTime() && timestamp <= weekEnd.toDate().getTime();
}
