# Epic 3: Communication Status & Notifications

**Expanded Goal:** Add professional-grade communication awareness features including online/offline presence indicators, message delivery and read receipts, typing indicators, and push notifications. These features transform yipyap from a basic messaging app into a reliable, business-appropriate communication platform where users have transparency about message status, recipient availability, and real-time engagement. By the end of this epic, users experience the full communication context needed for confident, asynchronous conversations.

## Story 3.1: Online/Offline Presence System

**User Story:**
As a user,
I want to see whether other users are currently online or offline,
so that I know if they're available to respond immediately.

**Acceptance Criteria:**

1. Firestore `presence` collection created to track user online/offline status
2. User's presence document updates to "online" when app becomes active (foreground)
3. User's presence document updates to "offline" with current timestamp when app backgrounds or user logs out
4. Presence indicator (green dot = online, gray dot = offline) displays on conversation list next to each contact
5. Presence indicator displays in chat view header showing conversation partner's status
6. Real-time listener (onSnapshot) on presence collection updates UI when contact's status changes
7. "Last seen" timestamp displays for offline users (e.g., "Last seen 5 minutes ago", "Last seen yesterday")
8. Presence updates handle edge cases (app crash, network disconnect) using Firestore onDisconnect() trigger
9. TypeScript interface defined for Presence document structure
10. Presence system tested with multiple users going online/offline simultaneously

---

## Story 3.2: Message Delivery Status Tracking

**User Story:**
As a user,
I want to see when my messages have been delivered to the recipient,
so that I know the message successfully reached them.

**Acceptance Criteria:**

1. Message status field in Firestore includes three states: 'sending', 'delivered', 'read'
2. Message displays single gray checkmark (✓) when status = 'sending' (optimistic UI from Epic 2)
3. Message updates to double gray checkmark (✓✓) when status = 'delivered' (Firestore write confirmed)
4. Delivery status updates in real-time when recipient's app receives the message via Firestore listener
5. Background Cloud Function or client-side logic marks message as 'delivered' when recipient's device syncs
6. Delivery status visible only to message sender (recipients don't see delivery status on messages they receive)
7. Status indicator styling is subtle and consistent with messaging app conventions
8. TypeScript types updated to include all message status states
9. Delivery status logic handles offline scenarios (message marked delivered when recipient comes online and syncs)

---

## Story 3.3: Read Receipts System

**User Story:**
As a user,
I want to see when my messages have been read by the recipient,
so that I know they've seen my message.

**Acceptance Criteria:**

1. Message status updates to 'read' when recipient views the message in chat view (scrolled into viewport)
2. Read messages display double blue checkmark (✓✓ in blue) for sender
3. Firestore message document updated with status='read' when recipient opens conversation and message is visible
4. Read status updates in real-time for sender via Firestore listener
5. User settings include option to disable sending read receipts (toggle: "Send Read Receipts")
6. When read receipts disabled, user still sees read receipts from others but doesn't send their own (messages stay at 'delivered')
7. Group chat read receipts show read status per message (future consideration: may need different UI pattern)
8. Read receipt logic only fires once per message (not repeatedly on scroll)
9. TypeScript types support read receipt settings in user profile
10. Privacy setting accessible from app settings screen

---

## Story 3.4: Typing Indicators

**User Story:**
As a user,
I want to see when the other person is typing,
so that I know they're actively composing a response.

**Acceptance Criteria:**

1. Typing indicator displays in chat view when conversation partner is actively typing (e.g., "Alice is typing..." or animated dots)
2. User's typing state publishes to Firestore presence or conversation metadata when text input has focus and content changes
3. Typing state clears when user stops typing for 3 seconds (debounced) or sends message
4. Real-time listener updates typing indicator UI when partner's typing state changes
5. Typing indicator displays below last message or in chat header (design decision)
6. Typing state uses ephemeral data (doesn't persist in message history, uses Firestore presence or temporary field)
7. Typing indicator works in both 1:1 and group chats (group chat may show "Alice and Bob are typing")
8. Typing state properly cleans up when user navigates away from chat or app backgrounds
9. TypeScript types defined for typing state in conversation or presence metadata
10. Typing indicator tested with multiple users typing simultaneously

---

## Story 3.5: Push Notifications for New Messages (Firebase Cloud Messaging)

**User Story:**
As a user,
I want to receive push notifications when new messages arrive while the app is backgrounded or closed,
so that I don't miss time-sensitive communications.

**Acceptance Criteria:**

1. Firebase Cloud Messaging (FCM) SDK integrated into React Native app
2. User prompted for notification permissions on first app launch (iOS) or automatically enabled (Android)
3. FCM device token generated and stored in user's Firestore profile document
4. Cloud Function or client-side trigger sends push notification to recipient when new message created in Firestore
5. Push notification displays sender's display name and message preview (first 100 characters)
6. Tapping notification opens app to the specific conversation (deep linking)
7. Notification badge count updates on app icon showing total unread message count
8. Notifications do not display when app is in foreground and user is viewing the conversation (suppress duplicate alerts)
9. Push notification delivery rate exceeds 95% (NFR6 requirement validated in testing)
10. TypeScript types defined for FCM token storage and notification payload

---

## Story 3.6: Notification Settings & Mute Conversations

**User Story:**
As a user,
I want to customize notification settings and mute specific conversations,
so that I control when and how I'm alerted to new messages.

**Acceptance Criteria:**

1. App settings screen includes global notification toggle (enable/disable all push notifications)
2. Per-conversation settings accessible from chat view menu (e.g., three-dot menu in header)
3. "Mute Conversation" option disables push notifications for that specific conversation
4. Muted conversations display mute icon in conversation list
5. Unmute option available in conversation settings to re-enable notifications
6. Mute state stored in Firestore conversation document (per-user mute preferences)
7. Cloud Function or notification logic respects mute settings (doesn't send notifications for muted conversations)
8. Muted conversations still update in conversation list with unread badges (only notifications suppressed, not UI updates)
9. Global notification setting updates FCM token active state or notification preference in user profile
10. TypeScript types support mute preferences in conversation and user profile documents

---

## Story 3.7: Unread Message Badge Counts

**User Story:**
As a user,
I want to see unread message counts on conversations and the app icon,
so that I know how many new messages I have at a glance.

**Acceptance Criteria:**

1. Conversation list displays unread count badge on each conversation with unread messages
2. Unread count increments when new message arrives in conversation
3. Unread count resets to zero when user opens conversation and views messages
4. Firestore conversation document includes unreadCount map (per-user unread counts: `{ userId1: 3, userId2: 0 }`)
5. Unread count updates in real-time via Firestore listener as messages arrive
6. App icon badge displays total unread count across all conversations (sum of all unread counts)
7. App icon badge updates when app is backgrounded using platform APIs (iOS/Android badge APIs)
8. Unread counts persist across app restarts (stored in Firestore)
9. TypeScript types support unreadCount map in Conversation interface
10. Badge counts tested with multiple conversations receiving messages simultaneously

---
