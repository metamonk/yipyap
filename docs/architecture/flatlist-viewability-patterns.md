# FlatList Viewability & Scroll Patterns

## Overview

This document captures critical patterns for implementing reliable FlatList scrolling and viewability callbacks in React Native, specifically addressing challenges encountered during Story 3.3 (Read Receipts System) and the migration to inverted FlatList pattern in Story 5.10.

---

## Recommended Pattern: Inverted FlatList for Chat UIs (Story 5.10)

**Status:** ✅ **CURRENT IMPLEMENTATION** (as of Story 5.10)

### What is the Inverted FlatList Pattern?

The inverted FlatList pattern is React Native's industry-standard approach for chat interfaces, used by WhatsApp, Telegram, Slack, and iMessage. Instead of manually scrolling to the bottom, the list is rendered upside-down so newest messages (index 0) automatically appear at the bottom.

```typescript
// Messages sorted newest-first (DESC)
const messages = useMemo(() => {
  return combined.sort((a, b) => {
    const aTime = a.timestamp?.toMillis?.() ?? 0;
    const bTime = b.timestamp?.toMillis?.() ?? 0;
    return bTime - aTime; // DESC: Newest first (index 0 = newest)
  });
}, [confirmedMessages, optimisticMessages]);

// FlatList configured with inverted prop
<FlatList
  inverted={true}  // Renders list upside-down
  data={messages}  // Newest at index 0, oldest at end
  onEndReached={loadMoreMessages}  // "End" is visually at top
  maintainVisibleContentPosition={{
    minIndexForVisible: 0,  // Prevents scroll jumping during pagination
  }}
  viewabilityConfig={viewabilityConfig}  // Viewability still works!
  onViewableItemsChanged={onViewableItemsChanged}
/>
```

### Why Inverted Pattern is Superior

**Before (Manual Scroll Management):**

- 100+ lines of scroll state management code
- 4+ scroll executions during initial load (visible jank)
- Complex timing with `requestAnimationFrame` and `setTimeout`
- Race conditions between scroll requests and content changes
- Manual `scrollToEnd()` calls on every new message
- Disabled `maintainVisibleContentPosition` (conflicts with manual scrolls)

**After (Inverted Pattern):**

- Zero manual scroll management code
- 0 scroll executions (React Native handles automatically)
- No timing issues or race conditions
- New messages at index 0 automatically appear at bottom
- `maintainVisibleContentPosition` enabled for smooth pagination

### Code Deleted in Migration

**Removed from `hooks/useMessages.ts` (~100 lines):**

- `scrollStateRef` - Scroll state tracking
- `scrollToBottom()` - Manual scroll function
- `handleContentSizeChange()` - Scroll trigger callback
- `onContentSizeChange` - Return value
- Initial scroll window closing effect
- Scroll state reset effect
- All `scrollToBottom()` calls throughout hook

**Changes to `app/(tabs)/conversations/[id].tsx`:**

- `inverted={false}` → `inverted={true}`
- Removed `onContentSizeChange={onContentSizeChange}` prop
- `onStartReached={loadMoreMessages}` → `onEndReached={loadMoreMessages}`
- Enabled `maintainVisibleContentPosition={{ minIndexForVisible: 0 }}`

### Viewability Compatibility

✅ **Good News:** Viewability callbacks work identically with inverted lists!

- `onViewableItemsChanged` fires based on screen position, not array index
- 50% visibility threshold works the same
- 500ms minimum view time works the same
- Closure pattern with refs (see below) still required

**No changes needed to:**

- `viewabilityConfig` settings
- `onViewableItemsChanged` callback logic
- Closure refs (`userIdRef`, `conversationIdRef`)
- Performance settings (`removeClippedSubviews`, `windowSize`)

### Date Separator Compatibility

Date separator utilities may expect oldest-first (ASC) order. Use double-reverse pattern:

```typescript
// groupMessagesWithSeparators expects oldest-first (ASC)
// but messages are newest-first (DESC) for inverted list
const chatItems = groupMessagesWithSeparators(
  displayMessages.slice().reverse() // Pass oldest-first to function
).reverse(); // Reverse result back to newest-first for inverted list
```

### Migration Benefits

**Performance:**

- Eliminated 4+ scroll executions during initial load
- Smoother scrolling (no jank from rapid scrolls)
- Reduced re-renders (no scroll state tracking)

**Code Quality:**

- ~100 lines of complexity deleted
- Easier to understand and maintain
- Fewer edge cases and race conditions

**User Experience:**

- Professional feel (matches industry standard apps)
- Instant message display (no scroll delay)
- Smooth pagination (no scroll jumping)

---

## Historical Context: Manual Scroll Management (Pre-Story 5.10)

**Note:** The following sections describe the manual scroll management approach used before Story 5.10. This is preserved for historical context and debugging older implementations. **New implementations should use the inverted pattern above.**

## Core Issue: Read Receipts Weren't Working (Story 3.3)

### The Problem

Read receipts require `onViewableItemsChanged` callback to fire when messages are visible for 500ms. This callback **was not firing at all**, despite the FlatList being properly configured.

### Root Causes

Three critical bugs prevented read receipts from working:

#### **Bug #1: React Closure Issue with useRef** ⚠️ CRITICAL

**What Happened:**

```typescript
// ❌ WRONG: Closure captures initial values
const onViewableItemsChanged = useRef(({ viewableItems }) => {
  // This closure captured user/conversationId from FIRST RENDER
  if (!user?.uid || !conversationId) {
    return; // ALWAYS returned here, even after user loaded!
  }
  // Mark as read logic never executed
}).current;
```

**Why This Happens:**

- FlatList requires `onViewableItemsChanged` to be a **stable reference** (doesn't change between renders)
- This requires `useRef` to create the callback once
- `useRef` creates a **JavaScript closure** that captures variables at creation time
- On first render, `user` is `null` (authentication still loading)
- The callback captured that `null` value and **never updated**
- Even after auth loaded, the callback still saw `user === null`

**The Fix:**

```typescript
// ✅ CORRECT: Use refs to access current values
const userIdRef = useRef(user?.uid);
const conversationIdRef = useRef(conversationId);

// Update refs when values change
useEffect(() => {
  userIdRef.current = user?.uid;
}, [user?.uid]);

useEffect(() => {
  conversationIdRef.current = conversationId;
}, [conversationId]);

// Callback accesses current values from refs
const onViewableItemsChanged = useRef(({ viewableItems }) => {
  const currentUserId = userIdRef.current; // ✅ Gets current value
  const currentConversationId = conversationIdRef.current;

  if (!currentUserId || !currentConversationId) {
    return;
  }
  // Mark as read logic executes correctly
}).current;
```

**Key Lesson:** When using `useRef` for stable callbacks that need access to changing values, **store those values in separate refs** and update them in `useEffect`.

---

#### **Bug #2: Scroll Stacking / FlatList Never Stabilized**

**What Happened:**

```
1. Initial scroll requested: scrollToBottom(false)
2. Content size changed: triggers scroll
3. Timeout fallback fires: triggers ANOTHER scroll (300ms later)
4. Real-time messages arrive: triggers ANOTHER scroll
5. FlatList constantly scrolling, items never visible for 500ms
6. onViewableItemsChanged never fires
```

**Why This Prevents Viewability:**

- Read receipts require items to be visible for `minimumViewTime: 500ms`
- Multiple scroll requests were **stacking**, causing continuous scrolling
- FlatList never stabilized long enough for viewability to trigger
- Items were technically "visible" but scrolling prevented the 500ms threshold

**The Fix:**

```typescript
// ✅ Prevent scroll stacking with state tracking
const scrollStateRef = useRef({
  shouldScrollOnContentChange: false,
  isScrolling: false,
  scrollReason: 'initial' | 'new-message' | 'none',
  initialScrollCompleted: false,
  lastMessageCount: 0,
});

const scrollToBottom = (reason: 'initial' | 'new-message') => {
  // ✅ PREVENTS STACKING
  if (scrollStateRef.current.isScrolling) {
    console.log('Scroll already in progress, skipping');
    return;
  }

  // Set flag for onContentSizeChange to handle the scroll
  scrollStateRef.current.shouldScrollOnContentChange = true;
  scrollStateRef.current.scrollReason = reason;

  // ✅ NO TIMEOUT FALLBACK - eliminates interference
};

const handleContentSizeChange = () => {
  if (scrollStateRef.current.shouldScrollOnContentChange) {
    scrollStateRef.current.isScrolling = true;

    // Use requestAnimationFrame for proper timing
    requestAnimationFrame(() => {
      flatListRef.current.scrollToEnd({ animated: false });

      scrollStateRef.current.shouldScrollOnContentChange = false;
      scrollStateRef.current.scrollReason = 'none';

      // ✅ STABILIZATION PERIOD - Critical for viewability!
      setTimeout(
        () => {
          scrollStateRef.current.isScrolling = false;
          console.log('Scroll complete, FlatList stabilized');
        },
        isInitial ? 1000 : 400
      );
    });
  }
};
```

**Key Lesson:** FlatList viewability requires **stabilization**. Don't stack multiple scroll operations. Use state tracking to ensure only one scroll happens at a time, then wait for FlatList to stabilize.

---

#### **Bug #3: Scroll Timing / Content Changes During Scroll**

**What Happened:**

```
LOG Initial load: 50 messages
LOG Scroll executed to bottom
LOG Real-time update: 58 messages (8 new arrived)
// User ends up in middle of conversation
// Scrolled before all content loaded!
```

**Why This Happens:**

- `scrollToEnd` was called before FlatList finished measuring all content
- Real-time messages arrived **during** the scroll sequence
- No re-scroll happened, leaving user stranded in the middle

**The Fix:**

```typescript
// ✅ Use requestAnimationFrame for proper timing
requestAnimationFrame(() => {
  flatListRef.current.scrollToEnd({ animated: false });
});

// ✅ Safeguard: Re-scroll if messages arrive during initial scroll
useEffect(() => {
  const scrollState = scrollStateRef.current;

  if (
    !loading &&
    !scrollState.initialScrollCompleted &&
    scrollState.scrollReason === 'none' &&
    messages.length > 0
  ) {
    if (scrollState.lastMessageCount > 0 && messages.length > scrollState.lastMessageCount) {
      const newMessages = messages.length - scrollState.lastMessageCount;
      console.log(`Detected ${newMessages} new messages, re-scrolling`);
      scrollToBottom('initial');
    }

    scrollState.lastMessageCount = messages.length;
  }
}, [messages.length, loading, scrollToBottom]);
```

**Key Lesson:** Real-time updates can arrive during scroll sequences. Use `requestAnimationFrame` for timing and add safeguards to detect content changes.

---

## Best Practices for FlatList Viewability

### 1. Stable Reference Requirements

FlatList requires these props to be **stable references**:

- `onViewableItemsChanged` - Use `useRef`
- `viewabilityConfig` - Use `useRef`
- `keyExtractor` - Use `useCallback`
- `renderItem` - Use `useCallback`

**Why:** FlatList internally checks if these props changed to re-register callbacks. Unstable references cause re-registration on every render, breaking viewability tracking.

### 2. Accessing Changing Values in Stable Callbacks

**Pattern:**

```typescript
// Store changing values in refs
const currentValueRef = useRef(initialValue);

useEffect(() => {
  currentValueRef.current = newValue;
}, [newValue]);

// Use ref in stable callback
const stableCallback = useRef((data) => {
  const value = currentValueRef.current; // ✅ Always current
  // Use value...
}).current;
```

### 3. Scroll State Management

**Pattern:**

```typescript
const scrollStateRef = useRef({
  shouldScroll: false,
  isScrolling: false,
  scrollCompleted: false,
});

const requestScroll = () => {
  if (scrollStateRef.current.isScrolling) return; // Prevent stacking
  scrollStateRef.current.shouldScroll = true;
};

const handleContentSizeChange = () => {
  if (scrollStateRef.current.shouldScroll) {
    scrollStateRef.current.isScrolling = true;

    requestAnimationFrame(() => {
      flatListRef.current.scrollToEnd({ animated: false });
      scrollStateRef.current.shouldScroll = false;

      setTimeout(() => {
        scrollStateRef.current.isScrolling = false;
        scrollStateRef.current.scrollCompleted = true;
      }, 1000); // Stabilization period
    });
  }
};
```

### 4. Viewability Configuration

**Recommended Settings:**

```typescript
const viewabilityConfig = useRef({
  itemVisiblePercentThreshold: 50, // Item must be 50% visible
  minimumViewTime: 500, // Visible for 500ms before callback
  waitForInteraction: false, // Fire automatically
}).current;
```

**Why These Values:**

- 50% threshold: Item is clearly visible to user
- 500ms duration: Prevents marking during rapid scrolling
- No wait for interaction: Auto-marks when items become visible

### 5. FlatList Performance Settings for Viewability

```typescript
<FlatList
  removeClippedSubviews={false}  // ✅ Disabled for viewability
  windowSize={21}                 // ✅ Larger window keeps items mounted
  maxToRenderPerBatch={20}        // ✅ Reduces batching delays
  initialNumToRender={30}         // ✅ Renders more initially
  disableVirtualization={false}   // ✅ Keep virtualization for performance
/>
```

**Trade-offs:**

- `removeClippedSubviews={false}`: Slightly higher memory, but ensures viewability fires
- Larger `windowSize`: More items stay mounted, better for viewability tracking
- Higher `initialNumToRender`: More upfront rendering, but items are ready for viewability

---

## Common Pitfalls

### ❌ Pitfall 1: Unstable Callback References

```typescript
// ❌ WRONG: New function on every render
<FlatList
  onViewableItemsChanged={({ viewableItems }) => {
    // This callback is recreated every render
    // FlatList re-registers it, breaking viewability tracking
  }}
/>
```

```typescript
// ✅ CORRECT: Stable reference with useRef
const onViewableItemsChanged = useRef(
  ({ viewableItems }) => {
    // Callback created once, stable reference
  }
).current;

<FlatList onViewableItemsChanged={onViewableItemsChanged} />
```

### ❌ Pitfall 2: Accessing Stale Closures

```typescript
// ❌ WRONG: Closure captures stale values
const [userId, setUserId] = useState(null);

const onViewableItemsChanged = useRef(({ viewableItems }) => {
  console.log(userId); // Always null! Captured at creation time
}).current;
```

```typescript
// ✅ CORRECT: Use ref to access current value
const [userId, setUserId] = useState(null);
const userIdRef = useRef(userId);

useEffect(() => {
  userIdRef.current = userId;
}, [userId]);

const onViewableItemsChanged = useRef(({ viewableItems }) => {
  console.log(userIdRef.current); // ✅ Always current value
}).current;
```

### ❌ Pitfall 3: Scroll Stacking

```typescript
// ❌ WRONG: Multiple scroll requests stack
const scrollToBottom = () => {
  flatListRef.current.scrollToEnd({ animated: true });

  setTimeout(() => {
    flatListRef.current.scrollToEnd({ animated: false }); // Interferes!
  }, 300);
};

// Called multiple times quickly
scrollToBottom(); // Request 1
scrollToBottom(); // Request 2 (while 1 is executing)
scrollToBottom(); // Request 3 (while 1&2 are executing)
```

```typescript
// ✅ CORRECT: Prevent stacking with state
const isScrollingRef = useRef(false);

const scrollToBottom = () => {
  if (isScrollingRef.current) return; // Prevent stacking

  isScrollingRef.current = true;
  flatListRef.current.scrollToEnd({ animated: false });

  setTimeout(() => {
    isScrollingRef.current = false; // Allow next scroll
  }, 1000);
};
```

### ❌ Pitfall 4: Scrolling Before Content Measured

```typescript
// ❌ WRONG: Scroll immediately after setState
setMessages(newMessages);
flatListRef.current.scrollToEnd(); // Content not measured yet!
```

```typescript
// ✅ CORRECT: Scroll in onContentSizeChange
const [shouldScroll, setShouldScroll] = useState(false);

setMessages(newMessages);
setShouldScroll(true);

const onContentSizeChange = () => {
  if (shouldScroll) {
    requestAnimationFrame(() => {
      flatListRef.current.scrollToEnd(); // Content measured!
      setShouldScroll(false);
    });
  }
};
```

---

## Testing Viewability

### Manual Testing Checklist

- [ ] Viewability callback fires after items visible for `minimumViewTime`
- [ ] Callback doesn't fire during rapid scrolling
- [ ] Callback fires when scrolling stops with items visible
- [ ] Callback doesn't fire for items below visibility threshold
- [ ] Callback fires correctly after data updates
- [ ] Scroll to bottom works on initial load
- [ ] Scroll to bottom works when new items arrive
- [ ] No scroll stacking or jumping

### Debug Logging

```typescript
const onViewableItemsChanged = useRef(({ viewableItems, changed }) => {
  console.log(`[Viewability] ${viewableItems.length} items visible`);
  console.log(`[Viewability] ${changed.length} items changed`);

  viewableItems.forEach(({ item, isViewable }) => {
    console.log(`[Viewability] Item ${item.id}: ${isViewable ? 'VISIBLE' : 'HIDDEN'}`);
  });
}).current;
```

### Common Log Patterns

**✅ Good - Viewability Working:**

```
[Viewability] 12 items visible
[Viewability] 3 items changed
[Viewability] Item msg1: VISIBLE
[Viewability] Item msg2: VISIBLE
```

**❌ Bad - Closure Issue:**

```
[Viewability] Callback fired but no user/conversation, skipping
[Viewability] Callback fired but no user/conversation, skipping
```

_Fix: Use refs to access current values_

**❌ Bad - Never Fires:**

```
[Scroll] Requesting scroll to bottom
[Scroll] Content size changed
[Scroll] Scroll executed
// No viewability logs
```

_Fix: Check scroll stacking, ensure FlatList stabilizes_

---

## Architecture Decision: Why These Patterns

### Decision: Use `useRef` for Stable Callbacks

**Context:** FlatList requires stable references for `onViewableItemsChanged`

**Options Considered:**

1. `useCallback` with dependencies
2. `useRef` with closure
3. `useRef` with refs for values

**Decision:** Option 3 - `useRef` with refs for values

**Rationale:**

- Option 1: Breaks viewability tracking (callback changes)
- Option 2: Stale closures
- Option 3: Stable reference + current values ✅

### Decision: Non-Animated Scrolls for Reliability

**Context:** Need reliable scroll-to-bottom on load and new messages

**Options Considered:**

1. Animated scrolls (`animated: true`)
2. Non-animated scrolls (`animated: false`)

**Decision:** Option 2 - Non-animated scrolls

**Rationale:**

- Animated scrolls can be interrupted by user interaction
- Animated scrolls can be interrupted by new content
- Non-animated scrolls complete instantly and reliably
- Better UX: User sees content immediately, not watching scroll animation

### Decision: Event-Driven Scrolling (onContentSizeChange)

**Context:** Need to scroll after content loaded, not before

**Options Considered:**

1. Fixed timeouts (`setTimeout(scroll, 600)`)
2. `onContentSizeChange` callback
3. Combination of both

**Decision:** Option 2 - `onContentSizeChange` with stabilization timeout

**Rationale:**

- Fixed timeouts are unreliable (race conditions)
- `onContentSizeChange` fires when content is measured
- Stabilization timeout ensures viewability can fire

---

## Related Patterns

- **Real-Time Data Patterns**: [real-time-data-patterns.md](./real-time-data-patterns.md)
- **Critical Infrastructure Fixes**: [critical-infrastructure-fixes.md](./critical-infrastructure-fixes.md)

---

## References

- **Implemented in:**
  - Story 3.3 (Read Receipts System) - Viewability callbacks with manual scroll management
  - Story 5.10 (Inverted FlatList Migration) - Industry-standard pattern, eliminated scroll complexity
- **Files:**
  - `hooks/useMessages.ts` - Message sorting (DESC), removed scroll management
  - `app/(tabs)/conversations/[id].tsx` - Inverted FlatList configuration, viewability implementation
  - `utils/messageHelpers.ts` - Date separator grouping (ASC order)
- **Root Cause Analysis:** 2025-10-24 debugging session (Story 3.3)
- **Migration Implementation:** 2025-10-24 (Story 5.10)
- **React Native Docs:**
  - [FlatList - onViewableItemsChanged](https://reactnative.dev/docs/flatlist#onviewableitemschanged)
  - [FlatList - inverted prop](https://reactnative.dev/docs/flatlist#inverted)
  - [FlatList - maintainVisibleContentPosition](https://reactnative.dev/docs/flatlist#maintainvisiblecontentposition)
