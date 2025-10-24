# Daily Agent Configuration Guide

**Story 5.8 - Multi-Step Daily Agent**

This document provides comprehensive documentation for all configuration options available in the Daily Agent workflow.

---

## Table of Contents

1. [Configuration Storage](#configuration-storage)
2. [Workflow Settings](#workflow-settings)
3. [Notification Settings](#notification-settings)
4. [Schedule Configuration](#schedule-configuration)
5. [Configuration Examples](#configuration-examples)
6. [Default Values](#default-values)
7. [Best Practices](#best-practices)

---

## Configuration Storage

### Firestore Document Structure

User-specific configuration is stored in Firestore at:

```
/users/{userId}/ai_workflow_config/{userId}
```

**Document Structure**:
```typescript
{
  userId: string;
  workflowSettings: {
    maxAutoResponses: number;
    requireApproval: boolean;
    escalationThreshold: number;
    activeThresholdMinutes: number;
  };
  scheduleSettings: {
    enabled: boolean;
    scheduleTime: string;        // Format: "HH:mm" (24-hour)
    timezone: string;             // IANA timezone (e.g., "America/Los_Angeles")
    runOnWeekends: boolean;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Workflow Settings

### `workflowSettings.maxAutoResponses`

**Type**: `number`
**Default**: `20`
**Range**: `0` to `100`

**Description**:
Maximum number of FAQ auto-responses the daily agent can send per execution.

**Purpose**:
Prevents overwhelming recipients with too many automated messages in a single batch.

**Behavior**:
- FAQ detection processes messages in batches of 20
- When `maxAutoResponses` is reached, FAQ detection stops early
- Remaining messages are marked for voice-matched response drafting

**Example**:
```typescript
workflowSettings: {
  maxAutoResponses: 30,  // Allow up to 30 auto-responses per day
  // ...
}
```

**Recommendations**:
- **Light users (< 50 messages/day)**: 10-15
- **Moderate users (50-150 messages/day)**: 20-30
- **Heavy users (> 150 messages/day)**: 30-50

---

### `workflowSettings.requireApproval`

**Type**: `boolean`
**Default**: `true`

**Description**:
Whether FAQ auto-responses require manual approval before being sent.

**Behavior**:
- **`true`**: Detected FAQs are stored in `metadata.suggestedResponse`, marked as `pendingReview`
- **`false`**: Detected FAQs are auto-responded immediately (up to `maxAutoResponses` limit)

**Security Implications**:
- Setting to `false` enables fully automated responses
- User should trust the FAQ detection system before disabling approval

**Example**:
```typescript
workflowSettings: {
  requireApproval: false,  // Auto-send FAQ responses without approval
  // ...
}
```

**Recommendations**:
- **Initial setup**: Keep `true` until FAQ templates are validated
- **Mature deployment**: Can set to `false` if FAQ accuracy is high (> 95%)

---

### `workflowSettings.escalationThreshold`

**Type**: `number`
**Default**: `0.3`
**Range**: `0.0` to `1.0`

**Description**:
Sentiment score threshold below which messages are escalated to human review (crisis detection).

**Sentiment Score Mapping**:
- `1.0` = Very positive
- `0.5` = Neutral
- `0.0` = Very negative

**Behavior**:
- Messages with `metadata.sentimentScore < escalationThreshold` are **excluded** from daily agent processing
- These messages require immediate human attention (potential crisis)
- They appear in a separate "Urgent Review" section in the UI

**Example**:
```typescript
workflowSettings: {
  escalationThreshold: 0.2,  // Escalate messages with sentiment < 0.2 (very negative)
  // ...
}
```

**Recommendations**:
- **Conservative (catch all issues)**: `0.4` - Escalates more messages
- **Balanced (default)**: `0.3` - Good balance of automation vs. safety
- **Aggressive (maximize automation)**: `0.2` - Only escalates severe cases

---

### `workflowSettings.activeThresholdMinutes`

**Type**: `number`
**Default**: `30`
**Range**: `5` to `120` (minutes)

**Description**:
Minutes since last activity to consider user as "active" for IV3 checks.

**Purpose**:
Prevents daily agent from interfering with real-time conversations.

**Behavior**:
- If user's `presence.lastSeen` is within `activeThresholdMinutes`, workflow is **skipped**
- If user's `presence.status === 'online'`, workflow is **skipped** (regardless of threshold)

**Example**:
```typescript
workflowSettings: {
  activeThresholdMinutes: 60,  // Consider user active if seen within last 60 minutes
  // ...
}
```

**Recommendations**:
- **Short threshold (10-15 min)**: User frequently checks app, wants more automation
- **Medium threshold (30 min)**: Default, good balance
- **Long threshold (60+ min)**: User rarely uses app, wants daily agent to handle most messages

---

## Schedule Configuration

### `scheduleSettings.enabled`

**Type**: `boolean`
**Default**: `true`

**Description**:
Whether the daily agent scheduled execution is enabled for this user.

**Behavior**:
- **`true`**: Cloud Scheduler will invoke daily agent at `scheduleTime` (user's timezone)
- **`false`**: User is skipped during scheduled runs (manual execution still possible)

**Example**:
```typescript
scheduleSettings: {
  enabled: true,  // Enable scheduled daily agent
  // ...
}
```

**Use Cases for `false`**:
- User is on vacation/hiatus
- User wants to manually trigger workflow only
- Testing/development accounts

---

### `scheduleSettings.scheduleTime`

**Type**: `string`
**Format**: `"HH:mm"` (24-hour format)
**Default**: `"09:00"`

**Description**:
Time of day (in user's timezone) to run the daily agent workflow.

**Timezone Handling**:
- Cloud Scheduler runs hourly (every hour on the hour)
- For each run, calculates current time in user's `timezone`
- Triggers workflow if current time is within **5-minute window** of `scheduleTime`

**Example**:
```typescript
scheduleSettings: {
  scheduleTime: "08:30",  // Run at 8:30 AM user's local time
  timezone: "America/New_York",
  // ...
}
```

**Recommendations**:
- **Morning users**: `"09:00"` - Review messages over coffee
- **Afternoon users**: `"14:00"` - After lunch digest
- **Evening users**: `"18:00"` - End-of-day summary

**Edge Cases**:
- If scheduler runs at `09:03`, workflow will trigger (within 5-minute window)
- If scheduler runs at `09:06`, workflow will **not** trigger (outside window)
- To avoid duplicate triggers, workflow checks last execution time

---

### `scheduleSettings.timezone`

**Type**: `string`
**Format**: IANA timezone name
**Default**: `"America/Los_Angeles"`

**Description**:
User's timezone for schedule time calculation.

**Valid Values**:
- `"America/New_York"` (EST/EDT)
- `"America/Los_Angeles"` (PST/PDT)
- `"America/Chicago"` (CST/CDT)
- `"Europe/London"` (GMT/BST)
- `"Asia/Tokyo"` (JST)
- Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

**Daylight Saving Time**:
- Automatically handled by `Intl.DateTimeFormat`
- No manual adjustment needed when clocks change

**Example**:
```typescript
scheduleSettings: {
  scheduleTime: "09:00",
  timezone: "Europe/London",  // 9 AM London time
  // ...
}
```

---

### `scheduleSettings.runOnWeekends`

**Type**: `boolean`
**Default**: `true`

**Description**:
Whether to run the daily agent on Saturdays and Sundays.

**Behavior**:
- **`true`**: Daily agent runs every day (7 days/week)
- **`false`**: Daily agent only runs Monday-Friday (skips Sat/Sun)

**Example**:
```typescript
scheduleSettings: {
  runOnWeekends: false,  // Only run on weekdays
  // ...
}
```

**Use Cases for `false`**:
- Business accounts that don't work weekends
- Users who manually handle messages on weekends
- Reducing API costs by skipping low-activity days

---

## Notification Settings

Notification settings are stored separately in the user's main document:

```
/users/{userId}
```

### `settings.notifications.enabled`

**Type**: `boolean`
**Default**: `true`

**Description**:
Master switch for all push notifications.

**Behavior**:
- If `false`, daily digest notifications are **not sent** (workflow still runs)
- Overrides all other notification settings

---

### `settings.notifications.quietHours`

**Type**: `object`
**Default**: `{ enabled: false }`

**Description**:
Time range during which notifications should be suppressed.

**Structure**:
```typescript
quietHours: {
  enabled: boolean;
  start: string;   // Format: "HH:mm" (24-hour)
  end: string;     // Format: "HH:mm" (24-hour)
}
```

**Behavior**:
- **Same-day quiet hours** (e.g., `start: "13:00"`, `end: "15:00"`):
  - Notifications suppressed if current time is between 13:00 and 15:00
- **Overnight quiet hours** (e.g., `start: "22:00"`, `end: "08:00"`):
  - Notifications suppressed if current time is after 22:00 OR before 08:00

**Example**:
```typescript
settings: {
  notifications: {
    enabled: true,
    quietHours: {
      enabled: true,
      start: "22:00",  // 10 PM
      end: "08:00",    // 8 AM
    },
  },
}
```

**Edge Case**:
If daily agent runs during quiet hours, notification is **skipped** (not queued for later).

---

## Configuration Examples

### Example 1: Conservative Configuration

**Use Case**: New user, wants manual control, high safety threshold

```typescript
{
  userId: "user123",
  workflowSettings: {
    maxAutoResponses: 10,         // Limit automation
    requireApproval: true,         // All responses require approval
    escalationThreshold: 0.4,      // Conservative escalation
    activeThresholdMinutes: 60,    // Long activity window
  },
  scheduleSettings: {
    enabled: true,
    scheduleTime: "09:00",
    timezone: "America/New_York",
    runOnWeekends: false,          // Only weekdays
  },
}
```

---

### Example 2: Aggressive Automation

**Use Case**: Power user, trusts system, wants maximum automation

```typescript
{
  userId: "user456",
  workflowSettings: {
    maxAutoResponses: 50,          // High limit
    requireApproval: false,        // Fully automated
    escalationThreshold: 0.2,      // Only escalate severe cases
    activeThresholdMinutes: 15,    // Short activity window
  },
  scheduleSettings: {
    enabled: true,
    scheduleTime: "08:00",
    timezone: "America/Los_Angeles",
    runOnWeekends: true,           // Every day
  },
}
```

---

### Example 3: Business Hours Only

**Use Case**: Business account, weekday mornings only

```typescript
{
  userId: "user789",
  workflowSettings: {
    maxAutoResponses: 20,
    requireApproval: true,
    escalationThreshold: 0.3,
    activeThresholdMinutes: 30,
  },
  scheduleSettings: {
    enabled: true,
    scheduleTime: "09:00",         // 9 AM
    timezone: "America/Chicago",
    runOnWeekends: false,          // Monday-Friday only
  },
}
```

---

## Default Values

If no configuration document exists, the system uses these defaults:

```typescript
const DEFAULT_CONFIG = {
  workflowSettings: {
    maxAutoResponses: 20,
    requireApproval: true,
    escalationThreshold: 0.3,
    activeThresholdMinutes: 30,
  },
  scheduleSettings: {
    enabled: false,               // Disabled by default (opt-in)
    scheduleTime: "09:00",
    timezone: "America/Los_Angeles",
    runOnWeekends: true,
  },
};
```

**Note**: Users must explicitly enable `scheduleSettings.enabled = true` to activate scheduled runs.

---

## Best Practices

### 1. Start Conservative, Increase Gradually

- Begin with `requireApproval: true` and `maxAutoResponses: 10`
- Monitor accuracy and cost for 1 week
- Gradually increase `maxAutoResponses` or disable approval

### 2. Align Schedule with User Habits

- Set `scheduleTime` to when user typically checks messages
- Consider user's timezone (don't run at 3 AM local time!)
- Use quiet hours to avoid late-night notifications

### 3. Monitor Costs

- Each workflow execution costs approximately **$8-10** (100 messages)
- Higher `maxAutoResponses` = more FAQ detection cost
- Consider `runOnWeekends: false` if weekend volume is low

### 4. Test Before Enabling Full Automation

- Keep `requireApproval: true` for at least 2 weeks
- Review suggested responses for quality
- Only set `requireApproval: false` when confidence is high

### 5. Adjust Escalation Threshold Based on Use Case

- **Customer support**: Use `0.3` (default) - catch negative feedback early
- **Personal messages**: Use `0.2` - only escalate severe issues
- **Business networking**: Use `0.4` - be cautious with all concerns

---

## Configuration UI (Future)

**Planned Features** (Story 5.9 - UI for Configuration):

- Settings screen at `/profile/daily-agent-settings`
- Toggle switches for `enabled`, `requireApproval`, `runOnWeekends`
- Time picker for `scheduleTime`
- Timezone selector (autocomplete)
- Slider for `maxAutoResponses` (0-100)
- Sentiment threshold slider (0.0-1.0)
- Quiet hours time range picker

**Current Workaround**:

Developers can manually set configuration via Firebase Console or Admin SDK:

```typescript
await db
  .collection('users')
  .doc(userId)
  .collection('ai_workflow_config')
  .doc(userId)
  .set({
    userId,
    workflowSettings: {
      maxAutoResponses: 30,
      requireApproval: false,
      escalationThreshold: 0.3,
      activeThresholdMinutes: 30,
    },
    scheduleSettings: {
      enabled: true,
      scheduleTime: '09:00',
      timezone: 'America/New_York',
      runOnWeekends: true,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
```

---

## Troubleshooting

### Workflow Not Running

**Possible Causes**:
1. `scheduleSettings.enabled = false`
2. User is online/active (IV3 check)
3. Schedule time not matching current time (outside 5-minute window)
4. Timezone mismatch (check user's `timezone` setting)

**Solution**:
- Check `daily_executions` collection for "skipped" status
- Review Cloud Scheduler logs for user ID
- Verify timezone is correct IANA format

### Too Many/Too Few Auto-Responses

**Possible Causes**:
1. `maxAutoResponses` set too high/low
2. FAQ templates have high false positive rate
3. `requireApproval` setting incorrect

**Solution**:
- Adjust `maxAutoResponses` incrementally (±5 at a time)
- Review `agent_logs` for FAQ detection metrics
- Check FAQ template similarity scores (should be > 0.8)

### Daily Agent Running at Wrong Time

**Possible Causes**:
1. Timezone setting incorrect
2. Daylight saving time transition
3. Cloud Scheduler delay (> 5 minutes)

**Solution**:
- Verify `timezone` matches user's actual location
- Cloud Scheduler should run hourly - check schedule config
- Review `daily_executions` for actual execution timestamps

---

**Last Updated**: 2025-10-24
**Story**: 5.8 - Multi-Step Daily Agent
**Task**: 16.2 - Document Daily Agent Configuration Options

**See Also**:
- [Daily Agent Performance Metrics](./daily-agent-performance-metrics.md)
- [Daily Agent Workflow](../../functions/src/ai/daily-agent-workflow.ts)
- [Story 5.8](../stories/5.8.story.md)
