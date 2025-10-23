# Tech Stack

## Existing Technology Stack (Maintained)

| Category           | Current Technology       | Version | Usage in Enhancement          | Notes                         |
| ------------------ | ------------------------ | ------- | ----------------------------- | ----------------------------- |
| Frontend Language  | TypeScript               | 5.9.2   | All AI UI components          | Maintained                    |
| Frontend Framework | React Native             | 0.81.4  | AI feature screens            | Maintained                    |
| State Management   | Zustand                  | latest  | AI state management           | Extended with AI stores       |
| Backend Services   | Firebase                 | latest  | Core infrastructure           | Maintained                    |
| Database           | Cloud Firestore          | latest  | Message storage + AI metadata | Extended schema               |
| Authentication     | Firebase Auth            | latest  | User context for AI           | Maintained                    |
| Push Notifications | Firebase Cloud Messaging | latest  | AI alerts                     | Extended for AI notifications |

## New Technology Additions

| Technology            | Version | Purpose                                | Rationale                                         | Integration Method                     |
| --------------------- | ------- | -------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| Vercel AI SDK         | 3.x     | Unified AI provider abstraction        | Model-agnostic interface, easy provider switching | npm package in frontend & functions    |
| Vercel Edge Functions | latest  | Low-latency AI operations              | <500ms response time for categorization           | Separate deployment alongside Firebase |
| OpenAI API            | latest  | Fast categorization & batch processing | GPT-4-Turbo for speed, GPT-3.5 for cost           | Via Vercel AI SDK                      |
| Anthropic Claude API  | latest  | Voice matching & response drafting     | Best quality for authentic responses              | Via Vercel AI SDK                      |
| Google Gemini API     | latest  | Sentiment analysis & FAQ detection     | Cost-effective for high-volume                    | Via Vercel AI SDK                      |
| React Query           | 5.x     | AI response caching                    | Efficient state management for AI data            | npm package in frontend                |
| Cloud Tasks/Pub/Sub   | latest  | Background job processing              | Complex AI workflows                              | Firebase Cloud Functions               |

---
