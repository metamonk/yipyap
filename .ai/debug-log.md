# Debug Log

## 2025-10-23: GestureHandlerRootView Missing from Root Layout

**Error:**

```
[Error: PanGestureHandler must be used as a descendant of GestureHandlerRootView. Otherwise the gestures will not be recognized.]
```

**Location:** `components/conversation/ConversationListItem.tsx:211` (Swipeable component)

**Root Cause:**

- The app was using `Swipeable` component from `react-native-gesture-handler`
- `GestureHandlerRootView` wrapper was not configured in the root layout
- All gesture components (Swipeable, PanGestureHandler, etc.) require `GestureHandlerRootView` to be an ancestor

**Fix Applied:**

1. Added import: `import { GestureHandlerRootView } from 'react-native-gesture-handler';` to `app/_layout.tsx`
2. Wrapped entire app return JSX in `<GestureHandlerRootView style={{ flex: 1 }}>...</GestureHandlerRootView>`

**Files Modified:**

- `app/_layout.tsx` - Added GestureHandlerRootView wrapper

**Prevention:**

- Document in tech stack that any usage of react-native-gesture-handler components requires GestureHandlerRootView at root
- Consider adding to setup checklist for new gesture-based features

**References:**

- https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation
- ConversationListItem uses Swipeable for archive functionality
