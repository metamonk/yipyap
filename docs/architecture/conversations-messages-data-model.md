# Conversations & Messages Data Model

**Version**: 1.0
**Last Updated**: 2025-10-21
**Status**: Implemented

## Overview

This document describes the Firestore data model for conversations and messages in the yipyap chat application. The model is designed for:

- **Real-time messaging** with low latency
- **Efficient queries** using composite indexes
- **Scalability** with cursor-based pagination
- **Cost optimization** by minimizing document reads
- **Future AI integration** with metadata fields

## Table of Contents

1. [Conversations Collection](#conversations-collection)
2. [Messages Subcollection](#messages-subcollection)
3. [Conversation ID Generation](#conversation-id-generation)
4. [Firestore Indexes](#firestore-indexes)
5. [Pagination Strategy](#pagination-strategy)
6. [Security Rules](#security-rules)
7. [Common Query Patterns](#common-query-patterns)
8. [AI-Ready Metadata](#ai-ready-metadata)

---

## Conversations Collection

**Collection Path**: `/conversations/{conversationId}`

### Document Structure

| Field                  | Type                  | Description                                                        | Indexed |
| ---------------------- | --------------------- | ------------------------------------------------------------------ | ------- |
| `id`                   | `string`              | Unique conversation ID (deterministic for 1:1, random for groups)  | No      |
| `type`                 | `'direct' \| 'group'` | Conversation type                                                  | No      |
| `participantIds`       | `string[]`            | Array of user UIDs in the conversation                             | Yes     |
| `groupName`            | `string \| undefined` | Name for group chats (null/undefined for 1:1)                      | No      |
| `groupPhotoURL`        | `string \| undefined` | Group photo URL (null/undefined for 1:1)                           | No      |
| `creatorId`            | `string \| undefined` | UID of group creator (null/undefined for 1:1)                      | No      |
| `lastMessage`          | `object`              | Preview of most recent message (see structure below)               | No      |
| `lastMessageTimestamp` | `Timestamp`           | Time of last message (for sorting conversations)                   | Yes     |
| `unreadCount`          | `map<string, number>` | Per-user unread message counts (e.g., `{ "user1": 3, "user2": 0 }` | No      |
| `archivedBy`           | `map<string, bool>`   | Per-user archive status                                            | No      |
| `deletedBy`            | `map<string, bool>`   | Per-user soft deletion status                                      | No      |
| `mutedBy`              | `map<string, bool>`   | Per-user mute status                                               | No      |
| `createdAt`            | `Timestamp`           | Conversation creation timestamp                                    | No      |
| `updatedAt`            | `Timestamp`           | Last update timestamp                                              | No      |

### lastMessage Object Structure

```typescript
{
  text: string; // Message preview text
  senderId: string; // UID of sender
  timestamp: Timestamp; // When message was sent
}
```

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
    timestamp: Timestamp;
  };
  lastMessageTimestamp: Timestamp;
  unreadCount: Record<string, number>;
  archivedBy: Record<string, boolean>;
  deletedBy: Record<string, boolean>;
  mutedBy: Record<string, boolean>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Example Document

```json
{
  "id": "user123_user456",
  "type": "direct",
  "participantIds": ["user123", "user456"],
  "lastMessage": {
    "text": "Hey, how are you?",
    "senderId": "user123",
    "timestamp": "2025-10-21T10:30:00Z"
  },
  "lastMessageTimestamp": "2025-10-21T10:30:00Z",
  "unreadCount": {
    "user123": 0,
    "user456": 1
  },
  "archivedBy": {
    "user123": false,
    "user456": false
  },
  "deletedBy": {
    "user123": false,
    "user456": false
  },
  "mutedBy": {
    "user123": false,
    "user456": false
  },
  "createdAt": "2025-10-20T09:00:00Z",
  "updatedAt": "2025-10-21T10:30:00Z"
}
```

---

## Messages Subcollection

**Collection Path**: `/conversations/{conversationId}/messages/{messageId}`

### Document Structure

| Field            | Type                                 | Description                                       | Indexed |
| ---------------- | ------------------------------------ | ------------------------------------------------- | ------- |
| `id`             | `string`                             | Unique message ID (Firestore document ID)         | No      |
| `conversationId` | `string`                             | Parent conversation ID                            | No      |
| `senderId`       | `string`                             | UID of message sender                             | No      |
| `text`           | `string`                             | Message content (1-1000 characters)               | No      |
| `status`         | `'sending' \| 'delivered' \| 'read'` | Delivery status                                   | No      |
| `readBy`         | `string[]`                           | Array of UIDs who have read the message           | No      |
| `timestamp`      | `Timestamp`                          | Message creation time                             | Yes     |
| `metadata`       | `object`                             | AI-ready fields for Phase 2 (see structure below) | No      |

### metadata Object Structure

```typescript
{
  category?: string;     // AI-assigned category (e.g., "question", "task", "social")
  sentiment?: string;    // Sentiment analysis ("positive", "negative", "neutral")
  aiProcessed?: boolean; // Whether AI processing completed (false by default)
}
```

### TypeScript Interface

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: 'sending' | 'delivered' | 'read';
  readBy: string[];
  timestamp: Timestamp;
  metadata: {
    category?: string;
    sentiment?: string;
    aiProcessed?: boolean;
  };
}
```

### Example Document

```json
{
  "id": "msg123",
  "conversationId": "user123_user456",
  "senderId": "user123",
  "text": "Hey, how are you?",
  "status": "delivered",
  "readBy": ["user123"],
  "timestamp": "2025-10-21T10:30:00Z",
  "metadata": {
    "aiProcessed": false
  }
}
```

---

## Conversation ID Generation

### For 1:1 Direct Chats (Deterministic)

**Purpose**: Prevent duplicate conversations between the same two users.

**Algorithm**:

1. Sort participant UIDs alphabetically
2. Join with underscore separator

**Example**:

```typescript
generateConversationId(['user456', 'user123']); // Returns: 'user123_user456'
generateConversationId(['user123', 'user456']); // Returns: 'user123_user456'
```

**Benefit**: Both participants generate the same ID, ensuring a single conversation exists.

### For Group Chats (Random)

**Purpose**: Allow multiple groups with the same participants.

**Algorithm**: Use Firestore auto-generated document ID

**Example**:

```typescript
doc(collection(db, 'conversations')).id; // Returns: random ID like 'a1b2c3d4e5'
```

**Benefit**: Multiple group chats can have the same participants without conflicts.

---

## Firestore Indexes

### Index 1: Conversation List Query

**Purpose**: Fetch user's conversations sorted by last message timestamp

**Configuration**:

```json
{
  "collectionGroup": "conversations",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "participantIds", "arrayConfig": "CONTAINS" },
    { "fieldPath": "lastMessageTimestamp", "order": "DESCENDING" }
  ]
}
```

**Query Pattern**:

```typescript
query(
  collection(db, 'conversations'),
  where('participantIds', 'array-contains', userId),
  orderBy('lastMessageTimestamp', 'desc')
);
```

**Use Case**: Display user's conversation list with most recent activity first

---

### Index 2: Message Pagination

**Purpose**: Load messages in chronological order with pagination

**Configuration**:

```json
{
  "collectionGroup": "messages",
  "queryScope": "COLLECTION_GROUP",
  "fields": [{ "fieldPath": "timestamp", "order": "DESCENDING" }]
}
```

**Query Pattern**:

```typescript
query(
  collection(db, 'conversations', conversationId, 'messages'),
  orderBy('timestamp', 'desc'),
  limit(50),
  startAfter(lastVisibleDoc)
);
```

**Use Case**: Load messages page by page (oldest to newest) with cursor-based pagination

---

## Pagination Strategy

### Cursor-Based Pagination with Firestore

**Benefits**:

- Efficient: Only reads necessary documents
- Cost-effective: Avoids redundant reads
- Scalable: Works with unlimited message history
- Real-time compatible: Works with `onSnapshot` listeners

### Implementation

**1. Initial Load** (Most Recent 50 Messages):

```typescript
const q = query(
  collection(db, 'conversations', conversationId, 'messages'),
  orderBy('timestamp', 'desc'),
  limit(50)
);
const snapshot = await getDocs(q);
```

**2. Load More** (Next Page):

```typescript
const lastVisible = snapshot.docs[snapshot.docs.length - 1];
const nextQ = query(
  collection(db, 'conversations', conversationId, 'messages'),
  orderBy('timestamp', 'desc'),
  startAfter(lastVisible),
  limit(50)
);
```

**3. State Management**:

- Store `lastVisible` document for next page
- Track `hasMore` boolean flag
- Reverse message array for display (oldest to newest)

### Example Service Function

```typescript
async function getMessages(
  conversationId: string,
  pageSize: number = 50,
  lastVisible?: QueryDocumentSnapshot
): Promise<{ messages: Message[]; lastDoc: any; hasMore: boolean }> {
  // Implementation in messageService.ts
}
```

---

## Security Rules

### Conversations

```javascript
match /conversations/{conversationId} {
  // Read: User must be a participant
  allow read: if request.auth != null &&
    request.auth.uid in resource.data.participantIds;

  // Create: User must include themselves in participantIds
  allow create: if request.auth != null &&
    request.auth.uid in request.resource.data.participantIds;

  // Update: User must be a participant
  allow update: if request.auth != null &&
    request.auth.uid in resource.data.participantIds;

  // Delete: Not allowed (use soft delete via deletedBy field)
  allow delete: if false;
}
```

### Messages

```javascript
match /conversations/{conversationId}/messages/{messageId} {
  // Read: User must be participant in parent conversation
  allow read: if request.auth != null &&
    request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;

  // Create: User must be participant AND senderId must match auth.uid
  allow create: if request.auth != null &&
    request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds &&
    request.auth.uid == request.resource.data.senderId;

  // Update: User must be participant (for read receipts, status updates)
  allow update: if request.auth != null &&
    request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;

  // Delete: Not allowed (messages are immutable)
  allow delete: if false;
}
```

**Key Security Features**:

- All operations require authentication
- Participant validation enforced server-side
- senderId validation prevents message spoofing
- Soft deletes prevent data loss
- Parent document access for message validation

---

## Common Query Patterns

### 1. Get User's Conversations

```typescript
import { getUserConversations } from '@/services/conversationService';

const conversations = await getUserConversations('user123');
// Returns conversations sorted by lastMessageTimestamp (newest first)
```

### 2. Get Conversation by ID

```typescript
import { getConversation } from '@/services/conversationService';

const conversation = await getConversation('user123_user456');
```

### 3. Create Direct Conversation

```typescript
import { createConversation } from '@/services/conversationService';

const conversation = await createConversation({
  type: 'direct',
  participantIds: ['user123', 'user456'],
});
```

### 4. Create Group Conversation

```typescript
import { createConversation } from '@/services/conversationService';

const conversation = await createConversation({
  type: 'group',
  participantIds: ['user123', 'user456', 'user789'],
  groupName: 'Project Team',
  creatorId: 'user123',
});
```

### 5. Send Message

```typescript
import { sendMessage } from '@/services/messageService';

const message = await sendMessage(
  {
    conversationId: 'user123_user456',
    senderId: 'user123',
    text: 'Hello!',
  },
  ['user123', 'user456']
);
```

### 6. Load Messages with Pagination

```typescript
import { getMessages } from '@/services/messageService';

// Initial load
const result = await getMessages('user123_user456', 50);
console.log(result.messages); // First 50 messages
console.log(result.hasMore); // true if more messages available

// Load next page
if (result.hasMore) {
  const nextResult = await getMessages('user123_user456', 50, result.lastDoc);
}
```

### 7. Subscribe to Real-Time Messages

```typescript
import { subscribeToMessages } from '@/services/messageService';

const unsubscribe = subscribeToMessages(
  'user123_user456',
  (messages) => {
    // Called when messages change
    console.log(`Received ${messages.length} messages`);
  },
  50
);

// Later, cleanup
unsubscribe();
```

### 8. Mark Conversation as Read

```typescript
import { markConversationAsRead } from '@/services/conversationService';

await markConversationAsRead('user123_user456', 'user123');
// Resets unreadCount for user123 to 0
```

---

## AI-Ready Metadata

### Purpose

Prepare for Phase 2 AI features:

- Message categorization
- Sentiment analysis
- Smart replies
- Conversation insights

### Current Implementation (Phase 1)

**Message Creation**:

```typescript
metadata: {
  aiProcessed: false; // Initialized on message creation
}
```

**No AI Processing**: Category and sentiment fields are not populated in Phase 1.

### Future Implementation (Phase 2)

**Cloud Function Trigger**:

1. Message created in Firestore
2. Cloud Function triggered
3. AI processes message (categorization + sentiment)
4. Metadata updated asynchronously

**Updated Metadata**:

```typescript
metadata: {
  category: 'question',      // AI-assigned category
  sentiment: 'positive',     // Sentiment analysis result
  aiProcessed: true          // Processing completed
}
```

**Frontend Integration**:

- Display category badges on messages
- Show sentiment indicators
- Enable category-based filtering
- Provide conversation insights

---

## File Locations

### Type Definitions

- `/types/models.ts` - Conversation and Message interfaces

### Service Layer

- `/services/conversationService.ts` - Conversation CRUD operations
- `/services/messageService.ts` - Message operations and real-time subscriptions

### Firebase Configuration

- `/firebase/firestore.indexes.json` - Composite indexes
- `/firebase/firestore.rules` - Security rules

### Tests

- `/tests/unit/services/conversationService.test.ts` - Conversation service tests
- `/tests/unit/services/messageService.test.ts` - Message service tests
- `/tests/rules/firestore.test.ts` - Security rules tests

---

## Deployment

### Deploy Indexes

```bash
firebase deploy --only firestore:indexes
```

### Deploy Security Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Both

```bash
firebase deploy --only firestore:indexes,firestore:rules
```

---

## References

- [Firestore Data Model Best Practices](https://firebase.google.com/docs/firestore/data-model)
- [Firestore Pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [TypeScript Interfaces](../architecture/coding-standards.md)
- [Service Layer Pattern](../architecture/backend-architecture.md)

---

**Document Status**: ✅ Implemented and Deployed
**Last Reviewed**: 2025-10-21
**Next Review**: When adding Phase 2 AI features
