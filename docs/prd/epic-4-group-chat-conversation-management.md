# Epic 4: Group Chat & Conversation Management

**Expanded Goal:** Enable multi-user group conversations (3-50 participants) with group naming, participant management, and group-specific communication features (typing indicators, read receipts). Add high-volume conversation management capabilities including archive, delete, and batch actions so users can efficiently organize many active conversations. Optimize Firestore query patterns to ensure scalable, cost-efficient performance. By the end of this epic, yipyap delivers the complete MVP feature set with professional-grade conversation management tools.

## Story 4.1: Create Group Chats with Multiple Participants

**User Story:**
As a user,
I want to create group chats with multiple participants (3-50 users),
so that I can have multi-person conversations.

**Acceptance Criteria:**

1. Unified conversation creation automatically detects group mode when 2+ recipients selected
2. Group creation flow allows selecting 2+ other users (minimum 3 total including creator)
3. Maximum 50 participants enforced during recipient selection (validation with error message if exceeded)
4. Optional group name field appears automatically when multiple recipients selected
5. Group photo upload available in group settings after group is created
6. Firestore conversation document created with type='group', participantIds array, groupName, and groupPhotoURL
7. All participants receive notification/update that they've been added to new group
8. Group chat displays in conversation list for all participants after first message sent
9. Group chat view shows group name and photo in header (instead of 1:1 participant name)
10. TypeScript interfaces updated to support group-specific fields in Conversation type

---

## Story 4.2: Group Chat Messaging with Multi-User Support

**User Story:**
As a user,
I want to send and receive messages in group chats with multiple participants,
so that I can communicate with several people simultaneously.

**Acceptance Criteria:**

1. Group chat view displays messages from all participants in chronological order
2. Each message shows sender's name and profile photo (essential in group context for attribution)
3. Sent messages use same real-time Firestore sync as 1:1 chats (Epic 2 infrastructure)
4. All group participants receive real-time updates when any member sends message
5. Message list visually distinguishes sender (e.g., color coding, alignment, or consistent name display)
6. Group chat supports all Epic 2 messaging features: optimistic UI, offline sync, pagination, timestamps
7. Firestore query retrieves messages for group conversation same as 1:1 (subcollection structure)
8. Group chat performance maintains sub-500ms delivery latency even with 50 participants
9. Push notifications sent to all group participants (except sender) when new group message arrives
10. TypeScript types handle group chat messages identically to 1:1 (unified Message interface)

---

## Story 4.3: Group Participant Management (Add/Remove/Admin)

**User Story:**
As a group creator,
I want to add or remove participants and update group name/photo,
so that I can manage group membership and settings.

**Acceptance Criteria:**

1. Group settings screen accessible from three-dot menu in group chat header
2. "Add Participants" option allows group creator to search and add new users (up to 50 total participant limit)
3. Added participants immediately see group in conversation list and can view full message history
4. "Remove Participant" option allows group creator to remove users from group
5. Removed participants lose access to group (conversation disappears from their list, cannot send messages)
6. "Edit Group Name" allows updating group name (visible to all participants immediately via real-time sync)
7. "Edit Group Photo" allows uploading new group photo
8. Group creator designated in conversation document (creatorId field) for permission checks
9. Only group creator can add/remove participants and edit group settings (enforced in Firestore Security Rules)
10. Firestore Security Rules updated to enforce group creator permissions for participant management

---

## Story 4.4: Group Chat Typing Indicators & Read Receipts

**User Story:**
As a group chat participant,
I want to see who is typing and who has read messages in the group,
so that I have awareness of group engagement.

**Acceptance Criteria:**

1. Typing indicator in group chat shows all currently typing participants (e.g., "Alice and Bob are typing...")
2. If 3+ users typing, display abbreviated indicator (e.g., "Alice, Bob, and 2 others are typing...")
3. Typing state tracked per-user in conversation metadata or presence system
4. Read receipts in group chat show read count (e.g., "Read by 5" or list of names who read)
5. Tapping read receipt indicator shows list of participants who have/haven't read the message
6. Group chat read status updates when any participant views message (incremental read tracking)
7. Read receipt privacy setting (from Story 3.3) applies to group chats (users can opt out of sending read status)
8. Typing and read receipt features perform efficiently even with 50 participants (optimized queries)
9. TypeScript types support multi-user typing state and read status arrays
10. Group typing/read features tested with 10+ participants simultaneously

---

## Story 4.5: Archive Conversations

**User Story:**
As a user,
I want to archive conversations to hide them from my main list,
so that I can declutter my conversation list without deleting chats.

**Acceptance Criteria:**

1. Swipe-left gesture on conversation list item reveals "Archive" action
2. Tapping archive moves conversation to archived state (hidden from main conversation list)
3. Firestore conversation document updated with per-user archived flag (archivedBy map: `{ userId: true/false }`)
4. Archived conversations accessible via "Archived" view (link in conversation list header or settings)
5. Archived view displays all archived conversations for current user
6. Unarchive option available in archived conversation list (swipe or long-press menu)
7. Unarchiving conversation moves it back to main conversation list
8. New messages in archived conversations automatically unarchive them (conversation reappears in main list)
9. Archived conversations still receive push notifications (archiving doesn't mute)
10. TypeScript types support archivedBy map in Conversation interface

---

## Story 4.6: Delete Conversations

**User Story:**
As a user,
I want to delete conversations permanently,
so that I can remove chats I no longer need.

**Acceptance Criteria:**

1. Swipe-left gesture on conversation list item reveals "Delete" action (alongside "Archive")
2. Tapping delete prompts confirmation dialog ("Are you sure you want to delete this conversation?")
3. Confirming delete removes conversation from user's conversation list (for that user only, not other participants)
4. Firestore implementation uses per-user deletion flag (deletedBy map: `{ userId: true/false }`) rather than hard delete
5. Deleted conversations do not appear in main list or archived list for deleting user
6. Messages remain in Firestore for other participants (only removed from deleting user's view)
7. Hard delete option (admin/cleanup) can be added later to remove conversations deleted by all participants
8. User cannot undo deletion (permanent action, hence confirmation dialog)
9. Deleted conversations do not send push notifications to deleting user
10. TypeScript types support deletedBy map in Conversation interface

---

## Story 4.7: Batch Actions for Conversation Management

**User Story:**
As a user,
I want to select multiple conversations and perform batch actions (archive/delete),
so that I can efficiently manage many conversations at once.

**Acceptance Criteria:**

1. Long-press on conversation list item enters selection mode
2. Selection mode displays checkboxes on all conversation list items
3. User can tap multiple conversations to select them (visual indication of selected state)
4. Selection mode header shows count of selected conversations (e.g., "3 selected")
5. "Archive" button in selection mode archives all selected conversations simultaneously
6. "Delete" button in selection mode shows confirmation and deletes all selected conversations
7. Batch operations update Firestore documents for all selected conversations (efficient batch write)
8. Selection mode can be exited via "Cancel" button or back navigation
9. Batch actions complete with loading indicator and success feedback (e.g., "3 conversations archived")
10. TypeScript types support selection state management in conversation list

---

## Story 4.8: Firestore Query Optimization for Cost Efficiency

**User Story:**
As a developer,
I want to optimize Firestore queries to minimize read/write costs,
so that the app remains cost-efficient as it scales (NFR7 requirement).

**Acceptance Criteria:**

1. Conversation list query uses Firestore limit to fetch only visible conversations (e.g., 20-30 most recent)
2. Pagination implemented for conversation list (load more on scroll, not all conversations at once)
3. Message queries use limit and startAfter for efficient pagination (from Epic 2, verify optimization)
4. Firestore offline persistence reduces redundant reads (cached data served from local storage)
5. Composite indexes created for all complex queries (conversation participantIds + timestamp, message timestamp)
6. Real-time listeners scoped to minimal necessary data (e.g., only active conversations, not archived/deleted)
7. Unread count calculations use efficient Firestore aggregation or incremental updates (avoid full message scans)
8. Profile photo URLs cached locally to avoid repeated Storage reads
9. Firestore usage monitored in Firebase console (reads/writes per day tracked against budget)
10. Documentation added explaining query optimization strategies and cost monitoring approach

---
