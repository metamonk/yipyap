# Cloud Scheduler Setup for Daily Agent

**Story 5.8 - Multi-Step Daily Agent (Task 4)**

This guide covers deploying and configuring the Cloud Scheduler for the Daily Agent workflow automation.

---

## Overview

The Daily Agent uses Firebase Cloud Scheduler (Gen2) to automatically trigger workflows for users at their configured times. The scheduler:

- Runs **every hour** at minute 0 (`:00`)
- Checks all users with `dailyWorkflowEnabled: true`
- Triggers workflows for users whose scheduled time matches (within 5-minute window)
- Handles timezone conversions automatically
- Logs all execution attempts for monitoring

---

## Prerequisites

1. **Firebase Project** with Blaze (pay-as-you-go) plan
2. **Firebase CLI** installed and authenticated
3. **Cloud Functions** deployed
4. **Firestore** configured with security rules

---

## Deployment Steps

### Step 1: Deploy Cloud Functions

```bash
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Deploy all functions (includes scheduler)
firebase deploy --only functions

# Or deploy only scheduler functions
firebase deploy --only functions:dailyAgentScheduler,functions:triggerDailyAgentManual
```

### Step 2: Verify Cloud Scheduler

After deployment, verify the scheduler was created:

```bash
# List all Cloud Scheduler jobs
firebase functions:config:get

# View scheduler logs
firebase functions:log --only dailyAgentScheduler
```

### Step 3: Monitor Execution

Check the Firebase Console for:

1. **Functions Dashboard** → `dailyAgentScheduler`
   - Execution count
   - Error rate
   - Execution time

2. **Firestore** → `scheduler_logs` collection
   - Timestamp
   - Users triggered
   - Execution summary

---

## Configuration

### Scheduler Schedule

The scheduler runs **every hour**. You can modify the schedule in `functions/src/ai/daily-agent-scheduler.ts`:

```typescript
export const dailyAgentScheduler = functions.onSchedule(
  {
    schedule: '0 * * * *', // Cron format: every hour at minute 0
    timeZone: 'UTC',
    // ... other config
  },
  async (event) => {
    // Scheduler logic
  }
);
```

**Cron Format:**
- `0 * * * *` - Every hour at minute 0
- `*/30 * * * *` - Every 30 minutes
- `0 */2 * * *` - Every 2 hours
- `0 9 * * *` - Once daily at 9:00 AM UTC

### User-Specific Schedules

Users configure their schedule in the Daily Agent Settings screen:

```typescript
{
  features: {
    dailyWorkflowEnabled: true,  // Required to enable
  },
  workflowSettings: {
    dailyWorkflowTime: "09:00",  // HH:mm format (24-hour)
    timezone: "America/Los_Angeles",  // IANA timezone
    // ... other settings
  }
}
```

**Supported Timezones:**
All IANA timezone identifiers are supported, e.g.:
- `America/New_York`
- `America/Los_Angeles`
- `Europe/London`
- `Asia/Tokyo`
- `Australia/Sydney`

---

## Testing

### Manual Trigger (For Testing)

Trigger a workflow manually without waiting for the schedule:

```bash
# Via Firebase CLI
firebase functions:call triggerDailyAgentManual --data '{"userId": "USER_ID_HERE"}'
```

```javascript
// Via client SDK
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const triggerManual = httpsCallable(functions, 'triggerDailyAgentManual');

try {
  const result = await triggerManual({ userId: 'USER_ID_HERE' });
  console.log('Triggered:', result.data);
} catch (error) {
  console.error('Error:', error);
}
```

### Verify Scheduler Logic

1. Enable daily workflow for a test user
2. Set schedule time to current time + 5 minutes
3. Wait for scheduler to run (top of next hour)
4. Check `scheduler_logs` collection for execution attempt
5. Check `daily_executions` collection for workflow result

---

## Monitoring

### Scheduler Logs

The scheduler creates logs in Firestore for monitoring:

**Collection:** `scheduler_logs`

```typescript
{
  timestamp: Timestamp,
  totalUsers: number,        // Users with daily workflow enabled
  triggered: number,          // Workflows triggered this run
  skipped: number,            // Users skipped (wrong time)
  errors: number,             // Errors encountered
  attempts: [                 // Per-user details
    {
      userId: string,
      status: 'success' | 'skipped' | 'error',
      reason: string
    }
  ]
}
```

### Cloud Functions Logs

View real-time logs:

```bash
# All scheduler logs
firebase functions:log --only dailyAgentScheduler

# Last 100 lines
firebase functions:log --only dailyAgentScheduler --lines 100

# Follow logs in real-time
firebase functions:log --only dailyAgentScheduler --follow
```

### Metrics to Monitor

1. **Execution Rate**
   - Should match number of enabled users
   - Each user triggered once per day at their scheduled time

2. **Error Rate**
   - Should be < 1%
   - Check `scheduler_logs` for error details

3. **Execution Duration**
   - Scheduler should complete in < 60 seconds
   - Individual workflows take 3-5 minutes

4. **Cost**
   - Scheduler invocations: ~720/month (hourly)
   - Workflow executions: depends on user count
   - Check Firebase billing dashboard

---

## Troubleshooting

### Scheduler Not Running

**Symptom:** No logs in `scheduler_logs` collection

**Solutions:**
1. Verify function is deployed:
   ```bash
   firebase functions:list | grep dailyAgentScheduler
   ```

2. Check for deployment errors:
   ```bash
   firebase functions:log --only dailyAgentScheduler --lines 50
   ```

3. Verify Blaze plan is active:
   - Go to Firebase Console → Billing
   - Ensure pay-as-you-go plan is enabled

### Workflows Not Triggering

**Symptom:** Scheduler runs but no workflows execute

**Solutions:**
1. Check if users have `dailyWorkflowEnabled: true`:
   ```bash
   firebase firestore:get users/USER_ID/ai_workflow_config/USER_ID
   ```

2. Verify schedule time matching:
   - Scheduler uses 5-minute window
   - Check `scheduler_logs` for "skipped" entries
   - Ensure user's timezone is correct

3. Check for online/active status blocking:
   - Users online/active are skipped (IV3)
   - Check execution logs for "skipped" status

### High Error Rate

**Symptom:** Many errors in `scheduler_logs`

**Solutions:**
1. Check function logs for error details:
   ```bash
   firebase functions:log --only dailyAgentScheduler,dailyAgentWorkflow --lines 200
   ```

2. Common errors:
   - **Permission denied:** Check Firestore security rules
   - **Timeout:** Increase `timeoutSeconds` in function config
   - **Out of memory:** Increase `memory` allocation
   - **API rate limit:** Implement backoff or reduce batch size

3. Test manually:
   ```bash
   firebase functions:call triggerDailyAgentManual --data '{"userId": "USER_ID"}'
   ```

---

## Cost Optimization

### Scheduler Invocations

**Current:**
- 24 invocations/day (hourly)
- ~720 invocations/month
- Cost: ~$0.01/month (negligible)

**Optimization:**
- Schedule less frequently if all users have same schedule window
- Example: `0 8-10 * * *` (3 invocations/day)

### Workflow Executions

**Cost per workflow:**
- Cloud Function: $0.0000004/invocation
- Firestore reads/writes: ~$0.01/workflow
- AI API calls: $0.10-0.50/workflow (varies by messages)

**Total estimated:** $0.15-0.60 per user per day

---

## Security Rules

Ensure Firestore security rules allow scheduler function access:

```javascript
// Scheduler logs (write-only by Cloud Functions)
match /scheduler_logs/{logId} {
  allow read: if false;  // No client reads needed
  allow write: if false; // Only Cloud Functions
}

// Daily executions (read by users, write by Cloud Functions)
match /users/{userId}/daily_executions/{executionId} {
  allow read: if request.auth.uid == userId;
  allow write: if false; // Only Cloud Functions
}
```

---

## Maintenance

### Updating the Schedule

1. Modify schedule in `daily-agent-scheduler.ts`
2. Deploy updated function:
   ```bash
   firebase deploy --only functions:dailyAgentScheduler
   ```
3. Verify new schedule in Cloud Console

### Disabling the Scheduler

**Temporary:**
```bash
# Pause the scheduler job
gcloud scheduler jobs pause dailyAgentScheduler --location=us-central1
```

**Permanent:**
```bash
# Delete the function
firebase functions:delete dailyAgentScheduler
```

### Re-enabling
```bash
# Resume paused job
gcloud scheduler jobs resume dailyAgentScheduler --location=us-central1

# Or redeploy
firebase deploy --only functions:dailyAgentScheduler
```

---

## Support

For issues or questions:
1. Check Firebase Console → Functions → Logs
2. Review `scheduler_logs` collection in Firestore
3. Test manually with `triggerDailyAgentManual`
4. Check GitHub issues or documentation

---

**Last Updated:** 2025-10-24
**Story:** 5.8 - Multi-Step Daily Agent
**Task:** 4 - Cloud Scheduler Integration
