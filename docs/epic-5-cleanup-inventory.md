# Epic 5 Code Cleanup Inventory

**Created:** 2025-10-26
**Story:** 6.7 - Systematic Epic 5 Code Cleanup
**Status:** Discovery Complete

## Executive Summary

**Good News:** Most Epic 5 code has already been removed or was never implemented!

- ✅ Daily Digest UI is already using Epic 6 format (Meaningful 10)
- ✅ No "Approve All" or "Reject All" buttons exist in the codebase
- ✅ No deprecated types (OpportunitySummary, BulkOperation, ApprovalResponse) found
- ✅ No old Command Center UI from Story 5.8

**What Remains:** Only the Story 5.5 approval mode batch functions and related UI

## Items to Remove

### Priority 1: UI Components (REMOVE)

| File | Lines | Description | Replacement |
|------|-------|-------------|-------------|
| `components/dashboard/QuickActions.tsx` | 194 | Uses `batchApproveSuggestions()` | Story 6.2 (Draft-first, no approval) |

### Priority 2: Service Functions (REMOVE)

| File | Lines | Function | Replacement |
|------|-------|----------|-------------|
| `services/bulkOperationsService.ts` | 310-419 | `batchApproveSuggestions()` | Story 6.2 (Draft-first mode) |
| `services/bulkOperationsService.ts` | 442-551 | `batchRejectSuggestions()` | Story 6.2 (Draft-first mode) |

**KEEP in bulkOperationsService.ts:**
- `archiveAllRead()` - Standard bulk operation
- `markAllAsRead()` - Standard bulk operation
- `autoArchiveWithKindBoundary()` - Story 6.4 ✅

### Priority 3: Tests (REMOVE/UPDATE)

| File | Lines | Description | Action |
|------|-------|-------------|--------|
| `tests/unit/services/bulkOperationsService.test.ts` | 338+ | Tests for `batchApproveSuggestions()` | Remove test suite |
| `tests/unit/services/bulkOperationsService.test.ts` | (unknown) | Tests for `batchRejectSuggestions()` | Remove test suite |
| `tests/unit/components/dashboard/QuickActions.test.tsx` | 24, 282-325 | Tests using batch approve functions | Remove tests |
| `tests/unit/components/dashboard/DashboardWidgetContainer.test.tsx` | 48 | Mock of `batchApproveSuggestions` | Remove mock |

## Items Already Clean (No Action Needed)

### UI Screens ✅
- ✅ `app/(tabs)/daily-digest.tsx` - Already Epic 6 (Meaningful 10)
- ✅ No old "Overnight Summary" UI found
- ✅ No old "Command Center" from Story 5.8 found
- ✅ No "Approve All" / "Reject All" buttons found

### Types ✅
- ✅ No `OpportunitySummary` interface found
- ✅ No `BulkOperation` interface found
- ✅ No `ApprovalResponse` interface found
- ✅ `types/ai.ts` appears clean

### Database Fields ✅
- ✅ No deprecated `approved` fields found in current code
- ✅ No deprecated `bulkOperationId` fields found in current code
- Note: These may exist in actual Firestore data, but not actively used in code

## Epic 5 Infrastructure Still Active (DO NOT REMOVE)

These Story 5.x features are still in use:

- ✅ Story 5.1: AI Infrastructure (OpenAI, Pinecone) - KEEP
- ✅ Story 5.2: Message Categorization - KEEP
- ✅ Story 5.3: Sentiment Analysis - KEEP
- ✅ Story 5.4: FAQ Detection - KEEP
- ✅ Story 5.5: Voice Matching Core (only approval mode removed) - KEEP
- ✅ Story 5.6: Opportunity Scoring - KEEP
- ✅ Story 5.7: Creator Dashboard - KEEP
- ✅ Story 5.9: Performance Monitoring - KEEP

## Replacement Mapping

| Old (Epic 5) | New (Epic 6) | Story |
|--------------|--------------|-------|
| `batchApproveSuggestions()` | Draft-first editing (no approval) | 6.2 |
| `batchRejectSuggestions()` | Draft-first editing (no approval) | 6.2 |
| Approval buttons in QuickActions | Removed (draft-first only) | 6.2 |

## Estimated Impact

**Lines of Code to Remove:** ~300 lines
- Service functions: ~240 lines (2 functions)
- UI component sections: ~20 lines
- Tests: ~40 lines

**Files to Modify:** 4 files
- `services/bulkOperationsService.ts` - Remove 2 functions
- `components/dashboard/QuickActions.tsx` - Remove batch approve usage
- `tests/unit/services/bulkOperationsService.test.ts` - Remove test suites
- `tests/unit/components/dashboard/QuickActions.test.tsx` - Remove test cases
- `tests/unit/components/dashboard/DashboardWidgetContainer.test.tsx` - Remove mock

**Files to Delete:** 0 files (no standalone deprecated files found)

**Bundle Size Reduction:** ~15-20KB estimated

## Search Commands Used

```bash
# Epic 5 story references
grep -r "Story 5\." --include="*.ts" --include="*.tsx" .

# Old UI components
grep -r "Overnight Summary\|Command Center\|Approve All\|Reject All" --include="*.tsx" app/

# Old service functions
grep -r "bulkApprove\|bulkReject\|approveAll\|rejectAll" --include="*.ts" services/ functions/

# Old types/interfaces
grep -r "OpportunitySummary\|BulkOperation\|ApprovalResponse" --include="*.ts" types/

# Batch function usage
grep -rn "batchApproveSuggestions\|batchRejectSuggestions" --include="*.tsx" --include="*.ts" .
```

## Next Steps

1. ✅ Task 1 Complete: Discovery & Inventory
2. ⏳ Task 2: Create this document
3. ⏳ Task 3: Verify replacement status
4. ⏳ Task 4-12: Safe removal (Priorities 1-3)
5. ⏳ Task 13-15: Verification
6. ⏳ Task 16: Cleanup report

## Notes

- Most of the feared "Epic 5 mess" doesn't exist - the code is already clean!
- The removal is much simpler than anticipated
- Main cleanup is Story 5.5 approval mode (batch approve/reject)
- No old digest UI, no old types, no approval buttons in main app
- This suggests Epic 6 was implemented as a replacement, not an addition
