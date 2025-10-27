# Tech Stack

This is the **DEFINITIVE technology selection** for the entire yipyap project. All development must use these exact versions.

## Technology Stack Table

| Category             | Technology                           | Version          | Purpose                               | Rationale                                                                                 |
| -------------------- | ------------------------------------ | ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Frontend Language    | TypeScript                           | 5.9.2            | Type-safe JavaScript for React Native | Type safety reduces runtime errors, improves IDE support, essential for scalable codebase |
| Frontend Framework   | React Native                         | 0.81.4           | Cross-platform mobile development     | Latest stable version, proven framework for iOS/Android from single codebase              |
| UI Component Library | React Native Elements                | latest           | Pre-built UI components               | Accelerates development with consistent, customizable components                          |
| State Management     | Zustand                              | latest           | Lightweight state management          | Simpler than Redux, perfect for chat app state, TypeScript-first                          |
| Backend Language     | TypeScript                           | 5.9.2            | Cloud Functions if needed             | Consistency with frontend, type safety across stack                                       |
| Backend Framework    | Firebase JavaScript SDK              | latest           | Backend-as-a-Service                  | Managed infrastructure, real-time capabilities, Expo Go compatible                        |
| API Style            | Firebase JS Client SDK               | latest           | Direct client-to-database             | No traditional API needed, Firestore handles real-time sync                               |
| Database             | Cloud Firestore                      | latest           | NoSQL real-time database              | Built for real-time apps, offline support, automatic scaling                              |
| Realtime DB          | Firebase Realtime Database           | latest           | Presence & typing indicators          | Sub-millisecond latency for presence state, onDisconnect handlers                         |
| Cache                | Firestore Offline                    | built-in         | Local data caching                    | Native offline persistence in Firestore SDK                                               |
| File Storage         | Firebase Storage                     | latest           | Profile photos and media              | Integrated with Firebase Auth, CDN distribution                                           |
| Authentication       | Firebase Auth (Email/Password)       | latest           | User authentication                   | Email/password provider for MVP, Expo Go compatible, managed auth with secure tokens      |
| Frontend Testing     | Jest + React Native Testing Library  | 29.x + latest    | Unit and component testing            | Standard React Native testing stack                                                       |
| Backend Testing      | Firebase Emulator Suite              | latest           | Local Firebase testing                | Test Firestore rules and Cloud Functions locally                                          |
| E2E Testing          | Detox                                | latest           | End-to-end mobile testing             | React Native optimized, supports both platforms                                           |
| Build Tool           | Expo CLI                             | 54.0.13          | Build and development                 | Managed workflow, OTA updates, simplified native module management                        |
| Bundler              | Metro                                | built-in         | JavaScript bundling                   | React Native default bundler, optimized for RN                                            |
| IaC Tool             | Firebase CLI                         | latest           | Infrastructure configuration          | Deploy security rules, indexes, functions                                                 |
| CI/CD                | Expo EAS Build                       | latest           | Automated builds and deployment       | Cloud builds for iOS/Android, automatic store submission                                  |
| Monitoring           | Firebase Crashlytics                 | latest           | Crash reporting and monitoring        | Real-time crash reports, performance monitoring                                           |
| Logging              | Firebase Analytics                   | latest           | Usage analytics and logging           | User behavior tracking, custom events                                                     |
| CSS Framework        | React Native StyleSheet + Reanimated | built-in + 4.1.1 | Styling and animations                | Native performance, gesture-driven animations                                             |

## Phase 2: AI Intelligence Layer Tech Stack

| Category          | Technology                    | Version | Purpose                         | Rationale                                                            |
| ----------------- | ----------------------------- | ------- | ------------------------------- | -------------------------------------------------------------------- |
| AI SDK            | OpenAI SDK                    | ^6.7.0  | Direct OpenAI API integration   | Official SDK, all AI features (Stories 6.8-6.11)                     |
| ~AI SDK (Legacy)~ | ~Vercel AI SDK~               | N/A     | ~~Unified AI provider~~         | **Removed (Oct 2025, Story 6.11)** - Replaced with OpenAI SDK       |
| ~Edge Functions~  | ~Vercel Edge Functions~       | N/A     | ~~FAQ detection endpoint~~      | **Removed (Oct 2025, Story 6.10)** - Migrated to Cloud Functions    |
| Quality LLM       | OpenAI GPT-4 Turbo            | latest  | Advanced text generation        | Best-in-class performance for complex tasks, JSON mode support       |
| Speed/Cost LLM    | OpenAI GPT-4o-mini            | latest  | Fast, cost-effective processing | Rapid categorization, competitive pricing at $0.15/$0.60 per 1M tokens |
| Embeddings        | OpenAI text-embedding-3-small | latest  | Semantic search & similarity    | Efficient vector representations for FAQ matching                    |
| Vector Database   | Pinecone                      | latest  | Vector storage and retrieval    | Managed vector DB for FAQ and voice matching, sub-50ms query times   |
| AI Monitoring     | Langfuse                      | latest  | LLM observability and analytics | Track AI performance, costs, user satisfaction                       |
| Cloud Functions   | Firebase Cloud Functions Gen2 | latest  | Background AI processing        | Extended timeout for training jobs, scheduled workflows              |
| Queue Service     | Firebase Cloud Tasks          | latest  | Async AI job processing         | Reliable task execution for batch operations                         |
| AI Data Storage   | Firestore + Cloud Storage     | latest  | AI metadata and training data   | Consistent with Phase 1 stack, supports large training datasets      |
| Rate Limiting     | Upstash Redis                 | latest  | API rate limiting for AI        | Serverless Redis for distributed rate limiting                       |
| Secret Management | Firebase Functions Config     | latest  | API key management              | Secure storage for AI provider keys                                  |

### AI Provider Selection Strategy

**Note**: yipyap uses an OpenAI-only approach for simplicity and competitive pricing. Multi-provider support can be added later if needed.

**Architecture (Stories 6.8-6.11 - Oct 2025):**
- **All AI Features**: Use OpenAI SDK directly in Firebase Cloud Functions
  - Daily Agent Workflow (Story 6.8):
    - Categorization: GPT-4o-mini via direct SDK call
    - Sentiment analysis: GPT-4o-mini via direct SDK call
    - Opportunity scoring: GPT-4 Turbo via direct SDK call
  - Voice Training/Matching (Story 6.9):
    - Voice profile generation: GPT-4 Turbo via direct SDK call
    - Response suggestions: GPT-4 Turbo via direct SDK call
  - FAQ Detection (Story 6.10):
    - FAQ embeddings: OpenAI Embeddings via direct SDK call
    - Vector search: Pinecone client in Cloud Functions
- **Benefits**: No HTTP overhead, simplified architecture, single SDK dependency

**Model Usage:**
- **Real-time categorization**: GPT-4o-mini (speed priority, $0.15/$0.60 per 1M tokens)
- **Response generation**: GPT-4 Turbo (quality priority, $10.00/$30.00 per 1M tokens)
- **FAQ matching**: OpenAI Embeddings + Pinecone (semantic search)
- **Sentiment analysis**: GPT-4o-mini (cost-effective)
- **Opportunity scoring**: GPT-4 Turbo (accuracy critical)
- **Fallback strategy**: Model degradation (GPT-4 Turbo → GPT-4o-mini) instead of cross-provider

### Cost Optimization Approach

- Model routing based on task complexity
- Response caching for common queries
- Batch processing for non-urgent tasks
- Progressive enhancement (basic → advanced features)

---
