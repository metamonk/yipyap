# Dashboard Customization Guide

## Overview

The Creator Command Center Dashboard is fully customizable to match your workflow preferences. This guide explains how to configure widgets, adjust refresh settings, and optimize the dashboard for your needs.

## Accessing Dashboard Settings

Navigate to: **Profile → Dashboard Settings**

Or programmatically:

```typescript
import { router } from 'expo-router';

router.push('/profile/dashboard-settings');
```

## Widget Visibility

Control which widgets appear on your dashboard home screen.

### Available Widgets

1. **Daily Summary** - Overnight activity metrics and AI automation stats
2. **Priority Messages** - Intelligently sorted feed of important messages
3. **AI Performance** - AI feature performance, accuracy, and cost metrics
4. **Quick Actions** - Bulk operations (archive, mark spam)
5. **Opportunities** - High-value business opportunities requiring attention

### Toggling Widget Visibility

**In Settings Screen:**
- Toggle switches next to each widget name
- Changes apply immediately when saved
- Hidden widgets are excluded from home screen render tree

**Programmatically:**

```typescript
import { doc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

async function toggleWidget(userId: string, widgetId: string, visible: boolean) {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    [`settings.dashboardConfig.widgetVisibility.${widgetId}`]: visible,
  });
}

// Example: Hide AI Metrics widget
await toggleWidget('user123', 'aiMetrics', false);
```

### Default Visibility

All widgets are visible by default on first use:

```typescript
const DEFAULT_VISIBILITY = {
  dailySummary: true,
  priorityFeed: true,
  aiMetrics: true,
  quickActions: true,
  opportunityAnalytics: true,
};
```

## Widget Ordering

Customize the order in which widgets appear on your dashboard.

### Reordering Widgets

**In Settings Screen:**
- Use **Up** (chevron-up) and **Down** (chevron-down) buttons
- Position numbers (1-5) show current order
- Changes apply immediately when saved

**Programmatically:**

```typescript
async function reorderWidgets(userId: string, newOrder: string[]) {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    'settings.dashboardConfig.widgetOrder': newOrder,
  });
}

// Example: Move Opportunities to top
await reorderWidgets('user123', [
  'opportunityAnalytics',
  'dailySummary',
  'priorityFeed',
  'aiMetrics',
  'quickActions',
]);
```

### Default Order

Default widget order from top to bottom:

```typescript
const DEFAULT_ORDER = [
  'dailySummary',        // 1. Daily Summary
  'priorityFeed',        // 2. Priority Messages
  'opportunityAnalytics', // 3. Opportunities
  'aiMetrics',           // 4. AI Performance
  'quickActions',        // 5. Quick Actions
];
```

### Drag-and-Drop (Future Enhancement)

The `DashboardWidgetContainer` component supports drag-and-drop using `react-native-draggable-flatlist`:

```typescript
import DraggableFlatList from 'react-native-draggable-flatlist';

// Drag-and-drop enabled with activationDistance={10}
<DraggableFlatList
  data={visibleWidgets}
  onDragEnd={({ data }) => handleReorder(data)}
  activationDistance={10}
/>
```

## Refresh Interval

Configure how frequently the dashboard fetches fresh data from Firestore.

### Available Intervals

- **30 seconds** - Most current data, higher battery/network usage
- **60 seconds** (default) - Balanced refresh rate
- **120 seconds** - Less frequent updates, better battery life
- **300 seconds** (5 minutes) - Minimal updates, best for battery

### Setting Refresh Interval

**In Settings Screen:**
- Tap desired interval button (30s, 60s, 120s, 300s)
- Active interval highlighted
- Changes apply on next refresh cycle

**Programmatically:**

```typescript
async function setRefreshInterval(userId: string, intervalSeconds: number) {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    'settings.dashboardConfig.refreshInterval': intervalSeconds,
  });
}

// Example: Set to 2 minutes
await setRefreshInterval('user123', 120);
```

### How It Works

The home screen uses the configured interval for automatic background refreshes:

```typescript
useEffect(() => {
  if (!config?.refreshInterval) return;

  const intervalMs = config.refreshInterval * 1000;
  const intervalId = setInterval(() => {
    loadDashboardData(); // Fetch fresh data
  }, intervalMs);

  return () => clearInterval(intervalId);
}, [config?.refreshInterval]);
```

**Note:** Manual pull-to-refresh is always available regardless of interval setting.

## Metrics Display Period

Choose the time window for AI Performance charts and metrics.

### Available Periods

- **7 Days** (default) - Last week's data, good for daily trends
- **30 Days** - Last month's data, useful for monthly patterns
- **90 Days** - Last quarter's data, shows long-term trends

### Setting Display Period

**In Settings Screen:**
- Tap desired period button (7 Days, 30 Days, 90 Days)
- Active period highlighted
- Charts update immediately when saved

**Programmatically:**

```typescript
async function setMetricsPeriod(userId: string, period: '7days' | '30days' | '90days') {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    'settings.dashboardConfig.metricsDisplayPeriod': period,
  });
}

// Example: Show last 30 days
await setMetricsPeriod('user123', '30days');
```

### Performance Impact

Longer periods require more Firestore document reads:

- **7 Days**: ~50-100 documents (minimal cost)
- **30 Days**: ~200-400 documents (moderate cost)
- **90 Days**: ~600-1200 documents (higher cost, cached for 5 minutes)

**Recommendation:** Use 7 Days for daily monitoring, 30 Days for trend analysis.

## Cost Transparency

Toggle visibility of AI cost metrics in the dashboard.

### Cost Metrics Included

When enabled, the AI Performance Dashboard shows:
- **Daily cost**: AI spend for the last 24 hours
- **Weekly cost**: AI spend for the last 7 days
- **Monthly cost**: Estimated AI spend for current month
- **Cost breakdown**: By feature (categorization, sentiment, FAQ, voice)

### Toggling Cost Metrics

**In Settings Screen:**
- Toggle "Show AI Cost Metrics" switch
- Changes apply immediately to AI Performance widget
- Cost data still collected even when hidden

**Programmatically:**

```typescript
async function toggleCostMetrics(userId: string, show: boolean) {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    'settings.dashboardConfig.showCostMetrics': show,
  });
}

// Example: Hide cost metrics
await toggleCostMetrics('user123', false);
```

### Default Setting

Cost metrics are **hidden by default** to avoid overwhelming new users:

```typescript
const DEFAULT_SHOW_COST_METRICS = false;
```

## Saving Configuration

All settings changes must be explicitly saved.

### Save Behavior

**Unsaved Changes Detection:**
- Save button disabled when no changes
- "Save Changes" button enabled when changes detected
- Navigation warning shown if leaving with unsaved changes

**Save Process:**
1. User makes changes (toggle widget, reorder, change interval, etc.)
2. `hasChanges` state set to `true`
3. "Save Changes" button becomes active
4. User taps "Save Changes"
5. Configuration saved to Firestore
6. Success alert shown
7. `hasChanges` reset to `false`

**Code Example:**

```typescript
const saveConfig = useCallback(async () => {
  if (!user?.uid || !config) return;

  try {
    setSaving(true);
    const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
    await updateDoc(userDocRef, {
      'settings.dashboardConfig': {
        ...config,
        updatedAt: Timestamp.now(),
      },
    });
    setHasChanges(false);
    Alert.alert('Success', 'Dashboard settings saved successfully');
  } catch (err) {
    console.error('Failed to save dashboard config:', err);
    Alert.alert('Error', 'Failed to save dashboard settings');
  } finally {
    setSaving(false);
  }
}, [user?.uid, config]);
```

## Resetting to Default

Restore all dashboard settings to default values.

### Reset Process

**In Settings Screen:**
1. Tap "Reset to Default" button
2. Confirmation dialog appears
3. Confirm to proceed
4. All settings reset to default values
5. Configuration saved to Firestore
6. Success alert shown

**Default Configuration:**

```typescript
const DEFAULT_DASHBOARD_CONFIG = {
  widgetVisibility: {
    dailySummary: true,
    priorityFeed: true,
    aiMetrics: true,
    quickActions: true,
    opportunityAnalytics: true,
  },
  widgetOrder: [
    'dailySummary',
    'priorityFeed',
    'opportunityAnalytics',
    'aiMetrics',
    'quickActions',
  ],
  refreshInterval: 60, // seconds
  metricsDisplayPeriod: '7days',
  showCostMetrics: false,
};
```

**Programmatically:**

```typescript
import { DEFAULT_DASHBOARD_CONFIG } from '@/components/dashboard/DashboardWidgetContainer';

async function resetDashboardConfig(userId: string) {
  const userDocRef = doc(getFirebaseDb(), 'users', userId);
  await updateDoc(userDocRef, {
    'settings.dashboardConfig': {
      ...DEFAULT_DASHBOARD_CONFIG,
      userId,
      updatedAt: Timestamp.now(),
    },
  });
}
```

## Configuration Schema

Complete TypeScript schema for dashboard configuration:

```typescript
interface DashboardConfig {
  userId: string;
  widgetVisibility: {
    dailySummary: boolean;
    priorityFeed: boolean;
    aiMetrics: boolean;
    quickActions: boolean;
    opportunityAnalytics: boolean;
  };
  widgetOrder: string[];
  refreshInterval: number; // seconds (30, 60, 120, 300)
  metricsDisplayPeriod: '7days' | '30days' | '90days';
  showCostMetrics: boolean;
  updatedAt: Timestamp;
}
```

## Firestore Storage

Dashboard configuration is stored in the user document:

**Path:** `users/{userId}/settings/dashboardConfig`

**Security Rules:**

```javascript
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;

  match /settings/dashboardConfig {
    allow read, write: if request.auth.uid == userId;
  }
}
```

**Example Document:**

```json
{
  "settings": {
    "dashboardConfig": {
      "userId": "user123",
      "widgetVisibility": {
        "dailySummary": true,
        "priorityFeed": true,
        "aiMetrics": false,
        "quickActions": true,
        "opportunityAnalytics": true
      },
      "widgetOrder": [
        "dailySummary",
        "opportunityAnalytics",
        "priorityFeed",
        "quickActions",
        "aiMetrics"
      ],
      "refreshInterval": 120,
      "metricsDisplayPeriod": "30days",
      "showCostMetrics": true,
      "updatedAt": { "_seconds": 1698765432, "_nanoseconds": 0 }
    }
  }
}
```

## Best Practices

**For Creators:**
1. Start with default settings and adjust based on usage patterns
2. Hide widgets you don't use to reduce clutter and improve performance
3. Use longer refresh intervals (120s/300s) to conserve battery on mobile
4. Enable cost metrics if monitoring AI budget
5. Prioritize high-value widgets (Opportunities, Priority Feed) at the top

**For Developers:**
1. Always validate configuration before saving to Firestore
2. Provide sensible defaults for all settings
3. Handle missing/corrupt configuration gracefully (fallback to defaults)
4. Cache configuration client-side to avoid redundant Firestore reads
5. Use TypeScript types to ensure type safety

## Troubleshooting

**Settings not saving:**
- Check Firestore security rules allow write access
- Verify user is authenticated
- Check browser/app console for error messages

**Widgets not updating after configuration change:**
- Ensure configuration is saved successfully
- Pull-to-refresh to force reload
- Check `updatedAt` timestamp in Firestore

**Default configuration not loading:**
- First-time users may need to trigger configuration creation
- Check `DashboardWidgetContainer` initialization logic
- Verify Firestore document exists

## Related Documentation

- [Dashboard Performance Optimization](../architecture/dashboard-performance-optimization.md)
- [Bulk Operations Guide](./bulk-operations-guide.md)
- [Story 5.7: Creator Command Center](../stories/5.7.story.md)
