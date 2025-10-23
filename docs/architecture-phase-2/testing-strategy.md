# Testing Strategy

## Integration with Existing Tests

**Existing Test Framework:** Jest + React Native Testing Library
**Test Organization:** `__tests__` folders colocated with code
**Coverage Requirements:** Maintain 80% coverage minimum

## New Testing Requirements

### Unit Tests for New Components

- **Framework:** Jest (existing)
- **Location:** `src/features/ai/__tests__/`
- **Coverage Target:** 85% for AI components
- **Integration with Existing:** Mock AI services for deterministic tests

### Integration Tests

- **Scope:** AI service layer + Firebase integration
- **Existing System Verification:** Ensure messages still deliver without AI
- **New Feature Testing:** End-to-end AI categorization flow

### Regression Testing

- **Existing Feature Verification:** Full test suite for messaging features
- **Automated Regression Suite:** GitHub Actions on every PR
- **Manual Testing Requirements:** Creator acceptance testing for voice matching

---
