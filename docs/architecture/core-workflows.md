# Core Workflows

## User Registration and Onboarding Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant FirebaseAuth
    participant Firestore
    participant Storage

    User->>App: Tap "Create Account"
    User->>App: Enter email, password, display name
    App->>App: Validate email format and password strength
    App->>FirebaseAuth: createUserWithEmailAndPassword(email, password)
    FirebaseAuth-->>App: Return user UID
    App->>FirebaseAuth: updateProfile(displayName)
    FirebaseAuth-->>App: Profile updated
    App->>App: Navigate to username setup
    User->>App: Enter unique username
    App->>Firestore: Check username uniqueness
    Firestore-->>App: Username available
    User->>App: Optionally upload profile photo
    App->>Storage: Upload photo (optional)
    Storage-->>App: Return photo URL (if uploaded)
    App->>Firestore: Create user document
    Firestore-->>App: User profile created
    App->>App: Navigate to conversation list
```

## User Login Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant FirebaseAuth
    participant Firestore

    User->>App: Enter email and password
    App->>FirebaseAuth: signInWithEmailAndPassword(email, password)
    FirebaseAuth-->>App: Return user UID + auth token
    App->>Firestore: Fetch user profile
    Firestore-->>App: Return user data
    App->>App: Check if username setup complete
    alt Username exists
        App->>App: Navigate to conversation list
    else No username
        App->>App: Navigate to username setup
    end
```

## Real-time Message Send/Receive Flow

```mermaid
sequenceDiagram
    participant SenderApp
    participant Firestore
    participant ReceiverApp
    participant FCM

    SenderApp->>SenderApp: Optimistic UI update (show message)
    SenderApp->>Firestore: Add message to conversation
    Firestore-->>SenderApp: Message confirmed (ID returned)
    SenderApp->>SenderApp: Update message status to "delivered"

    Firestore-->>ReceiverApp: Real-time listener triggered
    ReceiverApp->>ReceiverApp: Display new message
    ReceiverApp->>Firestore: Update message status to "read"

    Note over Firestore,FCM: If receiver app is backgrounded
    Firestore->>FCM: Trigger notification
    FCM->>ReceiverApp: Push notification
    ReceiverApp->>ReceiverApp: Update badge count
```

## Offline Message Sync Workflow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant LocalCache
    participant Firestore

    Note over App: Device goes offline
    User->>App: Send message
    App->>LocalCache: Queue message locally
    App->>App: Show message with "sending" status

    Note over App: Device comes online
    App->>Firestore: Sync queued messages
    Firestore-->>App: Messages confirmed
    App->>App: Update message status
    App->>LocalCache: Clear sent messages from queue

    Firestore-->>App: Sync messages received while offline
    App->>App: Display received messages
```

## App Lifecycle and Foreground Sync Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant AppState
    participant Presence
    participant Firestore
    participant RTDB

    Note over App: App in foreground
    App->>Presence: Mark device as online
    Presence->>RTDB: Update presence status
    App->>Firestore: Active message listeners

    User->>App: Press home button
    App->>AppState: Detect background state
    AppState->>Presence: Mark device as offline
    Presence->>RTDB: Update presence to offline
    Note over App,Firestore: Listeners remain active (iOS: ~30s, Android: varies)

    User->>App: Tap app icon (foreground)
    App->>AppState: Detect active state
    AppState->>Presence: Mark device as online
    Presence->>RTDB: Update presence to online

    App->>App: Trigger explicit sync
    App->>Firestore: refreshConversations()
    Firestore-->>App: Return missed messages
    App->>App: Display sync indicator
    App->>App: Update UI with synced data
    App->>App: Hide sync indicator

    Note over RTDB: Connection monitoring
    RTDB->>App: Connection status update
    App->>App: Log connection state

    Note over Firestore: Auto-reconnection
    Firestore->>App: Snapshot listeners resume
    App->>App: Process queued operations
```

### Lifecycle State Transitions

The app manages three critical lifecycle states:

1. **Active (Foreground)**
   - Presence: Device marked as "online"
   - Realtime listeners: Active
   - Sync behavior: Automatic via listeners
   - Push notifications: Suppressed (user already in app)

2. **Background**
   - Presence: Device marked as "offline"
   - Realtime listeners: Active for limited time (platform-dependent)
   - Sync behavior: Queued for next foreground
   - Push notifications: Delivered to user

3. **Inactive (App Killed)**
   - Presence: Device marked as "offline" (via onDisconnect)
   - Realtime listeners: Cleaned up by OS
   - Sync behavior: Full sync on next launch
   - Push notifications: Delivered to user

### Explicit Foreground Sync

When the app returns to foreground, an explicit sync is triggered to ensure instant message recovery:

**Implementation:** `app/_layout.tsx:93-114`

```typescript
useEffect(() => {
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    const wasInBackground =
      appStateRef.current === 'background' || appStateRef.current === 'inactive';
    const isNowActive = nextAppState === 'active';

    if (wasInBackground && isNowActive && user?.uid) {
      console.log('[RootLayout] App foregrounded - triggering conversation sync');
      await refreshConversations(user.uid);
      console.log('[RootLayout] Conversation sync completed');
    }

    appStateRef.current = nextAppState;
  });

  return () => subscription.remove();
}, [user?.uid]);
```

**Why this matters:**

- Firebase's automatic reconnection can take 3-10 seconds
- Users expect instant message updates when foregrounding
- Explicit sync provides 1-3 second message recovery
- Prevents "blank screen" experience after backgrounding

### Connection Health Monitoring

Real-time connection monitoring provides visibility into Firebase RTDB and Firestore status:

**Implementation:** `hooks/useConnectionState.ts:142-177`

```typescript
// Firebase RTDB connection monitoring
unsubscribeRef.current = onValue(connectedRef, async (snapshot) => {
  const isConnected = snapshot.val() === true;

  if (isConnected) {
    console.log('[ConnectionState] ✅ Firebase RTDB connected');
    // Process queued operations
    await processQueue();
  } else {
    console.warn('[ConnectionState] ⚠️ Firebase RTDB disconnected');
    // Start reconnection handling
    handleReconnect();
  }
});
```

**Benefits:**

- Real-time visibility into connection status
- Queue management for offline operations
- Exponential backoff for reconnection attempts
- Debugging aid for connection issues

### Sync Indicator UI

Visual feedback during sync operations improves user experience:

**Implementation:** `components/common/SyncBanner.tsx`

```typescript
export const SyncBanner: FC<SyncBannerProps> = ({ isSyncing }) => {
  if (!isSyncing) return null;

  return (
    <Animated.View entering={SlideInUp.duration(300)} style={styles.banner}>
      <ActivityIndicator size="small" color="#fff" />
      <Text style={styles.text}>Syncing messages...</Text>
    </Animated.View>
  );
};
```

**User Experience:**

- Appears at top of screen during sync
- Slides in/out smoothly
- Auto-dismisses when sync completes
- Non-intrusive (transparent when not syncing)

### Battery Efficiency Considerations

The app balances real-time updates with battery conservation:

**Strategies:**

1. **Presence updates only on state changes** - Not continuous polling
2. **Listeners suspended in background** - Reduces network activity
3. **Queued operations** - Batch writes when reconnecting
4. **Exponential backoff** - Prevents aggressive reconnection attempts

**Trade-offs:**

- Instant updates in foreground
- Minimal battery drain in background
- Quick sync on foreground return

---
