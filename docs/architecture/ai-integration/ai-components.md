# Component Architecture

## New Components

### AI Service Layer

**Responsibility:** Unified interface for all AI operations
**Integration Points:** Edge Functions, Cloud Functions, Firestore

**Key Interfaces:**

- `categorizeMessage(message): Promise<Category>`
- `analyzeSentiment(text): Promise<Sentiment>`
- `generateResponse(context, voiceProfile): Promise<string>`
- `detectFaq(message, faqLibrary): Promise<FaqMatch>`

**Dependencies:**

- **Existing Components:** Firebase services, Message components
- **New Components:** Edge Function clients, AI provider abstraction
- **Technology Stack:** TypeScript, Vercel AI SDK, React Query

### Edge Function Services

**Responsibility:** Ultra-fast AI operations (<500ms)
**Integration Points:** Called from React Native app via HTTPS

**Key Interfaces:**

- `POST /api/ai/categorize` - Message categorization
- `POST /api/ai/sentiment` - Sentiment analysis
- `POST /api/ai/faq-detect` - FAQ pattern matching

**Dependencies:**

- **Existing Components:** None (stateless operations)
- **New Components:** AI provider abstraction
- **Technology Stack:** TypeScript, Vercel Edge Runtime, Vercel AI SDK

### Voice Training Service

**Responsibility:** Learn creator communication patterns
**Integration Points:** Firebase Cloud Functions with Firestore access

**Key Interfaces:**

- `trainVoiceModel(creatorId, messageHistory): Promise<VoiceProfile>`
- `updateVoiceProfile(creatorId, newMessages): Promise<void>`

**Dependencies:**

- **Existing Components:** Firestore message history
- **New Components:** AI training data storage
- **Technology Stack:** Node.js, Firebase Functions, Claude API

### AI Dashboard Components

**Responsibility:** Display AI insights and controls
**Integration Points:** Existing React Native screens

**Key Interfaces:**

- `<AIDashboard />` - Main command center
- `<CategoryFilter />` - Message filtering UI
- `<AIResponseSuggestion />` - Response draft UI
- `<FAQManager />` - FAQ template management

**Dependencies:**

- **Existing Components:** React Native Elements, Navigation
- **New Components:** AI Service Layer
- **Technology Stack:** React Native, TypeScript, Zustand

## Component Interaction Diagram

```mermaid
graph TB
    subgraph "Mobile App"
        UI[React Native UI]
        AIState[AI State<br/>Zustand + React Query]
        AIService[AI Service Layer]
    end

    subgraph "Edge Functions"
        EdgeAPI[Vercel Edge<br/>Fast AI Operations]
        AIAbstraction[Vercel AI SDK<br/>Provider Abstraction]
    end

    subgraph "Firebase"
        Functions[Cloud Functions<br/>Complex AI Tasks]
        Firestore[(Firestore<br/>Messages + AI Data)]
        FCM[Cloud Messaging<br/>AI Notifications]
    end

    subgraph "AI Providers"
        OpenAI[OpenAI<br/>GPT-4/3.5]
        Claude[Anthropic<br/>Claude-3]
        Gemini[Google<br/>Gemini]
    end

    UI --> AIState
    AIState --> AIService
    AIService --> EdgeAPI
    AIService --> Functions
    AIService --> Firestore

    EdgeAPI --> AIAbstraction
    Functions --> AIAbstraction

    AIAbstraction --> OpenAI
    AIAbstraction --> Claude
    AIAbstraction --> Gemini

    Functions --> Firestore
    Functions --> FCM

    style UI fill:#f9f,stroke:#333,stroke-width:2px
    style EdgeAPI fill:#9ff,stroke:#333,stroke-width:2px
    style AIAbstraction fill:#ff9,stroke:#333,stroke-width:2px
```

---
