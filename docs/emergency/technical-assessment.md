# Emergency Features Technical Assessment

**Architect:** Winston
**Date:** 2025-01-21
**Time Estimate:** 3-4 hours total

## Current State Analysis

### ✅ What's Already In Place

1. **Group Chat** - Data model fully supports it (`type: 'group'`, `participantIds[]`)
2. **Read Receipts** - Fields exist (`readBy[]`, `status`, `unreadCount`)
3. **Online/Offline** - User model has `presence.status` and `lastSeen`
4. **Notifications** - Settings field exists (`notificationsEnabled`)

### ❌ What's Missing

1. **Group Chat UI** - No screens for creating/managing groups
2. **Presence Updates** - Not updating online/offline status
3. **Read Receipt Logic** - Not marking messages as read
4. **Push Notifications** - No Expo Notifications setup

## Implementation Architecture

### 1️⃣ Online/Offline Status (30 mins)

**Approach:** Lightweight Firestore-based presence

```typescript
// Location: services/presenceService.ts (NEW)
- Update presence on app state changes
- Use AppState API to detect foreground/background
- Batch updates every 30 seconds when online
- Set offline on background
```

**Changes Required:**

- New service: `presenceService.ts`
- Hook: `usePresence()` in app/\_layout.tsx
- Component update: Show status dots in ConversationListItem

**Technical Decisions:**

- Use Firestore only (no Realtime Database) for simplicity
- 30-second heartbeat when active
- Immediate offline on background

### 2️⃣ Group Chat UI (1 hour)

**Approach:** Minimal group creation flow

```typescript
// Location: app/(tabs)/conversations/new-group.tsx (NEW)
- User multi-select list
- Group name input
- Create button
```

**Changes Required:**

- New screen: `new-group.tsx`
- Update: `conversationService.ts` (already has createConversation)
- Component: `UserSelectList.tsx` (NEW)
- Update navigation to show group option

**Technical Decisions:**

- Reuse existing conversation model
- No admin controls for MVP
- Max 10 participants initially
- No group editing (can add later)

### 3️⃣ Message Read Receipts (45 mins)

**Approach:** Batch updates for efficiency

```typescript
// Location: services/messageService.ts (UPDATE)
- markMessagesAsRead() function
- Update readBy array
- Update conversation unreadCount
```

**Changes Required:**

- Update: `messageService.ts` - Add marking logic
- Hook: `useMarkAsRead()` - Auto-mark on view
- Component: MessageStatus checkmarks (✓✓)

**Technical Decisions:**

- Batch read updates per conversation
- Only show double-check for last message
- Respect user's sendReadReceipts setting

### 4️⃣ Push Notifications - Foreground (45 mins)

**Approach:** Expo Notifications with in-app display only

```bash
# Installation
npx expo install expo-notifications expo-device
```

```typescript
// Location: services/notificationService.ts (NEW)
- Request permissions
- Handle foreground notifications
- Show in-app banner
```

**Changes Required:**

- New service: `notificationService.ts`
- Hook: `useNotifications()` in \_layout.tsx
- Component: `NotificationBanner.tsx` (NEW)
- No FCM backend needed yet (foreground only)

**Technical Decisions:**

- Foreground only (no background/killed state)
- Local notifications for now
- In-app banner display
- Permission request on first message

## Data Model Updates

### No Schema Changes Needed! ✅

Existing models already support all features:

```typescript
// Existing Conversation model supports groups
type: 'direct' | 'group'
participantIds: string[]
groupName?: string

// Existing Message model has read receipts
readBy: string[]
status: 'sending' | 'delivered' | 'read'

// Existing User model has presence
presence: {
  status: 'online' | 'offline'
  lastSeen: Timestamp
}
```

### Firestore Rules Updates

```javascript
// Minor update for group conversations
// Current rules already support multiple participants!
// Just need to ensure group creation validates participant count

match /conversations/{conversationId} {
  allow create: if request.auth != null &&
    request.auth.uid in request.resource.data.participantIds &&
    request.resource.data.participantIds.size() <= 10; // Add size limit
}
```

## Implementation Order

1. **Start Here:** Presence Service (foundation for online status)
2. **Then:** Read Receipts (builds on presence)
3. **Then:** Group Chat UI (uses updated services)
4. **Finally:** Notifications (ties everything together)

## Code Organization

```
services/
├── presenceService.ts      [NEW]
├── notificationService.ts  [NEW]
├── messageService.ts       [UPDATE - read receipts]
└── conversationService.ts  [Existing - ready for groups]

hooks/
├── usePresence.ts         [NEW]
├── useMarkAsRead.ts       [NEW]
└── useNotifications.ts    [NEW]

components/
├── common/
│   ├── OnlineIndicator.tsx  [NEW]
│   └── NotificationBanner.tsx [NEW]
├── conversation/
│   └── UserSelectList.tsx   [NEW]
└── chat/
    └── MessageStatus.tsx     [UPDATE - double checks]

app/(tabs)/
└── conversations/
    └── new-group.tsx        [NEW]
```

## Risk Mitigation

### Performance Risks

- **Risk:** Too many presence updates
- **Mitigation:** 30-second batching, debounce

### Security Risks

- **Risk:** Users seeing wrong group messages
- **Mitigation:** Firestore rules already enforce participant checking

### UX Risks

- **Risk:** Notification spam
- **Mitigation:** In-app only, respect mute settings

## Technical Debt Being Created

1. **Presence Accuracy** - 30-second updates mean slight delay
2. **Group Management** - No edit/leave group functionality
3. **Notification Handling** - No background support
4. **Read Receipt Batching** - Could be optimized with Cloud Functions
5. **Error Recovery** - Minimal error handling for speed

## Success Metrics

- [ ] Users see online/offline dots in conversation list
- [ ] Can create group with 3+ users
- [ ] Messages show ✓ (sent) and ✓✓ (read)
- [ ] See notification banner when app is open

## Rollback Plan

All changes are additive. To rollback:

1. Comment out new hook calls in \_layout.tsx
2. Hide new UI components
3. Features gracefully degrade

---

**Ready to implement?** Total time: ~3-4 hours
**Next step:** Transform to Developer (\*agent dev) to start coding!
