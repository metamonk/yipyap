# Epic 5 Repurposing Plan: From Automation to Authentic Engagement

**Document Status:** ✅ FINAL - Ready for Implementation
**Created:** 2025-10-25
**Updated:** 2025-10-26 (Consolidated PM + Architect Feedback)
**Author:** Mary (Business Analyst)
**Reviewed By:**
- ✅ PM (John) - APPROVED (8.5/10 confidence)
- ✅ Architect (Winston) - APPROVED (85% confidence)

**Sign-Off:**
- ✅ Product Owner - APPROVED (All decisions finalized)
- ✅ Ready for SM (Bob) - Story creation
- ✅ Ready for Dev (James) - Implementation

---

## Document Purpose

This document outlines a **strategic repurposing** of Epic 5's AI automation features, shifting from **"AI handles messages for you"** to **"AI helps you choose which messages matter most"**.

All product and technical decisions have been finalized through parallel review by PM and Architect. This document is **implementation-ready** and can be handed directly to the Scrum Master for story creation.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Changes - ALL DECISIONS FINALIZED](#2-product-changes)
3. [Technical Approach - ALL DECISIONS FINALIZED](#3-technical-approach)
4. [Implementation Plan - Week 0 to Week 6](#4-implementation-plan)
5. [Change Management](#5-change-management)
6. [Success Metrics & Monitoring](#6-success-metrics--monitoring)
7. [Risk Management](#7-risk-management)
8. [Handoff Checklist](#8-handoff-checklist)

---

## 1. Executive Summary

### 1.1 Problem Statement

**Current State:**
Epic 5 (Stories 5.1-5.10) implemented AI automation:
- Voice-matched response generation (Story 5.5)
- Daily agent workflow with bulk approve/reject (Story 5.8)
- Message categorization, sentiment analysis, FAQ detection
- Performance monitoring and cost tracking

**Critical Issue Identified:**
The current UX promotes **inauthentic engagement at scale** rather than helping creators maintain **authentic connection within capacity limits**.

**Key Problems:**
1. **Authenticity Paradox:** "Approve All" allows creators to send messages they haven't read
2. **Wrong Mental Model:** Binary approve/reject doesn't match creator triage behavior
3. **Disengagement Risk:** Features train creators to disengage from their community
4. **Missing Context:** System learns HOW creators write, but not WHO/WHAT/WHEN they prioritize

### 1.2 Strategic Shift

**From:**
> "AI automates your DM responses. Approve 50 messages with one tap!"

**To:**
> "AI curates your top 10 most meaningful messages. Spend 20 minutes on authentic connection, not 2 hours on inbox anxiety."

**Philosophy Change:**
- ❌ Automation of personal connection
- ✅ Curation within sustainable capacity

### 1.3 Review Outcomes

**PM Validation (John):** ✅ APPROVED
- User value: Strong alignment with creator pain points
- Features solve authenticity + capacity problems
- Differentiation angle ("anti-automation") resonates
- Confidence: 8.5/10

**Architect Validation (Winston):** ✅ APPROVED
- Infrastructure reuse: 80%+ validated
- Migration strategy: Robust zero-downtime approach
- Performance targets: All achievable
- Confidence: 85%

**Cross-Functional Alignment:** ✅ NO CONFLICTS
- All product questions answered
- All technical questions resolved
- Implementation plan agreed upon

### 1.4 Expected Outcomes

**User Benefits:**
- Focus on 10 high-priority messages/day (vs 50+ low-quality)
- Drafts always editable (no blind approval)
- Honest capacity management (no fake scaling)
- Better engagement health tracking

**Business Benefits:**
- Differentiated positioning ("anti-automation")
- Lower ethical risk (no fake responses)
- 30% reduction in AI costs
- +10% creator retention (less burnout)

**Technical Benefits:**
- 80% infrastructure reuse
- 4-6 week delivery (vs 12+ week rebuild)
- Simpler UX (editing > approving)

---

## 2. Product Changes

> **Status:** ALL PRODUCT DECISIONS FINALIZED BY PM (JOHN)

### 2.1 Features Overview

| Feature | Status | Priority | Timeline | Infrastructure Reuse |
|---------|--------|----------|----------|---------------------|
| Meaningful 10 Digest | ✅ FINAL | P0 | Week 1-2 | 85% |
| Draft-First Response | ✅ COMPLETED (2025-10-26) | P0 | Week 1-2 | 90% |
| Basic Capacity Settings | ✅ FINAL | P0 | Week 1-2 | 80% |
| Boundary Auto-Archive | ✅ FINAL | P1 | Week 3-4 | 95% |
| Advanced Capacity Config | ✅ FINAL | P1 | Week 3-4 | 80% |
| Engagement Health Dashboard | ✅ FINAL | P2 | Week 5-6 | 85% |

---

### 2.2 Feature #1: "Meaningful 10" Daily Digest

**User Story:**
> As a creator, I want to see my top 10 most important messages each day (ranked by priority), so I can focus my limited time on meaningful connections instead of feeling overwhelmed by volume.

**Current UX (Story 5.8):**
```
Daily Digest
─────────────
10 messages handled automatically
5 messages need your review

[Approve All] [Reject All]
```

**New UX:**
```
Your Meaningful 10 Today
─────────────────────────
Estimated time: 20 minutes

🎯 High Priority (Respond Today)
├─ 💼 Business: Brand partnership inquiry [2 min]
│  "Hey! Love your content. Want to discuss..."
│  [View Full] [Draft Response]
│
├─ ⚡ Urgent: Collaboration deadline tomorrow [1 min]
│  "Following up on our collab - need answer by..."
│  [View Full] [Draft Response]
│
└─ 💎 VIP Fan: Long-time supporter milestone [3 min]
   "@superfan (messaging you for 2 years): Just wanted..."
   [View Full] [Draft Response]

⏰ Medium Priority (This Week)
├─ 💬 Personal: Fan shared their story [5 min]
└─ 🤝 Network: Fellow creator introduction [2 min]

✅ Auto-Handled (No Action Needed)
├─ FAQ: 8 messages auto-responded
└─ Archived: 12 low-priority with kind message
    [Expand to Review] ← Collapsible section

⚙️ Capacity: 5/10 used today (5 responses remaining)
```

**Key Changes:**
1. **Priority Tiers:** High/Medium/Auto-handled (not flat pending list)
2. **Relationship Context:** Shows sender history ("messaging you for 2 years")
3. **Time Estimates:** Transparent about effort required
4. **Capacity Tracking:** Shows daily limit usage
5. **No Approve All:** Removed dangerous bulk action
6. **Visual Distinction:** Icons, colors, badges for tiers (accessibility)
7. **Collapsible Archive:** View auto-archived messages (transparency)

**Acceptance Criteria:**

**Core Functionality (AC1-AC10):**
- AC1: Messages grouped into 3 tiers (High/Medium/Auto-handled)
- AC2: High priority limited to top 3 most important (based on scoring)
- AC3: Medium priority shows next 2-7 messages (up to capacity limit)
- AC4: Auto-handled section shows FAQ count + archived count
- AC5: Time estimates displayed for each message (±30 seconds accuracy)
- AC6: Relationship context shown (conversation history, message count, recency)
- AC7: No "Approve All" or "Reject All" buttons present
- AC8: Capacity usage displayed (X/Y messages handled today)
- AC9: Refresh updates digest in real-time
- AC10: Empty state when no pending messages

**Added from PM Review (AC11-AC12):**
- AC11: Empty state guidance when capacity < messages received ("Only 7 messages today - adjust capacity if too quiet")
- AC12: Visual distinction between priority tiers (icons, colors, accessible labels)

**Product Decisions (FINALIZED BY PM):**

**Q1: Configurable or Fixed Capacity?**
✅ **DECISION: Configurable (5-20 range)**

Rationale:
- Creators have vastly different message volumes
- Supports different archetypes (micro/mid/power users)
- Marketing uses "Meaningful 10" as brand name
- Settings guide: "Most creators choose 8-12"

**Q2: Show Archived Messages?**
✅ **DECISION: Show in collapsible section (default: collapsed)**

Rationale:
- Transparency builds trust
- Safety net if algorithm makes mistakes
- Creators can adjust capacity if needed
- Copy: "12 low-priority messages kindly archived (expand to review)"

**Q3: Ignored High-Priority Messages?**
✅ **DECISION: Gentle persistence with escalation**

Behavior:
- Day 1: Appears in "High Priority" tier
- Day 2: Stays in "High Priority," add visual indicator ("2nd day")
- Day 3: Add to notification: "3 urgent messages still pending"
- Day 4+: Move to "Overdue" section above High Priority (yellow/amber)
- Day 7+: Send check-in: "You have 3 messages waiting over a week - need to adjust capacity?"
- **DO NOT** auto-archive high-priority messages

---

### 2.3 Feature #2: Draft-First Response Interface ✅ COMPLETED

**Implementation Date**: 2025-10-26
**Test Coverage**: 69/69 tests passing (100%)

**User Story:**
> As a creator, I want AI-generated responses to open in edit mode (not approval mode), so I can personalize every message before sending and maintain authenticity.

**Current UX (Story 5.5):**
```
Response Suggestions
────────────────────
✨ AI Suggestion 1:
"Thanks so much! I really appreciate your support 💙"

[✓ Accept] [✗ Reject] [✎ Edit]
```

**New UX:**
```
AI Draft Assistant
──────────────────
✨ Draft starting point (please personalize):

┌─────────────────────────────────────┐
│ Thanks so much! I really appreciate │ ← Always editable
│ your support 💙                     │   (not approval mode)
│                                     │
│ [Cursor here - add personal touch] │
└─────────────────────────────────────┘

💡 Personalization suggestions:
• Add specific detail about their message
• Include personal callback to previous conversation
• End with a question to continue dialogue

⏱️ Time saved: ~2 minutes of typing
📝 Requires editing before sending

[Send Personalized Response] [Discard Draft] [Generate New Draft]
```

**Low-Confidence Draft (<70% quality):**
```
⚠️ Low confidence draft - we're not sure about this one

✨ Draft starting point:
[Uncertain draft text...]

💡 This draft may not match your voice well.
   Consider:
   • [Generate New Draft] (retry)
   • [Write From Scratch] (blank input)
   • [Use Draft Anyway] (edit heavily)
```

**Acceptance Criteria:**

**Core Functionality (AC1-AC10):**
- AC1: Draft text always displayed in editable TextInput (not read-only)
- AC2: Send button disabled until user has edited text OR explicitly marked as reviewed
- AC3: Personalization suggestions displayed below draft (3 specific prompts)
- AC4: Time saved metric shown (calculated from message length)
- AC5: "Requires editing" flag blocks send for high-priority/business messages
- AC6: Discard draft option available without sending
- AC7: Draft edits tracked in analytics (edit rate metric)
- AC8: Multiple drafts can be generated (refresh button)
- AC9: Draft quality score shown (confidence 0-100)
- AC10: Character count and message length validation

**Added from PM Review (AC11-AC12):**
- AC11: Undo/revert to original draft if creator overwrites poorly
- AC12: Draft history (if creator generates multiple drafts for same message)

**Product Decisions (FINALIZED BY PM):**

**Q1: Override "Requires Editing" Flag?**
✅ **DECISION: Yes, with friction + tracking**

UX:
```
Draft Requires Editing (Business Message)
┌─────────────────────────────────────┐
│ [Draft text here...]                │
└─────────────────────────────────────┘

[Send After Editing] ← Primary CTA

I trust this draft, send as-is ← Small text link
  ↓ (if clicked)
  "Are you sure? This message is marked as high-priority.
   We recommend personalizing business messages."
   [Cancel] [Send Anyway]
```

Tracking: Log override rate for monitoring

**Q2: Save Draft Edits Locally?**
✅ **DECISION: Yes, auto-save to Firestore**

Implementation:
- Auto-save every 5 seconds while editing (debounced)
- Store in `message_drafts` subcollection under `conversations/{id}`
- Restore on return to conversation
- Clear after sending or explicit "Discard"

**Q3: Low-Confidence Drafts (<70%)?**
✅ **DECISION: Transparent warning + alternative options**

Thresholds:
- < 70%: Show warning, encourage retry or manual write
- 70-85%: Standard draft UX
- 85%+: Add confidence badge ("High confidence draft")

---

### 2.4 Feature #3: Basic Capacity Settings (ADDED TO PHASE 1)

**User Story:**
> As a creator, I want to set my daily response capacity (5-20 messages), so the system respects my realistic limits and helps me avoid burnout.

**New Settings Screen (Simple Version):**
```
Daily Capacity
─────────────────

How many messages can you meaningfully respond to each day?

┌─────────────────────────────────────┐
│ ◄────●─────────────────────────► │
│     10 meaningful responses/day    │
└─────────────────────────────────────┘
      5                          20

Based on your message volume (50/day), we recommend 10.

Most creators choose 8-12 for sustainable engagement.

Your commitment:
• Deep engagement: ~10 people/day (20 min)
• FAQ auto-responses: Unlimited
• Kind boundary messages: Remaining messages

[Save Settings]
```

**Acceptance Criteria:**

- AC1: Capacity slider range: 5-20 messages/day
- AC2: Default capacity: 10 messages/day
- AC3: Suggested capacity calculated: Math.round(avgDailyMessages * 0.18)
- AC4: Time commitment estimate shown (avg 2 min/message)
- AC5: Settings saved to Firestore immediately
- AC6: Validation prevents capacity < 5 (too restrictive)
- AC7: Help text explains impact of capacity setting
- AC8: Preview shows distribution (X deep, Y FAQ, Z archived)

**Product Decisions (FINALIZED BY PM):**

**Q1: Auto-Adjust Capacity?**
✅ **DECISION: No auto-adjust, but suggest adjustments**

Weekly Check-in Logic:
```
if (actualUsage.avg < capacity * 0.5) {
  suggest: "Lower capacity to 8" (less pressure)
}

if (actualUsage.avg > capacity * 0.9 && burnoutRisk === 'high') {
  suggest: "Focus on fewer, deeper conversations"
}
```

**Q2: Suggest Capacity Dynamically?**
✅ **DECISION: Yes, during onboarding and settings**

Formula:
```javascript
function suggestCapacity(avgDailyMessages: number): number {
  const suggested = Math.round(avgDailyMessages * 0.18);
  return Math.max(5, Math.min(20, suggested));
}

// Examples:
// 30 messages/day → Suggest 10 capacity (33%)
// 80 messages/day → Suggest 15 capacity (19%)
// 200 messages/day → Suggest 20 capacity (10% - max)
```

**Q3: Default Capacity for New Users?**
✅ **DECISION: 10 (brand-aligned default)**

Rationale:
- Aligns with "Meaningful 10" branding
- Research: 10-12 is sustainable (20 min/day)
- Conservative default prevents burnout
- Easy to adjust up if needed

---

### 2.5 Feature #4: Kind Boundary Auto-Archive

**User Story:**
> As a creator, I want low-priority messages automatically archived with a kind explanation (not ignored), so fans understand my capacity limits without feeling rejected.

**Auto-Handled Section:**
```
✅ Auto-Handled (No Action Needed)
──────────────────────────────────
12 messages kindly archived with boundary message:

"Hi! I get hundreds of messages daily and can't
personally respond to everyone.

For quick questions → FAQ: [link]
For community → Discord: [link]

I read every message but focus on those I can give
thoughtful attention to. Thank you for understanding! 💙"

⚙️ [Edit Boundary Message] [View Archived (12)] ← Collapsible
```

**Boundary Message Sent to Fans:**
```
[Auto-message from creator's account]

Hi! I get hundreds of messages daily and can't personally
respond to everyone.

For quick questions, check out my FAQ: [link]
For deeper connection, join my community: [Discord link]

I read every message, but I focus on responding to those
I can give thoughtful attention to. If this is time-sensitive,
feel free to follow up and I'll prioritize it.

Thank you for understanding! 💙

[This message was sent automatically]
```

**Acceptance Criteria:**

**Core Functionality (AC1-AC10):**
- AC1: Boundary message template customizable in settings
- AC2: Auto-archive applies only to low-priority general messages (not business/urgent/VIP)
- AC3: Boundary message includes FAQ link and community link (if configured)
- AC4: Message clearly labeled as automated in metadata
- AC5: Archived conversations moved to separate folder (not deleted)
- AC6: Creator can view archived messages and manually respond later
- AC7: Boundary message respects quiet hours settings
- AC8: Analytics track auto-archive count and effectiveness
- AC9: Safety check: Never auto-archive crisis/urgent sentiment messages
- AC10: Undo option available for 24 hours after auto-archive

**Added from PM Review (AC11):**
- AC11: Rate limiting (max 1 boundary message per fan per week to avoid spam perception)

**Product Decisions (FINALIZED BY PM):**

**Q1: Immediate or Batched Sending?**
✅ **DECISION: Batched daily (during daily workflow)**

Rationale:
- Reduces spam perception (not immediate auto-reply)
- Respects quiet hours
- Lower notification noise for fans
- Aligns with "Daily Digest" mental model

Exception: If fan sends follow-up before batch runs, don't send boundary (conversation still active)

**Q2: Fan Escalation Allowed?**
✅ **DECISION: Yes, passive escalation only**

Behavior:
- If fan replies to boundary → message moves to Medium Priority next day
- If fan replies again → moves to High Priority (persistence signals importance)
- Don't notify fan about escalation (happens automatically)
- Copy: "If this is time-sensitive, feel free to follow up and I'll prioritize it."

**Q3: What if Fan Replies Again?**
✅ **DECISION: Un-archive and re-prioritize**

- Auto-archived conversation moved back to inbox
- Relationship score recalculated (persistence increases score)
- Appears in next day's digest (tier based on new score)
- Don't send another boundary message (fan already got one)
- Log "un-archive count" to detect spam/persistent fans

---

### 2.6 Feature #5: Engagement Health Dashboard

**User Story:**
> As a creator, I want to see my engagement quality metrics (not just quantity), so I can maintain healthy relationships and avoid burning out.

**Dashboard Screen:**
```
Engagement Health
─────────────────

Overall Score: 87/100 ✅ Healthy

┌─────────────────────────────────────┐
│ Personal Response Rate              │
│ ████████████████░░░░ 82%            │
│ Target: 80%+ ✅                     │
│ (% of responses you edited/wrote)   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Average Response Time               │
│ 18 hours                            │
│ Target: <24h ✅                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Conversation Depth                  │
│ ████████████░░░░░░░░ 45%            │
│ Target: 40%+ ✅                     │
│ (% of convos with 3+ exchanges)     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Capacity Usage                      │
│ ██████████████░░░░░░ 7/10 today     │
│ ██████████████████░░ 48/70 this wk  │
└─────────────────────────────────────┘

⚠️ Burnout Risk: Low
✨ Streak: 14 days of healthy engagement
📈 Trend: +5 points from last week

[View Details] [Adjust Capacity]
```

**Acceptance Criteria:**

**Core Functionality (AC1-AC10):**
- AC1: Overall health score (0-100) calculated from composite metrics
- AC2: Personal response rate shown (% not using AI drafts blindly)
- AC3: Average response time displayed (hours)
- AC4: Conversation depth metric (% multi-turn conversations)
- AC5: Capacity usage shown for today and week
- AC6: Burnout risk indicator (Low/Medium/High) with explanation
- AC7: Visual indicators (✅/⚠️/❌) for each metric vs target
- AC8: Trend charts available (tap "View Details")
- AC9: Recommendations shown if metrics unhealthy
- AC10: Refresh every 5 minutes when screen active

**Added from PM Review (AC11-AC12):**
- AC11: Week-over-week trends ("+5 points from last week")
- AC12: Peer benchmarks (optional: "Your response rate is higher than 70% of creators")

**Product Decisions (FINALIZED BY PM):**

**Q1: Burnout Notifications?**
✅ **DECISION: High risk only (push + email + dashboard)**

Notification Levels:
- **Low risk:** Dashboard only (no notification)
- **Medium risk:** Dashboard + weekly summary email
- **High risk:** Push notification + email + dashboard

Notification Copy:
```
⚠️ Engagement Health Alert

Your burnout risk is high. You've been at 100% capacity
for 7 straight days and response times are increasing.

Consider:
• Lower your daily capacity (currently 20 → try 15)
• Take a rest day
• Review your boundary message settings

[Adjust Settings] [View Health Dashboard]
```

Frequency: Max 1 notification per week (avoid alert fatigue)

**Q2: Health Thresholds?**
✅ **DECISION: Research-backed + iterative thresholds**

| Metric | Healthy (✅) | At Risk (⚠️) | Unhealthy (❌) |
|--------|-------------|--------------|---------------|
| Personal Response Rate | 80%+ | 60-79% | < 60% |
| Avg Response Time | < 24h | 24-48h | > 48h |
| Conversation Depth | 40%+ | 25-39% | < 25% |
| Capacity Usage | 60-90% | 91-100% or < 40% | 7 days at 100% |

Burnout Risk Formula:
```javascript
function assessBurnoutRisk(metrics): 'low' | 'medium' | 'high' {
  let score = 0;

  if (metrics.capacityUsage === 100 && metrics.daysAtMax >= 7) score += 3;
  if (metrics.personalResponseRate < 60) score += 2;
  if (metrics.avgResponseTime > 48) score += 2;
  if (metrics.conversationDepth < 25) score += 1;

  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
```

**Q3: Relationship NPS?**
✅ **DECISION: Phase 4 (post-launch), not MVP**

Rationale:
- Requires fan-facing UI (reaction buttons)
- Adds complexity to MVP
- Good idea, defer until core metrics validated

Future:
- Add reaction system: 👍 👎 after receiving response
- Track "positive reaction rate"
- Include in Engagement Health v2

---

## 3. Technical Approach

> **Status:** ALL TECHNICAL DECISIONS FINALIZED BY ARCHITECT (WINSTON)

### 3.1 Infrastructure Reuse (VALIDATED)

| Component | Reuse % | Status | Changes Required |
|-----------|---------|--------|------------------|
| Message Categorization (5.2) | 95% | ✅ | Add relationship scoring |
| Sentiment Analysis (5.3) | 100% | ✅ | No changes |
| FAQ Detection (5.4) | 100% | ✅ | No changes |
| Voice Matching (5.5) | 90% | ✅ | Change approval → draft mode |
| Opportunity Scoring (5.6) | 100% | ✅ | No changes |
| Dashboard Framework (5.7) | 85% | ✅ | Swap metrics (quality vs quantity) |
| Daily Agent Workflow (5.8) | 80% | ✅ | Add scoring, remove approve all |
| Performance Monitoring (5.9) | 90% | ✅ | Add engagement metrics |
| AI Infrastructure (5.1) | 100% | ✅ | No changes |

**Overall Reuse:** 90% backend, 75% frontend ✅ VALIDATED BY ARCHITECT

### 3.2 Technical Decisions (FINALIZED)

**Q1: Relationship Scoring - Pre-calculate or On-Demand?**
✅ **DECISION: Pre-calculate during daily workflow** (HIGH confidence)

Rationale (PM + Architect agreement):
- Faster digest load times (< 500ms target)
- Scores only change once/day
- Easier to debug/iterate on algorithm
- Lower real-time query costs

Implementation:
```typescript
// In daily-agent-workflow.ts
async function orchestrateWorkflow(userId: string) {
  const messages = await fetchUnprocessedMessages(userId);
  const categorized = await categorizeMessages(messages);

  // NEW: Pre-calculate scores and store in metadata
  const scored = await scoreMessagesByRelationship(categorized);

  // Store scores in message metadata for fast retrieval
  await batchUpdateMessageMetadata(scored);

  // Rest of workflow...
}
```

**Q2: Engagement Metrics - Real-time or Cached?**
✅ **DECISION: Pre-calculate daily + manual refresh option** (HIGH confidence)

Rationale:
- Load time < 0.1 second (vs 1 second real-time)
- Metrics don't change frequently
- Lower Firestore query costs

Implementation:
- Cloud Function runs daily at midnight (calculates for all users)
- Stores in `engagement_metrics` collection
- Dashboard reads from cache (< 0.1s)
- Manual refresh button triggers on-demand calculation

**Q3: Migration Strategy - Dual-write or Hard Cutover?**
✅ **DECISION: Dual-write for 2 weeks + feature flags** (HIGH confidence)

Rationale:
- Data safety net during transition
- Easy rollback if issues arise
- Validate new system before deprecating old

Migration Timeline:
- Week 0-1: Dual-write (both old + new schemas)
- Week 2: Feature flag rollout (5% → 25% → 50% → 100%)
- Week 3-4: Monitor, validate, tune
- Week 5+: Deprecate old schema, cleanup

**Q4: Conversation Metadata - Denormalize or Query?**
✅ **DECISION: Denormalize critical fields in messages doc** (HIGH confidence)

Rationale:
- Avoids N+1 query problem (50 messages = 50 conversation reads)
- Performance: 1 second vs 3-5 seconds
- Acceptable size increase (~400 bytes vs 100 bytes)

Fields to Denormalize:
```typescript
interface MessageMetadata {
  // Existing
  isAIDraft?: boolean;
  confidence?: number;

  // NEW: Denormalized from conversation
  conversationMessageCount?: number;
  conversationLastCreatorReply?: Timestamp;
  conversationIsVIP?: boolean;

  // NEW: Pre-calculated
  relationshipScore?: number;
  relationshipContext?: {
    conversationAge: number;
    lastInteraction: Timestamp;
    isVIP: boolean;
  };

  // NEW: Draft tracking
  wasEdited?: boolean;
  editCount?: number;
  timeToEdit?: number;

  // NEW: Boundary tracking
  isAutoBoundary?: boolean;
  boundaryReason?: string;
  originalMessageId?: string;
}
```

### 3.3 Database Schema Changes

**Collection: `daily_digests` (MODIFIED)**

```typescript
interface DailyDigest {
  id: string;
  userId: string;
  executionDate: Timestamp;

  // NEW: Meaningful 10 structure
  meaningful10: {
    highPriority: DigestMessage[];      // Top 3
    mediumPriority: DigestMessage[];    // Next 2-7
    autoHandled: {
      faqCount: number;
      archivedCount: number;
      boundaryMessageSent: boolean;
    };
    capacityUsed: number;
    estimatedTimeCommitment: number;    // Minutes
  };

  // NEW: Engagement snapshot
  engagementMetrics: {
    personalResponseRate: number;
    qualityScore: number;
    burnoutRisk: string;
  };

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Collection: `engagement_metrics` (NEW)**

```typescript
interface EngagementMetrics {
  id: string;
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Timestamp;
  endDate: Timestamp;

  metrics: {
    qualityScore: number;
    personalResponseRate: number;
    avgResponseTime: number;
    conversationDepth: number;
    capacityUsage: number;
    burnoutRisk: 'low' | 'medium' | 'high';
  };

  createdAt: Timestamp;
}
```

**Collection: `user_settings` (MODIFIED - ADD capacity field)**

```typescript
interface UserSettings {
  // ... existing fields ...

  // NEW: Capacity settings
  capacity?: {
    dailyLimit: number;              // 5-20 messages
    boundaryMessage: string;         // Customizable template
    autoArchiveEnabled: boolean;
    requireEditingForBusiness: boolean;
  };
}
```

**Firestore Indexes (NEW):**

```json
{
  "indexes": [
    {
      "collectionGroup": "engagement_metrics",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "startDate", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "messages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "metadata.relationshipScore", "order": "DESCENDING" },
        { "fieldPath": "timestamp", "order": "DESCENDING" }
      ]
    }
  ]
}
```

### 3.4 Code Modifications (Summary)

**Files to Modify (8 files):**
1. `services/dailyDigestService.ts` - New schema, scoring integration
2. `services/voiceMatchingService.ts` - Draft-first mode
3. `services/bulkOperationsService.ts` - Remove approve all, add auto-archive
4. `functions/src/ai/daily-agent-workflow.ts` - Add scoring step
5. `app/(tabs)/daily-digest.tsx` - Priority tiers UI
6. `app/(tabs)/conversations/[id].tsx` - Draft-first response card
7. `types/ai.ts` - New interfaces
8. `types/user.ts` - Capacity settings

**Files to Create (3 new files):**
1. `services/relationshipScoringService.ts` - NEW
2. `services/engagementMetricsService.ts` - NEW
3. `app/(tabs)/profile/engagement-health.tsx` - NEW

**Estimated Development Effort:** 8 weeks total (1 week shadow mode + 6 weeks dev + 1 week rollout) - validated by Architect

### 3.5 Performance Validation (ARCHITECT CONFIRMED)

| Operation | Target | Architect Estimate | Status |
|-----------|--------|-------------------|--------|
| Daily digest generation | < 5 sec | 3-7 sec | ✅ ACHIEVABLE |
| Relationship scoring | < 2 sec | 1-3 sec | ✅ ACHIEVABLE |
| Engagement health (cached) | < 1 sec | 0.1-0.5 sec | ✅ EXCEEDED |
| UI load time | < 500ms | 200-400ms | ✅ EXCEEDED |

**Optimization Strategies:**
- ✅ Batch Firestore reads (1 batch vs 50 individual)
- ✅ Denormalize metadata (avoid N+1 queries)
- ✅ Pre-calculate scores (daily workflow, not on-demand)
- ✅ Cache engagement metrics (daily, not real-time)

---

## 4. Implementation Plan

### 4.1 Week 0: Shadow Mode & Setup (NEW - ARCHITECT RECOMMENDATION)

**Purpose:** Validate scoring algorithm before exposing to users

**Tasks:**

**Shadow Mode Deployment:**
1. Deploy relationship scoring in logging-only mode
2. Run new scoring alongside production (doesn't affect users)
3. Log comparison: old digest vs new digest
4. Manual spot-checks: 80%+ accuracy target
5. Tune scoring weights via remote config

**Infrastructure Setup:**
1. Deploy Firestore indexes (before any code)
2. Set up granular feature flags (per-feature toggles)
3. Configure remote config for scoring weights
4. Set up observability (Datadog/CloudWatch alerts)

**Deliverables:**
- ✅ Shadow mode runs 1 week without errors
- ✅ Scoring latency < 3 seconds validated
- ✅ Manual validation: 80%+ accuracy on spot-checks
- ✅ Performance benchmarks established

**Success Criteria:**
- No errors in shadow mode for 1 week
- Scoring algorithm matches PM expectations (manual review of 50 samples)
- Performance within budget (< 3 seconds for 50 messages)

---

### 4.2 Phase 1: MVP (Weeks 1-2) - P0 Features

**Goal:** Ship critical authenticity fixes and core curation UX

#### **Week 1: Backend Foundation**

**Tasks:**

1. **Create `relationshipScoringService.ts`** (NEW - 2-3 days)
   - Scoring algorithm with observability
   - Score breakdown logging (for debugging)
   - Unit tests (15 tests)
   - Integration with existing categorization

2. **Modify `dailyDigestService.ts`** (MODIFY - 2-3 days)
   - Update `getMeaningful10Digest()` function
   - New schema support (meaningful10 structure)
   - Capacity-based selection
   - Unit tests (20 tests)

3. **Modify `daily-agent-workflow.ts`** (MODIFY - 2-3 days)
   - Add relationship scoring step
   - Add capacity-based selection
   - Store scores in message metadata (denormalization)
   - Integration tests (10 tests)

4. **Deploy Firestore indexes** (1 day)
   - engagement_metrics index
   - messages.metadata.relationshipScore index
   - Test query performance

**Deliverables:**
- ✅ Relationship scoring working (< 2 seconds for 50 messages)
- ✅ Meaningful 10 digest generation working
- ✅ All tests passing (45 total)
- ✅ Feature flags deployed (OFF by default)

**Success Criteria:**
- Backend generates Meaningful 10 digest successfully
- Relationship scoring accurate (manual validation of 100 samples)
- Zero errors in staging environment
- Performance within budget

#### **Week 2: Frontend MVP**

**Tasks:**

1. **CRITICAL: Remove "Approve All" / "Reject All"** (PRIORITY 1 - 0.5 days)
   - Delete from `daily-digest.tsx`
   - Delete from `bulkOperationsService.ts`
   - Update tests

2. **Redesign `app/(tabs)/daily-digest.tsx`** (3-4 days)
   - Priority tier sections (High/Medium/Auto-handled)
   - Relationship context display
   - Time estimates
   - Capacity indicator
   - Collapsible archive section
   - Visual distinction (icons, colors, badges)

3. **Create `ResponseDraftCard.tsx`** (2-3 days)
   - Draft-first editing interface
   - Personalization hints
   - RequiresEditing enforcement
   - Low-confidence draft warnings
   - Draft history / multiple generation

4. **Modify conversation screen** (1-2 days)
   - Integrate ResponseDraftCard
   - Remove approval buttons
   - Edit tracking (wasEdited, editCount, timeToEdit)

5. **Create `capacity-settings.tsx` (SIMPLE VERSION)** (1-2 days)
   - Capacity slider (5-20 range)
   - Suggested capacity display
   - Time commitment estimate
   - Save to Firestore

**Deliverables:**
- ✅ "Approve All" deleted from codebase
- ✅ Meaningful 10 UI live
- ✅ Draft-first response interface live
- ✅ Basic capacity settings live
- ✅ Component tests passing (30 tests)

**Success Criteria:**
- No way to bulk-approve messages (UX verification)
- Users can only send after reviewing/editing drafts
- UI shows priority tiers correctly
- Capacity slider works and persists

**Rollout Strategy:**
- Deploy to staging (full team testing)
- Enable for internal team (dogfooding - 3 days)
- Rollout to 5% of users (canary - 3 days)
- Monitor metrics, then 25% → 50% → 100% (3 days each)

**Rollback Plan:**
- Feature flags allow instant rollback
- Old schema still available (dual-write)
- Can revert to old UI in < 1 hour

---

### 4.3 Phase 2: Capacity Management (Weeks 3-4) - P1 Features

**Goal:** Add sustainable capacity features and boundary-setting

#### **Week 3: Capacity Settings + Auto-Archive**

**Tasks:**

1. **Enhance `capacity-settings.tsx`** (2-3 days)
   - Boundary message template editor
   - Advanced toggles (autoArchive, requireEditingForBusiness)
   - Weekly capacity report toggle
   - Component tests (15 tests)

2. **Modify `bulkOperationsService.ts`** (2-3 days)
   - Add `autoArchiveWithKindBoundary()` function
   - Boundary message templates
   - Rate limiting (max 1/fan/week)
   - Unit tests (10 tests)

3. **Update `daily-agent-workflow.ts`** (2 days)
   - Auto-archive low-priority messages
   - Send boundary messages (batched daily)
   - Respect capacity limits
   - Track boundary message analytics

4. **Add `user_settings.capacity` schema** (1 day)
   - Firestore writes
   - Default values
   - Validation rules

**Deliverables:**
- ✅ Full capacity settings screen live
- ✅ Auto-archive with boundary messages working
- ✅ User settings persisted to Firestore

**Success Criteria:**
- Users can customize boundary message
- Low-priority messages auto-archived correctly
- Fans receive boundary message (not ghosted)
- Rate limiting prevents spam

#### **Week 4: Engagement Tracking**

**Tasks:**

1. **Create `engagementMetricsService.ts`** (3-4 days)
   - Health score calculation
   - Personal response rate tracking
   - Burnout risk assessment
   - Conversation depth calculation
   - Unit tests (20 tests)

2. **Modify message metadata tracking** (1-2 days)
   - Add `wasEdited`, `editCount`, `timeToEdit` fields
   - Track boundary messages
   - Log edit events from ResponseDraftCard

3. **Create `engagement_metrics` collection** (1-2 days)
   - Daily/weekly/monthly aggregation
   - Cloud Function for daily calculation
   - Firestore writes and queries

**Deliverables:**
- ✅ Edit tracking working
- ✅ Engagement metrics calculated daily
- ✅ Data stored in Firestore

**Success Criteria:**
- Personal response rate calculated correctly (matches manual count)
- Edit events tracked accurately
- Burnout risk assessment matches expected behavior

---

### 4.4 Phase 3: Engagement Health Dashboard (Weeks 5-6) - P2 Features

**Goal:** Provide long-term engagement insights and health monitoring

#### **Week 5: Dashboard Backend**

**Tasks:**

1. **Complete `engagementMetricsService.ts`** (2-3 days)
   - Average response time tracking
   - Capacity usage trending
   - Week-over-week comparisons

2. **Create Cloud Function for metrics aggregation** (2-3 days)
   - Daily scheduled job
   - Weekly/monthly rollups
   - Historical data queries
   - Performance optimization

**Deliverables:**
- ✅ All engagement metrics calculated
- ✅ Historical data available
- ✅ Aggregation working

#### **Week 6: Dashboard Frontend**

**Tasks:**

1. **Create `engagement-health.tsx`** (4-5 days)
   - Overall health score display
   - Metric cards (personal rate, response time, depth)
   - Capacity usage indicators
   - Burnout risk warnings
   - Trend visualizations (30-day charts)

2. **Reuse components from Story 5.7 dashboard** (integrated above)
   - DashboardWidget
   - ProgressIndicator
   - Chart components

3. **Component tests** (1 day)
   - Metric calculation tests
   - UI rendering tests
   - Empty states
   - 25 tests total

**Deliverables:**
- ✅ Engagement health dashboard live
- ✅ All metrics displayed correctly
- ✅ Warnings for unhealthy patterns

**Success Criteria:**
- Dashboard loads < 1 second
- Metrics accurate vs manual calculation
- Recommendations actionable
- Burnout warnings trigger for high-risk users

---

## 5. Change Management

### 5.1 In-App Announcement (COPY FINALIZED)

**Modal on First Login After Update:**

```
┌─────────────────────────────────────┐
│  We've Upgraded Your Daily Digest 🎉│
│                                     │
│  Your inbox is now organized by     │
│  priority instead of one big        │
│  pending list.                      │
│                                     │
│  What's changed:                    │
│  ✅ Focus on top 10 most important  │
│     messages                        │
│  ✅ AI drafts always editable       │
│     (no more blind approval)        │
│  ✅ Set your daily capacity         │
│     (default: 10 messages)          │
│                                     │
│  [Take a Tour] [Got It]             │
└─────────────────────────────────────┘
```

**Optional 3-Step Tour:**

**Step 1: Priority Tiers**
```
[Spotlight on High Priority section]

Your most important messages appear here.

We use AI to detect:
• Business opportunities
• Urgent requests
• VIP fans (long-time supporters)

You can adjust capacity in settings.

[Next]
```

**Step 2: Draft-First Responses**
```
[Spotlight on ResponseDraftCard]

AI drafts are always editable now.

Add your personal touch before sending:
• Specific details about their message
• Callbacks to previous conversations
• Questions to continue dialogue

[Next]
```

**Step 3: Daily Capacity**
```
[Spotlight on capacity indicator]

Set your sustainable daily limit.

Most creators choose 8-12 messages/day
for quality over quantity.

[Go to Settings] [Finish Tour]
```

### 5.2 Communication Plan

**Week Before Launch:**
- Blog post: "Why We're Building Anti-Automation Features"
- Email to all creators: Heads-up about upcoming changes
- FAQ article published
- Video walkthrough (2 min)

**Launch Day:**
- In-app modal (above)
- Push notification: "Your Daily Digest just got smarter 🎉"
- Social media announcement
- Support team briefing

**Week After Launch:**
- Check-in email: "How's the new digest working for you?"
- Feedback survey (10 questions)
- Monitor support tickets
- Monitor analytics and user behavior

### 5.3 Help & Support Materials

**FAQ Article: "Understanding the New Daily Digest"**

Topics:
- What changed and why?
- How does priority ranking work?
- Can I adjust my daily capacity?
- What happens to archived messages?
- How do I customize the boundary message?
- Can I override "requires editing"?
- What is the engagement health score?

**Video Walkthrough (2 minutes):**
- 0:00-0:30 - Overview of changes
- 0:30-1:00 - Priority tiers explained
- 1:00-1:30 - Draft-first responses demo
- 1:30-2:00 - Capacity settings tour

**Support Team Scripts:**
- "Why can't I approve all messages anymore?"
- "How do I change my daily capacity?"
- "A fan complained about the boundary message"
- "The priority ranking seems wrong"

---

## 6. Success Metrics & Monitoring

### 6.1 Product Metrics (Primary)

**Engagement Quality:**
- Personal response rate: Target **80%+** (vs < 50% with Approve All)
- Average response time: Target **< 24 hours**
- Conversation depth: Target **40%+** multi-turn conversations
- Creator satisfaction: Target **4.5/5.0** (vs 3.8 current)

**Capacity Management:**
- Daily capacity usage: Target **70-90%** (not 100% burnout)
- Burnout risk distribution: Target **70% low, 25% medium, 5% high**
- Boundary message effectiveness: Target **< 10%** negative fan responses

**Behavioral Change:**
- % creators using draft editing: Target **85%+**
- % creators customizing boundary message: Target **60%+**
- % creators checking engagement health weekly: Target **40%+**

### 6.2 Technical Metrics

**Performance:**
- Daily digest generation time: Target **< 5 seconds** (Architect: 3-7 sec achievable)
- Relationship scoring latency: Target **< 2 seconds** for 50 messages
- Engagement health calculation: Target **< 1 second** (Architect: 0.1-0.5 sec)
- UI load time: Target **< 500ms** (Architect: 200-400ms achievable)

**Cost:**
- AI API costs: Target **30% reduction** (fewer generated messages)
- Firestore reads: Target **< 100 additional reads/user/day**
- Cloud Function execution time: Target **< 10 seconds** total

**Reliability:**
- Error rate: Target **< 0.1%**
- Feature flag rollback events: Target **0**
- User-reported bugs: Target **< 5 P0 bugs** in first month

### 6.3 Business Metrics

**Creator Retention:**
- 30-day retention: Target **+10%** vs current
- Churn rate: Target **-15%** vs current
- NPS score: Target **+20 points**

**Differentiation:**
- "Anti-automation" messaging resonance: Target **70%** positive sentiment
- Competitor comparison: Target "better boundaries" positioning
- Press coverage: Target **3+ articles** on unique approach

### 6.4 Analytics Tracking Plan

**Week 1-2 (Phase 1):**
- Track adoption of new digest UI (% viewing)
- Track edit rate (% drafts edited before sending)
- Monitor error logs and performance
- **Target:** Edit rate > 75%, Error rate < 0.1%

**Week 3-4 (Phase 2):**
- Track capacity settings distribution (avg daily limit)
- Track auto-archive usage (% low-priority archived)
- Survey creator satisfaction (online feedback form)
- **Target:** 60% customize boundary, 80% satisfaction

**Week 5-6 (Phase 3):**
- Track engagement health scores (distribution)
- Track dashboard usage (% weekly active)
- Measure retention impact (cohort analysis)
- **Target:** 70% "low" burnout risk

**Month 2-3:**
- A/B test messaging ("curation" vs "automation")
- Long-term engagement quality trends
- Creator testimonials and case studies

### 6.5 Monitoring & Alerting

**Critical Alerts (Pagerduty):**
- Daily digest failure rate > 1%
- Relationship scoring latency > 5 seconds
- Error rate > 0.5%
- Feature flag rollback triggered

**Warning Alerts (Email):**
- Edit rate drops below 60%
- Personal response rate drops below 70%
- Boundary message negative sentiment > 20%
- Performance degradation (digest > 7 seconds)

**Dashboard (Datadog):**
- Real-time edit rate tracking
- Relationship scoring performance (P50, P95, P99)
- Capacity usage distribution
- Burnout risk distribution
- Daily digest generation timeline

---

## 7. Risk Management

### 7.1 Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation |
|------|-----------|--------|----------|------------|
| Relationship scoring inaccuracy | Medium | High | 🔴 HIGH | A/B testing, manual override, feedback loops |
| Performance degradation | Medium | Medium | 🟡 MEDIUM | Batch reads, denormalization, caching |
| Fan pushback on boundaries | Low-Medium | Medium | 🟡 MEDIUM | A/B test messaging, escalation path |
| Firestore cost increase | Low | Low | 🟢 LOW | Validated (+$0.10/user/month) |
| Creator resistance to limits | Low-Medium | Medium | 🟡 MEDIUM | Configurable capacity, education |

### 7.2 Mitigation Strategies (DETAILED)

**🔴 HIGH RISK: Relationship Scoring Accuracy**

**Problem:** Algorithm prioritizes wrong messages → creators miss important DMs

**Mitigation:**

1. **A/B Test Scoring Weights (Remote Config)**
```typescript
// Remote config allows live tuning without redeploy
const SCORING_WEIGHTS = await getRemoteConfig('scoring_weights') || {
  business_opportunity: 50,
  urgent: 40,
  crisis_sentiment: 100,
  vip_relationship: 30,
  message_count_bonus: 30,
  recent_interaction: 15
};
```

2. **Manual Override UI**
```tsx
<MessageCard>
  <Badge>{message.priority}</Badge>
  <Menu>
    <MenuItem onPress={() => changePriority(message, 'high')}>
      Move to High Priority
    </MenuItem>
  </Menu>
</MessageCard>
```

3. **Feedback Loop (Learn from Behavior)**
- Track which messages creators respond to first
- Learn: "Creator always responds to @username first" → boost score
- Adjust scores over time based on behavior

4. **Observability (Score Breakdown Logging)**
```typescript
logger.info('Relationship score calculated', {
  messageId: message.id,
  scoreBreakdown: {
    category: 50,      // Business opportunity
    sentiment: 5,      // Neutral
    opportunity: 20,   // High opportunity score
    relationship: 15,  // 3 messages in conversation
    total: 90          // High priority
  }
});
```

5. **Shadow Mode Validation (Week 0)**
- Run scoring for 1 week without affecting users
- Manual spot-checks: 80%+ accuracy target
- Compare old digest vs new digest

**🟡 MEDIUM RISK: Performance Degradation**

**Problem:** Relationship scoring adds 2-3 seconds to daily workflow

**Current Budget:**
- Timeout: 540 seconds (from codebase)
- Current digest: ~5-10 seconds
- New scoring: +2-3 seconds
- **Total: 7-13 seconds** ✅ Well within budget

**Mitigation:**

1. **Batch Firestore Reads**
```typescript
// BAD: 50 individual reads (3-5 seconds)
const scores = await Promise.all(
  messages.map(async msg => {
    const conv = await getConversation(msg.conversationId);
    return calculateScore(msg, conv);
  })
);

// GOOD: 1 batch read (< 1 second)
const conversationIds = [...new Set(messages.map(m => m.conversationId))];
const conversations = await batchGetConversations(conversationIds);

const scores = messages.map(msg => {
  const conv = conversations.get(msg.conversationId);
  return calculateScore(msg, conv);
});
```

2. **Denormalize Metadata (Q4 Decision)**
- Store conversation data in message metadata
- Avoid N+1 queries
- Trade-off: 4x metadata size (acceptable)

3. **Pre-calculate Scores (Q1 Decision)**
- Calculate during daily workflow
- Store in message metadata
- Fast retrieval (no recalculation)

**🟡 MEDIUM RISK: Fan Pushback on Boundary Messages**

**Problem:** Fans upset by auto-archive → negative PR

**Mitigation:**

1. **A/B Test Message Wording**
```
Option A (Honest): "I get hundreds of DMs daily..."
Option B (Grateful): "Thank you for reaching out! I read every message but..."
Option C (Helpful): "For quick help, check my FAQ..."
```

2. **Measure Fan Sentiment**
```typescript
interface BoundaryMessageAnalytics {
  sent: number;
  repliesAfter: number;           // How many fans replied again
  negativeReplies: number;        // Sentiment analysis
  escalationRequests: number;     // "This is urgent!"
  conversionToFAQ: number;        // Clicked FAQ link
}
```

3. **Escalation Path (PM Decision)**
- Fans can reply to boundary message
- Reply → Medium Priority next day
- Reply again → High Priority (persistence signals importance)
- No explicit "mark as urgent" button (prevents abuse)

4. **Rate Limiting (AC11)**
- Max 1 boundary message per fan per week
- Prevents spam perception

### 7.3 Rollback Procedures

**Immediate Rollback (< 1 hour):**
1. Disable feature flags (revert to old digest format)
2. Frontend automatically falls back to old UI
3. Backend continues dual-write (old schema still available)

**Partial Rollback:**
- Can disable specific features individually via granular flags:
  - `relationship_scoring`: Disable scoring, use flat list
  - `auto_archive_low_priority`: Disable auto-archive
  - `draft_first_response`: Revert to approval buttons
  - `engagement_health_metrics`: Disable dashboard

**Data Safety:**
- No destructive migrations (all changes additive)
- Old data remains accessible
- New data backward-compatible
- Dual-write ensures data consistency

---

## 8. Handoff Checklist

### 8.1 Pre-Handoff Validation

**Document Completeness:**
- ✅ All product questions answered by PM
- ✅ All technical questions answered by Architect
- ✅ Cross-functional alignment confirmed (no conflicts)
- ✅ Implementation phases finalized
- ✅ Change management materials prepared
- ✅ Success metrics defined
- ✅ Product Owner final approval (ALL DECISIONS FINALIZED)

**Reviewer Sign-Off:**
- ✅ PM (John): APPROVED (8.5/10 confidence)
- ✅ Architect (Winston): APPROVED (85% confidence)
- ✅ Product Owner: APPROVED (All 5 questions answered)

### 8.2 Handoff to Scrum Master (Bob)

**What to Provide:**
1. ✅ This final document (`epic-5-repurposing-plan-FINAL.md`)
2. ✅ All acceptance criteria (finalized and numbered)
3. ✅ Technical approach (infrastructure reuse, code changes)
4. ✅ Implementation timeline (Week 0 through Week 6)
5. ✅ Success criteria for each phase

**SM Tasks:**
1. Create Epic 6: "Epic 5 Repurposing - Authentic Engagement"
2. Create Stories from features:
   - Story 6.1: Meaningful 10 Daily Digest (Phase 1)
   - Story 6.2: Draft-First Response Interface (Phase 1)
   - Story 6.3: Basic Capacity Settings (Phase 1)
   - Story 6.4: Kind Boundary Auto-Archive (Phase 2)
   - Story 6.5: Advanced Capacity Configuration (Phase 2)
   - Story 6.6: Engagement Health Dashboard (Phase 3)
3. Break down into tasks/subtasks
4. Estimate story points
5. Sequence for sprints

**Command to Transform into SM:**
```
/BMad:agents:sm
```

### 8.3 Handoff to Developer (James)

**What Dev Needs:**
1. ✅ This document with technical specs
2. ✅ Stories from SM (with acceptance criteria)
3. ✅ Code examples (included in Section 3)
4. ✅ Database schema changes (Section 3.3)
5. ✅ Performance targets (Section 3.5)

**Dev Responsibilities:**
1. Set up shadow mode (Week 0)
2. Implement Phase 1 features (Weeks 1-2)
3. Implement Phase 2 features (Weeks 3-4)
4. Implement Phase 3 features (Weeks 5-6)
5. Write tests (unit + integration)
6. Deploy with feature flags
7. Monitor rollout

**Command to Transform into Dev:**
```
/BMad:agents:dev
```

### 8.4 Open Questions for Product Owner ✅ ALL ANSWERED

**From PM (John):**

1. **In-app announcement copy**
   - ✅ **DECISION: APPROVED AS-IS** (Section 5.1)
   - No changes needed to drafted copy

2. **Creator interviews**
   - ✅ **DECISION: NO - Skip creator interviews**
   - Rationale: Not needed at this stage, save $2-3k
   - Will rely on analytics and feedback surveys instead

3. **Metrics prioritization**
   - ✅ **DECISION: APPROVED current metrics**
   - Focus on: Edit rate, capacity usage, auto-archive rate, relationship scoring accuracy
   - These metrics cover the critical success indicators

**From Architect (Winston):**

4. **Shadow mode timeline**
   - ✅ **DECISION: 1 week (extended from 3-5 days)**
   - Rationale: Extra safety margin for validation
   - Manual spot-checks throughout the week

5. **Rollout aggressiveness**
   - ✅ **DECISION: CONFIRMED - Conservative 2-week rollout**
   - Timeline: 5% → 25% → 50% → 100% with 3-day pauses
   - Gradual rollout provides safety and monitoring time

### 8.5 Final Approval Needed

**Product Owner Sign-Off Required For:**
- ✅ Overall strategic direction (automation → curation)
- ✅ Feature prioritization (P0/P1/P2)
- ✅ Timeline (8 weeks total: 1 week shadow + 6 weeks dev + 1 week rollout)
- ✅ Budget ($0.10/user/month cost increase - no interviews)
- ✅ Rollout strategy (conservative 2-week rollout)
- ✅ Change management approach (in-app announcement, tour)

**✅ APPROVED - Ready for Handoff:**
- Hand document to SM (Bob) for story creation
- SM creates epic + stories → Dev (James) implements
- Begin Week 0 (shadow mode - 1 week) immediately

---

## Appendix A: PM Review Summary

**Reviewer:** John (Product Manager)
**Date:** 2025-10-26
**Overall Assessment:** ✅ APPROVED FOR DEVELOPMENT
**Confidence:** 8.5/10

**Key Validations:**
- Strategic shift is exactly right (automation → curation)
- Features solve real creator pain (authenticity + capacity)
- Differentiation angle ("anti-automation") resonates
- Execution plan is realistic

**Product Decisions Made:**
- Capacity: Configurable 5-20 (not fixed at 10)
- Archived messages: Show in collapsible section
- Ignored high-priority: Gentle persistence with escalation
- Override "requires editing": Yes, with friction + tracking
- Save draft edits: Yes, auto-save to Firestore
- Low-confidence drafts: Transparent warning + retry option
- Boundary messages: Batched daily (not immediate)
- Fan escalation: Passive only (reply to re-prioritize)
- Auto-archive reply: Un-archive and re-prioritize
- Capacity auto-adjust: No, but suggest adjustments
- Suggest capacity: Yes (18% of avg daily volume)
- Default capacity: 10 (brand-aligned)
- Burnout notifications: High risk only
- Health thresholds: Defined (e.g., 80%+ personal response rate)
- Relationship NPS: Phase 4 (defer)

**Additional Recommendations:**
- Add basic capacity slider to Phase 1 (not Phase 2)
- Create in-app announcement modal
- A/B test boundary message wording
- Track analytics religiously (edit rate, capacity usage)
- Conservative rollout (5% → 25% → 50% → 100% over 2 weeks)

**Risks Identified:**
- Relationship scoring accuracy (mitigated by iteration)
- Creator resistance to capacity limits (mitigated by configurability)
- Change management for power users (mitigated by communication)

**Expected Outcomes:**
- +10% creator retention (Q4 2025)
- 80%+ personal response rate (vs < 50% current)
- "Anti-automation" positioning resonates

---

## Appendix B: Architect Review Summary

**Reviewer:** Winston (Architect)
**Date:** 2025-10-26
**Overall Assessment:** ✅ APPROVED FOR IMPLEMENTATION
**Confidence:** 85%

**Key Validations:**
- Infrastructure reuse: 80%+ validated (accurate estimate)
- Schema changes: Safe & additive (backward compatible)
- Migration strategy: Robust zero-downtime approach
- Performance targets: All achievable with optimizations

**Technical Decisions Made:**
- Relationship scoring: Pre-calculate during daily workflow
- Engagement metrics: Pre-calculate daily + manual refresh
- Migration strategy: Dual-write for 2 weeks + feature flags
- Conversation metadata: Denormalize critical fields

**Performance Validation:**
- Daily digest: 3-7 seconds (target < 5 sec) ✅
- Relationship scoring: 1-3 seconds (target < 2 sec) ✅
- Engagement health: 0.1-0.5 seconds (target < 1 sec) ✅ EXCEEDED
- UI load time: 200-400ms (target < 500ms) ✅ EXCEEDED

**Additional Recommendations:**
- Shadow mode (Week 0): Run 3-5 days before rollout
- Granular feature flags: Per-feature toggles for safety
- Observability: Score breakdown logging for debugging
- Remote config: Live tuning of scoring weights
- Batch reads: Avoid N+1 query problem
- Denormalization: Critical metadata in messages doc

**Risks Identified:**
- 🔴 Relationship scoring accuracy (HIGH - needs iteration)
- 🟡 Performance degradation (MEDIUM - mitigated by optimizations)
- 🟡 Fan pushback on boundaries (MEDIUM - A/B test messaging)
- 🟢 Firestore cost increase (LOW - +$0.10/user/month acceptable)

**Technical Landmines to Avoid:**
- ❌ Don't query conversations on-demand (use denormalization)
- ❌ Don't calculate engagement metrics real-time (use caching)
- ❌ Don't hard-cutover schema (use dual-write)
- ❌ Don't ignore scoring accuracy (add observability)
- ❌ Don't skip shadow mode (validate first)

**Confidence Levels:**
- Infrastructure reuse: 95% (verified in codebase)
- Migration safety: 90% (dual-write + feature flags)
- Performance targets: 85% (achievable with optimizations)
- Scoring accuracy: 70% (needs iteration, feedback loops)
- **Overall success: 85%** (strong recommendation to proceed)

---

**END OF DOCUMENT**

**Next Steps:**
1. Product Owner reviews and approves this final document
2. Hand to SM (Bob) for epic + story creation
3. Hand to Dev (James) for implementation (begin Week 0 shadow mode)

**Document Location:** `/Users/zeno/Projects/yipyap/docs/epic-5-repurposing-plan-FINAL.md`
