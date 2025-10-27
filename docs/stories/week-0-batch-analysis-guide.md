# Week 0: Historical Batch Analysis Guide
**Accelerated Validation - Run TODAY**

## Overview

Instead of waiting 7 days for shadow mode to collect data, we're analyzing **historical messages from the last 30 days** using the same scoring algorithm. This gives us immediate validation results.

**Timeline:**
- **Today**: Run batch analysis on historical data
- **Today/Tomorrow**: Manual review of 50+ sample digests
- **1-2 days**: Validation sign-off and proceed to Week 1
- **Parallel**: Shadow mode continues running as ongoing validation

---

## Prerequisites

### 1. Firebase Service Account Key

The batch analysis needs direct Firestore access. Ensure you have:

```bash
# Check if service account key exists
ls /Users/zeno/Projects/yipyap/serviceAccountKey.json

# If not found, download it:
# 1. Go to Firebase Console → Project Settings → Service Accounts
# 2. Click "Generate New Private Key"
# 3. Save as serviceAccountKey.json in project root
```

### 2. Set Environment Variable

```bash
# In /Users/zeno/Projects/yipyap/functions directory
export GOOGLE_APPLICATION_CREDENTIALS="../serviceAccountKey.json"
```

---

## Running Batch Analysis

### Step 1: Build Functions

```bash
cd /Users/zeno/Projects/yipyap/functions
npm run build
```

### Step 2: Run Batch Analysis

```bash
npm run batch-analysis
```

**What this does:**
1. Fetches last 30 days of messages for 50-100 active creators
2. Runs relationship scoring algorithm on each message
3. Generates "Meaningful 10" digests for each creator
4. Selects 50 best samples for manual review
5. Outputs results to `functions/results/` directory

**Expected duration**: 2-5 minutes (depends on data volume)

### Step 3: Review Output

The script generates 3 files in `functions/results/`:

1. **batch-analysis-{timestamp}.json**
   - Raw data (all digests, scores, statistics)
   - Use for detailed analysis

2. **batch-analysis-{timestamp}.md**
   - Summary statistics
   - Score distribution
   - High priority analysis

3. **sample-digests-{timestamp}.md** ← **REVIEW THIS**
   - 50 sample digests for manual spot-checking
   - Formatted for easy review
   - Includes tracking table

---

## Manual Review Process

### Step 1: Open Sample Digests

```bash
open functions/results/sample-digests-*.md
```

### Step 2: Spot-Check Each Digest

For each of the 50 sample digests:

**Review the Top 3 High Priority messages:**

```markdown
## Sample 1: Creator abc123...

**Total Messages**: 45

### 🎯 Top 3 High Priority (Respond Today)

**1. Score: 85** | Category: Business
- **Preview**: "Interested in brand partnership for our new product line..."
- **Breakdown**: Category=50, Sentiment=0, Opportunity=20, Relationship=15
- **Manual Judgment**: [ ] ✅ Important | [ ] ❌ Not important
```

**Ask yourself:**
- Is this message actually important?
- Would I prioritize this in my top 3?
- Does the score make sense?

**Check one:**
- ✅ Important = Algorithm is correct
- ❌ Not important = Algorithm scored this too high

### Step 3: Fill Out Tracking Table

At the bottom of `sample-digests-*.md`:

```markdown
## Accuracy Tracking

| Sample | High Priority 1 | High Priority 2 | High Priority 3 | Match Count |
|--------|-----------------|-----------------|-----------------|-------------|
| 1      | ✅              | ✅              | ❌              | 2/3         |
| 2      | ✅              | ✅              | ✅              | 3/3         |
| 3      | ✅              | ❌              | ✅              | 2/3         |
...
```

### Step 4: Calculate Accuracy

```
Total Accuracy = (Sum of Match Counts) / 150 × 100
Target: ≥80% (≥120 matches out of 150)
```

**Example:**
- If you got 125 matches out of 150 → 83.3% ✅ PASS
- If you got 110 matches out of 150 → 73.3% ❌ FAIL (tune weights)

---

## Expected Results

### Good Score Distribution

```
High Priority (≥70):   10-20%  (mostly Business, Urgent, VIP)
Medium Priority (40-69): 30-40%  (Fan engagement, personal messages)
Low Priority (<40):    40-60%  (Generic messages, spam)
```

### High Priority Analysis

Top 3 messages should typically be:
- **Business opportunities** (brand partnerships, collaborations)
- **Urgent time-sensitive** (deadlines, crisis situations)
- **VIP relationships** (long-time supporters, important connections)
- **Crisis sentiment** (very negative messages needing attention)

**Red flags:**
- Generic fan messages scoring high (weights too loose)
- Important business messages scoring low (weights too strict)
- All messages scoring the same (algorithm not differentiating)

---

## Troubleshooting

### "Cannot find module" error

```bash
# Make sure you built first
cd /Users/zeno/Projects/yipyap/functions
npm run build
```

### "Permission denied" errors

```bash
# Check service account key is set
echo $GOOGLE_APPLICATION_CREDENTIALS

# Should output: ../serviceAccountKey.json
# If not, run:
export GOOGLE_APPLICATION_CREDENTIALS="../serviceAccountKey.json"
```

### "No active creators found"

This means your database doesn't have enough historical data. Options:

1. **Reduce date range** (try 7 days instead of 30):
   Edit `historical-batch-analysis.ts`:
   ```typescript
   daysBack: 7,  // ← Change from 30 to 7
   ```

2. **Use test data** (if this is a dev environment):
   Seed test messages first

3. **Use production data** (if available):
   Point to production Firestore instance

### Script runs but no results

Check the console output:
```
✅ Found X active creators
✅ Generated X valid digests
```

If digests = 0, adjust `minMessagesPerCreator`:
```typescript
minMessagesPerCreator: 3,  // ← Lower from 5 to 3
```

---

## Tuning Scoring Weights

If accuracy < 80%, you can tune weights:

### Current Weights

```typescript
{
  business_opportunity: 50,
  urgent: 40,
  crisis_sentiment: 100,
  vip_relationship: 30,
  message_count_bonus: 30,
  recent_interaction: 15
}
```

### Common Adjustments

**Problem**: Generic fan messages scoring too high
```typescript
message_count_bonus: 20,  // ← Reduce from 30
```

**Problem**: Business opportunities scoring too low
```typescript
business_opportunity: 60,  // ← Increase from 50
```

**Problem**: VIP messages not surfacing
```typescript
vip_relationship: 40,  // ← Increase from 30
```

After tuning, re-run:
```bash
npm run build
npm run batch-analysis
```

---

## Validation Sign-Off

### Success Criteria

After manual review:

- [ ] **Accuracy**: ≥80% on 50+ sample digests (≥120/150 matches)
- [ ] **Distribution**: Reasonable spread (not all high or all low)
- [ ] **High Priority**: Mostly Business, Urgent, VIP, Crisis

### Decision Matrix

| Accuracy | Action |
|----------|--------|
| ≥85% | ✅ **PROCEED** to Week 1 immediately |
| 80-84% | ✅ **PROCEED** with monitoring (shadow mode validates) |
| 75-79% | ⚠️ **TUNE** weights and re-run batch analysis |
| <75% | ❌ **REVISE** algorithm, extend shadow mode validation |

### Sign-Off Document

Create `docs/stories/week-0-batch-validation-results.md`:

```markdown
# Week 0 Batch Validation Results

**Analysis Date**: {date}
**Reviewer**: {your name}

## Results

- **Total Samples Reviewed**: 50
- **Total High Priority Messages**: 150
- **Matches**: X/150
- **Accuracy**: X%

## Decision

- [x] ✅ PROCEED to Week 1 backend implementation
- [ ] ❌ EXTEND validation (reason: ___)

**Signed**: ___________ Date: ___________
```

---

## Next Steps After Validation

### If Validation Passes (≥80%)

**Immediately proceed to Week 1:**

1. Create production `relationshipScoringService.ts`
2. Modify `dailyDigestService.ts`
3. Integrate into production workflow
4. Write tests
5. Deploy to production

**Parallel tracking:**
- Shadow mode continues running (validates on live data)
- Monitor shadow mode logs weekly for drift

### If Validation Fails (<80%)

1. **Analyze failure patterns**:
   - Which message types are misclassified?
   - Is scoring too aggressive or too conservative?

2. **Tune weights**:
   - Adjust in `historical-batch-analysis.ts`
   - Re-run batch analysis

3. **Re-validate**:
   - Repeat manual review
   - Target 80%+ on new run

4. **If still failing**:
   - Extend shadow mode to 7 days
   - Collect more manual feedback
   - Consider algorithm revision

---

## Summary

**The Plan:**
1. ✅ Run batch analysis TODAY (2-5 minutes)
2. ✅ Manual review TODAY/TOMORROW (1-2 hours)
3. ✅ Validation sign-off (1-2 days)
4. ✅ Proceed to Week 1 (if ≥80% accuracy)

**Why this works:**
- Same algorithm as shadow mode
- Real historical data (not synthetic)
- Immediate results (no waiting)
- Shadow mode validates in parallel (safety net)

**Let's go!** 🚀

---

## Commands Quick Reference

```bash
# Setup
cd /Users/zeno/Projects/yipyap/functions
export GOOGLE_APPLICATION_CREDENTIALS="../serviceAccountKey.json"

# Run analysis
npm run build
npm run batch-analysis

# View results
open results/sample-digests-*.md
```

**Questions?** Ping James (me!) for help.
