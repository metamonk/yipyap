# Auto-Archive Testing Scripts (Story 6.4)

Quick reference for testing the auto-archive feature.

## 🚀 Quick Start (Automated)

```bash
# Run the full test flow
./functions/scripts/test-auto-archive-flow.sh
```

This script will:
1. ✅ Create test user with capacity settings
2. ✅ Seed 10 test messages (3 high-priority, 7 low-priority)
3. ⏸️ Pause for you to trigger the workflow manually
4. ✅ Verify results (archived count, safety checks, undo records)
5. ✅ Optional cleanup

## 📋 Manual Testing (Step-by-Step)

### Prerequisites
```bash
# Make sure you have serviceAccountKey.json in project root
ls serviceAccountKey.json
```

### Step 1: Setup Test User
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/setupTestUser.ts
```

**Creates:**
- User: `test-creator-123`
- Daily limit: 3 messages
- Auto-archive: ENABLED

### Step 2: Seed Test Messages
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/seedAutoArchiveMessages.ts
```

**Creates 10 messages:**
- 3 high-priority (business, urgent, crisis) → Should NOT archive
- 7 low-priority (fan engagement) → Should archive

### Step 3: Trigger Workflow

**Option A: Firebase Functions Shell**
```bash
firebase functions:shell

# In the shell:
> dailyAgentWorkflow({ userId: 'test-creator-123' })
```

**Option B: Firebase Emulator**
```bash
# Start emulator
firebase emulators:start

# Call function via HTTP
curl -X POST http://localhost:5001/your-project/us-central1/dailyAgentWorkflow \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-creator-123"}'
```

**Option C: Direct Script** (if you create triggerAutoArchive.ts)
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/triggerAutoArchive.ts
```

### Step 4: Verify Results
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/verifyAutoArchive.ts
```

**Checks:**
- ✅ 7 conversations archived
- ✅ 3 conversations kept (high priority)
- ✅ Undo records created (24-hour window)
- ✅ Rate limits set (1/fan/week)
- ✅ Safety checks (no business/urgent/VIP/crisis archived)

### Step 5: Cleanup
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/cleanupTestData.ts
```

## 🧪 Testing Specific Features

### Test Undo Functionality

**In Mobile App:**
1. Navigate to **Profile → Archived Messages**
2. See countdown timer (e.g., "23h 45m remaining")
3. Tap **"Undo Archive"** button
4. Verify conversation restored

**Via Firestore Console:**
1. Go to `undo_archive` collection
2. Check `canUndo: true` and `expiresAt` timestamp
3. Manually update conversation: `isArchived: false`
4. Update undo record: `canUndo: false, undoneAt: [now]`

### Test Rate Limiting

```bash
# 1. Run workflow first time
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/triggerAutoArchive.ts

# 2. Verify boundary messages sent
# Check rate_limits/boundary_messages/limits collection

# 3. Run workflow again (same fans)
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/triggerAutoArchive.ts

# 4. Verify: Messages archived but NO new boundaries sent (rate limited)
```

### Test Safety Checks

**Expected Behavior:**
- ❌ Business messages (category: 'business_opportunity') → NOT archived
- ❌ Urgent messages (category: 'urgent') → NOT archived
- ❌ VIP conversations (relationshipContext.isVIP: true) → NOT archived
- ❌ Crisis sentiment (sentimentScore < -0.7) → NOT archived
- ✅ Low-priority fan engagement → Archived

**Verify:**
```bash
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json \
  npx ts-node functions/scripts/verifyAutoArchive.ts

# Check output for "Safety Check" section
# Should show: ✅ All safety checks PASSED!
```

### Test Quiet Hours

**Setup:**
1. Update test user settings:
   ```typescript
   notifications: {
     quietHoursStart: '22:00',
     quietHoursEnd: '08:00'
   }
   ```

2. Run workflow during quiet hours (10 PM - 8 AM)

**Expected:**
- Messages still archived
- Boundary messages NOT sent immediately
- Scheduled for next day (after 8 AM)

### Test 24-Hour Expiry

**Option A: Wait 24 hours** 😴
(Not recommended)

**Option B: Manually expire records**
1. Go to Firestore Console
2. Find `undo_archive` documents
3. Update `expiresAt` to past timestamp
4. Update `canUndo: false`
5. Refresh app → "Undo" buttons should be disabled

## 📊 Expected Test Results

### ✅ Success Criteria

- [ ] **Capacity Respected**: 3 messages kept (dailyLimit: 3)
- [ ] **Low Priority Archived**: 7 fan messages archived
- [ ] **Safety Checks Pass**: Business/Urgent/VIP/Crisis NOT archived
- [ ] **Boundary Messages Sent**: To archived fans (max 1/week)
- [ ] **Undo Records Created**: With 24-hour expiry
- [ ] **Undo Works**: Conversation restored within 24h
- [ ] **Undo Expires**: Button disabled after 24h
- [ ] **Rate Limiting**: No duplicate boundaries within 7 days

### 🐛 Troubleshooting

**Problem: No messages archived**
```bash
# Check user settings
firebase firestore:get users/test-creator-123

# Verify autoArchiveEnabled: true
# Verify dailyLimit < message count
```

**Problem: Business messages archived (SAFETY VIOLATION!)**
```bash
# Check message metadata
firebase firestore:get conversations/test-conv-1/messages/test-msg-1

# Should have category: 'business_opportunity'
# Check shouldNotArchive() function logic
```

**Problem: Undo doesn't work**
```bash
# Check undo record
firebase firestore:get undo_archive/{undoId}

# Verify:
# - canUndo: true
# - expiresAt is in the future
# - userId matches
```

## 📁 Script Files

| Script | Purpose |
|--------|---------|
| `setupTestUser.ts` | Creates test user with capacity settings |
| `seedAutoArchiveMessages.ts` | Creates 10 test messages |
| `verifyAutoArchive.ts` | Verifies archive results and safety checks |
| `cleanupTestData.ts` | Removes all test data |
| `test-auto-archive-flow.sh` | Runs all steps in sequence |

## 🔗 Related Documentation

- [Full Testing Guide](../../docs/stories/6.4-manual-testing-guide.md)
- [Story 6.4 Spec](../../docs/stories/6.4.story.md)
- [Auto-Archive Service](../src/services/bulkOperationsService.ts)
- [Undo Service](../src/services/undoArchiveService.ts)

## 💡 Tips

1. **Use Firebase Emulator** for testing (avoid affecting production)
   ```bash
   firebase emulators:start
   ```

2. **Check Firestore Console** to see real-time data changes
   ```bash
   open https://console.firebase.google.com/project/your-project/firestore
   ```

3. **Enable Debug Logging** to see detailed workflow output
   ```typescript
   // In daily-agent-workflow.ts
   console.log('[Auto-Archive]', ...);
   ```

4. **Test in Stages** - Don't run all steps at once. Verify each step before proceeding.

5. **Keep Test Data** - Don't cleanup immediately. Inspect Firestore to understand behavior.

## 🚨 Important Notes

- ⚠️ **Never run these scripts on production!** Always use emulator or test environment.
- ⚠️ **Service Account Key** is sensitive - never commit to git.
- ⚠️ **Safety checks are critical** - verify they work before deploying.
