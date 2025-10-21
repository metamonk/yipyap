# Requirements

## Functional Requirements

- **FR1:** Users must be able to register and login securely using Firebase Authentication
- **FR2:** Users must be able to create and edit profiles with username, display name, and profile photo
- **FR3:** Users must be able to send and receive text messages in real-time (one-on-one chat)
- **FR4:** Users must be able to create and participate in group chats with 3-50 participants
- **FR5:** Users must be able to view complete conversation history with pagination (load 50 messages at a time)
- **FR6:** Users must be able to search message history by keyword
- **FR7:** Messages must display timestamps and date separators (e.g., "Today," "Yesterday")
- **FR8:** Users must be able to see online/offline status and "last seen" timestamps for other users
- **FR9:** Users must be able to see typing indicators when other users are composing messages
- **FR10:** Messages must show delivery status (sending → delivered → read) with visual indicators
- **FR11:** Users must be able to see read receipts (double checkmark system) with option to disable sending
- **FR12:** Users must receive push notifications for new messages when app is backgrounded or closed
- **FR13:** Users must be able to view conversation list with unread count badges and last message preview
- **FR14:** Users must be able to archive, mute, or delete conversations
- **FR15:** Users must be able to perform batch actions on multiple conversations (select and archive/delete)
- **FR16:** Group chat creators must be able to add/remove participants and manage group name and photo
- **FR17:** Messages sent while offline must queue and auto-send when connectivity returns

## Non-Functional Requirements

- **NFR1:** Message delivery latency must be sub-500ms (P95) under normal network conditions
- **NFR2:** System must maintain 99.5%+ uptime for messaging infrastructure
- **NFR3:** Platform must support 1,000+ concurrent users without performance degradation
- **NFR4:** Optimistic UI updates must display messages instantly in sender's view before server confirmation
- **NFR5:** Offline message sync success rate must exceed 99%
- **NFR6:** Push notification delivery rate must exceed 95%
- **NFR7:** Firebase Firestore usage must stay within 80% of free-tier or budget limits through optimized queries
- **NFR8:** App crash rate must remain below 1% of sessions
- **NFR9:** Data architecture must include metadata fields to support future AI categorization and analysis
- **NFR10:** Application must be cross-platform (iOS and Android) using React Native/Expo
- **NFR11:** Message data must persist reliably with zero critical data loss
- **NFR12:** Security must be enforced through properly configured Firebase Security Rules
- **NFR13:** App must use efficient rendering patterns (FlatList) to handle large message lists without lag

---
