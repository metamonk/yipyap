# Epic 2: Real-Time Direct Messaging

**Expanded Goal:** Deliver the core value proposition of yipyap—instant, reliable one-on-one text messaging with real-time delivery, message persistence, and offline support. Implement optimistic UI updates for perceived instant performance, Firestore-based real-time synchronization for sub-500ms message delivery, and robust offline handling with automatic sync when connectivity returns. By the end of this epic, users can engage in real-time conversations, view complete message history, and communicate reliably even with intermittent network connectivity.

## Story 2.1: Firestore Data Model for Conversations & Messages

**User Story:**
As a developer,
I want a well-designed Firestore data model for conversations and messages,
so that the chat system can scale efficiently and support real-time updates with optimized read/write costs.

**Acceptance Criteria:**

1. Firestore `conversations` collection created with document structure: `{ participantIds: string[], lastMessage: object, lastMessageTimestamp: timestamp, unreadCount: map<userId, number> }`
2. Firestore `messages` subcollection created under each conversation document with structure: `{ senderId: string, text: string, timestamp: timestamp, status: 'sending'|'delivered'|'read', metadata: object }`
3. Composite indexes created for efficient queries (conversation by participantIds, messages by timestamp)
4. TypeScript interfaces defined for Conversation and Message types with proper typing
5. Helper functions created for generating conversation IDs (deterministic based on participant IDs for 1:1 chats)
6. Firestore Security Rules updated to allow users to read/write conversations they participate in
7. Message metadata structure includes AI-ready fields (category, sentiment, aiProcessed) for Phase 2 preparation
8. Data model documentation added explaining structure, indexes, and query patterns
9. Pagination strategy documented (cursor-based pagination using Firestore startAfter)

---

## Story 2.2: Conversation List View

**User Story:**
As a user,
I want to see a list of all my conversations with last message preview and timestamp,
so that I can navigate to ongoing chats and start new conversations.

**Acceptance Criteria:**

1. Conversation list screen displays all conversations where user is a participant (sorted by lastMessageTimestamp descending)
2. Each conversation list item shows other participant's display name, profile photo, and last message preview (first 50 characters)
3. Last message timestamp displays in relative format ("Just now", "5m ago", "Yesterday", "Jan 15")
4. Unread count badge displays on conversations with unread messages for current user
5. "New Conversation" button navigates to user search/selection screen
6. User search screen allows searching users by username or display name
7. Selecting a user from search creates or opens existing 1:1 conversation with that user
8. Conversation list uses FlatList with proper optimization (keyExtractor, getItemLayout) for performance
9. Empty state displays when user has no conversations ("Start your first conversation")
10. Pull-to-refresh functionality reloads conversation list

---

## Story 2.3: Real-Time 1:1 Chat View with Send/Receive

**User Story:**
As a user,
I want to send and receive text messages in real-time within a conversation,
so that I can communicate instantly with another user.

**Acceptance Criteria:**

1. Chat view screen displays messages for selected conversation in chronological order (oldest at top, newest at bottom)
2. Message input field at bottom of screen accepts text input (up to 1,000 characters)
3. Send button writes message to Firestore messages subcollection with senderId, text, timestamp, and status='sending'
4. Firestore real-time listener (onSnapshot) attached to messages subcollection updates UI when new messages arrive
5. Received messages display sender's name and profile photo (for context, even in 1:1 where it's obvious)
6. Sent messages display on right side, received messages on left side (standard chat UI pattern)
7. Messages automatically scroll to bottom when new message sent or received
8. Real-time updates occur within sub-500ms of message being sent (measurable in tests)
9. Chat view uses FlatList inverted pattern for efficient message rendering
10. Loading state displays while initial messages load from Firestore

---

## Story 2.4: Optimistic UI Updates for Instant Message Display

**User Story:**
As a user,
I want my sent messages to appear instantly in the chat,
so that the app feels fast and responsive even on slower networks.

**Acceptance Criteria:**

1. Message appears in chat view immediately when user taps send button (before Firestore write completes)
2. Optimistic message displays with status indicator showing "sending" state (e.g., single gray checkmark or clock icon)
3. Message status updates to "delivered" (double gray checkmark) when Firestore write confirms success
4. Failed message sends display error indicator (red exclamation mark) with retry button
5. Retry button re-attempts Firestore write for failed messages
6. Optimistic message includes temporary local ID that gets replaced with Firestore document ID on success
7. Message list correctly handles optimistic messages when real-time listener receives the confirmed message (deduplication logic)
8. Optimistic UI success rate exceeds 95% (messages successfully deliver after optimistic display)
9. User cannot send empty messages (send button disabled when input field is empty)

---

## Story 2.5: Message Persistence with Pagination & History Loading

**User Story:**
As a user,
I want to view complete conversation history and load older messages as I scroll,
so that I can reference past conversations without performance issues.

**Acceptance Criteria:**

1. Chat view initially loads most recent 50 messages from Firestore on conversation open
2. Scroll-to-top triggers loading of next 50 older messages using Firestore cursor-based pagination (startAfter)
3. Loading indicator displays at top of message list while fetching older messages
4. Pagination continues until all historical messages loaded (no more messages available)
5. Loaded messages persist in local state/cache during session (avoid redundant Firestore reads)
6. Firestore offline persistence enabled to cache messages locally for faster subsequent loads
7. Message history accessible even after app restart (Firestore persistence layer handles this)
8. Efficient query uses Firestore query limits and indexes to minimize read costs
9. TypeScript types ensure proper pagination state management (hasMore flag, lastVisible cursor)

---

## Story 2.6: Offline Support with Message Queuing & Auto-Sync

**User Story:**
As a user,
I want to send messages even when offline and have them automatically deliver when I reconnect,
so that poor connectivity doesn't prevent me from communicating.

**Acceptance Criteria:**

1. Network connectivity state detected and displayed in UI (offline banner or indicator)
2. Messages sent while offline are queued locally and display in chat with "waiting to send" status
3. Queued messages automatically attempt to send when network connectivity restored (Firestore handles this via offline persistence)
4. Firestore offline persistence configured to queue writes and sync on reconnection
5. Offline sync success rate exceeds 99% (messages sent offline successfully deliver when online)
6. User can continue browsing cached conversations and messages while offline
7. Real-time listeners reconnect automatically when network restored (Firestore SDK handles this)
8. Clear visual feedback when transitioning from offline to online (banner dismisses, messages sync)
9. Messages received while offline sync and display when reconnected
10. Offline functionality tested with airplane mode and network disconnection scenarios

---

## Story 2.7: Message Timestamps & Date Separators

**User Story:**
As a user,
I want to see when messages were sent with clear timestamps and date separators,
so that I have temporal context for conversations.

**Acceptance Criteria:**

1. Each message displays timestamp in user's local timezone (e.g., "10:45 AM")
2. Timestamps show on every message (not grouped/hidden)
3. Date separators inserted between messages from different days (e.g., "Today", "Yesterday", "Monday", "Jan 15, 2025")
4. Date separator logic handles multi-day conversations correctly (separator appears when date changes)
5. Timestamp formatting uses relative labels for recent dates ("Today", "Yesterday") and absolute dates for older messages
6. Message timestamps are timezone-aware (Firestore server timestamp converted to local time)
7. Timestamp styling is subtle (smaller font, gray color) to not distract from message content
8. TypeScript utility functions created for timestamp formatting and date separator logic

---

## Story 2.8: Search Messages by Keyword

**User Story:**
As a user,
I want to search for messages by keyword across all my conversations,
so that I can quickly find specific information from past chats.

**Acceptance Criteria:**

1. Search icon in conversation list header opens search interface
2. Search input field accepts text keywords and searches across all user's conversations
3. Firestore query searches message text field using appropriate query strategy (note: Firestore doesn't support full-text search natively—may require client-side filtering or Algolia integration for advanced search)
4. Search results display matching messages with conversation context (sender, conversation name, timestamp)
5. Tapping search result navigates to conversation and scrolls to the specific message (message highlighted temporarily)
6. Search is case-insensitive and finds partial matches (substring search)
7. Search results update as user types (debounced to avoid excessive queries)
8. Empty search results display "No messages found" message
9. Search interface includes clear/cancel button to exit search and return to conversation list
10. TypeScript types defined for search results and search state management

**Note:** For MVP, implement basic client-side search across cached messages. Full Firestore text search requires third-party integration (Algolia, Elastic) which is out of MVP scope. Document this limitation for Phase 2 enhancement.

---
