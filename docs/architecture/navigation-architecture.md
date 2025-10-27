# Navigation Architecture

## Overview

This document outlines the navigation architecture for the yipyap app, including patterns, conventions, and best practices.

## Architecture Principles

### 1. **Hierarchical Tab-Based Navigation**
- Main app uses Expo Router's file-based routing
- Four main tabs: Home, Daily, Conversations, Profile
- Each tab has its own navigation stack
- Back navigation follows stack hierarchy, not journey path

### 2. **Type-Safe Navigation**
- All routes defined in `constants/routes.ts`
- Navigation hook provides type-safe utilities
- Prevents typos and makes refactoring easier

### 3. **DRY (Don't Repeat Yourself)**
- Common patterns abstracted into `useNavigation` hook
- Reusable navigation logic across components
- Single source of truth for route strings

---

## File Structure

```
app/
├── (auth)/              # Authentication group
│   ├── login.tsx
│   ├── register.tsx
│   ├── forgot-password.tsx
│   └── username-setup.tsx
│
├── (tabs)/              # Main app tabs group
│   ├── index.tsx        # Home/Dashboard tab
│   ├── daily-digest.tsx # Daily tab
│   ├── conversations/   # Conversations tab
│   └── profile/         # Profile tab
│
constants/
└── routes.ts            # Navigation constants

hooks/
└── useNavigation.ts     # Navigation utilities
```

---

## Navigation Constants

All routes are defined in `constants/routes.ts`:

```typescript
import { ROUTES } from '@/constants/routes';

// Use constants instead of hardcoded strings
router.push(ROUTES.TABS.CONVERSATIONS);                    // ✅ Good
router.push('/(tabs)/conversations');                       // ❌ Avoid

// Dynamic routes
router.push(ROUTES.CONVERSATIONS.DETAIL(conversationId));  // ✅ Good
router.push(`/(tabs)/conversations/${conversationId}`);     // ❌ Avoid
```

### Available Route Groups

- `ROUTES.AUTH.*` - Authentication routes
- `ROUTES.TABS.*` - Main tab routes
- `ROUTES.CONVERSATIONS.*` - Conversation routes
- `ROUTES.PROFILE.*` - Profile routes

---

## Navigation Hook

The `useNavigation` hook provides common navigation patterns:

```typescript
import { useNavigation } from '@/hooks/useNavigation';

function MyComponent() {
  const {
    goToConversation,
    goBackOrFallback,
    navigateWithAuthCheck,
    ROUTES
  } = useNavigation();

  // Navigate to conversation
  goToConversation(conversationId);

  // Navigate back with fallback
  goBackOrFallback(ROUTES.TABS.PROFILE);

  // Navigate with auth check
  navigateWithAuthCheck(ROUTES.PROFILE.SETTINGS, !!user);
}
```

---

## Common Patterns

### 1. **Back Navigation with Fallback**

**Before (Repeated Pattern):**
```typescript
// ❌ Repeated in 6+ files
const handleBack = () => {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace('/(tabs)/profile');
  }
};
```

**After (DRY):**
```typescript
// ✅ Using navigation hook
const { goBackOrFallback, ROUTES } = useNavigation();

const handleBack = () => {
  goBackOrFallback(ROUTES.TABS.PROFILE);
};
```

---

### 2. **Navigate to Conversation**

**Before:**
```typescript
// ❌ Hardcoded, duplicated logic
router.push(`/(tabs)/conversations/${conversationId}?messageId=${messageId}`);
```

**After:**
```typescript
// ✅ Type-safe, reusable
const { goToConversation } = useNavigation();
goToConversation(conversationId, messageId);
```

---

### 3. **Auth-Gated Navigation**

**Before:**
```typescript
// ❌ Repeated pattern
if (!currentUser) {
  Alert.alert('Error', 'You must be logged in');
  router.push('/(tabs)/profile');
  return;
}
router.push('/(tabs)/profile/settings');
```

**After:**
```typescript
// ✅ Encapsulated
const { navigateWithAuthCheck, ROUTES } = useNavigation();
navigateWithAuthCheck(ROUTES.PROFILE.SETTINGS, !!currentUser);
```

---

## Navigation Flows

### Home → Conversation
```
/(tabs)/index
    └──> goToConversation(id, messageId?)
         └──> /(tabs)/conversations/{id}?messageId={id}
```

### Daily Digest → Settings
```
/(tabs)/daily-digest
    └──> goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS)
         └──> /(tabs)/profile/daily-agent-settings
              └──> back()
                   └──> /(tabs)/profile (hierarchical)
```

### Conversation → Group Settings
```
/(tabs)/conversations/{id}
    └──> goToGroupSettings(conversationId)
         └──> /(tabs)/conversations/group-settings?id={id}
```

---

## Navigation Methods

### `router.push()` vs `router.replace()`

| Method | Use Case | Example |
|--------|----------|---------|
| `push()` | Standard navigation (user can go back) | Navigating to a conversation |
| `replace()` | No-back scenarios | After logout, after creating conversation |

```typescript
// Use push for standard navigation
router.push(ROUTES.CONVERSATIONS.DETAIL(id));  // Can go back

// Use replace when back shouldn't work
router.replace(ROUTES.AUTH.LOGIN);  // After logout
router.replace(ROUTES.CONVERSATIONS.DETAIL(newId));  // After creating conversation
```

---

## Cross-Tab Navigation

When navigating to a screen in a different tab:

1. **Router automatically switches to that tab**
2. **Pushes screen onto that tab's stack**
3. **Back button follows stack hierarchy**

```typescript
// From Daily tab
goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS);

// Result:
// - Switches to Profile tab
// - Pushes daily-agent-settings onto Profile stack
// - Back button goes to Profile index (hierarchical)
```

**This is expected behavior and follows iOS/Android conventions.**

---

## Best Practices

### ✅ DO

1. **Use route constants**
   ```typescript
   router.push(ROUTES.TABS.PROFILE);
   ```

2. **Use navigation hook for common patterns**
   ```typescript
   const { goToConversation } = useNavigation();
   goToConversation(id);
   ```

3. **Provide fallbacks for back navigation**
   ```typescript
   goBackOrFallback(ROUTES.TABS.CONVERSATIONS);
   ```

4. **Use replace for no-back scenarios**
   ```typescript
   replaceWith(ROUTES.AUTH.LOGIN);  // After logout
   ```

### ❌ DON'T

1. **Hardcode route strings**
   ```typescript
   router.push('/(tabs)/conversations/123');  // ❌
   ```

2. **Duplicate back navigation logic**
   ```typescript
   // ❌ Don't repeat this pattern
   if (router.canGoBack()) { ... }
   ```

3. **Navigate without auth checks**
   ```typescript
   // ❌ Missing auth check
   router.push(ROUTES.PROFILE.SETTINGS);
   ```

4. **Use push when replace is needed**
   ```typescript
   // ❌ After logout, user can go back
   router.push(ROUTES.AUTH.LOGIN);
   ```

---

## Migration Guide

### Refactoring Existing Code

#### 1. Update Imports
```typescript
// Add these imports
import { useNavigation } from '@/hooks/useNavigation';
// Note: ROUTES is included in hook return value
```

#### 2. Replace Router Usage
```typescript
// Before
const router = useRouter();

// After
const {
  goToConversation,
  goBackOrFallback,
  ROUTES
} = useNavigation();
```

#### 3. Replace Hardcoded Routes
```typescript
// Before
router.push('/(tabs)/conversations/' + id);

// After
goToConversation(id);
```

#### 4. Replace Back Navigation
```typescript
// Before
if (router.canGoBack()) {
  router.back();
} else {
  router.replace('/(tabs)/profile');
}

// After
goBackOrFallback(ROUTES.TABS.PROFILE);
```

---

## Example Refactor

**Before (profile/index.tsx):**
```typescript
export default function ProfileScreen() {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
    >
      <Text>Daily Agent Settings</Text>
    </TouchableOpacity>
  );
}
```

**After:**
```typescript
export default function ProfileScreen() {
  const { goToProfileSettings, ROUTES } = useNavigation();

  return (
    <TouchableOpacity
      onPress={() => goToProfileSettings(ROUTES.PROFILE.DAILY_AGENT_SETTINGS)}
    >
      <Text>Daily Agent Settings</Text>
    </TouchableOpacity>
  );
}
```

---

## Testing

### Navigation Hook Testing
```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useNavigation } from '@/hooks/useNavigation';

describe('useNavigation', () => {
  it('should navigate to conversation', () => {
    const { result } = renderHook(() => useNavigation());
    result.current.goToConversation('conv123');
    // Assert navigation occurred
  });
});
```

---

## Performance

### Navigation Hook Optimization

All navigation functions use `useCallback` to prevent unnecessary re-renders:

```typescript
const goToConversation = useCallback(
  (conversationId: string, messageId?: string) => {
    router.push(ROUTES.CONVERSATIONS.DETAIL(conversationId, messageId));
  },
  [router]  // Stable dependency
);
```

---

## Future Enhancements

### Optional Improvements (Not Required)

1. **Deep Linking Support**
   - Add deep link handling to routes
   - Map URLs to route constants

2. **Navigation Analytics**
   - Track navigation patterns
   - Monitor user flows

3. **Route Guards**
   - Add permission-based navigation
   - Role-based access control

4. **Navigation Animations**
   - Custom transitions
   - Tab-specific animations

---

## Related Files

- `constants/routes.ts` - Route constants
- `hooks/useNavigation.ts` - Navigation hook
- `app/_layout.tsx` - Root layout with auth routing
- `app/(tabs)/_layout.tsx` - Tab navigation layout
- `app/_components/NavigationHeader.tsx` - Shared navigation header

---

## Summary

The navigation architecture provides:

- ✅ **Type Safety** - No more typos in route strings
- ✅ **DRY Code** - Reusable navigation patterns
- ✅ **Consistency** - Standard patterns across the app
- ✅ **Maintainability** - Easy to refactor routes
- ✅ **Developer Experience** - Autocomplete and documentation

**Key Principle:** Navigation follows hierarchical structure, not journey path. This is intentional and conventional for tab-based mobile apps.
