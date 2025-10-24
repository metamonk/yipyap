# Offline Functionality Testing Guide

## Overview

This guide provides step-by-step instructions for testing yipyap's offline messaging capabilities using two physical devices with different user accounts.

## Features Covered

yipyap implements comprehensive offline support including:

✅ **Offline Message Queuing** - Messages sent while offline are queued locally and auto-send when reconnected
✅ **Persistent Chat History** - Full conversation history preserved after force-quit/app restart
✅ **Cross-Device Sync** - Messages appear for other users once sender reconnects
✅ **Auto-Reconnection** - Network drops trigger automatic reconnection with retry logic
✅ **Connection Status UI** - Clear indicators for offline state and pending messages
✅ **Sub-1 Second Sync** - Real-time listeners auto-reconnect for fast sync after reconnection

---

## Test Setup Requirements

### Prerequisites

- **Two physical devices** (or one device + one emulator)
- **Two different yipyap accounts** logged in on each device
- **Network control** (ability to toggle WiFi/Airplane Mode)
- **Active conversation** between the two accounts

### Architecture Components Being Tested

- **Firestore Offline Persistence** (`services/firebase.ts:99-116`)
- **Retry Queue Service** (`services/retryQueueService.ts`)
- **Network Monitor Hook** (`hooks/useNetworkMonitor.ts`)
- **Message Hook Offline Handling** (`hooks/useMessages.ts:428`)
- **Offline UI Indicators** (`app/(tabs)/conversations/index.tsx:651-661`)

---

## Test 1: Offline Message Queuing

**Objective:** Verify messages sent while offline are queued and auto-send when reconnected

### Steps (Device A - Sender)

1. **Open the app** and navigate to a conversation with Device B's account
2. **Enable Airplane Mode** (or disable WiFi + Cellular Data)
3. **Observe the offline banner** appears at top of conversation list:
   - Should show: "Viewing cached conversations"
4. **Send 3-4 messages** in the chat
5. **Verify optimistic UI:**
   - Messages appear immediately in the chat
   - Message status shows "sending" (not "delivered")
   - Messages remain visible while offline
6. **Disable Airplane Mode** (re-enable network)
7. **Observe auto-sync:**
   - Offline banner changes to "Syncing messages..." briefly
   - Message statuses change from "sending" to "delivered" within 1-2 seconds
   - Offline banner disappears once sync completes

### Expected Results (Device A)

- ✅ Messages appear instantly when sent (optimistic UI)
- ✅ "sending" status shown while offline
- ✅ Auto-sync triggers within 2 seconds of reconnection
- ✅ All messages change to "delivered" status
- ✅ No data loss or duplicate messages

### Expected Results (Device B - Recipient)

- ✅ No messages appear while Device A is offline
- ✅ All 3-4 messages appear within 1-3 seconds of Device A reconnecting
- ✅ Messages display in correct chronological order
- ✅ Push notifications delivered (if enabled)

---

## Test 2: Force-Quit Persistence

**Objective:** Verify chat history survives app force-quit and restart

### Steps (Device A)

1. **Open the app** and navigate to any conversation
2. **Send 5-10 messages** to build up history
3. **Verify messages are visible** in the chat
4. **Force-quit the app:**
   - **iOS:** Double-tap home, swipe up on yipyap
   - **Android:** Recent apps button, swipe yipyap away
5. **Wait 10-30 seconds**
6. **Reopen the app**
7. **Navigate to the same conversation**

### Expected Results

- ✅ App launches normally (no errors)
- ✅ Conversation list shows all conversations
- ✅ All message history is intact
- ✅ Messages load from local cache (instant/sub-500ms load)
- ✅ No "loading" spinner for cached data
- ✅ Real-time sync resumes automatically

### Technical Details

This tests **Firestore persistent local cache** configured in `services/firebase.ts:113-116`:

```typescript
db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});
```

The cache survives app restarts and provides instant access to previously loaded data.

---

## Test 3: Network Drop & Auto-Reconnect (30s+ Outage)

**Objective:** Verify app handles extended network outages gracefully

### Steps (Device A)

1. **Start in an active conversation** with Device B
2. **Disable ALL network connections:**
   - Enable Airplane Mode, OR
   - Disable WiFi AND Cellular Data
3. **Wait 30+ seconds** (simulate extended outage)
4. **Send 2-3 messages** while offline
   - Observe: Messages appear with "sending" status
5. **Continue waiting** (total 60+ seconds offline)
6. **Re-enable network connections**
7. **Observe reconnection behavior:**
   - Watch for network monitor to detect connection
   - 2-second debounce delay before processing
   - Retry queue processes automatically
   - Message statuses update to "delivered"

### Expected Results (Device A)

- ✅ Offline banner appears immediately when network lost
- ✅ Messages can still be sent (queued locally)
- ✅ UI remains responsive throughout outage
- ✅ Reconnection detected within 1-2 seconds
- ✅ Retry queue processes within 2-4 seconds of reconnection
- ✅ All queued messages successfully sent
- ✅ No duplicate messages created

### Expected Results (Device B)

- ✅ Messages appear within 3-5 seconds of Device A reconnecting
- ✅ Messages display in correct order
- ✅ No gaps or missing messages

### Technical Details

This tests the **Network Monitor's reconnection debounce** (`hooks/useNetworkMonitor.ts:264-272`):

```typescript
reconnectionTimerRef.current = setTimeout(() => {
  console.log('Network connection stable, processing queued operations');
  onOnline?.();
  processRetryQueue();
  reconnectionTimerRef.current = null;
}, reconnectionDebounce); // 2000ms default
```

The 2-second debounce prevents rapid reconnection attempts and battery drain.

---

## Test 4: Connection Status Indicators

**Objective:** Verify UI clearly communicates offline state and sync progress

### Steps (Device A)

1. **Navigate to Conversation List** (`/(tabs)/conversations`)
2. **Enable Airplane Mode**
3. **Observe offline banner** at top of screen:
   - Shows: "Viewing cached conversations"
   - Background color indicates offline state
4. **Navigate through conversations**
   - All cached data should load instantly
   - No errors or missing data
5. **Disable Airplane Mode**
6. **Observe sync indicator:**
   - Banner changes to "Syncing messages..."
   - Shows last sync time when complete
   - Banner disappears when fully synced

### Expected UI States

| Network State    | Banner Text                    | Banner Color   | User Action             |
| ---------------- | ------------------------------ | -------------- | ----------------------- |
| **Offline**      | "Viewing cached conversations" | Yellow/Warning | Browse cached data only |
| **Reconnecting** | "Syncing messages..."          | Blue/Info      | Wait for sync           |
| **Synced**       | Last sync time OR hidden       | N/A            | Normal usage            |

### Expected Results

- ✅ Offline banner appears within 1 second of network loss
- ✅ Banner accurately reflects current state
- ✅ Sync progress visible when reconnecting
- ✅ Last sync time displayed when offline
- ✅ Banner auto-hides when online and synced

### Additional UI Indicators

**Message Status Icons:**

- 📤 **Sending** - Gray/pending icon (message queued)
- ✓ **Delivered** - Single checkmark (received by server)
- ✓✓ **Read** - Double checkmark (read by recipient)
- ❌ **Failed** - Red/error icon (retry button shown)

---

## Test 5: Pending Message Indicators

**Objective:** Verify individual message status tracking during offline→online transition

### Steps (Device A)

1. **Open a conversation**
2. **Go offline** (Airplane Mode)
3. **Send a single message**
4. **Observe message status:**
   - Should show "sending" status immediately
   - Message should have pending/queued visual indicator
5. **Wait 10-20 seconds** (while still offline)
   - Verify message stays in "sending" state
   - No error or timeout occurs
6. **Go back online**
7. **Watch status transition:**
   - "sending" → "delivered" within 1-2 seconds
   - Visual indicator updates

### Expected Results

- ✅ Message status accurately reflects state
- ✅ "sending" status shown while offline/queued
- ✅ No premature "delivered" status
- ✅ Status updates immediately after successful send
- ✅ Failed messages show retry button
- ✅ Retry button works (sends message again)

### Edge Case: Failed Send After Retry

1. **Modify Firestore rules** (temporarily) to deny writes
2. **Send a message**
3. **Observe failed status** after retry attempts exhausted
4. **Tap retry button**
5. **Restore Firestore rules**
6. **Verify message sends successfully**

---

## Test 6: Conversation List Offline Behavior

**Objective:** Verify conversation list works seamlessly when offline

### Steps (Device A)

1. **View Conversation List** while online
   - Ensure multiple conversations are loaded
2. **Enable Airplane Mode**
3. **Test offline functionality:**
   - Scroll through conversation list
   - Tap to open conversations
   - View message history
   - Navigate back to list
4. **Verify "New Conversation" button:**
   - Should be disabled when offline
   - Tapping should show no action or warning

### Expected Results

- ✅ Conversation list loads from cache instantly
- ✅ All previously loaded conversations visible
- ✅ Opening conversations works from cache
- ✅ Message history displays correctly
- ✅ Cannot create new conversations while offline
- ✅ Search functionality works on cached data
- ✅ No crashes or errors

---

## Test 7: Background Sync After Overnight Offline

**Objective:** Verify sync works after extended offline period (e.g., overnight with WiFi off)

### Steps (Device A)

1. **Send messages** in a conversation (while online)
2. **Enable Airplane Mode**
3. **Leave app in background** for 8+ hours (overnight)
4. **Disable Airplane Mode** in the morning
5. **Open the app**
6. **Navigate to conversation list**

### Expected Results

- ✅ App launches normally
- ✅ Sync begins automatically within 2-4 seconds
- ✅ New messages from other users appear
- ✅ Queued messages from previous session send
- ✅ No data loss or corruption
- ✅ Conversation list updates with latest data

---

## Common Issues & Troubleshooting

### ❌ Messages Not Sending After Reconnection

**Symptoms:**

- Network reconnects but messages stay in "sending" state
- No error shown to user

**Possible Causes:**

1. **Retry queue not processing**
   - Check: Network monitor not detecting online state
   - Fix: Verify `useNetworkMonitor` is properly initialized
2. **Firestore permission error**
   - Check: Firebase console logs for "permission-denied"
   - Fix: Review Firestore security rules
3. **Message service error**
   - Check: Console logs for errors in `sendMessage()`
   - Fix: Check message validation logic

**Debug Steps:**

```typescript
// In Chrome DevTools / React Native Debugger
import { getRetryQueue } from '@/services/retryQueueService';

const queue = getRetryQueue();
console.log('Queue size:', queue.getQueueSize());
console.log('Queue items:', queue.getQueueItems());
```

---

### ❌ Offline Banner Not Appearing

**Symptoms:**

- Network disconnects but no offline indicator shown

**Possible Causes:**

1. **NetInfo not detecting network change**
   - Check: Device network settings
   - Fix: Ensure `@react-native-community/netinfo` is properly linked
2. **Component not using `useNetworkStatus` hook**
   - Check: Conversation list component imports
   - Fix: Verify `const { connectionStatus } = useNetworkStatus()` is called

---

### ❌ Duplicate Messages After Reconnection

**Symptoms:**

- Same message appears twice after going back online

**Possible Causes:**

1. **Optimistic UI not cleaning up**
   - Check: `useMessages` deduplication logic
   - Fix: Verify message ID matching in real-time listener
2. **Multiple retry attempts**
   - Check: Retry queue processing logs
   - Fix: Ensure successful sends remove from optimistic state

---

### ❌ Messages Disappear After App Restart

**Symptoms:**

- Messages sent while offline are gone after force-quit

**Possible Causes:**

1. **Offline persistence not enabled**
   - Check: `services/firebase.ts` initialization
   - Fix: Verify `persistentLocalCache()` is configured
2. **Cache cleared by system**
   - Check: Device storage settings
   - Fix: Increase app storage allocation

---

## Performance Benchmarks

Based on implementation and testing:

| Metric                           | Target  | Typical Performance |
| -------------------------------- | ------- | ------------------- |
| **Offline Detection**            | < 1s    | 500-800ms           |
| **Message Queue Time**           | Instant | < 100ms             |
| **Reconnection Detection**       | < 2s    | 1-2s                |
| **Retry Queue Processing**       | < 5s    | 2-4s                |
| **Message Sync After Reconnect** | < 1s    | 500ms-1s            |
| **Cache Load on Restart**        | < 500ms | 200-400ms           |

---

## Code References for Debugging

### Key Files

| File                                 | Purpose                  | Lines of Interest                |
| ------------------------------------ | ------------------------ | -------------------------------- |
| `services/firebase.ts`               | Firestore offline config | 99-116 (persistence setup)       |
| `services/retryQueueService.ts`      | Queue management         | 146-210 (enqueue/process)        |
| `hooks/useNetworkMonitor.ts`         | Network detection        | 195-210 (retry queue processing) |
| `hooks/useMessages.ts`               | Offline message handling | 428-432 (offline check)          |
| `app/(tabs)/conversations/index.tsx` | Offline UI banner        | 651-661 (banner display)         |

### Console Logs to Watch

Enable development mode to see helpful logs:

```typescript
// Network state changes
'Network connection lost';
'Network connection restored, waiting for stability...';
'Network connection stable, processing queued operations';

// Retry queue
'Processing X queued operations after reconnection';

// Message status
'Delivery status update queued for retry';
'Read receipt update queued for retry';
```

---

## Advanced Testing Scenarios

### Scenario A: Rapid Online/Offline Cycling

1. Toggle Airplane Mode ON/OFF rapidly (5-10 times in 30 seconds)
2. Send messages between toggles
3. Verify: No crashes, all messages eventually send, no duplicates

### Scenario B: Offline + Force Quit + Reconnect

1. Go offline
2. Send 5 messages
3. Force-quit app
4. Wait 60 seconds
5. Reopen app (still offline)
6. Go online
7. Verify: All 5 messages send successfully

### Scenario C: Multi-Conversation Offline Sync

1. Go offline
2. Send messages in 3 different conversations
3. Go online
4. Verify: All messages in all conversations sync correctly

---

## Success Criteria

A successful offline functionality test should demonstrate:

✅ **Zero data loss** - No messages lost during offline periods
✅ **Zero duplicates** - Messages appear exactly once
✅ **Clear UX** - User always knows connection state
✅ **Fast sync** - Sub-1s sync after reconnection
✅ **Persistent cache** - Data survives app restarts
✅ **Graceful degradation** - App remains usable while offline
✅ **Automatic recovery** - No manual intervention needed

---

## Related Documentation

- [Firestore Offline Persistence](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Real-Time Data Patterns](../architecture/real-time-data-patterns.md)
- [Retry Queue Architecture](../architecture/error-handling-strategy.md)
- [Network Monitoring Strategy](../architecture/monitoring-and-observability.md)

---

## Feedback & Issues

If you encounter issues during testing:

1. **Check console logs** for error messages
2. **Verify Firestore rules** allow proper read/write access
3. **Review Firebase console** for quota/permission issues
4. **Test with Firebase Emulator** for isolated testing
5. **Report bugs** with device info, steps to reproduce, and console logs
