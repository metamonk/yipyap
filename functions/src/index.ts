/**
 * Cloud Functions entry point for yipyap
 *
 * This file exports all Cloud Functions for the application.
 * Functions are organized by feature area (notifications, messaging, etc.)
 */

// Export notification-related functions
export * from './notifications';

// Export AI-related functions (Story 5.3)
export * from './ai/sentimentNotifications';

// Export FAQ embedding functions (Story 5.4)
export * from './ai/faqEmbeddings';

// Export FAQ auto-response functions (Story 5.4)
export * from './ai/faqAutoResponse';

// Export voice matching functions (Story 5.5)
export * from './ai/voiceTraining';
export * from './ai/voiceMatching';
export * from './ai/voiceRetraining';

// Export daily agent workflow functions (Story 5.8)
export * from './ai/daily-agent-workflow';
export * from './ai/daily-agent-scheduler';

// Export budget monitoring functions (Story 5.9)
export * from './ai/budget-monitor';
export * from './ai/performance-monitor';
