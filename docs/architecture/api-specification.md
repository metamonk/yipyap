# API Specification

Since yipyap uses Firebase Client SDK for direct database access, there is no traditional REST API. Instead, we define Firestore access patterns and security rules that govern data operations.

## Firestore Access Patterns

### Authentication Operations

**Email/Password Authentication (MVP):**

- `firebase.auth().createUserWithEmailAndPassword(email, password)` - Create new user account
- `firebase.auth().signInWithEmailAndPassword(email, password)` - Sign in existing user
- `firebase.auth().sendPasswordResetEmail(email)` - Send password reset email
- `firebase.auth().updateProfile({ displayName })` - Update user profile information
- `firebase.auth().signOut()` - User logout (clears Firebase session)

### User Operations

```typescript
// Create/Update user profile
firestore.collection('users').doc(uid).set(userData);

// Get user profile
firestore.collection('users').doc(uid).get();

// Update presence
firestore.collection('users').doc(uid).update({
  'presence.status': 'online',
  'presence.lastSeen': firebase.firestore.FieldValue.serverTimestamp(),
});
```

### Conversation Operations

```typescript
// Get user's conversations
firestore
  .collection('conversations')
  .where('participantIds', 'array-contains', userId)
  .where(`deletedBy.${userId}`, '!=', true)
  .orderBy('lastMessageTimestamp', 'desc')
  .limit(30);

// Create conversation
firestore.collection('conversations').add(conversationData);

// Update conversation (archive, mute, etc.)
firestore
  .collection('conversations')
  .doc(conversationId)
  .update({
    [`archivedBy.${userId}`]: true,
  });
```

### Message Operations

```typescript
// Send message
firestore.collection('conversations').doc(conversationId).collection('messages').add(messageData);

// Get messages with pagination
firestore
  .collection('conversations')
  .doc(conversationId)
  .collection('messages')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .startAfter(lastVisible);

// Real-time message listener
firestore
  .collection('conversations')
  .doc(conversationId)
  .collection('messages')
  .orderBy('timestamp', 'desc')
  .limit(1)
  .onSnapshot((snapshot) => {
    /* handle new messages */
  });

// Update message status
firestore
  .collection('conversations')
  .doc(conversationId)
  .collection('messages')
  .doc(messageId)
  .update({ status: 'read', readBy: firebase.firestore.FieldValue.arrayUnion(userId) });
```

---
