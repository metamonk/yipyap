# Daily Agent Testing Scripts

## Setup

The script needs Firebase Admin credentials. Set up using one of these methods:

### Option 1: Using existing Firebase login

```bash
# If you're already logged in to Firebase CLI
firebase login
```

### Option 2: Using service account key

1. Download service account key from Firebase Console:
   - Go to: https://console.firebase.google.com/project/yipyap-444/settings/serviceaccounts/adminsdk
   - Click "Generate new private key"
   - Save as `service-account-key.json` in project root

2. Set environment variable:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/Users/zeno/Projects/yipyap/service-account-key.json
```

---

## Usage

### Trigger Daily Agent Workflow

**Basic usage:**
```bash
npm run trigger-daily-agent -- YOUR_USER_ID
```

**Example:**
```bash
npm run trigger-daily-agent -- abc123xyz
```

**Direct usage:**
```bash
tsx scripts/triggerDailyAgent.ts YOUR_USER_ID
```

---

## What It Does

The script will:
1. ✅ Verify the user exists in Firestore
2. ✅ Check/create daily agent configuration
3. ✅ Trigger the full workflow (fetch → categorize → FAQ detect → draft responses → generate digest)
4. ✅ Show detailed results:
   - Messages fetched and processed
   - FAQs detected and auto-responded
   - Responses drafted for review
   - Cost and duration metrics

---

## Example Output

```
╔════════════════════════════════════════════════════════════╗
║       Daily Agent Workflow Manual Trigger                 ║
╚════════════════════════════════════════════════════════════╝

🎯 Target User: abc123xyz

📋 Step 1: Verifying user exists...
✅ User found: John Doe

📋 Step 2: Checking daily agent configuration...
✅ Config found:
   Daily Workflow: ✅ Enabled
   Require Approval: ❌ No
   Max Auto-Responses: 20
   Scheduled Time: 09:00
   Timezone: America/Chicago

📋 Step 3: Triggering daily agent workflow...
⏳ This may take 1-2 minutes...

╔════════════════════════════════════════════════════════════╗
║                    Workflow Results                        ║
╚════════════════════════════════════════════════════════════╝

✅ Status: SUCCESS
⏱️  Duration: 45.23s
🆔 Execution ID: exec_1729826400000_abc123xyz

📊 Results:
   Messages Fetched:         12
   Messages Categorized:     12
   FAQs Detected:            5
   Auto-Responses Sent:      5
   Responses Drafted:        7
   Messages Needing Review:  7

💰 Cost Metrics:
   Total Duration: 45230ms
   Estimated Cost: $1.2500

📍 View Details in Firestore:
   /users/abc123xyz/daily_executions/exec_1729826400000_abc123xyz
   /users/abc123xyz/daily_digests (check latest)

📋 Step 4: Checking for daily digest...
✅ Digest created: "5 handled, 7 need review"

✅ Workflow completed successfully!

🎉 Script completed successfully
```

---

## Troubleshooting

### Error: "User does not exist"
- Verify the user ID is correct
- Check Firebase Console → Firestore → `/users` collection

### Error: "Permission denied"
- Make sure you're logged in: `firebase login`
- Or set `GOOGLE_APPLICATION_CREDENTIALS` environment variable

### Error: "Cannot find module 'firebase-admin'"
- Run: `npm install` from project root
- Make sure you're in `/Users/zeno/Projects/yipyap` directory

### Warning: "No messages to process"
- This is normal if there are no unprocessed messages
- Messages must be from inactive conversations (>1 hour old)
- User must not be currently online/active

---

## Testing Checklist

Before running the script, ensure:
- [ ] User has Daily Agent enabled in settings
- [ ] There are messages to process (>1 hour old)
- [ ] User has FAQ templates created (for auto-responses)
- [ ] User is set to offline/inactive status
- [ ] Edge Functions are deployed (`/api/categorize-message`, `/api/detect-faq`)

---

## Related Files

- Main workflow: `functions/src/ai/daily-agent-workflow.ts`
- Scheduler: `functions/src/ai/daily-agent-scheduler.ts`
- Testing guide: `docs/testing/daily-agent-testing.md`
