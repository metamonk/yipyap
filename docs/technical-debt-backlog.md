# Technical Debt & Cleanup Backlog

**Created:** 2025-10-26
**Priority:** Address after completing Epic 6 digest fix

---

## 🟡 Medium Priority

### 1. Security Rules - Misleading Comment (firebase/firestore.rules:509-510)

**Issue:**
```javascript
// Write: Only Cloud Functions can write (no client writes allowed)
allow write: if false;
```

**Problem:**
- Comment says "Only Cloud Functions can write"
- Rule says `allow write: if false` (blocks everyone)
- This is confusing and misleading

**Why it works anyway:**
- Cloud Functions use Admin SDK which bypasses security rules
- So the rule correctly blocks clients, and Cloud Functions work
- But the comment is inaccurate

**Fix:**
```javascript
// Write: Blocked for all clients (Cloud Functions use Admin SDK which bypasses rules)
allow write: if false;
```

**OR** (if we want to be more explicit):
```javascript
// Write: Only accessible via Cloud Functions Admin SDK (this rule blocks client writes)
// Cloud Functions with Admin SDK bypass Firestore security rules entirely
allow write: if false;
```

**Risk:** Low (just a comment clarification)
**Effort:** 5 minutes

---

## 🟢 Low Priority

### 2. Epic 5 Widgets Still in Home Page (Story 6.1 cleanup)

**Issue:**
- Home page still shows "Command Center" instead of Epic 6 UI
- Business Opportunities widget still present
- AI Performance Metrics widget still present
- Quick Actions widget still present

**Fix:**
- Remove Epic 5 widgets from `DashboardWidgetContainer`
- Replace with Epic 6 three-section layout (High/Medium/Auto-handled)

**Risk:** Low (frontend only)
**Effort:** 30-60 minutes

---

## 📊 Tracking

| Issue | Priority | Status | Assigned | Estimated Effort |
|-------|----------|--------|----------|------------------|
| Security Rules Comment | 🟡 Medium | Backlog | - | 5 min |
| Epic 5 Widget Removal | 🟢 Low | Backlog | - | 30-60 min |

---

## Notes

- Do NOT fix these while debugging the digest save issue
- Address after main problem is solved
- Test each fix in isolation
