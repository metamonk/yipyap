# Bulk Operations Guide

## Overview

The Bulk Operations Service provides efficient batch operations for managing multiple conversations and messages at once. All operations include progress tracking, error handling, and atomic transaction support.

## Service Import

```typescript
import { bulkOperationsService } from '@/services/bulkOperationsService';
import type { BulkOperationResult, ProgressCallback } from '@/services/bulkOperationsService';
```

## Available Operations

### 1. Archive All Read Conversations

Archive all conversations where all messages have been read by the user.

**Use Cases:**
- Clean up inbox at end of day
- Archive completed conversations
- Reduce conversation list clutter

**Method Signature:**

```typescript
async archiveAllRead(
  userId: string,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult>
```

**Example:**

```typescript
// With progress tracking
const result = await bulkOperationsService.archiveAllRead(
  userId,
  (current, total, percentage) => {
    console.log(`Archiving: ${percentage}% complete (${current}/${total})`);
    // Update progress bar UI
    setProgress(percentage);
  }
);

if (result.completed) {
  console.log(`Successfully archived ${result.successCount} conversations`);
} else {
  console.log(`Failed: ${result.failureCount} conversations`);
  console.error('Errors:', result.errors);
}
```

**Without progress tracking:**

```typescript
const result = await bulkOperationsService.archiveAllRead(userId);
console.log(`Archived ${result.successCount} conversations`);
```

**How It Works:**

1. Query all conversations where user is a participant
2. For each conversation, check if all messages are read
3. Filter to only fully-read conversations
4. Batch update in groups of 500 (Firestore limit)
5. Set `archivedBy` array field for each conversation
6. Return result with success/failure counts

**Performance:**
- Processes 500 conversations per batch
- Typical operation: 1-2 seconds for 100 conversations
- Network-bound (depends on Firestore latency)

### 2. Mark Conversations as Spam

Mark multiple conversations as spam and optionally block senders.

**Use Cases:**
- Bulk spam cleanup
- Block abusive senders
- Report coordinated spam attacks

**Method Signature:**

```typescript
async markAsSpam(
  userId: string,
  conversationIds: string[],
  blockSenders: boolean = false,
  onProgress?: ProgressCallback
): Promise<BulkOperationResult>
```

**Example:**

```typescript
// Mark specific conversations as spam and block senders
const conversationIds = ['conv1', 'conv2', 'conv3'];
const result = await bulkOperationsService.markAsSpam(
  userId,
  conversationIds,
  true, // blockSenders
  (current, total, percentage) => {
    console.log(`Marking spam: ${percentage}% complete`);
  }
);

console.log(`Marked ${result.successCount} as spam`);
console.log(`Blocked ${result.successCount} senders`);
```

**Without blocking senders:**

```typescript
const result = await bulkOperationsService.markAsSpam(
  userId,
  conversationIds,
  false // Don't block senders
);
```

**How It Works:**

1. Validate user is participant in all specified conversations
2. Batch update in groups of 500
3. Set `spam: true` on each conversation
4. If `blockSenders: true`, add sender IDs to user's blocked list
5. Return result with success/failure counts

**Performance:**
- Processes 500 conversations per batch
- Typical operation: 1-2 seconds for 100 conversations
- Network-bound (depends on Firestore latency)

**Security:**
- Users can only mark conversations they're participants in
- Firestore security rules enforce participant validation
- Blocked users stored in `users/{userId}/blockedUsers` array

## Operation Result Format

All bulk operations return a consistent result object:

```typescript
interface BulkOperationResult {
  /** Total number of items processed */
  totalProcessed: number;

  /** Number of items successfully updated */
  successCount: number;

  /** Number of items that failed to update */
  failureCount: number;

  /** Array of error messages for failed operations */
  errors: string[];

  /** Whether the entire operation completed successfully */
  completed: boolean;
}
```

**Example Result:**

```json
{
  "totalProcessed": 100,
  "successCount": 98,
  "failureCount": 2,
  "errors": [
    "Conversation conv42: User not a participant",
    "Conversation conv87: Document not found"
  ],
  "completed": true
}
```

**Success Criteria:**
- `completed: true` - Operation finished (even if some items failed)
- `completed: false` - Operation was interrupted (network error, timeout)

## Progress Tracking

All operations support optional progress callbacks for real-time UI updates.

**Progress Callback Type:**

```typescript
type ProgressCallback = (
  current: number,    // Items processed so far
  total: number,      // Total items to process
  percentage: number  // Percentage complete (0-100)
) => void;
```

**Example UI Integration:**

```typescript
import { useState } from 'react';

function BulkArchiveButton() {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleArchive() {
    setIsProcessing(true);

    const result = await bulkOperationsService.archiveAllRead(
      userId,
      (current, total, percentage) => {
        setProgress(percentage);
      }
    );

    setIsProcessing(false);
    setProgress(0);

    if (result.completed) {
      Alert.alert('Success', `Archived ${result.successCount} conversations`);
    }
  }

  return (
    <View>
      <Button
        title={isProcessing ? 'Archiving...' : 'Archive All Read'}
        onPress={handleArchive}
        disabled={isProcessing}
      />
      {isProcessing && (
        <ProgressBar progress={progress / 100} />
      )}
    </View>
  );
}
```

## Error Handling

All operations use comprehensive error handling with detailed error messages.

### Handling Errors

```typescript
const result = await bulkOperationsService.archiveAllRead(userId);

if (result.failureCount > 0) {
  console.error(`${result.failureCount} conversations failed to archive`);
  result.errors.forEach((error, index) => {
    console.error(`Error ${index + 1}: ${error}`);
  });

  // Show error summary to user
  Alert.alert(
    'Partial Success',
    `Archived ${result.successCount} conversations. ${result.failureCount} failed.`
  );
}
```

### Common Error Scenarios

**1. User Not a Participant:**

```
Error: Conversation conv123: User not a participant
```

**Cause:** User attempting to modify conversation they're not part of
**Solution:** Filter conversations to only those where user is participant

**2. Network Timeout:**

```typescript
try {
  const result = await bulkOperationsService.archiveAllRead(userId);
} catch (error) {
  if (error.code === 'unavailable') {
    Alert.alert('Network Error', 'Please check your connection and try again');
  }
}
```

**3. Permission Denied:**

```
Error: Conversation conv456: Permission denied
```

**Cause:** Firestore security rules blocking write access
**Solution:** Verify user authentication and security rules

## Atomic Operations

Operations use Firestore batched writes for atomicity within each batch.

### Batch Size

All operations use a maximum batch size of **500 documents** (Firestore limit).

For operations affecting >500 conversations:
- Split into multiple batches of 500
- Each batch is atomic (all succeed or all fail)
- Failures in one batch don't affect other batches

**Example:**

```typescript
// Archiving 1,200 conversations
// Batch 1: 500 conversations (atomic)
// Batch 2: 500 conversations (atomic)
// Batch 3: 200 conversations (atomic)

const result = await bulkOperationsService.archiveAllRead(userId);
// result.totalProcessed = 1200
// If Batch 2 fails, Batches 1 and 3 still succeed
```

### Rollback Behavior

**Within a batch:**
- If any write fails, entire batch rolls back
- All-or-nothing guarantee within 500 documents

**Across batches:**
- No automatic rollback between batches
- Previous batches remain committed
- Result object reports partial success

**Manual rollback:**

```typescript
const result = await bulkOperationsService.archiveAllRead(userId);

if (result.failureCount > 0 && result.successCount > 0) {
  // Partial success - decide whether to rollback successful batches
  const shouldRollback = await confirmRollback();

  if (shouldRollback) {
    // Implement custom rollback logic
    await undoArchive(userId, successfulConversationIds);
  }
}
```

## Performance Optimization

### Parallel Execution

For maximum performance, run independent operations in parallel:

```typescript
// Archive read conversations AND mark spam simultaneously
const [archiveResult, spamResult] = await Promise.all([
  bulkOperationsService.archiveAllRead(userId),
  bulkOperationsService.markAsSpam(userId, spamConversationIds, true),
]);

console.log(`Archived: ${archiveResult.successCount}`);
console.log(`Marked spam: ${spamResult.successCount}`);
```

### Caching

Query results are not cached - each operation queries Firestore fresh.

**Optimization strategy:**

```typescript
// Instead of running archiveAllRead multiple times:
// ❌ Bad
await bulkOperationsService.archiveAllRead(userId);
await bulkOperationsService.archiveAllRead(userId); // Redundant

// ✅ Good - run once
const result = await bulkOperationsService.archiveAllRead(userId);
if (result.completed) {
  // Success - no need to retry
}
```

### Firestore Reads vs Writes

**Archive All Read:**
- Reads: 1 per conversation (to check read status)
- Writes: 1 per archived conversation

**Mark as Spam:**
- Reads: 1 per conversation (to verify participant)
- Writes: 1 per conversation + 1 for user's blocked list

**Cost estimation:**

```typescript
// 100 conversations archived
// Reads: 100
// Writes: 100
// Total operations: 200
// Firestore cost: ~$0.0006 (reads) + ~$0.0018 (writes) = ~$0.0024
```

## Integration with Quick Actions

The dashboard's Quick Actions panel uses bulk operations:

**Quick Actions Component:**

```typescript
import { bulkOperationsService } from '@/services/bulkOperationsService';

function QuickActions({ userId }: { userId: string }) {
  const [archiveProgress, setArchiveProgress] = useState(0);

  async function handleArchiveAll() {
    const result = await bulkOperationsService.archiveAllRead(
      userId,
      (current, total, percentage) => {
        setArchiveProgress(percentage);
      }
    );

    if (result.completed) {
      Alert.alert('Success', `Archived ${result.successCount} conversations`);
    }
  }

  return (
    <View>
      <Button title="Archive All Read" onPress={handleArchiveAll} />
      {archiveProgress > 0 && <ProgressBar value={archiveProgress} />}
    </View>
  );
}
```

## Testing

Comprehensive test coverage ensures reliability:

### Unit Tests

```typescript
describe('BulkOperationsService', () => {
  it('should archive all read conversations', async () => {
    const result = await bulkOperationsService.archiveAllRead('user123');
    expect(result.completed).toBe(true);
    expect(result.successCount).toBeGreaterThan(0);
  });

  it('should mark conversations as spam', async () => {
    const result = await bulkOperationsService.markAsSpam(
      'user123',
      ['conv1', 'conv2'],
      true
    );
    expect(result.successCount).toBe(2);
  });

  it('should handle errors gracefully', async () => {
    const result = await bulkOperationsService.archiveAllRead('invalid-user');
    expect(result.failureCount).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
describe('Bulk Operations Integration', () => {
  it('should archive conversations end-to-end', async () => {
    // Setup: Create conversations with read messages
    const conversations = await createTestConversations(5);
    await markAllMessagesAsRead(userId, conversations);

    // Execute
    const result = await bulkOperationsService.archiveAllRead(userId);

    // Verify
    expect(result.successCount).toBe(5);
    const archived = await getArchivedConversations(userId);
    expect(archived.length).toBe(5);
  });
});
```

## Security Considerations

All bulk operations enforce strict security rules:

**Firestore Security Rules:**

```javascript
match /conversations/{conversationId} {
  // Users can only modify conversations they're participants in
  allow update: if request.auth.uid in resource.data.participantIds;

  // Prevent unauthorized archiving
  allow update: if request.auth.uid in request.resource.data.archivedBy;
}
```

**Client-Side Validation:**

```typescript
// Service validates user is participant before any operation
const conversationsQuery = query(
  collection(firestore, 'conversations'),
  where('participantIds', 'array-contains', userId)
);
```

## Best Practices

1. **Always use progress callbacks** for operations affecting >10 conversations
2. **Handle partial failures gracefully** - don't assume 100% success
3. **Validate user input** before calling bulk operations
4. **Test error scenarios** - network failures, permission errors, etc.
5. **Log operation results** for debugging and analytics
6. **Confirm destructive operations** - especially markAsSpam with blockSenders
7. **Monitor Firestore quotas** - bulk operations can consume quota quickly

## Troubleshooting

**Operation takes too long:**
- Check network connection
- Reduce batch size if necessary
- Consider pagination for very large datasets

**Partial failures:**
- Check Firestore security rules
- Verify user permissions
- Review error messages in `result.errors`

**Progress callback not firing:**
- Ensure callback function is provided
- Check that operation is processing multiple items
- Verify no errors in callback function

## Related Documentation

- [Dashboard Customization Guide](./dashboard-customization.md)
- [Dashboard Performance Optimization](../architecture/dashboard-performance-optimization.md)
- [Story 5.7: Creator Command Center](../stories/5.7.story.md)
