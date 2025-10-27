# Button Component - Robinhood Style

## Overview

The `Button` component implements Robinhood's premium button aesthetic with spring animations, multiple variants, and full theme support.

## Features

✅ **Robinhood Green Primary** - Signature green accent for primary actions
✅ **Spring Press Animation** - Subtle 98% scale with spring physics
✅ **Multiple Variants** - primary, secondary, ghost, danger
✅ **Three Sizes** - sm (36px), md (48px), lg (56px)
✅ **Loading State** - Built-in spinner
✅ **Disabled State** - Automatic opacity reduction
✅ **Theme Aware** - Light/dark mode support
✅ **Accessibility** - Full screen reader support
✅ **Bold Text** - Robinhood signature typography

## Usage

### Basic Example

```tsx
import { Button } from '@/components/common/Button';

<Button
  variant="primary"
  size="md"
  onPress={handleSubmit}
>
  Continue
</Button>
```

### All Variants

```tsx
{/* Primary - Robinhood green, use for main CTAs */}
<Button variant="primary" onPress={handleSubmit}>
  Continue
</Button>

{/* Secondary - Outlined, use for secondary actions */}
<Button variant="secondary" onPress={handleCancel}>
  Cancel
</Button>

{/* Ghost - Transparent, use for tertiary actions */}
<Button variant="ghost" onPress={handleSkip}>
  Skip
</Button>

{/* Danger - Red, use for destructive actions */}
<Button variant="danger" onPress={handleDelete}>
  Delete Account
</Button>
```

### All Sizes

```tsx
{/* Small - 36px height */}
<Button size="sm" variant="primary">
  Small Button
</Button>

{/* Medium (default) - 48px height */}
<Button size="md" variant="primary">
  Medium Button
</Button>

{/* Large - 56px height */}
<Button size="lg" variant="primary">
  Large Button
</Button>
```

### States

```tsx
{/* Loading state - shows spinner */}
<Button variant="primary" loading={true}>
  Processing...
</Button>

{/* Disabled state - 50% opacity, no interaction */}
<Button variant="primary" disabled={true}>
  Submit
</Button>

{/* Full width */}
<Button variant="primary" fullWidth={true}>
  Continue
</Button>
```

### Custom Styling

```tsx
<Button
  variant="primary"
  style={{ marginTop: 20 }}
  textStyle={{ fontSize: 18 }}
>
  Custom Styled
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `string` | - | **Required.** Button text content |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Visual variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `onPress` | `() => void` | - | Press handler callback |
| `disabled` | `boolean` | `false` | Disable button interaction |
| `loading` | `boolean` | `false` | Show loading spinner |
| `fullWidth` | `boolean` | `false` | Expand to full container width |
| `style` | `ViewStyle` | - | Custom container style |
| `textStyle` | `TextStyle` | - | Custom text style |
| `accessibilityLabel` | `string` | - | Screen reader label |
| `testID` | `string` | - | Testing identifier |

## Design Decisions

### Why Robinhood Green?

Robinhood's signature green (`#00C805` light, `#00D906` dark) is used for primary actions. This creates a distinctive, premium feel different from iOS blue.

### Why Spring Animation?

Robinhood uses spring physics (`damping: 15, stiffness: 150`) for natural, responsive feel. The 98% scale creates subtle feedback without being distracting.

### Why Bold Text?

Robinhood uses bold (weight 700) for all button text. This creates clear visual hierarchy and premium feel.

### Why These Sizes?

- **Small (36px)**: Compact actions in tight spaces (e.g., inline actions)
- **Medium (48px)**: Default, meets 44px touch target minimum
- **Large (56px)**: Primary CTAs on screens (e.g., "Sign Up", "Send Message")

## Common Patterns

### Auth Screens

```tsx
{/* Sign up form */}
<Button
  variant="primary"
  size="lg"
  fullWidth
  onPress={handleSignUp}
  loading={isSubmitting}
>
  Create Account
</Button>

<Button
  variant="ghost"
  size="md"
  fullWidth
  onPress={navigateToLogin}
>
  Already have an account? Sign In
</Button>
```

### Conversation Actions

```tsx
{/* Delete conversation modal */}
<Button
  variant="danger"
  onPress={handleDelete}
  loading={isDeleting}
>
  Delete Conversation
</Button>

<Button
  variant="secondary"
  onPress={handleCancel}
>
  Cancel
</Button>
```

### Inline Actions

```tsx
{/* Small actions in lists */}
<Button size="sm" variant="ghost" onPress={handleEdit}>
  Edit
</Button>

<Button size="sm" variant="ghost" onPress={handleShare}>
  Share
</Button>
```

## Accessibility

The Button component includes:

- ✅ `accessibilityRole="button"`
- ✅ `accessibilityLabel` support
- ✅ `accessibilityState` for disabled/loading states
- ✅ Minimum 44x44px touch targets (md and lg sizes)
- ✅ High contrast colors (WCAG AA compliant)
- ✅ Screen reader announcements

## Dark Mode

All variants adapt automatically:

| Variant | Light Mode | Dark Mode |
|---------|------------|-----------|
| **Primary** | Green `#00C805` | Brighter green `#00D906` |
| **Secondary** | White surface | Dark surface `#1C1C1E` |
| **Ghost** | Transparent | Transparent |
| **Danger** | Red `#FF3B30` | Lighter red `#FF453A` |

## Migration Guide

### Before (TouchableOpacity)

```tsx
<TouchableOpacity
  style={{
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
  }}
  onPress={handlePress}
>
  <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
    Submit
  </Text>
</TouchableOpacity>
```

### After (Button)

```tsx
<Button variant="primary" onPress={handlePress}>
  Submit
</Button>
```

**Benefits:**
- 15 lines → 1 line
- Theme-aware colors
- Built-in animation
- Loading state support
- Accessibility included

## Visual Examples

```
┌─────────────────────────────────────┐
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃       Continue            ┃   │  ← Primary (lg)
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │    Green, bold, shadow
│                                     │
│   ┌─────────────────────────────┐   │
│   │       Cancel                │   │  ← Secondary (lg)
│   └─────────────────────────────┘   │    Border, no shadow
│                                     │
│         Skip                        │  ← Ghost (md)
│                                     │    No background
│                                     │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│   ┃    Delete Account         ┃   │  ← Danger (lg)
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │    Red, bold, shadow
│                                     │
└─────────────────────────────────────┘
```

## Next Steps

Consider replacing existing TouchableOpacity buttons in:
- [ ] Auth screens (`app/(auth)/`)
- [ ] Settings screen (`app/(tabs)/profile/settings.tsx`)
- [ ] Modals and dialogs
- [ ] Form submissions

This creates consistent, premium button experience across the app.
