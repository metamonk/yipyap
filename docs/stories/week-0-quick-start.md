# Week 0 Shadow Mode: Quick Start Guide

## ✅ Status: Shadow Mode Deployed

**Deployed**: Oct 26, 2025
**Validation Period**: 7 days (Oct 26 - Nov 2, 2025)
**Function**: `dailyAgentWorkflow` (us-central1)

---

## Quick Verification

### 1. Verify Deployment

```bash
# Check function is deployed
firebase functions:list | grep dailyAgentWorkflow

# Expected output:
# dailyAgentWorkflow  v2  callable  us-central1  1024  nodejs20
```

✅ **Status**: Deployed

### 2. Manual Test (Optional)

To test shadow mode before waiting for the scheduled run:

```bash
# Trigger manually via the app's "Test Daily Agent" screen
# OR use the manual trigger function:
firebase functions:shell
> triggerDailyAgentManual({userId: 'YOUR_USER_ID'})
```

**Note**: Only test with a real user who has unprocessed messages.

### 3. Wait for Scheduled Run

The daily agent runs automatically based on user schedules (typically 9am local time). Shadow mode will activate automatically during these runs.

**Expected timeline**:
- **Next scheduled run**: Check user workflow configs
- **First shadow mode logs**: Within 24 hours of deployment

---

## Monitor Shadow Mode

### View Logs (After First Run)

```bash
# View all logs from dailyAgentWorkflow
firebase functions:log --only dailyAgentWorkflow --since 1h

# Filter for shadow mode entries only
firebase functions:log --only dailyAgentWorkflow --since 1d 2>&1 | grep "\[SHADOW MODE\]"

# Real-time monitoring
firebase functions:log --only dailyAgentWorkflow --tail 2>&1 | grep "\[SHADOW MODE\]"
```

### What to Look For

**Success indicators:**
```
[SHADOW MODE] Starting relationship scoring validation
[SHADOW MODE] Relationship scoring results
  - duration: 1234 (< 3000ms ✅)
  - performanceTarget: "PASS"
  - highPriorityCount: 3
  - topScores: [...]
[SHADOW MODE] Score distribution
[SHADOW MODE] Scoring completed in 1234ms
```

**Error indicators:**
```
[SHADOW MODE] Relationship scoring failed
[SHADOW MODE] Error: ...
```

---

## Next Steps

### Daily Tasks (For 7 Days)

**Every day at ~10am** (after daily agent runs):

1. **Check logs** (5 min):
   ```bash
   firebase functions:log --only dailyAgentWorkflow --since 1h 2>&1 | grep "\[SHADOW MODE\]"
   ```

2. **Spot-check 10 samples** (20 min):
   - Open `docs/stories/week-0-spot-check-log.md`
   - Extract top 3 messages from shadow mode logs
   - Manually review in Firestore
   - Record match/mismatch

3. **Track accuracy** (5 min):
   - Update running total in spot-check log
   - If < 75% at midpoint (Day 4), consider weight tuning

### Week-End Review (Nov 2)

After 7 days:

1. **Calculate final accuracy**: __/70 = __%
2. **Verify performance**: All runs < 3 seconds?
3. **Verify reliability**: Zero errors?
4. **Get sign-off**: PM, Technical PO, Architect

**Decision**:
- ✅ If all criteria met → Proceed to Week 1
- ❌ If criteria not met → Extend shadow mode + tune weights

---

## Troubleshooting

### No logs appearing?

**Possible causes:**
1. No users have unprocessed messages today
2. Daily agent hasn't run yet (check user schedules)
3. Users are online/active (workflow skips if user is active)

**Solution**: Wait 24-48 hours for normal usage patterns to trigger workflow

### Logs show errors?

**Check error message:**
```bash
firebase functions:log --only dailyAgentWorkflow --since 1d 2>&1 | grep -i "error\|failed"
```

**Common issues:**
- Firestore permission errors → Check security rules
- Timeout errors → Check performance (should be < 3s)
- Conversation not found → Expected (deleted conversations)

**Action**: Document in week-0-shadow-mode-validation.md

### Performance > 3 seconds?

**Possible causes:**
1. Too many messages (> 100)
2. Too many conversations
3. Firestore read latency

**Solution**:
- Review batch fetching logic
- Consider denormalization
- Document for optimization in Week 1

---

## Resources

- **Validation Guide**: `docs/stories/week-0-shadow-mode-validation.md`
- **Spot-Check Log**: `docs/stories/week-0-spot-check-log.md`
- **Story File**: `docs/stories/6.1.story.md`
- **Shadow Mode Code**: `functions/src/ai/daily-agent-workflow.ts` (lines 760-973)

---

## Contact

**Questions?**
- PM: John
- Technical PO: Sarah
- Architect: Winston
- Developer: James (me!)

**Ready to begin Week 0 validation!** 🚀

See you in 7 days for the sign-off review.
