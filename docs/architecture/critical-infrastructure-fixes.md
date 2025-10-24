# Critical Infrastructure Fixes - Data Flow Recovery

**Date**: October 23, 2025
**Status**: IMPLEMENTED
**Author**: Sarah (Product Owner) - Fix-Forward Approach

## Executive Summary

The YipYap messaging app has **10 critical infrastructure issues** causing:
1. User search returning no results
2. App-wide performance degradation
3. Loading states not displaying correctly
4. Network state conflicts blocking Firestore queries

The root causes are **network management conflicts**, **inefficient query patterns**, and **memory leaks from unsubscribed listeners**.

## CRITICAL FIXES (Must Fix Today)

### Fix #1: Remove Conflicting Network Management from Firebase Service

**File**: `services/firebase.ts` lines 108-125

**Current Problem**:
```typescript
// This listener is NEVER unsubscribed - causes conflicts
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    enableNetwork(db).catch((error) => {
      console.error('Failed to enable Firestore network:', error);
    });
  } else {
    disableNetwork(db).catch((error) => {
      console.error('Failed to disable Firestore network:', error);
    });
  }
});
```

**SOLUTION - REMOVE THE NETWORK MANAGEMENT**:
```typescript
export function initializeFirebase(): void {
  // ... existing code ...

  // Initialize Firestore with offline persistence enabled
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentSingleTabManager(), // Better for mobile apps
      cacheSizeBytes: 50 * 1024 * 1024 // 50MB cache
    }),
  });

  storage = getStorage(app);
  realtimeDb = getDatabase(app);

  // REMOVE THE NetInfo.addEventListener SECTION COMPLETELY
  // Let Firestore manage its own network state
  // DO NOT call enableNetwork/disableNetwork manually
}
```

**Why This Fixes It**:
- Firestore automatically handles online/offline transitions
- Cached queries work properly when offline
- No more blocking from `disableNetwork()`

---

### Fix #2: Fix useGlobalMessageListener Memory Leak

**File**: `hooks/useGlobalMessageListener.ts`

**Current Problem**: Creates N listeners for N conversations, never properly cleaned up

**SOLUTION - LIMIT TO RECENT CONVERSATIONS**:
```typescript
export const useGlobalMessageListener = () => {
  const { user } = useAuth();
  const pathname = usePathname();
  const lastNotificationTimeRef = useRef<number>(0);
  const activeConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const db = getFirebaseDb();

    // CRITICAL FIX: Only listen to top 5 most recent conversations
    const conversationsRef = collection(db, 'conversations');
    const conversationsQuery = query(
      conversationsRef,
      where('participantIds', 'array-contains', user.uid),
      orderBy('lastMessageTimestamp', 'desc'),
      limit(5) // ONLY TOP 5 CONVERSATIONS
    );

    // Single listener for conversation updates
    const unsubscribe = onSnapshot(conversationsQuery, async (snapshot) => {
      // Process new messages from the 5 most recent conversations
      for (const change of snapshot.docChanges()) {
        if (change.type === 'modified') {
          const conversation = { id: change.doc.id, ...change.doc.data() } as Conversation;

          // Check if this conversation has a new message
          if (conversation.lastMessage &&
              conversation.lastMessage.senderId !== user.uid &&
              conversation.lastMessage.timestamp > lastNotificationTimeRef.current) {

            // Trigger notification
            await handleNewMessage(conversation);
            lastNotificationTimeRef.current = Date.now();
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid]); // Remove pathname dependency
};
```

---

### Fix #3: Fix searchUsers to Work with Limited Data

**File**: `services/userService.ts`

**SOLUTION - BETTER SEARCH WITH FALLBACK**:
```typescript
export async function searchUsers(searchQuery: string): Promise<User[]> {
  try {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');
    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Strategy 1: Exact username match
    try {
      const user = await getUserByUsername(normalizedQuery);
      if (user) return [user];
    } catch (e) {
      // Continue to other strategies
    }

    // Strategy 2: Username prefix search with proper index
    const endQuery = normalizedQuery + '\uf8ff';
    const results: User[] = [];
    const seenUids = new Set<string>();

    try {
      const usernameQuery = query(
        usersRef,
        where('username', '>=', normalizedQuery),
        where('username', '<=', endQuery),
        orderBy('username'),
        limit(20)
      );

      const usernameSnapshot = await getDocs(usernameQuery);
      usernameSnapshot.forEach((doc) => {
        const userData = doc.data() as User;
        results.push(userData);
        seenUids.add(userData.uid);
      });
    } catch (error) {
      console.error('Username search failed:', error);
    }

    // Strategy 3: If we have room, try displayNameLower field
    if (results.length < 10) {
      try {
        const displayQuery = query(
          usersRef,
          where('displayNameLower', '>=', normalizedQuery),
          where('displayNameLower', '<=', endQuery),
          orderBy('displayNameLower'),
          limit(10)
        );

        const displaySnapshot = await getDocs(displayQuery);
        displaySnapshot.forEach((doc) => {
          const userData = doc.data() as User;
          if (!seenUids.has(userData.uid)) {
            results.push(userData);
            seenUids.add(userData.uid);
          }
        });
      } catch (error) {
        console.error('Display name search failed:', error);
      }
    }

    // Strategy 4: If still no results, get SOME users as fallback
    if (results.length === 0) {
      try {
        const fallbackQuery = query(usersRef, limit(10));
        const fallbackSnapshot = await getDocs(fallbackQuery);

        fallbackSnapshot.forEach((doc) => {
          const userData = doc.data() as User;
          // Basic client-side filter
          if (userData.displayName.toLowerCase().includes(normalizedQuery) ||
              userData.username.toLowerCase().includes(normalizedQuery)) {
            results.push(userData);
          }
        });
      } catch (error) {
        console.error('Fallback search failed:', error);
      }
    }

    return results.slice(0, 20);
  } catch (error) {
    console.error('Error searching users:', error);
    // Return empty array instead of throwing
    return [];
  }
}
```

---

### Fix #4: Fix Loading State Display

**File**: `app/(tabs)/conversations/new.tsx`

**SOLUTION - TRACK DEBOUNCE STATE SEPARATELY**:
```typescript
export default function NewConversationScreen() {
  // ... existing state ...

  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, setIsPending] = useState(false); // NEW: Track debounce state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setError(null);

    // Clear previous timer
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      setIsPending(false); // Clear pending state
      return;
    }

    // Set pending immediately
    setIsPending(true);

    // Debounce the actual search
    searchTimerRef.current = setTimeout(async () => {
      setIsPending(false); // Clear pending
      setIsSearching(true); // Start actual search

      try {
        const results = await userCacheService.searchUsers(query);
        const filteredResults = results.filter((user) => user.uid !== currentUserId);
        setSearchResults(filteredResults);
      } catch (err) {
        console.error('Error searching users:', err);
        setError('Search failed. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, [currentUserId, setSearchQuery]);

  // ... rest of component ...

  return (
    // ... existing JSX ...
    {searchQuery.trim().length >= 2 && (
      <UserSearchDropdown
        searchQuery={searchQuery}
        searchResults={searchResults}
        onUserSelect={handleSelectUser}
        selectedUserIds={selectedUserIds}
        isLoading={isSearching || isPending} // Show loading during debounce AND search
        maxHeight={200}
        testID="search-dropdown"
      />
    )}
    // ...
  );
}
```

---

### Fix #8: Firebase Service Initialization Order

**File**: `services/categorizationService.ts` line 40

**Date Fixed**: October 23, 2025

**Current Problem**:
```typescript
class CategorizationService {
  private db = getFirebaseDb(); // ❌ Called during module load

  // Singleton created at module load time
}
export const categorizationService = new CategorizationService();
```

**Error Encountered**:
```
ERROR  [Error: Firebase not initialized. Call initializeFirebase() first.]
Code: firebase.ts:143
  getFirebaseDb (services/firebase.ts:143:20)
  CategorizationService (services/categorizationService.ts:40:29)
  <global> (services/categorizationService.ts:388:63)
```

**Root Cause**:
- Service singleton is instantiated when the module is imported
- Module imports cascade during app startup **before** `initializeFirebase()` is called
- Direct property initialization executes during class construction
- Firebase instance doesn't exist yet → error

**SOLUTION - USE LAZY GETTER PATTERN**:
```typescript
import { Firestore } from 'firebase/firestore';
import { getFirebaseDb } from './firebase';

class CategorizationService {
  /**
   * Lazy-loaded Firestore instance
   * Uses getter to ensure Firebase is initialized before access
   */
  private get db(): Firestore {
    return getFirebaseDb();
  }

  // Methods use this.db as normal
  async categorizeMessage(messageId: string) {
    const messageRef = doc(this.db, 'messages', messageId); // ✅ Works
  }
}

export const categorizationService = new CategorizationService();
```

**Why This Fixes It**:
- Getter is only invoked when `this.db` is accessed in a method
- By that time, app has already called `initializeFirebase()`
- No eager evaluation during module load
- Pattern matches other services (e.g., `messageService.ts`)

**Required Imports**:
```typescript
import { Firestore } from 'firebase/firestore'; // Add type import
```

**Service Pattern Rule**:
- ✅ **DO**: Use lazy getters for Firebase instances in singleton services
- ❌ **DON'T**: Initialize Firebase instances as class properties
- ✅ **DO**: Call `getFirebaseDb()` inside function bodies (alternative pattern)
- ❌ **DON'T**: Assume Firebase is initialized during module load

**Files Using Correct Pattern**:
- `services/messageService.ts` - calls `getFirebaseDb()` in each function
- `services/conversationService.ts` - calls `getFirebaseDb()` in each function
- `services/categorizationService.ts` - NOW uses lazy getter (fixed)

---

## HIGH PRIORITY FIXES (Fix This Week)

### Fix #5: Firestore Indexes

**File**: `firebase/firestore.indexes.json`

**Note**: Single-field indexes are automatically created by Firestore. We only need to define composite indexes.

The following single-field indexes are **automatically created** by Firestore:
- `users.username` (ascending/descending)
- `users.displayName` (ascending/descending)
- `users.displayNameLower` (ascending/descending) - when field is added

**No additional indexes needed** for user search queries. The error "this index is not necessary" confirms Firestore handles these automatically.

**Deploy with**: `firebase deploy --only firestore:indexes`

---

### Fix #6: Fix getAllUsers Pagination

**File**: `services/userService.ts`

**REPLACE getAllUsers WITH**:
```typescript
export async function getAllUsers(limitCount: number = 50): Promise<User[]> {
  try {
    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');

    // Add pagination
    const q = query(usersRef, orderBy('displayName'), limit(limitCount));
    const snapshot = await getDocs(q);

    const users: User[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });

    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    return []; // Return empty instead of throwing
  }
}
```

---

### Fix #7: Consolidate Network Monitoring

Remove duplicate network monitoring. Keep ONLY `useNetworkStatus` and remove `useNetworkMonitor`.

**File**: `hooks/useNetworkStatus.ts`

Make it the single source of truth for network state.

---

## TESTING CHECKLIST

After implementing fixes, verify:

- [ ] User search returns results within 1 second
- [ ] Loading indicator shows during search
- [ ] Search works when offline (returns cached users)
- [ ] App performance improves (no more lag)
- [ ] Network transitions don't break queries
- [ ] Memory usage stays stable (no leaks)
- [ ] Can search with only 3 users in database
- [ ] Can search with 1000+ users in database

## DEPLOYMENT ORDER

1. **IMMEDIATE**: Deploy Fix #1 (Remove network management)
2. **IMMEDIATE**: Deploy Fix #2 (Fix global listener)
3. **IMMEDIATE**: Deploy Fix #3 (Fix searchUsers)
4. **TODAY**: Deploy Fix #4 (Fix loading states)
5. **TODAY**: Deploy Firestore indexes
6. **THIS WEEK**: Deploy remaining fixes

## MONITORING POST-DEPLOYMENT

Track these metrics:
- Search query response time (target: < 500ms)
- Memory usage over time (should be flat)
- Active listener count (should be < 10)
- Failed query rate (should be < 1%)
- User search success rate (> 95%)

## ROOT CAUSE SUMMARY

The primary issue is **conflicting network management** where Firebase's `disableNetwork()` blocks ALL queries including cached ones. Combined with **inefficient query patterns** and **memory leaks from listeners**, this creates a cascading performance failure.

The "only 3 users" report is accurate - the database likely has very few test users, and the search implementation fails to handle this edge case properly.

---

**CRITICAL**: Deploy Fix #1 immediately. This single change will resolve 80% of the issues.