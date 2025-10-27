/**
 * Application Routes Constants
 * @module constants/routes
 * @remarks
 * Centralized navigation routes for type-safe navigation throughout the app.
 *
 * Benefits:
 * - Single source of truth for all routes
 * - Type safety and autocomplete
 * - Easy refactoring if routes change
 * - Prevents typos in navigation code
 * - Clear documentation of app structure
 *
 * @example
 * ```typescript
 * import { ROUTES } from '@/constants/routes';
 *
 * // Navigate to a conversation
 * router.push(ROUTES.TABS.CONVERSATIONS.DETAIL(conversationId));
 *
 * // Navigate to profile settings
 * router.push(ROUTES.TABS.PROFILE.DAILY_AGENT_SETTINGS);
 * ```
 */

/**
 * Authentication routes
 */
export const AUTH_ROUTES = {
  /** Login screen */
  LOGIN: '/(auth)/login',

  /** Registration screen */
  REGISTER: '/(auth)/register',

  /** Forgot password screen */
  FORGOT_PASSWORD: '/(auth)/forgot-password',

  /** Username setup screen (after registration) */
  USERNAME_SETUP: '/(auth)/username-setup',
} as const;

/**
 * Tab routes - top-level tab screens
 */
export const TAB_ROUTES = {
  /** Root tabs group */
  ROOT: '/(tabs)',

  /** Home/Dashboard tab */
  HOME: '/(tabs)',

  /** Daily digest tab */
  DAILY: '/(tabs)/daily-digest',

  /** Conversations list tab */
  CONVERSATIONS: '/(tabs)/conversations',

  /** Profile tab */
  PROFILE: '/(tabs)/profile',
} as const;

/**
 * Conversation routes
 */
export const CONVERSATION_ROUTES = {
  /** Conversations list */
  INDEX: '/(tabs)/conversations',

  /** New conversation screen */
  NEW: '/(tabs)/conversations/new',

  /** Archived conversations */
  ARCHIVED: '/(tabs)/conversations/archived',

  /**
   * Conversation detail screen
   * @param id - Conversation ID
   * @param messageId - Optional message ID to scroll to
   */
  DETAIL: (id: string, messageId?: string) => {
    const base = `/(tabs)/conversations/${id}`;
    return messageId ? `${base}?messageId=${messageId}` : base;
  },

  /**
   * Group settings screen
   * @param id - Conversation ID
   */
  GROUP_SETTINGS: (id: string) => `/(tabs)/conversations/group-settings?id=${id}`,

  /**
   * Group members screen
   * @param id - Conversation ID
   */
  GROUP_MEMBERS: (id: string) => `/(tabs)/conversations/group-members?id=${id}`,
} as const;

/**
 * Profile routes
 */
export const PROFILE_ROUTES = {
  /** Profile home */
  INDEX: '/(tabs)/profile',

  /** Edit profile (modal) */
  EDIT: '/(tabs)/profile/edit',

  /** General settings */
  SETTINGS: '/(tabs)/profile/settings',

  /** Daily agent configuration */
  DAILY_AGENT_SETTINGS: '/(tabs)/profile/daily-agent-settings',

  /** Daily capacity settings */
  CAPACITY_SETTINGS: '/(tabs)/profile/capacity-settings',

  /** Engagement health dashboard */
  ENGAGEMENT_HEALTH: '/(tabs)/profile/engagement-health',

  /** FAQ library */
  FAQ_LIBRARY: '/(tabs)/profile/faq-library',

  /** FAQ analytics */
  FAQ_ANALYTICS: '/(tabs)/profile/faq-analytics',

  /** Voice settings */
  VOICE_SETTINGS: '/(tabs)/profile/voice-settings',

  /** AI cost monitoring dashboard */
  AI_COST_DASHBOARD: '/(tabs)/profile/ai-cost-dashboard',

  /** AI performance dashboard */
  AI_PERFORMANCE_DASHBOARD: '/(tabs)/profile/ai-performance-dashboard',

  /** Dashboard settings */
  DASHBOARD_SETTINGS: '/(tabs)/profile/dashboard-settings',

  /** Test daily agent */
  TEST_DAILY_AGENT: '/(tabs)/profile/test-daily-agent',

  /** Agent execution logs */
  AGENT_EXECUTION_LOGS: '/(tabs)/profile/agent-execution-logs',

  /** Archived messages (with undo) */
  ARCHIVED_MESSAGES: '/(tabs)/profile/archived-messages',
} as const;

/**
 * Combined routes object for convenient access
 */
export const ROUTES = {
  AUTH: AUTH_ROUTES,
  TABS: TAB_ROUTES,
  CONVERSATIONS: CONVERSATION_ROUTES,
  PROFILE: PROFILE_ROUTES,
} as const;

/**
 * Type for all possible route strings
 * Useful for type checking navigation targets
 */
export type AppRoute =
  | typeof AUTH_ROUTES[keyof typeof AUTH_ROUTES]
  | typeof TAB_ROUTES[keyof typeof TAB_ROUTES]
  | typeof PROFILE_ROUTES[keyof typeof PROFILE_ROUTES]
  | ReturnType<typeof CONVERSATION_ROUTES.DETAIL>
  | ReturnType<typeof CONVERSATION_ROUTES.GROUP_SETTINGS>
  | ReturnType<typeof CONVERSATION_ROUTES.GROUP_MEMBERS>;

/**
 * Fallback routes for when navigation history is empty
 */
export const FALLBACK_ROUTES = {
  /** Default fallback - go to tabs */
  DEFAULT: TAB_ROUTES.ROOT,

  /** Conversations fallback */
  CONVERSATIONS: TAB_ROUTES.CONVERSATIONS,

  /** Profile fallback */
  PROFILE: TAB_ROUTES.PROFILE,

  /** Auth fallback */
  AUTH: AUTH_ROUTES.LOGIN,
} as const;
