# Epic 6: Epic 5 Repurposing - Authentic Engagement

**Epic Goal**: Repurpose Epic 5's AI infrastructure from automation to curation. Shift from bulk message approval to intelligent prioritization that helps creators focus on their most meaningful connections within sustainable capacity limits - increasing creator retention by 10% while achieving 80%+ personal response rate.

**Strategic Shift**:

- **FROM**: "AI automates your DM responses. Approve 50 messages with one tap!"
- **TO**: "AI curates your top 10 most meaningful messages. Focus on authentic connection within sustainable capacity."

**Business Value**:

- +10% creator retention (less burnout)
- 80%+ personal response rate (vs <50% with bulk approve)
- Differentiated positioning ("anti-automation")
- 30% reduction in AI costs

**Integration Requirements**:

- Reuse 90% of Epic 5 backend infrastructure (categorization, voice matching, daily agent)
- Reuse 75% of Epic 5 frontend components
- Zero-downtime migration using dual-write strategy and feature flags
- Maintain full backward compatibility during 2-week rollout

**Timeline**:

- **Original Plan**: 8 weeks total (1 week shadow mode + 6 weeks dev + 1 week rollout)
- **Actual Implementation**: Accelerated delivery
  - **Story 6.1** (Meaningful 10 Daily Digest): ✅ COMPLETED (2025-10-26)
    - 10 days accelerated (5 days backend + 5 days frontend)
    - Shadow mode validation SKIPPED by user decision
    - Backend deployed to production (100% users)
    - Feature flag: `meaningful10.enabled = true`
  - **Story 6.2** (Draft-First Response Interface): ✅ COMPLETED (2025-10-26)
    - 1 day full implementation (all 7 tasks)
    - 69 unit tests passing (100% coverage)
    - iOS-native UX with smooth modal animations
  - **Story 6.3** (Basic Capacity Settings): 📋 READY (next in queue)
  - Stories 6.4-6.6: Pending

---

## Story 6.1: Meaningful 10 Daily Digest

**As a** creator,
**I want** to see my top 10 most important messages each day (ranked by priority),
**so that** I can focus my limited time on meaningful connections instead of feeling overwhelmed by volume.

**Acceptance Criteria:**

1. Messages grouped into 3 tiers (High/Medium/Auto-handled)
2. High priority limited to top 3 most important (based on scoring)
3. Medium priority shows next 2-7 messages (up to capacity limit)
4. Auto-handled section shows FAQ count + archived count
5. Time estimates displayed for each message (±30 seconds accuracy)
6. Relationship context shown (conversation history, message count, recency)
7. No "Approve All" or "Reject All" buttons present
8. Capacity usage displayed (X/Y messages handled today)
9. Refresh updates digest in real-time
10. Empty state when no pending messages
11. Empty state guidance when capacity < messages received ("Only 7 messages today - adjust capacity if too quiet")
12. Visual distinction between priority tiers (icons, colors, accessible labels)

**Priority**: P0 (Phase 1 - Weeks 1-2)

**Infrastructure Reuse**: 85%

**Integration Verification:**

- IV1: Existing Firebase message schema supports new metadata fields
- IV2: Relationship scoring completes in < 2 seconds for 50 messages
- IV3: Daily digest generation completes in < 5 seconds
- IV4: UI loads in < 500ms with all priority tiers
- IV5: Real-time message updates don't interfere with digest display

---

## Story 6.2: Draft-First Response Interface ✅

**Status**: COMPLETED (2025-10-26)

**As a** creator,
**I want** AI-generated responses to open in edit mode (not approval mode),
**so that** I can personalize every message before sending and maintain authenticity.

**Acceptance Criteria:** (12/12 ✅)

1. ✅ Draft text always displayed in editable TextInput (not read-only)
2. ✅ Send button disabled until user has edited text OR explicitly marked as reviewed
3. ✅ Personalization suggestions displayed below draft (3 specific prompts)
4. ✅ Time saved metric shown (calculated from message length)
5. ✅ "Requires editing" flag blocks send for high-priority/business messages
6. ✅ Discard draft option available without sending
7. ✅ Draft edits tracked in analytics (edit rate metric)
8. ✅ Multiple drafts can be generated (refresh button)
9. ✅ Draft quality score shown (confidence 0-100)
10. ✅ Character count and message length validation
11. ✅ Undo/revert to original draft if creator overwrites poorly
12. ✅ Draft history (creator can switch between multiple draft versions via horizontal carousel)

**Priority**: P0 (Phase 1 - Weeks 1-2)

**Infrastructure Reuse**: 90%

**Test Coverage**: 69/69 tests passing (100%)
- 15 tests: voiceMatchingService (draft generation, confidence, regeneration)
- 15 tests: draftManagementService (auto-save, restoration, history)
- 9 tests: draftAnalyticsService (edit tracking, override metrics)
- 30 tests: ResponseDraftCard component (UI, editing, history, sending)

**Integration Verification:**

- ✅ IV1: Voice matching service from Story 5.5 works with new draft-first UI
- ✅ IV2: Draft generation doesn't block manual typing
- ✅ IV3: Auto-save to Firestore works without conflicts (5-second debounce)
- ✅ IV4: Low-confidence drafts (<70%) show warnings correctly
- ✅ IV5: Override workflow for "requires editing" tracks metrics

**Bonus Features Delivered:**
- iOS-native modal presentation with `presentationStyle="pageSheet"` for smooth animations
- Smart ActionSheetIOS for small option sets (≤4 items)
- Draft history carousel with version switching
- Keyboard-aware modal with proper mobile UX

---

## Story 6.3: Basic Capacity Settings

**As a** creator,
**I want** to set my daily response capacity (5-20 messages),
**so that** the system respects my realistic limits and helps me avoid burnout.

**Acceptance Criteria:**

1. Capacity slider range: 5-20 messages/day
2. Default capacity: 10 messages/day
3. Suggested capacity calculated: Math.round(avgDailyMessages \* 0.18)
4. Time commitment estimate shown (avg 2 min/message)
5. Settings saved to Firestore immediately
6. Validation prevents capacity < 5 (too restrictive)
7. Help text explains impact of capacity setting
8. Preview shows distribution (X deep, Y FAQ, Z archived)

**Priority**: P0 (Phase 1 - Weeks 1-2)

**Infrastructure Reuse**: 80%

**Integration Verification:**

- IV1: Capacity setting persists across sessions
- IV2: Daily digest respects capacity limit immediately after change
- IV3: Suggested capacity calculation uses accurate historical data
- IV4: Time estimates match actual creator behavior (±2 minutes)

---

## Story 6.4: Kind Boundary Auto-Archive

**As a** creator,
**I want** low-priority messages automatically archived with a kind explanation (not ignored),
**so that** fans understand my capacity limits without feeling rejected.

**Acceptance Criteria:**

1. Boundary message template customizable in settings
2. Auto-archive applies only to low-priority general messages (not business/urgent/VIP)
3. Boundary message includes FAQ link and community link (if configured)
4. Message clearly labeled as automated in metadata
5. Archived conversations moved to separate folder (not deleted)
6. Creator can view archived messages and manually respond later
7. Boundary message respects quiet hours settings
8. Analytics track auto-archive count and effectiveness
9. Safety check: Never auto-archive crisis/urgent sentiment messages
10. Undo option available for 24 hours after auto-archive
11. Rate limiting (max 1 boundary message per fan per week to avoid spam perception)

**Priority**: P1 (Phase 2 - Weeks 3-4)

**Infrastructure Reuse**: 95%

**Integration Verification:**

- IV1: Auto-archive runs during daily workflow batch (not real-time)
- IV2: Fan replies to boundary message un-archive and re-prioritize conversation
- IV3: Boundary messages sent respecting quiet hours from user settings
- IV4: Escalation path works (reply → Medium Priority, reply again → High Priority)
- IV5: Rate limiting prevents spam perception (<1 message/fan/week)

---

## Story 6.5: Advanced Capacity Configuration

**As a** creator,
**I want** enhanced capacity settings with boundary message customization and weekly reports,
**so that** I can fine-tune my sustainable engagement strategy.

**Acceptance Criteria:**

1. Boundary message template editor with preview
2. Advanced toggles (autoArchiveEnabled, requireEditingForBusiness)
3. Weekly capacity reports toggle
4. Boundary message variables supported (creator name, FAQ link, community link)
5. Message preview shows how fans will see it
6. Custom boundary messages saved per creator
7. Suggested adjustments based on weekly capacity usage
8. Settings validation prevents destructive configurations

**Priority**: P1 (Phase 2 - Weeks 3-4)

**Infrastructure Reuse**: 80%

**Integration Verification:**

- IV1: Custom boundary messages render correctly in fan UI
- IV2: Weekly reports generation doesn't impact performance
- IV3: Settings changes take effect in next daily workflow run
- IV4: Suggested adjustments use accurate behavioral data

---

## Story 6.6: Engagement Health Dashboard

**As a** creator,
**I want** to see my engagement quality metrics (not just quantity),
**so that** I can maintain healthy relationships and avoid burning out.

**Acceptance Criteria:**

1. Overall health score (0-100) calculated from composite metrics
2. Personal response rate shown (% not using AI drafts blindly)
3. Average response time displayed (hours)
4. Conversation depth metric (% multi-turn conversations)
5. Capacity usage shown for today and week
6. Burnout risk indicator (Low/Medium/High) with explanation
7. Visual indicators (✅/⚠️/❌) for each metric vs target
8. Trend charts available (tap "View Details")
9. Recommendations shown if metrics unhealthy
10. Refresh every 5 minutes when screen active
11. Week-over-week trends ("+5 points from last week")
12. Peer benchmarks (optional: "Your response rate is higher than 70% of creators")

**Priority**: P2 (Phase 3 - Weeks 5-6)

**Infrastructure Reuse**: 85%

**Integration Verification:**

- IV1: Dashboard loads in < 1 second using cached metrics
- IV2: Metrics calculated daily via Cloud Function (not real-time)
- IV3: Burnout risk notifications trigger correctly for high-risk users
- IV4: Health score algorithm matches PM-defined formula
- IV5: Dashboard gracefully handles missing historical data

---

**Technical Implementation Notes:**

**Code Changes Required** (8 files to modify, 3 new files):

Modified Files:

1. `services/dailyDigestService.ts` - New schema, scoring integration
2. `services/voiceMatchingService.ts` - Draft-first mode
3. `services/bulkOperationsService.ts` - Remove approve all, add auto-archive
4. `functions/src/ai/daily-agent-workflow.ts` - Add scoring step
5. `app/(tabs)/daily-digest.tsx` - Priority tiers UI
6. `app/(tabs)/conversations/[id].tsx` - Draft-first response card
7. `types/ai.ts` - New interfaces
8. `types/user.ts` - Capacity settings

New Files:

1. `services/relationshipScoringService.ts`
2. `services/engagementMetricsService.ts`
3. `app/(tabs)/profile/engagement-health.tsx`

**Performance Targets** (All validated by Architect):

- Daily digest generation: < 5 seconds (achievable: 3-7 sec)
- Relationship scoring: < 2 seconds (achievable: 1-3 sec)
- Engagement health load: < 1 second (achievable: 0.1-0.5 sec)
- UI load time: < 500ms (achievable: 200-400ms)

**Migration Strategy**:

- Week 0: Shadow mode (1 week) - validate scoring algorithm
- Weeks 1-6: Dual-write strategy ensures zero-downtime rollback
- Week 7-8: Conservative rollout (5% → 25% → 50% → 100%)
- Feature flags enable granular per-feature toggles

**Risk Management**:

- 🔴 HIGH: Relationship scoring accuracy (mitigated by A/B testing, manual override, feedback loops, remote config tuning)
- 🟡 MEDIUM: Performance degradation (mitigated by batch reads, denormalization, caching)
- 🟡 MEDIUM: Fan pushback on boundaries (mitigated by A/B test messaging, escalation path)
- 🟢 LOW: Firestore cost increase (+$0.10/user/month - acceptable)

---
