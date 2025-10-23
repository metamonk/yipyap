# Coding Standards

## Existing Standards Compliance

**Code Style:** ESLint + Prettier configuration from Phase 1
**Linting Rules:** Strict TypeScript, React Native specific rules
**Testing Patterns:** Jest for unit tests, React Native Testing Library
**Documentation Style:** JSDoc comments for public APIs

## Enhancement-Specific Standards

- **AI Response Caching:** All AI responses must be cached with React Query (5 minute TTL)
- **Error Boundaries:** Every AI component wrapped in error boundary with fallback UI
- **Cost Tracking:** Log token usage for all AI operations
- **Prompt Versioning:** Version control all AI prompts in `ai/prompts/`
- **Model Selection:** Use cheapest model that meets accuracy requirements

## Critical Integration Rules

- **Existing API Compatibility:** Never modify existing Firebase service interfaces
- **Database Integration:** AI fields must be optional with defaults
- **Error Handling:** AI failures must not break core messaging
- **Logging Consistency:** Use existing Firebase Analytics patterns

---
