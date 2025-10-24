# Coding Standards

## Critical Fullstack Rules

- **Type Sharing:** Always define shared types in `/types` directory and import from there
- **Firebase Access:** Never access Firebase directly from components - use service layer
- **Firebase Initialization:** Use lazy getters or function-scoped calls for Firebase instances in services. Never initialize Firebase instances as class properties in singleton services. See: [architecture/critical-infrastructure-fixes.md#fix-8-firebase-service-initialization-order](./critical-infrastructure-fixes.md#fix-8-firebase-service-initialization-order)
- **Environment Variables:** Access only through Config object, never process.env directly
- **Error Handling:** All async operations must have try-catch with user-friendly error messages
- **State Updates:** Never mutate state directly - use proper Zustand actions or setState
- **Optimistic Updates:** All user actions must show immediate UI feedback before server confirmation
- **Offline Handling:** All features must gracefully handle offline state with queuing
- **Security Rules:** Never bypass Firestore Security Rules - all data access must be validated
- **Race Condition Prevention:** Fix race conditions through sequencing, not error suppression. Check prerequisites before setting up real-time listeners. See: [architecture/real-time-data-patterns.md](./real-time-data-patterns.md)

## TypeScript Documentation Standards

**MANDATORY: All public APIs must be documented with JSDoc/TSDoc comments**

### Required Documentation:

1. **All Public Functions/Methods:**

````typescript
/**
 * Sends a message to the specified conversation
 * @param conversationId - The ID of the conversation to send to
 * @param text - The message text content (max 1000 characters)
 * @param attachments - Optional array of attachment URLs
 * @returns Promise resolving to the created message with server-assigned ID
 * @throws {FirebaseError} When user lacks permission or network fails
 * @example
 * ```typescript
 * const message = await sendMessage('conv123', 'Hello world');
 * ```
 */
export async function sendMessage(
  conversationId: string,
  text: string,
  attachments?: string[]
): Promise<Message> {
  // Implementation
}
````

2. **All Public Interfaces/Types:**

```typescript
/**
 * Represents a chat message within a conversation
 * @remarks
 * Messages are immutable once sent and include metadata for future AI processing
 */
export interface Message {
  /** Unique message identifier assigned by Firestore */
  id: string;

  /** Parent conversation ID this message belongs to */
  conversationId: string;

  /** User ID of the message sender */
  senderId: string;

  /** Message text content (1-1000 characters) */
  text: string;

  /** Current delivery status of the message */
  status: 'sending' | 'delivered' | 'read';

  /** Array of user IDs who have read this message */
  readBy: string[];

  /** Server timestamp when message was created */
  timestamp: firebase.firestore.Timestamp;

  /** Metadata for future AI features */
  metadata: {
    /** AI-assigned category (optional) */
    category?: string;
    /** Sentiment analysis result (optional) */
    sentiment?: string;
    /** Whether AI processing has been completed */
    aiProcessed?: boolean;
  };
}
```

3. **All Public React Components:**

````typescript
/**
 * Displays a single message within a chat conversation
 *
 * @component
 * @example
 * ```tsx
 * <MessageItem
 *   message={messageData}
 *   isOwnMessage={true}
 *   onLongPress={handleMessageOptions}
 * />
 * ```
 */
export interface MessageItemProps {
  /** The message data to display */
  message: Message;

  /** Whether this message was sent by the current user */
  isOwnMessage: boolean;

  /** Whether to show the sender's avatar (default: true) */
  showAvatar?: boolean;

  /** Callback fired when message is long-pressed */
  onLongPress?: (message: Message) => void;
}

export const MessageItem: FC<MessageItemProps> = ({ ... }) => {
  // Component implementation
}
````

4. **All Public Hooks:**

````typescript
/**
 * Custom hook for managing conversation messages with real-time updates
 *
 * @param conversationId - The conversation to subscribe to
 * @returns Object containing messages array, loading state, and send function
 *
 * @example
 * ```tsx
 * function ChatScreen({ conversationId }) {
 *   const { messages, loading, sendMessage } = useMessages(conversationId);
 *   // Use messages in your component
 * }
 * ```
 */
export function useMessages(conversationId: string) {
  // Hook implementation
}
````

5. **All Public Classes:**

```typescript
/**
 * Service class for managing conversation operations
 * @class ConversationService
 * @remarks
 * This service handles all conversation CRUD operations and real-time subscriptions
 */
export class ConversationService {
  /**
   * Creates a new conversation between specified participants
   * @param participants - Array of user IDs (2-50 users)
   * @param type - Either 'direct' for 1:1 or 'group' for multiple users
   * @param groupName - Required for group conversations
   * @returns The newly created conversation ID
   */
  async createConversation(
    participants: string[],
    type: 'direct' | 'group',
    groupName?: string
  ): Promise<string> {
    // Method implementation
  }
}
```

### Documentation Rules:

- **Description**: First line must be a clear, concise description
- **@param**: Document all parameters with type and description
- **@returns**: Document return type and what it represents
- **@throws**: Document possible exceptions/errors
- **@example**: Include usage examples for complex functions
- **@deprecated**: Mark deprecated APIs with migration instructions
- **@since**: Add version info for new APIs
- **@remarks**: Add important notes or warnings
- **Property comments**: Use `/** */` for interface properties

### Documentation Quality Checks:

- No `any` types without explanation
- No missing parameter descriptions
- No undocumented public exports
- Examples must be valid TypeScript/TSX code
- Keep descriptions concise but complete

## Naming Conventions

| Element              | Frontend             | Backend          | Example                        |
| -------------------- | -------------------- | ---------------- | ------------------------------ |
| Components           | PascalCase           | -                | `MessageItem.tsx`              |
| Hooks                | camelCase with 'use' | -                | `useMessages.ts`               |
| API Routes           | -                    | kebab-case       | `/conversations/{id}/messages` |
| Database Collections | -                    | lowercase        | `conversations`, `users`       |
| Database Fields      | -                    | camelCase        | `lastMessageTimestamp`         |
| Constants            | UPPER_SNAKE_CASE     | UPPER_SNAKE_CASE | `MAX_MESSAGE_LENGTH`           |
| Functions            | camelCase            | camelCase        | `sendMessage()`                |
| Types/Interfaces     | PascalCase           | PascalCase       | `interface Message`            |

---
