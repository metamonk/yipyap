# Unified Project Structure

```
yipyap/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml            # Test and lint
│       └── eas-build.yaml     # EAS Build trigger
├── app/                        # Expo Router app directory
│   ├── (auth)/                # Authentication screens
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/                # Main app tabs
│   │   ├── _layout.tsx
│   │   ├── conversations/
│   │   ├── chat/
│   │   └── profile/
│   ├── _layout.tsx            # Root layout
│   └── +not-found.tsx         # 404 screen
├── components/                 # Reusable components
│   ├── common/                # Shared UI components
│   ├── conversation/          # Conversation components
│   ├── chat/                  # Chat components
│   └── profile/               # Profile components
├── constants/                  # App constants
│   ├── Colors.ts
│   ├── Layout.ts
│   └── Config.ts
├── hooks/                      # Custom React hooks
│   ├── useAuth.ts
│   ├── useConversations.ts
│   ├── useMessages.ts
│   └── usePresence.ts
├── services/                   # API/Firebase services
│   ├── firebase.ts            # Firebase initialization
│   ├── authService.ts
│   ├── conversationService.ts
│   ├── messageService.ts
│   └── notificationService.ts
├── stores/                     # Zustand state stores
│   ├── appStore.ts
│   ├── conversationStore.ts
│   └── messageStore.ts
├── utils/                      # Utility functions
│   ├── dateHelpers.ts
│   ├── messageHelpers.ts
│   └── validation.ts
├── types/                      # TypeScript type definitions
│   ├── models.ts              # Data models
│   ├── navigation.ts          # Navigation types
│   └── api.ts                 # API types
├── assets/                     # Static assets
│   ├── fonts/
│   └── images/
├── firebase/                   # Firebase configuration
│   ├── firestore.rules
│   ├── firestore.indexes.json
│   ├── storage.rules
│   └── functions/             # Optional Cloud Functions
│       ├── src/
│       └── package.json
├── scripts/                    # Build/utility scripts
│   └── reset-project.js
├── .env.example               # Environment template
├── .gitignore
├── app.json                   # Expo configuration
├── babel.config.js
├── eas.json                   # EAS Build configuration
├── eslint.config.js           # ESLint configuration
├── expo-env.d.ts              # Expo TypeScript definitions
├── package.json
├── tsconfig.json              # TypeScript configuration
└── README.md
```

---
