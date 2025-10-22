import { Timestamp } from 'firebase/firestore';

/**
 * Represents a chat conversation between users
 *
 * @remarks
 * Conversations can be either direct (1:1) or group chats.
 * For direct chats, the conversation ID is deterministic based on participant IDs.
 * For group chats, the conversation ID is randomly generated.
 *
 * Firestore Collection Path: `/conversations/{conversationId}`
 *
 * @example
 * ```typescript
 * const conversation: Conversation = {
 *   id: 'user123_user456',
 *   type: 'direct',
 *   participantIds: ['user123', 'user456'],
 *   lastMessage: {
 *     text: 'Hello!',
 *     senderId: 'user123',
 *     timestamp: Timestamp.now()
 *   },
 *   lastMessageTimestamp: Timestamp.now(),
 *   unreadCount: { 'user456': 1 },
 *   archivedBy: {},
 *   deletedBy: {},
 *   mutedBy: {},
 *   createdAt: Timestamp.now(),
 *   updatedAt: Timestamp.now()
 * };
 * ```
 */
export interface Conversation {
  /** Unique conversation identifier (deterministic for direct, random for group) */
  id: string;

  /** Type of conversation */
  type: 'direct' | 'group';

  /** Array of user IDs participating in this conversation (indexed for queries) */
  participantIds: string[];

  /** Group name (only for group conversations) */
  groupName?: string;

  /** Group photo URL (only for group conversations) */
  groupPhotoURL?: string;

  /** User ID of the group creator (only for group conversations) */
  creatorId?: string;

  /** Preview of the most recent message */
  lastMessage: {
    /** Text content of the last message */
    text: string;

    /** User ID of the message sender */
    senderId: string;

    /** Timestamp when the message was sent */
    timestamp: Timestamp;
  };

  /** Timestamp of the last message (indexed for sorting conversations) */
  lastMessageTimestamp: Timestamp;

  /** Per-user unread message counts */
  unreadCount: Record<string, number>;

  /** Per-user archive status (true if archived by that user) */
  archivedBy: Record<string, boolean>;

  /** Per-user soft deletion status (true if deleted by that user) */
  deletedBy: Record<string, boolean>;

  /** Per-user mute status (true if muted by that user) */
  mutedBy: Record<string, boolean>;

  /** Timestamp when the conversation was created */
  createdAt: Timestamp;

  /** Timestamp when the conversation was last updated */
  updatedAt: Timestamp;
}

/**
 * Represents a chat message within a conversation
 *
 * @remarks
 * Messages are stored as subcollections under conversations.
 * Messages are immutable once sent and include metadata for future AI processing.
 * The metadata field is prepared for Phase 2 AI features (categorization, sentiment analysis).
 *
 * Firestore Collection Path: `/conversations/{conversationId}/messages/{messageId}`
 *
 * @example
 * ```typescript
 * const message: Message = {
 *   id: 'msg123',
 *   conversationId: 'user123_user456',
 *   senderId: 'user123',
 *   text: 'Hello, how are you?',
 *   status: 'delivered',
 *   readBy: ['user123'],
 *   timestamp: Timestamp.now(),
 *   metadata: {
 *     aiProcessed: false
 *   }
 * };
 * ```
 */
export interface Message {
  /** Unique message identifier (Firestore document ID) */
  id: string;

  /** ID of the parent conversation this message belongs to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Message text content (1-1000 characters) */
  text: string;

  /** Current delivery status of the message */
  status: 'sending' | 'delivered' | 'read';

  /** Array of user IDs who have read this message */
  readBy: string[];

  /** Server timestamp when the message was created (indexed for ordering) */
  timestamp: Timestamp;

  /** Metadata for future AI features (Phase 2) */
  metadata: {
    /** AI-assigned category (e.g., "question", "task", "social") - Phase 2 */
    category?: string;

    /** Sentiment analysis result ("positive", "negative", "neutral") - Phase 2 */
    sentiment?: string;

    /** Whether AI processing has been completed */
    aiProcessed?: boolean;
  };
}

/**
 * Input data for creating a new conversation
 *
 * @remarks
 * This type is used when creating conversations and excludes auto-generated fields
 * like timestamps and IDs that are set by the service layer.
 */
export interface CreateConversationInput {
  /** Type of conversation to create */
  type: 'direct' | 'group';

  /** Array of user IDs to include in the conversation */
  participantIds: string[];

  /** Group name (required for group conversations) */
  groupName?: string;

  /** Group photo URL (optional for group conversations) */
  groupPhotoURL?: string;

  /** User ID of the group creator */
  creatorId?: string;
}

/**
 * Input data for creating a new message
 *
 * @remarks
 * This type is used when sending messages and excludes auto-generated fields
 * like ID, timestamp, and status that are set by the service layer.
 */
export interface CreateMessageInput {
  /** ID of the conversation to send the message to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Message text content (1-1000 characters) */
  text: string;
}

/**
 * Represents a date separator item in the chat message list
 *
 * @remarks
 * Used to visually separate messages from different days in the chat timeline.
 * Rendered as a centered date label with horizontal lines on both sides.
 */
export interface DateSeparatorItem {
  /** Item type discriminator */
  type: 'separator';

  /** Unique identifier for FlatList key */
  id: string;

  /** Timestamp representing the date for this separator */
  timestamp: Timestamp;
}

/**
 * Represents a message item in the chat message list
 *
 * @remarks
 * Wraps the Message data with type discriminator for FlatList rendering.
 */
export interface MessageListItem {
  /** Item type discriminator */
  type: 'message';

  /** Unique identifier for FlatList key (matches message.id) */
  id: string;

  /** The message data */
  data: Message;
}

/**
 * Union type for chat list items (messages and date separators)
 *
 * @remarks
 * Discriminated union based on 'type' field allows type-safe rendering
 * in FlatList renderItem function.
 */
export type ChatListItem = MessageListItem | DateSeparatorItem;

/**
 * Represents a search result with message and conversation context
 *
 * @remarks
 * Used to display search results with additional context like sender information
 * and conversation details. This allows users to navigate to the specific message
 * within its conversation.
 *
 * @example
 * ```typescript
 * const result: SearchResult = {
 *   message: messageData,
 *   conversationId: 'user123_user456',
 *   conversationName: 'John Doe',
 *   senderName: 'John Doe',
 *   senderPhotoURL: 'https://...'
 * };
 * ```
 */
export interface SearchResult {
  /** The message that matches the search query */
  message: Message;

  /** ID of the conversation containing this message */
  conversationId: string;

  /** Display name of the conversation (other participant name or group name) */
  conversationName: string;

  /** Display name of the message sender */
  senderName: string;

  /** Profile photo URL of the message sender (optional) */
  senderPhotoURL?: string;
}

/**
 * State management interface for message search functionality
 *
 * @remarks
 * Tracks search query, results, loading state, and errors.
 * Used by the useMessageSearch hook to manage search state.
 *
 * @example
 * ```typescript
 * const searchState: SearchState = {
 *   query: 'hello',
 *   results: [message1, message2],
 *   isSearching: false,
 *   error: null
 * };
 * ```
 */
export interface SearchState {
  /** Current search query string */
  query: string;

  /** Array of messages matching the search query */
  results: Message[];

  /** Whether a search operation is in progress */
  isSearching: boolean;

  /** Error message if search fails, null otherwise */
  error: string | null;
}

// Re-export User type from user.ts for convenience
export type { User } from './user';
