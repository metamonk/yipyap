# External API Integration

## OpenAI API

- **Purpose:** All AI operations - categorization, voice matching, sentiment analysis, and response generation
- **Documentation:** https://platform.openai.com/docs
- **Base URL:** https://api.openai.com/v1
- **Authentication:** Bearer token (API key)
- **Integration Method:** Vercel AI SDK abstraction

**Key Models Used:**

- `gpt-4o-mini` - Fast categorization, sentiment analysis, and cost-optimized operations
- `gpt-4-turbo-preview` - High-quality voice matching and response generation

**Key Endpoints Used:**

- `POST /chat/completions` - All text generation operations

**Error Handling:**
- Exponential backoff with 3 retry attempts
- Model degradation (Quality → Cost-optimized) for quality requests
- Circuit breaker pattern to prevent cascading failures
- Graceful degradation to manual mode when unavailable

**AI Model Selection History:**

*October 2025: GPT-4o-mini Selected as Primary Model*
- **Decision:** Use GPT-4o-mini instead of Claude 3 Haiku for categorization and sentiment analysis
- **Rationale:** Architecture compliance (OpenAI-only approach per tech-stack.md)
- **Cost Impact:** -40% to -52% cost savings over Claude 3 Haiku
  - GPT-4o-mini input: $0.15/1M tokens vs Claude input: $0.25/1M tokens
  - GPT-4o-mini output: $0.60/1M tokens vs Claude output: $1.25/1M tokens
- **Implementation:** Story 5.2 (Message Categorization)
- **Files Affected:** `api/utils/aiClient.ts`, `api/categorize-message.ts`
- **Performance:** No degradation observed, maintains <500ms latency targets

---
