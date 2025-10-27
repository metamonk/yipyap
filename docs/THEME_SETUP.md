# Theme System Setup Guide

## ✅ What's Already Done

I've created these files for you:

1. **`/constants/theme.ts`** - Theme tokens and color palettes
2. **`/contexts/ThemeContext.tsx`** - Theme provider and hook
3. **`/components/common/Avatar.tsx`** - Updated as example (uses new theme)
4. **`/components/common/ThemeSelector.tsx`** - Theme switcher UI component

## 🚀 Quick Start (3 Steps)

### Step 1: Install AsyncStorage

```bash
npx expo install @react-native-async-storage/async-storage
```

### Step 2: Wrap Your App with ThemeProvider

Edit `app/_layout.tsx`:

```tsx
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      {/* Your existing layout */}
      <Stack />
    </ThemeProvider>
  );
}
```

### Step 3: Add Theme Selector to Settings

Edit `app/(tabs)/profile/settings.tsx`:

```tsx
import { ThemeSelector } from '@/components/common/ThemeSelector';

export default function SettingsScreen() {
  return (
    <ScrollView>
      {/* Your existing settings */}

      <ThemeSelector />

      {/* More settings */}
    </ScrollView>
  );
}
```

**That's it!** 🎉 Your app now has full light/dark mode support.

---

## 📖 How to Use in Components

### Basic Usage

```tsx
import { useTheme } from '@/contexts/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();

  return (
    <View style={{ backgroundColor: theme.colors.background }}>
      <Text style={{ color: theme.colors.textPrimary }}>Hello World</Text>
    </View>
  );
};
```

### With StyleSheet

```tsx
import { useTheme } from '@/contexts/ThemeContext';
import { StyleSheet } from 'react-native';

const MyComponent = () => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.base,
    },
    text: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.base,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Hello World</Text>
    </View>
  );
};
```

### Check if Dark Mode is Active

```tsx
const { isDark } = useTheme();

return (
  <Image
    source={isDark ? require('./logo-dark.png') : require('./logo-light.png')}
  />
);
```

### Access Current Theme Mode

```tsx
const { themeMode, setThemeMode } = useTheme();

console.log(themeMode); // 'auto', 'light', or 'dark'

// Change theme
setThemeMode('dark');
```

---

## 🎨 Available Theme Tokens

### Colors

```typescript
theme.colors.primary           // Brand primary color
theme.colors.success          // Green for success states
theme.colors.error            // Red for errors
theme.colors.warning          // Orange for warnings

theme.colors.background       // Main background
theme.colors.surface          // Card/surface background
theme.colors.border           // Border color

theme.colors.textPrimary      // Main text
theme.colors.textSecondary    // Secondary text
theme.colors.textTertiary     // Tertiary/disabled text

theme.colors.messageSent      // Sent message bubble
theme.colors.messageReceived  // Received message bubble

theme.colors.gray50 - gray900 // Full gray scale
```

### Spacing

```typescript
theme.spacing.xs      // 4px
theme.spacing.sm      // 8px
theme.spacing.md      // 12px
theme.spacing.base    // 16px
theme.spacing.lg      // 20px
theme.spacing.xl      // 24px
theme.spacing['2xl'] // 32px
theme.spacing['3xl'] // 48px
```

### Typography

```typescript
theme.typography.fontSize.xs      // 12
theme.typography.fontSize.base    // 16
theme.typography.fontSize['2xl']  // 24

theme.typography.fontWeight.normal    // '400'
theme.typography.fontWeight.semibold  // '600'

theme.typography.lineHeight.normal    // 1.5
```

### Border Radius

```typescript
theme.borderRadius.sm    // 6
theme.borderRadius.md    // 8
theme.borderRadius.lg    // 12
theme.borderRadius.full  // 9999 (fully rounded)
```

### Shadows

```typescript
theme.shadows.sm  // Subtle shadow
theme.shadows.md  // Medium shadow
theme.shadows.lg  // Large shadow

// Use with spread operator
<View style={[styles.card, theme.shadows.md]} />
```

### Animation

```typescript
theme.animation.duration.fast    // 150ms
theme.animation.duration.normal  // 250ms
theme.animation.duration.slow    // 350ms
```

---

## 🔄 Migration Guide

### Component Migration Pattern

**Before:**
```tsx
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  text: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
});
```

**After:**
```tsx
const MyComponent = () => {
  const { theme } = useTheme();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      padding: theme.spacing.base,
    },
    text: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
    },
  });

  return <View style={styles.container}>...</View>;
};
```

### Suggested Migration Order

1. ✅ **Avatar** (already done!)
2. **Badge** - Small, easy win
3. **Button** - Create reusable component
4. **Auth screens** - Low traffic, safe to test
5. **Settings screens** - Users expect theme here
6. **Dashboard components**
7. **Chat components** - High traffic, do last

---

## 🌗 How It Works

### Default Behavior (Auto Mode)

- App launches in **'auto' mode** by default
- Automatically follows system dark/light preference
- Updates in real-time when system theme changes

### User Override

- User can choose **'light'**, **'dark'**, or **'auto'** via ThemeSelector
- Preference is saved to AsyncStorage
- Persists across app restarts

### Loading Behavior

- ThemeProvider loads saved preference before rendering
- Prevents flash of wrong theme on app launch
- Returns `null` during initial load (very brief)

---

## 🐛 Troubleshooting

### Theme not applying?

**Check that ThemeProvider wraps your entire app:**
```tsx
// ✅ Correct
<ThemeProvider>
  <Stack />
</ThemeProvider>

// ❌ Wrong
<Stack>
  <ThemeProvider />
</Stack>
```

### Error: "useTheme must be used within ThemeProvider"

You're calling `useTheme()` outside the provider. Make sure ThemeProvider wraps the component.

### Theme not persisting?

Check that AsyncStorage is installed:
```bash
npx expo install @react-native-async-storage/async-storage
```

### Colors look wrong in dark mode?

The dark theme uses true black (#000000) for OLED displays. If you want dark gray instead:

Edit `/constants/theme.ts`:
```typescript
const darkColors = {
  background: '#121212', // Instead of '#000000'
  // ...
};
```

---

## 📝 Next Steps

1. **Install AsyncStorage** (if not already installed)
2. **Wrap app with ThemeProvider** in `app/_layout.tsx`
3. **Add ThemeSelector** to settings screen
4. **Test** by changing theme in settings
5. **Migrate components** one by one using the Avatar as reference

---

## 🎯 Example: Complete Component Migration

See `/components/common/Avatar.tsx` for a complete example of:
- ✅ Using `useTheme()` hook
- ✅ Accessing theme colors
- ✅ Using theme spacing/typography
- ✅ Adding shadows from theme
- ✅ Memoizing dynamic styles

Copy this pattern for other components!
