# Source Tree

## Existing Project Structure (Relevant Parts)

```
yipyap/
├── app/                    # Expo Router screens
├── src/
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature modules
│   ├── services/          # Firebase services
│   └── utils/            # Utilities
├── functions/            # Firebase Cloud Functions
└── docs/                # Documentation
```

## New File Organization

```
yipyap/
├── src/
│   ├── features/
│   │   ├── ai/                          # NEW: AI feature module
│   │   │   ├── components/              # AI UI components
│   │   │   │   ├── AIDashboard.tsx
│   │   │   │   ├── CategoryFilter.tsx
│   │   │   │   ├── ResponseSuggestion.tsx
│   │   │   │   └── FAQManager.tsx
│   │   │   ├── hooks/                   # AI React hooks
│   │   │   │   ├── useAICategories.ts
│   │   │   │   ├── useVoiceMatching.ts
│   │   │   │   └── useFAQDetection.ts
│   │   │   ├── services/                # AI service layer
│   │   │   │   ├── aiService.ts
│   │   │   │   ├── edgeFunctions.ts
│   │   │   │   └── providers.ts        # AI provider abstraction
│   │   │   ├── stores/                  # AI state management
│   │   │   │   └── aiStore.ts
│   │   │   └── utils/                   # AI helpers
│   │   │       └── aiHelpers.ts
│   ├── services/
│   │   └── firebase/
│   │       └── ai/                      # NEW: Firebase AI integrations
│   │           ├── faqService.ts
│   │           └── trainingService.ts
├── functions/                            # Existing Firebase Functions
│   ├── src/
│   │   ├── ai/                          # NEW: AI Cloud Functions
│   │   │   ├── voiceMatching.ts
│   │   │   ├── dailyAgent.ts
│   │   │   └── workflows/
│   │   │       └── morningDigest.ts
├── edge-functions/                       # NEW: Vercel Edge Functions
│   ├── api/
│   │   └── v1/
│   │       └── ai/
│   │           ├── categorize.ts
│   │           ├── sentiment.ts
│   │           └── faq-detect.ts
└── ai/                                   # NEW: Shared AI utilities
    ├── providers/                        # Vercel AI SDK config
    │   └── index.ts
    └── prompts/                         # AI prompt templates
        ├── categorization.ts
        └── voice-matching.ts
```

## Integration Guidelines

- **File Naming:** Follow existing camelCase for files, PascalCase for components
- **Folder Organization:** AI features isolated in `features/ai/` for easy removal if needed
- **Import/Export Patterns:** Use barrel exports matching existing pattern

---
