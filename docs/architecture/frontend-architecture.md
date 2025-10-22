# Frontend Architecture

## Component Architecture

### Component Organization

```
app/
├── (auth)/                 # Authentication screens
│   ├── login.tsx          # Email/Password Sign-In
│   ├── register.tsx       # Email/Password Registration
│   ├── forgot-password.tsx # Password reset
│   └── username-setup.tsx # First-time username entry
├── (tabs)/                 # Main app tabs
│   ├── _layout.tsx        # Tab navigator
│   ├── conversations/      # Conversation list
│   │   └── index.tsx
│   ├── chat/              # Chat screens
│   │   ├── [id].tsx       # Dynamic chat route
│   │   └── new.tsx        # New conversation
│   └── profile/           # Profile screens
│       ├── index.tsx
│       └── settings.tsx
└── _layout.tsx            # Root layout

components/
├── common/                # Shared components
│   ├── Avatar.tsx
│   ├── Badge.tsx
│   └── LoadingSpinner.tsx
├── conversation/          # Conversation components
│   ├── ConversationList.tsx
│   ├── ConversationListItem.tsx
│   └── ConversationActions.tsx
├── chat/                  # Chat components
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── MessageInput.tsx
│   ├── TypingIndicator.tsx
│   └── MessageStatus.tsx
└── profile/              # Profile components
    ├── ProfileHeader.tsx
    └── ProfileForm.tsx
```

### Component Template

```typescript
import React, { FC, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar?: boolean;
}

export const MessageItem: FC<MessageItemProps> = memo(({
  message,
  isOwnMessage,
  showAvatar = true
}) => {
  const theme = useTheme();

  return (
    <View style={[
      styles.container,
      isOwnMessage ? styles.ownMessage : styles.otherMessage
    ]}>
      {/* Component implementation */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12
  },
  ownMessage: {
    justifyContent: 'flex-end'
  },
  otherMessage: {
    justifyContent: 'flex-start'
  }
});
```

## State Management Architecture

### State Structure

```typescript
// Using Zustand for state management
interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;

  // Conversations state
  conversations: Conversation[];
  activeConversationId: string | null;
  conversationLoading: boolean;

  // Messages state
  messages: Record<string, Message[]>; // Keyed by conversationId
  optimisticMessages: Message[]; // Temporary messages

  // UI state
  typingUsers: Record<string, string[]>; // conversationId -> userIds
  connectionStatus: 'online' | 'offline';

  // Actions
  setUser: (user: User | null) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  setTypingUsers: (conversationId: string, users: string[]) => void;
}
```

### State Management Patterns

- Optimistic updates for all user actions
- Real-time sync with Firestore listeners
- Local cache persistence using MMKV
- Selective subscription to active conversation
- Cleanup on unmount to prevent memory leaks

## Routing Architecture

### Route Organization

```
app/
├── (auth)/              # Public routes (not authenticated)
│   ├── _layout.tsx     # Stack navigator
│   ├── login.tsx       # Email/Password Sign-In screen
│   ├── register.tsx    # Email/Password Registration screen
│   ├── forgot-password.tsx # Password reset screen
│   └── username-setup.tsx # First-time username entry
├── (tabs)/              # Protected routes (authenticated)
│   ├── _layout.tsx     # Tab navigator
│   ├── conversations/
│   │   ├── _layout.tsx # Stack navigator
│   │   ├── index.tsx   # Conversation list
│   │   └── archived.tsx # Archived conversations
│   ├── chat/
│   │   ├── _layout.tsx # Stack navigator
│   │   ├── [id].tsx    # Dynamic chat route
│   │   ├── new.tsx     # New conversation
│   │   └── settings/[id].tsx # Conversation settings
│   └── profile/
│       ├── _layout.tsx # Stack navigator
│       ├── index.tsx
│       ├── edit.tsx
│       └── settings.tsx
└── _layout.tsx         # Root layout with auth check
```

### Protected Route Pattern

```typescript
// app/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <SplashScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

## Frontend Services Layer

### API Client Setup

```typescript
// services/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableNetwork, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import NetInfo from '@react-native-community/netinfo';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const firestore = getFirestore(app);
export const storage = getStorage(app);
export const messaging = getMessaging(app);

// Handle offline/online state
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    enableNetwork(firestore);
  } else {
    disableNetwork(firestore);
  }
});

// Enable offline persistence
firestore.enablePersistence();
```

### Service Example

```typescript
// services/conversationService.ts
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';

export class ConversationService {
  // Get user's conversations with real-time updates
  subscribeToConversations(userId: string, callback: (conversations: Conversation[]) => void) {
    const q = query(
      collection(firestore, 'conversations'),
      where('participantIds', 'array-contains', userId),
      where(`deletedBy.${userId}`, '!=', true),
      orderBy('lastMessageTimestamp', 'desc'),
      limit(30)
    );

    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Conversation
      );
      callback(conversations);
    });
  }

  // Create a new conversation
  async createConversation(participants: string[], type: 'direct' | 'group', groupName?: string) {
    const conversationData = {
      type,
      participantIds: participants,
      groupName: groupName || null,
      lastMessage: null,
      lastMessageTimestamp: serverTimestamp(),
      unreadCount: {},
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(firestore, 'conversations'), conversationData);
    return docRef.id;
  }

  // Archive a conversation
  async archiveConversation(conversationId: string, userId: string, archive: boolean) {
    await updateDoc(doc(firestore, 'conversations', conversationId), {
      [`archivedBy.${userId}`]: archive,
      updatedAt: serverTimestamp(),
    });
  }
}

export const conversationService = new ConversationService();
```

---
