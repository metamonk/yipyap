# Database Schema

## Firestore Collections Structure

```javascript
// Root Collections
firestore
├── users/                           // User profiles
│   └── {userId}/
│       ├── uid: string
│       ├── username: string         // Unique, indexed
│       ├── displayName: string
│       ├── email: string            // From Firebase Auth
│       ├── photoURL: string?
│       ├── fcmToken: string?        // Legacy single token
│       ├── fcmTokens: PushToken[]?  // Multi-device tokens
│       ├── presence: {              // Basic presence (detailed in RTDB)
│       │     status: 'online' | 'offline',
│       │     lastSeen: timestamp
│       │   }
│       ├── settings: {
│       │     sendReadReceipts: boolean,
│       │     notificationsEnabled: boolean,
│       │     notifications?: {...}, // Detailed preferences
│       │     presence?: {...}       // Presence preferences
│       │   }
│       ├── createdAt: timestamp
│       └── updatedAt: timestamp
│
├── conversations/                    // All conversations
│   └── {conversationId}/
│       ├── id: string
│       ├── type: 'direct' | 'group'
│       ├── participantIds: string[] // Indexed for queries
│       ├── groupName: string?       // For group chats
│       ├── groupPhotoURL: string?
│       ├── creatorId: string?       // Group creator
│       ├── adminIds: string[]?      // Group admins
│       ├── lastMessage: {
│       │     text: string,
│       │     senderId: string,
│       │     timestamp: timestamp
│       │   }
│       ├── lastMessageTimestamp: timestamp // Indexed for sorting
│       ├── unreadCount: map<userId, number>
│       ├── archivedBy: map<userId, boolean>
│       ├── deletedBy: map<userId, boolean>
│       ├── mutedBy: map<userId, boolean>
│       ├── createdAt: timestamp
│       ├── updatedAt: timestamp
│       └── messages/                // Subcollection
│           └── {messageId}/
│               ├── id: string
│               ├── senderId: string
│               ├── text: string
│               ├── status: 'sending' | 'delivered' | 'read'
│               ├── readBy: string[]
│               ├── timestamp: timestamp // Indexed for ordering
│               └── metadata: {       // AI-ready fields
│                     category?: string,
│                     sentiment?: string,
│                     aiProcessed?: boolean
│                   }
│
└── usernames/                       // Username uniqueness check
    └── {username}/
        └── uid: string               // Points to user
```

## Firebase Realtime Database Structure

```javascript
// Realtime Database (for low-latency presence & typing)
realtimeDatabase
├── presence/                         // User presence tracking
│   └── {userId}/
│       ├── state: 'online' | 'offline' | 'away'
│       ├── lastSeen: number         // Unix timestamp (ms)
│       └── devices/                 // Multi-device support
│           └── {deviceId}/
│               ├── state: 'online' | 'offline'
│               ├── platform: 'ios' | 'android' | 'web'
│               ├── lastActivity: number
│               └── appVersion?: string
│
└── typing/                          // Typing indicators
    └── {conversationId}/
        └── {userId}/
            ├── isTyping: boolean
            └── timestamp: number    // Unix timestamp (ms)
```

## Firestore Indexes

```javascript
// Composite Indexes (defined in firestore.indexes.json)
{
  "indexes": [
    {
      "collectionGroup": "conversations",
      "fields": [
        { "fieldPath": "participantIds", "arrayConfig": "CONTAINS" },
        { "fieldPath": "lastMessageTimestamp", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "messages",
      "fields": [
        { "fieldPath": "conversationId", "order": "ASCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own profile
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    // Conversations - users can access if they're participants
    match /conversations/{conversationId} {
      allow read: if request.auth != null &&
        request.auth.uid in resource.data.participantIds;
      allow create: if request.auth != null &&
        request.auth.uid in request.resource.data.participantIds;
      allow update: if request.auth != null &&
        request.auth.uid in resource.data.participantIds;

      // Messages within conversations
      match /messages/{messageId} {
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;
        allow create: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds &&
          request.auth.uid == request.resource.data.senderId;
        allow update: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;
      }
    }

    // Username uniqueness collection
    match /usernames/{username} {
      allow read: if request.auth != null;
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.uid;
    }
  }
}
```

---
