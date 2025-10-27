# Week 0: Shadow Mode Validation Guide
**Story 6.1: Meaningful 10 Daily Digest**

## Overview

Shadow mode is now LIVE in production (deployed: 2025-10-26). The relationship scoring algorithm runs alongside the existing daily workflow in **logging-only mode** - it does NOT affect the actual digest users see.

**Duration**: 7 days (Oct 26 - Nov 2, 2025)

**Success Criteria**:
- ✅ No errors for 7 consecutive days
- ✅ Performance < 3 seconds for 50 messages
- ✅ 80%+ accuracy on manual spot-checks (50+ samples)

---

## Monitoring Dashboard Queries

### 1. View All Shadow Mode Logs

```bash
# Last 100 shadow mode entries
firebase functions:log --only dailyAgentWorkflow | grep "\[SHADOW MODE\]"

# Real-time monitoring (tail mode)
firebase functions:log --only dailyAgentWorkflow --tail | grep "\[SHADOW MODE\]"

# Last 24 hours
firebase functions:log --only dailyAgentWorkflow --since 1d | grep "\[SHADOW MODE\]"
```

### 2. Performance Metrics

Look for these log entries:

```json
{
  "severity": "INFO",
  "message": "[SHADOW MODE] Relationship scoring results",
  "data": {
    "userId": "user123",
    "executionId": "exec_...",
    "messageCount": 45,
    "conversationCount": 32,
    "highPriorityCount": 3,
    "mediumPriorityCount": 7,
    "lowPriorityCount": 35,
    "duration": 2134,  // ← CHECK: Must be < 3000ms
    "performanceTarget": "PASS",  // ← CHECK: Should always be PASS
    "topScores": [
      {
        "messageId": "msg_abc",
        "score": 85,
        "breakdown": {
          "category": 50,      // Business opportunity
          "sentiment": 0,
          "opportunity": 20,
          "relationship": 15
        }
      }
    ]
  }
}
```

**What to check:**
- `duration` < 3000ms (performance target)
- `performanceTarget` = "PASS"
- `topScores` look reasonable (Business/Urgent messages have high scores)

### 3. Score Distribution

Look for these log entries:

```json
{
  "severity": "INFO",
  "message": "[SHADOW MODE] Score distribution",
  "data": {
    "userId": "user123",
    "executionId": "exec_...",
    "distribution": {
      "high": 5,    // Score >= 70
      "medium": 12, // Score >= 40
      "low": 28     // Score < 40
    }
  }
}
```

**What to check:**
- Not all messages scoring "high" (would indicate weights are too loose)
- Not all messages scoring "low" (would indicate weights are too strict)
- Reasonable distribution (expect ~10-20% high, ~30-40% medium, ~40-60% low)

### 4. Error Detection

```bash
# Check for shadow mode errors
firebase functions:log --only dailyAgentWorkflow | grep "\[SHADOW MODE\]" | grep -i "error\|failed"

# Count errors per day
firebase functions:log --since 1d | grep "\[SHADOW MODE\].*failed" | wc -l
```

**Success Criteria**: Zero errors for 7 consecutive days

---

## Manual Spot-Check Process

### Daily Spot-Check (10 samples/day × 7 days = 70 total)

**Goal**: Validate that the algorithm's "top 3 high priority" messages actually make sense.

**Process**:

1. **Find a shadow mode execution**:
```bash
firebase functions:log --only dailyAgentWorkflow --since 1d | grep "\[SHADOW MODE\] Relationship scoring results" | head -1
```

2. **Extract the top 3 high priority messages**:
Look for the `topScores` array in the log entry. Example:
```json
"topScores": [
  {
    "messageId": "msg_abc",
    "score": 85,
    "breakdown": { "category": 50, "sentiment": 0, "opportunity": 20, "relationship": 15 }
  },
  {
    "messageId": "msg_def",
    "score": 78,
    "breakdown": { "category": 50, "sentiment": 0, "opportunity": 0, "relationship": 28 }
  },
  {
    "messageId": "msg_ghi",
    "score": 70,
    "breakdown": { "category": 40, "sentiment": 0, "opportunity": 15, "relationship": 15 }
  }
]
```

3. **Manually review the messages in Firestore**:
Go to Firebase Console → Firestore → `messages` → Find each `messageId`

4. **Ask yourself**:
   - Is this message actually important? (Business, Urgent, VIP, etc.)
   - Would I prioritize this in a "Top 3" list?
   - Does the score breakdown make sense?

5. **Record your judgment**:
```
| Date | MessageID | Score | Category | Manual Judgment | Match? |
|------|-----------|-------|----------|-----------------|--------|
| 10/26| msg_abc   | 85    | Business | YES, important  | ✅     |
| 10/26| msg_def   | 78    | Fan      | NO, generic fan | ❌     |
| 10/26| msg_ghi   | 70    | Urgent   | YES, time-sensitive | ✅  |
```

6. **Calculate accuracy**:
   - After 50+ samples: `Accuracy = (Matches / Total) × 100`
   - Target: **80%+**

---

## Tuning Scoring Weights (If Needed)

If accuracy < 80%, you can tune the weights via Firebase Remote Config:

### Current Default Weights

```typescript
{
  business_opportunity: 50,
  urgent: 40,
  crisis_sentiment: 100, // Always prioritize crisis
  vip_relationship: 30,
  message_count_bonus: 30,
  recent_interaction: 15
}
```

### How to Tune

**Scenario 1: Too many generic messages scoring high**
- **Problem**: Fan messages scoring too high
- **Fix**: Reduce `message_count_bonus` (30 → 20)

**Scenario 2: Business opportunities scoring too low**
- **Problem**: Important brand partnerships not in top 3
- **Fix**: Increase `business_opportunity` (50 → 60)

**Scenario 3: VIP messages not prioritized enough**
- **Problem**: Long-term supporters not surfacing
- **Fix**: Increase `vip_relationship` (30 → 40)

### Deploy Weight Changes

Option A: **Update in code** (requires redeploy):
```typescript
// functions/src/ai/daily-agent-workflow.ts (line ~790)
const weights = {
  business_opportunity: 60,  // ← Increased
  urgent: 40,
  crisis_sentiment: 100,
  vip_relationship: 40,      // ← Increased
  message_count_bonus: 20,   // ← Decreased
  recent_interaction: 15,
};
```

Then redeploy:
```bash
firebase deploy --only functions:dailyAgentWorkflow
```

Option B: **Remote Config** (future enhancement):
Add support for fetching weights from Firestore config document.

---

## Daily Checklist (For 7 Days)

### Day 1 (Oct 26, 2025)
- [x] ✅ Shadow mode deployed
- [ ] Monitor first batch of executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Record performance metrics
- [ ] Note: Any errors? Any patterns?

### Day 2 (Oct 27, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Running accuracy: __/20 (__%)
- [ ] Any weight tuning needed?

### Day 3 (Oct 28, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Running accuracy: __/30 (__%)
- [ ] Performance stable?

### Day 4 (Oct 29, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Running accuracy: __/40 (__%)
- [ ] Midpoint check: On track for 80%+?

### Day 5 (Oct 30, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Running accuracy: __/50 (__%)
- [ ] If < 75%, consider weight tuning

### Day 6 (Oct 31, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] Running accuracy: __/60 (__%)
- [ ] Final weight tuning if needed

### Day 7 (Nov 1, 2025)
- [ ] Monitor executions (check logs)
- [ ] Spot-check 10 samples
- [ ] **FINAL ACCURACY: __/70 (__%)** ← Must be ≥80%
- [ ] Performance: All executions < 3 seconds? (YES/NO)
- [ ] Errors: Zero errors for 7 days? (YES/NO)

---

## Validation Sign-Off

### Success Criteria Met?

- [ ] **Accuracy**: ≥80% on 50+ manual spot-checks
- [ ] **Performance**: All executions < 3 seconds
- [ ] **Reliability**: Zero errors for 7 consecutive days

### Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| PM (John) | | | |
| Technical PO (Sarah) | | | |
| Architect (Winston) | | | |

**Decision**:
- [ ] ✅ PROCEED to Week 1 backend implementation
- [ ] ❌ EXTEND shadow mode validation (specify reason)

**Notes**:
[Add any observations, insights, or recommendations for Week 1]

---

## Next Steps After Validation

**If validation passes** (80%+ accuracy, < 3s, zero errors):

1. **Week 1 (Nov 3-9)**: Backend implementation
   - Create full `relationshipScoringService.ts`
   - Modify `dailyDigestService.ts` (add `getMeaningful10Digest()`)
   - Integrate into production workflow (not shadow mode)
   - Write 45 unit/integration tests

2. **Week 2 (Nov 10-16)**: Frontend implementation
   - DELETE "Approve All" / "Reject All" buttons
   - Build priority tier UI (High/Medium/Auto-handled)
   - Add time estimates, capacity indicators
   - Write 30 component tests

3. **Staging Rollout**: Full team testing (3 days)
4. **Canary Rollout**: 5% → 25% → 50% → 100% (9 days)

**If validation fails** (< 80% accuracy):
- Analyze failure patterns (which message types are misclassified?)
- Tune weights and extend shadow mode for another 3-5 days
- Re-validate with new spot-checks

---

## Contact

**Questions during validation?**
- PM: John
- Technical PO: Sarah (acceptance criteria validation)
- Architect: Winston (performance/technical issues)
- Developer: James (implementation questions)

**Log access issues?**
```bash
# Ensure you're authenticated
firebase login

# Ensure you're on the right project
firebase use yipyap-444

# Test log access
firebase functions:log --only dailyAgentWorkflow --limit 10
```
