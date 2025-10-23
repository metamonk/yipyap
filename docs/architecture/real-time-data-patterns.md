# Real-Time Data Patterns & Race Condition Prevention

## Core Principle

**Fix race conditions through sequencing, not error suppression.**

When working with real-time listeners and asynchronous data flows, always **prevent** race conditions by properly sequencing operations rather than suppressing errors after they occur.

---

## Background

This architectural principle emerged from debugging a production issue in `hooks/useGlobalMessageListener.ts` where permission-denied errors were occurring when setting up message listeners for newly created conversations.

### The Problem

When a user creates a new conversation:
1. Conversation document is created locally and synced to Firestore
2. Real-time conversation listener immediately receives the new conversation
3. Message listener tries to attach to the conversation's messages subcollection
4. **ERROR**: Firestore throws `permission-denied` because the conversation hasn't fully propagated server-side yet

### Wrong Approach ❌

```typescript
// BAD: Suppressing the error after it occurs
try {
  // Set up message listener for ALL conversations
  const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    // Process messages...
  }, (error) => {
    // Suppress permission-denied errors
    if (error.code === 'permission-denied') {
      console.log('Ignoring permission error for new conversation');
      return; // Silently ignore
    }
  });
} catch (error) {
  // Handle error reactively
}
```

**Why this is wrong:**
- Hides real permission issues
- Obscures the root cause
- Creates unreliable behavior
- Masks security problems

### Correct Approach ✓

```typescript
// GOOD: Preventing the race condition through sequencing
for (const conversation of conversations) {
  // Skip newly created conversations without any messages yet
  // This prevents race conditions where the conversation document exists locally
  // but hasn't propagated to the server, causing permission errors when
  // trying to set up message listeners that require reading the parent document
  if (!conversation.lastMessageTimestamp) {
    return; // No messages yet, nothing to listen to
  }

  // NOW it's safe to set up the listener
  const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
    // Process messages...
  });
}
```

**Why this is correct:**
- Prevents the error from ever occurring
- Clearly documents the sequencing requirement
- No performance impact from error handling
- Reliable and predictable behavior
- Real permission issues will still surface appropriately

---

## Architectural Guidelines

### 1. Identify the Data Dependency

Before setting up any real-time listener, ask:
- What data must exist for this listener to work?
- What fields indicate that prerequisite data exists?
- Can I check for this before creating the listener?

### 2. Check Prerequisites Before Subscribing

```typescript
// Example: Message listener requires conversation with messages
if (!conversation.lastMessageTimestamp) {
  // Conversation has no messages yet - skip listener setup
  return;
}

// Example: Presence aggregation requires device data
if (!userPresence.devices || Object.keys(userPresence.devices).length === 0) {
  // No device data to aggregate yet
  return;
}

// Example: Group chat requires minimum participants
if (conversation.participantIds.length < 2) {
  // Incomplete conversation - wait for participants
  return;
}
```

### 3. Document the Sequencing Requirement

Always add comments explaining WHY you're checking the prerequisite:

```typescript
// Skip newly created conversations without any messages yet
// This prevents race conditions where the conversation document exists locally
// but hasn't propagated to the server, causing permission errors when
// trying to set up message listeners that require reading the parent document
if (!conversation.lastMessageTimestamp) {
  return;
}
```

---

## Common Race Condition Patterns

### Pattern 1: Parent-Child Document Propagation

**Scenario:** Parent document created, child collection listener attached immediately

**Problem:** Child collection may not be readable until parent document fully propagates

**Solution:** Check parent document has relevant child data before subscribing

```typescript
// Before (BAD)
const messagesRef = collection(db, 'conversations', convId, 'messages');
const unsubscribe = onSnapshot(messagesRef, handleMessages);

// After (GOOD)
if (conversation.lastMessageTimestamp) {
  const messagesRef = collection(db, 'conversations', convId, 'messages');
  const unsubscribe = onSnapshot(messagesRef, handleMessages);
}
```

### Pattern 2: Aggregate Data Race Conditions

**Scenario:** Aggregating data from multiple sources that update independently

**Problem:** Reading partial data can corrupt aggregate state

**Solution:** Read all source data first, then aggregate atomically

```typescript
// Before (BAD) - Story 2.12 bug
async function updateAggregatedPresence(userId: string) {
  const userPresenceRef = ref(rtdb, `presence/${userId}`);

  // BUG: This overwrites all device data!
  await update(userPresenceRef, {
    devices: {} // ❌ Destructive
  });
}

// After (GOOD) - Proper sequencing
async function updateAggregatedPresence(userId: string) {
  const userPresenceRef = ref(rtdb, `presence/${userId}`);

  // 1. READ all device data first
  const snapshot = await get(userPresenceRef);
  const currentDevices = snapshot.val()?.devices || {};

  // 2. AGGREGATE the data
  const isOnline = Object.values(currentDevices).some(d => d.status === 'online');

  // 3. WRITE the aggregated result (preserving device data)
  await update(userPresenceRef, {
    status: isOnline ? 'online' : 'offline',
    lastSeen: isOnline ? null : Date.now()
    // ✓ Devices data preserved
  });
}
```

### Pattern 3: Multi-Step Operations

**Scenario:** Operation requires multiple sequential steps

**Problem:** Later steps fail if earlier steps haven't completed

**Solution:** Wait for each step to complete before proceeding

```typescript
// Before (BAD)
async function createConversationWithMessage(userId: string, text: string) {
  // Create conversation
  const convId = await createConversation([userId, otherUserId]);

  // Send message immediately (race condition!)
  await sendMessage(convId, text); // May fail - conversation not propagated
}

// After (GOOD)
async function createConversationWithMessage(userId: string, text: string) {
  // 1. Create conversation
  const convId = await createConversation([userId, otherUserId]);

  // 2. Wait for conversation to propagate by fetching it
  let conversation = null;
  for (let i = 0; i < 3 && !conversation; i++) {
    conversation = await getConversation(convId);
    if (!conversation) await delay(100 * Math.pow(2, i));
  }

  if (!conversation) throw new Error('Conversation creation timeout');

  // 3. NOW safe to send message
  await sendMessage(convId, text);
}
```

---

## Anti-Patterns to Avoid

### ❌ Silent Error Suppression

```typescript
// DON'T DO THIS
onSnapshot(query, handleData, (error) => {
  if (error.code === 'permission-denied') {
    return; // Silently ignore - BAD!
  }
});
```

**Why it's bad:** Hides real permission issues and security problems

### ❌ Retry Loops for Race Conditions

```typescript
// DON'T DO THIS
async function setupListener() {
  for (let i = 0; i < 5; i++) {
    try {
      onSnapshot(query, handleData);
      return; // Success
    } catch (error) {
      if (error.code === 'permission-denied') {
        await delay(1000); // Wait and retry - BAD!
        continue;
      }
      throw error;
    }
  }
}
```

**Why it's bad:**
- Wastes resources with unnecessary retries
- Doesn't address the root cause
- Adds unpredictable latency
- Use retries for NETWORK failures, not race conditions

### ❌ Catch-All Error Handlers

```typescript
// DON'T DO THIS
try {
  onSnapshot(query, handleData);
} catch (error) {
  console.log('Something went wrong, ignoring...'); // BAD!
}
```

**Why it's bad:** Obscures all errors, including real bugs

---

## When to Use Retry Logic

Retry logic IS appropriate for **transient network failures**, NOT for race conditions:

```typescript
// GOOD use of retry logic (Story 2.9 pattern)
async function sendMessageWithRetry(convId: string, text: string) {
  const retryConfig = {
    maxRetries: 3,
    backoff: 'exponential',
    retryOn: ['unavailable', 'deadline-exceeded', 'cancelled'] // Network errors
  };

  for (let attempt = 0; attempt < retryConfig.maxRetries; attempt++) {
    try {
      await sendMessage(convId, text);
      return; // Success
    } catch (error) {
      if (isNetworkError(error) && attempt < retryConfig.maxRetries - 1) {
        await delay(1000 * Math.pow(2, attempt)); // Exponential backoff
        continue;
      }
      throw error; // Non-network error or max retries reached
    }
  }
}

function isNetworkError(error: any): boolean {
  const networkCodes = ['unavailable', 'deadline-exceeded', 'cancelled'];
  return networkCodes.includes(error.code);
}
```

**Key Difference:**
- **Retry logic**: Handles transient network failures (503, timeout, etc.)
- **Sequencing**: Prevents race conditions from occurring in the first place

---

## Testing Race Conditions

### Unit Tests

```typescript
describe('useGlobalMessageListener', () => {
  it('should skip conversations without lastMessageTimestamp', () => {
    const conversations = [
      { id: 'conv1', lastMessageTimestamp: null }, // Skip this
      { id: 'conv2', lastMessageTimestamp: Timestamp.now() } // Listen to this
    ];

    const { result } = renderHook(() => useGlobalMessageListener(conversations));

    // Verify listener only set up for conv2
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ conversationId: 'conv2' }),
      expect.any(Function)
    );
  });
});
```

### Integration Tests

```typescript
describe('Conversation creation race condition', () => {
  it('should not set up message listener until conversation has messages', async () => {
    // 1. Create conversation (no messages yet)
    const convId = await createConversation(['user1', 'user2']);

    // 2. Verify no message listener is set up
    const conversation = await getConversation(convId);
    expect(conversation.lastMessageTimestamp).toBeNull();

    // 3. Send first message
    await sendMessage(convId, 'First message');

    // 4. NOW conversation should have lastMessageTimestamp
    const updatedConversation = await getConversation(convId);
    expect(updatedConversation.lastMessageTimestamp).not.toBeNull();

    // 5. NOW message listener can be safely set up
    const unsubscribe = subscribeToMessages(convId, handleMessages);
    expect(unsubscribe).toBeDefined();
  });
});
```

---

## Migration Checklist

When updating code to follow this principle:

- [ ] Identify all real-time listeners (onSnapshot, RTDB listeners)
- [ ] Document what data must exist before listener setup
- [ ] Add prerequisite checks before subscribing
- [ ] Add clear comments explaining the sequencing requirement
- [ ] Remove error suppression for permission-denied (if used to hide race conditions)
- [ ] Add unit tests verifying prerequisite checks
- [ ] Add integration tests for the happy path
- [ ] Update related stories/documentation

---

## Related Patterns

- **Defensive Programming**: Check preconditions before operations
- **Fail-Fast**: Let real errors surface immediately
- **Idempotency**: Design operations to be safely retryable
- **Circuit Breaker**: Different pattern for handling cascading failures

---

## References

- Original fix: `hooks/useGlobalMessageListener.ts` (lines 90-96)
- Context document: `.ai/story-consistency-request.md`
- Related story: Story 2.12 (Presence System - contains similar bug)
- Related story: Story 2.9 (Read Receipt Reliability - correct use of retry logic)
