/**
 * Navigation type definitions for Expo Router
 *
 * @remarks
 * Defines type-safe route parameters for all navigation screens.
 * Used with useLocalSearchParams and router.push() for type checking.
 */

/**
 * Route parameters for the chat screen
 *
 * @remarks
 * Supports both existing conversations and draft conversations.
 * Draft conversations are created when the first message is sent.
 *
 * @example
 * ```typescript
 * // Navigate to existing conversation
 * router.push(`/(tabs)/conversations/${conversationId}`);
 *
 * // Navigate to draft conversation
 * router.push({
 *   pathname: `/(tabs)/conversations/${conversationId}`,
 *   params: {
 *     isDraft: 'true',
 *     type: 'direct',
 *     recipientId: 'user456'
 *   }
 * });
 * ```
 */
export interface ChatScreenParams {
  /** Conversation ID (deterministic for direct, random for groups) */
  id: string;

  /** Optional message ID to scroll to (from search results) */
  messageId?: string;

  /** Whether this is a draft conversation (not yet created in Firestore) */
  isDraft?: string; // 'true' or undefined (route params are strings)

  /** Recipient user ID for direct message drafts */
  recipientId?: string;

  /** Type of conversation for drafts */
  type?: 'direct' | 'group';

  /** Group name for group conversation drafts */
  groupName?: string;

  /** Comma-separated participant IDs for group conversation drafts */
  participantIds?: string;
}

/**
 * Parameters for creating a draft direct message conversation
 *
 * @remarks
 * Used when navigating to a new 1:1 conversation that hasn't been created yet.
 * The conversation will be created atomically with the first message send.
 */
export interface DraftDirectConversationParams {
  /** Conversation ID (deterministic based on participant IDs) */
  id: string;

  /** Indicates this is a draft conversation */
  isDraft: 'true';

  /** Type of conversation */
  type: 'direct';

  /** Recipient user ID */
  recipientId: string;
}

/**
 * Parameters for creating a draft group conversation
 *
 * @remarks
 * Used when navigating to a new group conversation that hasn't been created yet.
 * The conversation will be created atomically with the first message send.
 */
export interface DraftGroupConversationParams {
  /** Conversation ID (random, generated client-side) */
  id: string;

  /** Indicates this is a draft conversation */
  isDraft: 'true';

  /** Type of conversation */
  type: 'group';

  /** Group name */
  groupName: string;

  /** Comma-separated participant IDs (including current user) */
  participantIds: string;
}

/**
 * Union type for all possible draft conversation parameters
 */
export type DraftConversationNavParams = DraftDirectConversationParams | DraftGroupConversationParams;

/**
 * Route parameters for the conversation list screen
 */
export interface ConversationListParams {
  /** Optional filter for conversation type */
  filter?: 'all' | 'direct' | 'group';
}

/**
 * Route parameters for the new conversation screen
 *
 * @remarks
 * This screen has no route parameters - users search for contacts within the screen.
 */
export type NewConversationParams = Record<string, never>;

/**
 * Route parameters for the new group screen
 *
 * @remarks
 * This screen has no route parameters - users select participants and enter group name within the screen.
 */
export type NewGroupParams = Record<string, never>;
