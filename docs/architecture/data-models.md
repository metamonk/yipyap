# Data Models

## User

**Purpose:** Represents a registered user in the system with profile information and settings

**Key Attributes:**

- `uid`: string - Unique Firebase Auth ID
- `username`: string - Unique username for user identification
- `displayName`: string - User's display name (up to 50 characters)
- `photoURL`: string | null - Firebase Storage URL for profile photo
- `fcmToken`: string | null - Firebase Cloud Messaging token for push notifications
- `presence`: object - Online/offline status and last seen timestamp
- `settings`: object - User preferences including read receipts toggle
- `createdAt`: timestamp - Account creation timestamp
- `updatedAt`: timestamp - Last profile update

### TypeScript Interface

```typescript
interface User {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  fcmToken?: string;
  presence: {
    status: 'online' | 'offline';
    lastSeen: firebase.firestore.Timestamp;
  };
  settings: {
    sendReadReceipts: boolean;
    notificationsEnabled: boolean;
  };
  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

### Relationships

- One-to-Many with Conversations (participates in multiple conversations)
- One-to-Many with Messages (sends multiple messages)

## Conversation

**Purpose:** Represents a chat conversation between users (1:1 or group)

**Key Attributes:**

- `id`: string - Unique conversation ID (deterministic for 1:1, random for groups)
- `type`: string - Either 'direct' or 'group'
- `participantIds`: string[] - Array of user UIDs in conversation
- `groupName`: string | null - Name for group chats
- `groupPhotoURL`: string | null - Group photo URL
- `creatorId`: string | null - UID of group creator
- `lastMessage`: object - Preview of most recent message
- `lastMessageTimestamp`: timestamp - Time of last message
- `unreadCount`: map - Per-user unread message counts
- `archivedBy`: map - Per-user archive status
- `deletedBy`: map - Per-user deletion status
- `mutedBy`: map - Per-user mute status

### TypeScript Interface

```typescript
interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  groupName?: string;
  groupPhotoURL?: string;
  creatorId?: string;
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: firebase.firestore.Timestamp;
  };
  lastMessageTimestamp: firebase.firestore.Timestamp;
  unreadCount: Record<string, number>;
  archivedBy: Record<string, boolean>;
  deletedBy: Record<string, boolean>;
  mutedBy: Record<string, boolean>;
  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

### Relationships

- Many-to-Many with Users (through participantIds)
- One-to-Many with Messages (contains multiple messages)

## Message

**Purpose:** Represents an individual message within a conversation

**Key Attributes:**

- `id`: string - Unique message ID (Firestore document ID)
- `conversationId`: string - Parent conversation ID
- `senderId`: string - UID of message sender
- `text`: string - Message content (up to 1000 characters)
- `status`: string - Delivery status (sending, delivered, read)
- `readBy`: string[] - Array of UIDs who have read the message
- `timestamp`: timestamp - Message creation time
- `metadata`: object - AI-ready fields for future features

### TypeScript Interface

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: 'sending' | 'delivered' | 'read';
  readBy: string[];
  timestamp: firebase.firestore.Timestamp;
  metadata: {
    category?: string;
    sentiment?: string;
    aiProcessed?: boolean;
  };
}
```

### Relationships

- Many-to-One with Conversation (belongs to one conversation)
- Many-to-One with User (sent by one user)

---
