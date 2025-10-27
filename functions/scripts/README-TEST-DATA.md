# Test Data Generation

## Overview

The `seedRealisticTestData.ts` script creates comprehensive, realistic test data for the YipYap application.

## What It Does

1. **Deletes all existing data**
   - Removes all conversations and messages
   - Clean slate for testing

2. **Ensures complete user profiles**
   - Creates/updates 4 user profiles
   - All required fields populated
   - Presence and settings configured

3. **Creates 200+ realistic messages**
   - No AI slop (no excessive emojis, sounds like real people)
   - Proper distribution across categories:
     - 80 fan engagement (40%)
     - 15 business opportunities (7.5%)
     - 10 spam (5%)
     - 25 urgent (12.5%)
     - 40 general (20%)
     - 15 negative sentiment (7.5%)
     - 15 positive (7.5%)

4. **Creates realistic conversations**
   - Multiple 1-on-1 conversations
   - 1 group conversation
   - Proper timestamps spread over 90 days
   - All metadata fields populated

5. **Populates all message fields**
   - Category, sentiment, emotional tone
   - Business opportunity scores
   - VIP flags and relationship context
   - AI processing metadata
   - Proper sender information

## Users

**Main User (heavily used):**
- `XoBenqsIt7bRp9ZYsftif0ZQc9o1` (Zeno)

**Test Users:**
- `QKw7CZMc7aP8dLOM0jD0dUTQLQL2` (Alex Chen)
- `jvExoDDTXsZHly4SOEfKmHZdqE42` (Sarah Kim)
- `zX4yI7Luw3PcY1TSEQ1wC6vOsfa2` (Mike Rivera)

## Usage

```bash
# From project root
GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/seedRealisticTestData.ts
```

## Message Categories

### Fan Engagement (40%)
Typical fan messages - appreciative, supportive, genuine

### Business Opportunities (7.5%)
Real business inquiries with:
- Opportunity scores (60-100)
- Budget mentions
- Professional tone
- Partnership discussions

### Spam (5%)
Obvious promotional content, scams, etc.

### Urgent (12.5%)
Time-sensitive messages, requests for help, decisions needed

### General (20%)
Casual conversation, check-ins, simple questions

### Negative Sentiment (7.5%)
Messages expressing struggle, frustration, or difficulty

### Positive Sentiment (7.5%)
Uplifting messages, progress updates, good news

## Data Quality

✅ **Real-sounding text** - No AI slop, no excessive emojis
✅ **Proper timestamps** - Spread over 90 days, realistic patterns
✅ **Complete metadata** - All fields populated correctly
✅ **Varied categories** - Representative distribution
✅ **Relationship context** - VIP flags, message counts, ages
✅ **Business opportunities** - With scores and indicators
✅ **Group conversations** - With multiple participants

## After Running

1. Test the Daily Agent workflow
2. Verify Meaningful 10 digest generation
3. Check message categorization
4. Test FAQ detection
5. Verify auto-archive logic
6. Check business opportunity detection

## Notes

- Script is idempotent (can run multiple times)
- Always deletes existing data first
- Focuses heavily on main user (XoBenqsIt7bRp9ZYsftif0ZQc9o1)
- Creates deterministic conversation IDs for 1-on-1 chats
- Random group conversation ID
