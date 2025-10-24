# Firestore Query Optimization

## Overview

This document describes the query optimization strategies implemented in the yipyap messaging app to minimize Firestore read/write costs while maintaining excellent performance.

**Last Updated**: 2025-10-23
**Story**: 4.8 - Firestore Query Optimization for Cost Efficiency

## Table of Contents

- [Query Patterns](#query-patterns)
- [Pagination Strategy](#pagination-strategy)
- [Offline Persistence](#offline-persistence)
- [Composite Indexes](#composite-indexes)
- [Real-Time Listener Scoping](#real-time-listener-scoping)
- [Unread Count Management](#unread-count-management)
- [Caching Strategy](#caching-strategy)
- [Cost Monitoring](#cost-monitoring)
- [Best Practices](#best-practices)

---

## Query Patterns

### Conversation List Query

**Location**: `services/conversationService.ts:getUserConversations()`

**Optimizations**:
- ✅ Uses `limit(30)` to fetch only most recent conversations
- ✅ Cursor-based pagination with `startAfter(lastVisible)`
- ✅ Returns `GetConversationsResult` with pagination metadata
- ✅ Client-side filtering for archived/deleted conversations

**Query Structure**:
```typescript
query(
  conversationsRef,
  where('participantIds', 'array-contains', userId),
  orderBy('lastMessageTimestamp', 'desc'),
  limit(30)
)
```

**Pagination**:
```typescript
// First page
const result = await getUserConversations(userId, 30);

// Next page
const nextResult = await getUserConversations(userId, 30, result.lastDoc);
```

**Cost Impact**: Reduces initial load from potentially hundreds of conversations to just 30 documents.

---

### Message Query

**Location**: `services/messageService.ts:getMessages()`

**Optimizations**:
- ✅ Uses `limit(50)` for initial message load
- ✅ Cursor-based pagination with `startAfter(lastVisible)`
- ✅ Returns `GetMessagesResult` with pagination metadata
- ✅ Subcollection scoping (per conversation)

**Query Structure**:
```typescript
query(
  messagesRef, // /conversations/{conversationId}/messages
  orderBy('timestamp', 'desc'),
  limit(50)
)
```

**Cost Impact**: Loads 50 messages per page instead of entire conversation history (which could be thousands).

---

## Pagination Strategy

### Why Cursor-Based Pagination?

We use Firestore's cursor-based pagination instead of offset pagination for several reasons:

1. **Cost Efficiency**: Skip billed reads for documents that aren't needed
2. **Performance**: O(1) complexity vs O(n) for offset pagination
3. **Consistency**: Results remain consistent even as data changes

### Implementation Pattern

All paginated queries follow this pattern:

```typescript
export interface GetConversationsResult {
  conversations: Conversation[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export async function getUserConversations(
  userId: string,
  pageSize: number = 30,
  lastVisible?: QueryDocumentSnapshot<DocumentData> | null
): Promise<GetConversationsResult> {
  let q = query(/* ... */, limit(pageSize));

  if (lastVisible) {
    q = query(/* ... */, startAfter(lastVisible), limit(pageSize));
  }

  const snapshot = await getDocs(q);
  const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
  const hasMore = snapshot.docs.length === pageSize;

  return { conversations, lastDoc, hasMore };
}
```

### Page Sizes

| Query Type | Page Size | Rationale |
|------------|-----------|-----------|
| Conversations | 30 | Fits 1-2 screens, quick initial load |
| Messages | 50 | Good balance for chat history |
| User Search | 20 | Sufficient for search results |

---

## Offline Persistence

### Configuration

**Location**: `services/firebase.ts:initializeFirebase()`

Firestore offline persistence is enabled using:

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
```

### Benefits

1. **Reduced Reads**: Cached queries don't count as billable reads
2. **Faster Load Times**: Data served from local storage
3. **Offline Support**: App works without network connection
4. **Write Queueing**: Offline writes automatically sync when online

### Offline Behavior

- **Reads**: Cache-first strategy - checks local cache before network
- **Writes**: Queued locally and synced when connection restored
- **Real-time Listeners**: Automatically reconnect and sync
- **Cache Persistence**: Survives app restarts

### Cache Invalidation

Firestore automatically handles cache invalidation:
- Real-time listeners keep cache up to date
- Server timestamp resolution on reconnection
- Automatic conflict resolution

---

## Composite Indexes

### Required Indexes

**Location**: `firebase/firestore.indexes.json`

#### 1. Conversation List Index

```json
{
  "collectionGroup": "conversations",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "participantIds",
      "arrayConfig": "CONTAINS"
    },
    {
      "fieldPath": "lastMessageTimestamp",
      "order": "DESCENDING"
    }
  ]
}
```

**Purpose**: Enables efficient query for user's conversations sorted by recency

**Query Pattern**:
```typescript
where('participantIds', 'array-contains', userId)
orderBy('lastMessageTimestamp', 'desc')
```

#### 2. Message Subcollection Index

**Status**: ✅ Automatic indexing

Messages are stored in subcollections and use automatic single-field indexing:

- Path: `/conversations/{conversationId}/messages`
- Query: `orderBy('timestamp', 'desc')`
- Index: Automatically created by Firestore

**Why no explicit index?**
- Messages queried within subcollection scope (conversationId implicit in path)
- Single-field `orderBy` uses automatic indexing
- Firestore creates single-field indexes automatically

### Deploying Indexes

```bash
# Deploy indexes to Firestore
firebase deploy --only firestore:indexes

# Check index build status
# Firebase Console > Firestore > Indexes
```

**Important**: Indexes can take several minutes to build. Monitor in Firebase Console.

---

## Real-Time Listener Scoping

### Conversation Listener

**Location**: `services/conversationService.ts:subscribeToConversations()`

**Scoping Strategy**: Client-side filtering (Option A)

```typescript
const q = query(
  conversationsRef,
  where('participantIds', 'array-contains', userId),
  orderBy('lastMessageTimestamp', 'desc'),
  limit(30)  // ✅ Scoped to 30 most recent
);

onSnapshot(q, (snapshot) => {
  const conversations = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Client-side filter archived/deleted
    if (!data.deletedBy[userId] && !data.archivedBy[userId]) {
      conversations.push(data);
    }
  });
  callback(conversations);
});
```

### Message Listener

**Location**: `services/messageService.ts:subscribeToMessages()`

**Scoping**:
- ✅ Limited to single conversation (subcollection path)
- ✅ Uses `limit(pageSize)` (default 50)
- ✅ Only subscribes to visible messages

### Why Client-Side Filtering?

**Decision**: Use client-side filtering for archived/deleted conversations

**Rationale**:
- **Simpler**: No additional composite indexes needed
- **Flexible**: Easy to change filtering logic
- **Cost Tradeoff**: Slightly higher read cost vs significantly less complex

**Alternative**: Server-side filtering with additional where() clauses
```typescript
// Option B (not implemented)
where('participantIds', 'array-contains', userId),
where(`deletedBy.${userId}`, '==', false),
where(`archivedBy.${userId}`, '==', false)
```

**Migration Path**: If archived conversation updates become a cost issue, migrate to Option B with proper indexing.

---

## Unread Count Management

### Efficient Increment Pattern

**Location**: `services/conversationService.ts:updateConversationLastMessage()`

**Strategy**: Use Firestore's atomic `increment()` operation

```typescript
import { increment } from 'firebase/firestore';

// Increment unread count for recipients
const unreadCountUpdates: Record<string, ReturnType<typeof increment>> = {};
for (const participantId of participantIds) {
  if (participantId !== senderId) {
    unreadCountUpdates[`unreadCount.${participantId}`] = increment(1);
  }
}

await updateDoc(conversationRef, {
  lastMessage,
  lastMessageTimestamp: lastMessage.timestamp,
  ...unreadCountUpdates,
});
```

### Read Receipt Pattern

**Location**: `services/conversationService.ts:markConversationAsRead()`

```typescript
await updateDoc(conversationRef, {
  [`unreadCount.${userId}`]: 0,
  updatedAt: serverTimestamp(),
});
```

### Why This Matters

| Approach | Complexity | Firestore Reads | Write Operations |
|----------|-----------|-----------------|------------------|
| ❌ Count messages | O(n) | n (all unread messages) | 1 |
| ✅ Atomic increment | O(1) | 0 | 1 |

**Cost Savings**: For a conversation with 100 unread messages:
- Counting approach: 100 reads + 1 write
- Increment approach: 0 reads + 1 write

**Benefit**: 100x reduction in read costs for unread count updates.

---

## Caching Strategy

### Multi-Layer Caching

#### 1. Firestore Offline Cache

**Level**: Database layer
**Scope**: All Firestore queries
**TTL**: Automatic (managed by Firestore SDK)

**Coverage**:
- Conversation list
- Message history
- User profiles
- All Firestore documents

#### 2. User Profile Cache

**Location**: `services/userCacheService.ts`
**Level**: Application layer
**Scope**: User documents including photoURL

**Features**:
- In-memory Map cache
- 5-minute TTL for search results
- Session-based cache for active users
- Automatic invalidation on logout

**Usage**:
```typescript
import { userCacheService } from '@/services/userCacheService';

// Search with caching
const users = await userCacheService.searchUsers('john');

// Get cached user
const cachedUser = userCacheService.getCachedUser(userId);

// Manual invalidation
userCacheService.invalidateCache();
```

**Cache Hits**: Prevents redundant Firestore reads for:
- Repeated user searches
- Profile displays in message lists
- Participant avatars in conversations

#### 3. Firebase Storage CDN

**Level**: Network/CDN layer
**Scope**: Profile photos and media

**Coverage**:
- Profile photos cached by Firebase CDN
- React Native Image component has native caching
- User photoURL cached in userCacheService (prevents Firestore read)

### Cache Invalidation Strategy

| Cache Layer | Invalidation Trigger |
|-------------|---------------------|
| Firestore Offline | Real-time listeners |
| User Profile Cache | User logout, manual refresh |
| CDN/Image Cache | Native cache management |

---

## Cost Monitoring

### Firebase Console Setup

1. **Access**: [Firebase Console](https://console.firebase.google.com) > Project Settings > Usage and billing

2. **Budget Alerts**:
   - Set monthly budget threshold
   - Configure alerts at 50%, 75%, 90%, 100%
   - Add team email addresses

3. **Daily Monitoring**:
   - Check Firestore dashboard daily
   - Compare reads/writes to baseline
   - Investigate spikes or anomalies

### Baseline Metrics

Establish baseline metrics after optimization:

| Metric | Development Target | Production Target |
|--------|-------------------|-------------------|
| Daily Reads | TBD | TBD |
| Daily Writes | TBD | TBD |
| Monthly Cost | < $10 | Adjust based on scale |

**Action**: Document actual baseline metrics after deployment

### Cost Optimization Targets

- **50% reduction** in reads through pagination and caching
- **Efficient writes** through batch operations
- **Budget buffer** for unexpected usage spikes

### Monitoring Workflow

```bash
# Daily checks
1. Open Firebase Console > Firestore > Usage
2. Compare daily reads/writes to baseline
3. Check for anomalies or spikes
4. Review budget alert emails

# Weekly review
1. Analyze usage trends
2. Calculate cost per active user
3. Adjust optimizations if needed
```

---

## Best Practices

### When Writing New Queries

✅ **DO**:
- Always use `limit()` for list queries
- Implement cursor-based pagination for large datasets
- Use subcollections for hierarchical data (messages under conversations)
- Leverage offline persistence (it's already enabled)
- Use `increment()` for counters
- Batch related writes with `writeBatch()`

❌ **DON'T**:
- Query without limits ("give me all conversations")
- Use offset pagination (`startAt(1000)`)
- Scan collections to count documents
- Read documents just to check existence (use lightweight queries)
- Create one listener per item (batch subscriptions)

### Query Optimization Checklist

When adding a new query, verify:

- [ ] Query uses `limit()` with appropriate page size
- [ ] Pagination implemented if dataset can grow large
- [ ] Composite index exists (check `firestore.indexes.json`)
- [ ] Real-time listeners are scoped appropriately
- [ ] Consider using subcollections for nested data
- [ ] Cache results when appropriate
- [ ] Test query performance with large datasets

### Index Management

```bash
# Before deploying new queries
1. Add required indexes to firebase/firestore.indexes.json
2. Deploy indexes: firebase deploy --only firestore:indexes
3. Wait for index build completion (check Firebase Console)
4. Test queries in production

# Index creation time
- Simple indexes: < 1 minute
- Complex indexes: Several minutes
- Large datasets: Up to hours
```

### Performance Targets

From architecture requirements (NFR7):

| Operation | Target (P95) | Optimization Strategy |
|-----------|-------------|----------------------|
| Message delivery | < 500ms | Real-time listeners + offline cache |
| Conversation list load | < 1s | Limit(30) + pagination + cache |
| Message history load | < 1s | Limit(50) + pagination + cache |

---

## Code Examples

### Example 1: Paginated Conversation List

```typescript
import { getUserConversations, GetConversationsResult } from '@/services/conversationService';

async function loadConversations() {
  // Load first page
  const firstPage: GetConversationsResult = await getUserConversations(userId, 30);

  console.log(`Loaded ${firstPage.conversations.length} conversations`);
  console.log(`Has more: ${firstPage.hasMore}`);

  // Load next page if available
  if (firstPage.hasMore && firstPage.lastDoc) {
    const secondPage = await getUserConversations(userId, 30, firstPage.lastDoc);
    console.log(`Loaded ${secondPage.conversations.length} more conversations`);
  }
}
```

### Example 2: Real-Time Listener with Scoping

```typescript
import { subscribeToConversations } from '@/services/conversationService';

function ConversationListComponent({ userId }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    // Subscribe to 30 most recent conversations
    const unsubscribe = subscribeToConversations(
      userId,
      (updatedConversations) => {
        setConversations(updatedConversations);
      },
      30  // pageSize
    );

    return () => unsubscribe();
  }, [userId]);

  return (/* render conversations */);
}
```

### Example 3: Efficient Unread Count Update

```typescript
import { increment, updateDoc } from 'firebase/firestore';

async function sendMessageAndUpdateUnread(
  conversationId: string,
  message: Message,
  participantIds: string[]
) {
  // Send message
  await addDoc(messagesRef, message);

  // Update conversation with atomic increment
  const unreadUpdates: Record<string, any> = {};
  for (const participantId of participantIds) {
    if (participantId !== message.senderId) {
      unreadUpdates[`unreadCount.${participantId}`] = increment(1);
    }
  }

  await updateDoc(conversationRef, {
    lastMessage: {
      text: message.text,
      senderId: message.senderId,
      timestamp: message.timestamp,
    },
    lastMessageTimestamp: message.timestamp,
    ...unreadUpdates,
  });
}
```

---

## Cost Analysis

### Read Costs

**Pricing**: $0.06 per 100K document reads

**Estimated reads per active user per day**:

| Operation | Reads per Day | Notes |
|-----------|---------------|-------|
| Conversation list load | 30 | Initial load with limit(30) |
| Conversation list refresh | 10 | Pull-to-refresh (cached mostly) |
| Message history | 50 × 3 = 150 | 3 conversations opened |
| Real-time updates | 20 | New messages received |
| User profile lookups | 5 | Cached after first load |
| **Total** | **215** | Per active user |

**Monthly cost** (1000 active users):
- Reads: 1000 × 215 × 30 = 6.45M reads
- Cost: 6.45M / 100K × $0.06 = **$3.87/month**

### Without Optimization

| Operation | Reads | Increase |
|-----------|-------|----------|
| Load all conversations | 200+ | 6.7x |
| Load all messages | 500+ | 3.3x |
| No caching | 2x | 2x |
| **Total impact** | **~40x** | **$150+/month** |

**Savings**: ~$146/month (97% reduction) for 1000 active users

---

## Troubleshooting

### Issue: "Missing Index" Error

**Symptom**: Query fails with error about missing composite index

**Solution**:
1. Check error message for required index structure
2. Add index to `firebase/firestore.indexes.json`
3. Deploy: `firebase deploy --only firestore:indexes`
4. Wait for index build in Firebase Console

### Issue: Slow Query Performance

**Diagnosis**:
1. Check if query uses appropriate `limit()`
2. Verify composite index is built (Firebase Console)
3. Check network conditions (offline persistence helps)
4. Use Firebase Performance Monitoring

**Solutions**:
- Add `limit()` to unbounded queries
- Ensure indexes are deployed and built
- Use pagination for large datasets
- Enable offline persistence (already enabled)

### Issue: High Read Costs

**Investigation**:
1. Check Firebase Console > Firestore > Usage
2. Identify queries with high read counts
3. Review real-time listener scoping
4. Check for redundant queries

**Solutions**:
- Add pagination to list queries
- Scope real-time listeners with `limit()`
- Implement caching (userCacheService pattern)
- Use subcollections for nested data

---

## Related Documentation

- [Architecture: Backend Architecture](./backend-architecture.md)
- [Architecture: Security and Performance](./security-and-performance.md)
- [Architecture: Database Schema](./database-schema.md)
- [Data Models](./data-models.md)

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-10-23 | 1.0 | Initial documentation for Story 4.8 | James (Dev Agent) |

---

**Questions or Issues?** Contact the development team or refer to Firebase documentation.
