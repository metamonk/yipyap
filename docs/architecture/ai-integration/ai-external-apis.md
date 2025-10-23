# External API Integration

## OpenAI API

- **Purpose:** Fast categorization and batch processing
- **Documentation:** https://platform.openai.com/docs
- **Base URL:** https://api.openai.com/v1
- **Authentication:** Bearer token (API key)
- **Integration Method:** Vercel AI SDK abstraction

**Key Endpoints Used:**

- `POST /chat/completions` - Message categorization and analysis

**Error Handling:** Exponential backoff, fallback to Gemini

## Anthropic Claude API

- **Purpose:** Voice matching and high-quality response generation
- **Documentation:** https://docs.anthropic.com
- **Base URL:** https://api.anthropic.com/v1
- **Authentication:** X-API-Key header
- **Integration Method:** Vercel AI SDK abstraction

**Key Endpoints Used:**

- `POST /messages` - Response generation with voice matching

**Error Handling:** Graceful degradation to manual mode

## Google Gemini API

- **Purpose:** Cost-effective sentiment analysis and FAQ detection
- **Documentation:** https://ai.google.dev/docs
- **Base URL:** https://generativelanguage.googleapis.com/v1
- **Authentication:** API key parameter
- **Integration Method:** Vercel AI SDK abstraction

**Key Endpoints Used:**

- `POST /models/gemini-flash:generateContent` - Fast analysis tasks

**Error Handling:** Queue for retry, alert if persistent failures

---
