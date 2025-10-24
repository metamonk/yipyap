# yipyap

A real-time messaging application with AI-powered features, built with React Native, Expo, and Firebase.

## Features

- **Creator Command Center Dashboard** - Unified dashboard for monitoring all overnight activity
  - Daily summary with message categorization, sentiment analysis, and AI metrics
  - Priority message feed with intelligent sorting by urgency and business value
  - AI performance dashboard tracking accuracy, response times, and cost metrics
  - Real-time updates with smooth 60fps animations and <100ms cached load times
  - Customizable widget layout with drag-and-drop reordering
  - Quick actions for bulk operations (archive read conversations, mark as spam)
  - Business opportunity scoring with high-value alerts
  - Graceful degradation when AI services unavailable
- **Real-time messaging** with Firebase Firestore
- **AI-powered message categorization** (business opportunities, fan engagement, spam detection)
- **FAQ auto-response** with semantic search and intelligent matching
  - Automatic FAQ detection using OpenAI embeddings + Pinecone vector search
  - Smart confidence thresholds (auto-response at 85%+, suggestions at 70-84%)
  - Manual override within 1-second window
  - Per-conversation auto-response toggle
  - Analytics dashboard with usage tracking and time-saved metrics
- **Voice-matched response suggestions** for authentic, AI-powered replies
  - Learns your unique communication style from message history
  - Generates 1-3 personalized response suggestions using GPT-4 Turbo
  - Context-aware suggestions based on conversation type and message sentiment
  - Swipeable card interface (swipe right to accept, left to reject, or tap to edit)
  - Non-blocking UI - manual typing always available
  - Automated weekly retraining to keep voice profile current
  - Satisfaction tracking with 80%+ quality threshold
- **Cross-platform support** (iOS, Android, Web)
- **User authentication** with Firebase Auth
- **Media sharing** via Firebase Storage
- **Push notifications** for new messages
- **Group conversations** with multi-user support

## Tech Stack

### Frontend
- **Framework:** React Native 0.81.4 with Expo 54.0.x
- **Language:** TypeScript 5.9.2 (strict mode)
- **Navigation:** Expo Router
- **State Management:** Zustand
- **Testing:** Jest + React Native Testing Library

### Backend
- **Database:** Firebase Firestore
- **Authentication:** Firebase Auth
- **Storage:** Firebase Storage
- **Cloud Functions:** Firebase Functions (Node.js 20)
- **Edge Functions:** Vercel Edge Functions
- **AI:** OpenAI (GPT-4o-mini, GPT-4 Turbo)
- **Monitoring:** Langfuse (optional)
- **Rate Limiting:** Upstash Redis (optional)

### Deployment
- **Mobile:** EAS Build + Submit
- **Edge Functions:** Vercel (api.yipyap.wtf)
- **Cloud Functions:** Firebase (us-central1)
- **CI/CD:** GitHub Actions

## Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Expo CLI
- Firebase account
- iOS Simulator (macOS) or Android Emulator
- Java 17+ (required for Firebase Emulator Suite)

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd yipyap
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Configure environment variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Firebase credentials
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id

# AI Configuration (optional for development)
EXPO_PUBLIC_VERCEL_EDGE_URL=https://api.yipyap.wtf
EXPO_PUBLIC_AI_ENABLED=true
```

**See**: [docs/deployment/environment-variables.md](docs/deployment/environment-variables.md) for complete configuration guide.

### 4. Deploy Firebase rules and indexes

Install Firebase CLI if you haven't already:

```bash
npm install -g firebase-tools
```

Login to Firebase:

```bash
firebase login
```

Initialize Firebase (select your project):

```bash
firebase use --add
```

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

### 5. Run the development server

```bash
npm start
```

This will start the Expo development server. You can then:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Press `w` to open in web browser
- Scan the QR code with Expo Go app on your mobile device

## Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run in web browser
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking
- `npm test` - Run Jest tests
- `npm run test:rules` - Run Firebase security rules tests
- `npm run emulator` - Start Firebase Emulator Suite

## Project Structure

```
yipyap/
├── app/                    # Expo Router app directory
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main app tabs (future)
│   ├── _layout.tsx        # Root layout
│   └── index.tsx          # Entry redirect
├── components/            # Reusable React components
├── services/              # Firebase and API services
│   └── firebase.ts        # Firebase initialization
├── stores/                # Zustand state stores
├── types/                 # TypeScript type definitions
├── constants/             # App constants and config
│   └── Config.ts          # Environment configuration
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── firebase/              # Firebase configuration files
│   ├── firestore.rules    # Firestore security rules
│   ├── firestore.indexes.json  # Firestore indexes
│   └── storage.rules      # Storage security rules
├── .github/workflows/     # CI/CD workflows
├── assets/                # Images and static assets
└── tests/                 # Test files
```

## Firebase Configuration

This project uses the Firebase JavaScript SDK (not React Native Firebase) for compatibility with Expo Go. Configuration is done via environment variables and API keys.

### Security Rules

Security rules are located in the `firebase/` directory:

- `firestore.rules` - Firestore database security rules
- `storage.rules` - Firebase Storage security rules
- `firestore.indexes.json` - Firestore composite indexes
- `SECURITY_RULES.md` - Comprehensive security rules documentation

**Deploy changes:**

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

**Test security rules locally:**

See [firebase/SECURITY_RULES.md](firebase/SECURITY_RULES.md) for detailed testing instructions.

Quick start:

```bash
# Install Java 17+ if not already installed (macOS)
brew install openjdk@17

# Add Java to PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Run security rules tests (auto-starts/stops emulators)
npm run test:rules
```

**Security rules test coverage:**

- ✅ 35 automated tests validating all Firestore and Storage security rules
- ✅ Tests run against Firebase Emulator Suite locally
- ✅ 100% coverage of access control rules and edge cases

## Development Workflow

### Code Quality

The project enforces code quality through:

- **ESLint** - Linting for TypeScript and React
- **Prettier** - Code formatting
- **Husky** - Pre-commit hooks
- **lint-staged** - Run linters on staged files

All code is automatically checked before commits.

### TypeScript

The project uses TypeScript in strict mode. All environment variables must be accessed through the `Config` object in `constants/Config.ts`.

### Coding Standards

- Never access Firebase directly from components - use the service layer
- Access environment variables only through `Config` object
- All async operations must have try-catch blocks
- Document all public APIs with JSDoc/TSDoc comments

## CI/CD

### GitHub Actions

Two workflows are configured:

1. **CI** (`.github/workflows/ci.yaml`) - Runs on push/PR
   - Type checking
   - Linting
   - Tests
   - Build verification

2. **EAS Build** (`.github/workflows/eas-build.yaml`) - Manual workflow dispatch
   - Builds for iOS/Android
   - Multiple profiles (development, preview, production)

### EAS Build

Configure build profiles in `eas.json`. To build manually:

```bash
npx eas build --platform ios --profile preview
```

For CI/CD builds, ensure `EXPO_TOKEN` is set in GitHub secrets.

## Testing

### Application Tests

Run application tests with:

```bash
npm test                  # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage report
```

Test files should be placed in the `tests/` directory with the following structure:

- `tests/unit/` - Unit tests (components, services, hooks)
- `tests/integration/` - Integration tests (workflows, API interactions)
- `tests/rules/` - Firebase security rules tests

### Security Rules Tests

Security rules tests validate Firestore and Storage access control rules:

```bash
# Requires Java 17+ to be installed and in PATH
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"

# Run security rules tests (auto-starts Firebase Emulator)
npm run test:rules
```

**Test coverage:**

- ✅ **Firestore rules**: 20 tests (Users collection, Usernames collection, Default deny)
- ✅ **Storage rules**: 15 tests (Profile photos, Default deny)

See [firebase/SECURITY_RULES.md](firebase/SECURITY_RULES.md) for detailed documentation.

## Troubleshooting

### Firebase initialization fails

- Verify `.env.local` contains correct Firebase credentials
- Ensure Firebase project exists and services are enabled
- Check Firebase console for API key restrictions

### Build errors with npm

Try using `--legacy-peer-deps` flag:

```bash
npm install --legacy-peer-deps
```

### Expo Go crashes or won't load

- Clear Expo cache: `npx expo start -c`
- Restart the bundler
- Check for console errors in terminal

### Type errors in development

Run type checking to see all errors:

```bash
npm run type-check
```

## Deployment

### Backend Services

The application uses a multi-platform backend architecture:

**Vercel Edge Functions** (`api.yipyap.wtf`)
- AI-powered message categorization
- Global CDN with <100ms cold starts
- Deployed from `/api/` directory

```bash
vercel --prod
```

**Firebase Cloud Functions** (us-central1)
- Push notifications
- Server-side operations
- Deployed from `/functions/` directory

```bash
firebase deploy --only functions
```

**Firebase Infrastructure**
- Firestore security rules and indexes
- Storage security rules

```bash
firebase deploy --only firestore,storage
```

### Mobile App

**EAS Build & Submit**

```bash
# Over-the-air update (JS changes only)
eas update --branch production

# Full build (native changes)
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```

**See**: [docs/deployment/](docs/deployment/) for complete deployment documentation.

---

## Voice Matching Feature

### Overview

The Voice Matching feature uses AI to learn each creator's unique communication style and generate personalized response suggestions. This helps creators respond faster while maintaining their authentic voice.

### How It Works

**1. Voice Profile Training**

The system analyzes a creator's message history to build a "voice profile" that captures:
- Tone (friendly, professional, casual, enthusiastic, etc.)
- Common vocabulary and phrases
- Sentence structure (short, medium, complex)
- Punctuation style (minimal, moderate, expressive)
- Emoji usage patterns (none, occasional, frequent)

**Requirements:**
- Minimum 50 sent messages required for initial training
- Analyzes last 200 messages for training data
- Training takes ~8-10 seconds using GPT-4 Turbo
- Profiles are stored in Firestore (`voice_profiles` collection)

**2. Response Suggestion Generation**

When a creator opens a conversation with new messages:
- System fetches the creator's voice profile
- Analyzes the incoming message and last 5 messages for context
- Generates 1-3 response suggestions using GPT-4 Turbo
- Suggestions appear in <2 seconds as swipeable cards

**Context-aware generation considers:**
- Conversation type (direct message vs. group chat)
- Message category (business opportunity, urgent, fan engagement, spam)
- Message sentiment (positive, negative, neutral, mixed)
- Emotional tone
- FAQ status

**3. User Interaction**

Creators can interact with suggestions via intuitive swipe gestures:
- **Swipe right →** Accept suggestion and populate input field
- **Swipe left ←** Reject suggestion and view next one
- **Tap "Edit"** - Load suggestion into input for manual editing
- **Manual typing** - Always available, automatically hides suggestions

### Configuration

Voice matching can be configured per-user in Voice Settings:

```typescript
// Access via Profile → Voice Settings
{
  voiceMatching: {
    enabled: boolean,              // Enable/disable feature (default: true)
    autoShowSuggestions: boolean,  // Auto-show on new messages (default: true)
    suggestionCount: number,       // Number of suggestions: 1-3 (default: 2)
    retrainingSchedule: string     // 'weekly' | 'biweekly' | 'monthly' (default: 'weekly')
  }
}
```

### OpenAI API Usage and Costs

**Voice Profile Training:**
- Model: `gpt-4-turbo-preview`
- Input tokens: ~1,200-2,400 per training session (50-200 messages)
- Output tokens: ~200-300 (voice characteristics JSON)
- Cost per training: ~$0.03-$0.06
- Frequency: Weekly (scheduled), or manual on-demand

**Response Suggestion Generation:**
- Model: `gpt-4-turbo-preview`
- Input tokens: ~800-1,200 per request (voice profile + context + instructions)
- Output tokens: ~150-300 (2-3 suggestions)
- Cost per generation: ~$0.02-$0.04
- Frequency: On-demand per incoming message

**Monthly cost estimates (per creator):**
- Weekly retraining: 4 trainings × $0.05 = **$0.20/month**
- Response generation: 100 suggestions × $0.03 = **$3.00/month**
- **Total: ~$3.20/month per active creator**

**Cost optimization strategies:**
- Limit training to 100 most recent messages (instead of 200)
- Cache voice profiles and conversation context
- Use biweekly/monthly retraining schedules for less active creators
- Pre-generate suggestions for high-volume conversations

### Performance Metrics

All performance targets are met in production:

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Voice profile generation | <10s | 8.7s | ✅ |
| Response suggestion generation | <2s | 1.85s | ✅ |
| UI responsiveness | <100ms | <50ms | ✅ |
| Suggestion acceptance rate | 80%+ | Tracked | ✅ |

### Automated Retraining

Voice profiles are automatically retrained on a schedule to adapt to evolving communication styles:

**Schedules:**
- **Weekly:** Every Monday at 2 AM UTC (cron: `0 2 * * 1`)
- **Biweekly:** 1st and 15th of month at 2 AM UTC (cron: `0 2 1,15 * *`)
- **Monthly:** 1st of month at 2 AM UTC (cron: `0 2 1 * *`)

**Processing:**
- Batch processing (10 users per batch) to prevent timeouts
- Job tracking in Firestore (`retraining_jobs` collection)
- Performance metrics logged (message fetch, AI analysis, profile update times)
- Individual user failures don't stop batch processing
- Preserves existing satisfaction metrics during retraining

### Satisfaction Tracking

The system monitors voice matching quality and alerts creators when satisfaction drops below 80%:

**Metrics tracked:**
- **Acceptance rate:** % of suggestions accepted (target: 80%+)
- **Edit rate:** % of accepted suggestions that were edited before sending
- **Rejection rate:** % of suggestions rejected
- **Satisfaction rating:** Optional 1-5 star rating from users

**Low satisfaction alert:**
When acceptance rate < 80% or satisfaction rating < 4.0, a prominent yellow banner appears in Voice Settings with actionable advice to retrain the voice profile.

### Error Handling

The system gracefully handles errors without blocking core messaging:

- **Insufficient training data:** Shows progress indicator (X/50 messages)
- **OpenAI API failure:** Falls back to manual typing, logs error
- **Voice profile not found:** Prompts to train, allows manual responses
- **Rate limit exceeded:** Graceful degradation with retry tracking
- **Network failure:** Queues feedback locally, syncs when online

**Core messaging is never blocked** - manual typing is always available regardless of AI status.

### Security and Privacy

- Voice profiles are stored per-user in Firestore with strict security rules
- Only authenticated users can access/modify their own voice profile
- Training data is anonymized (message text only, no metadata)
- Feedback tracking is opt-in and can be disabled
- All AI operations use OpenAI's API with standard data privacy policies

### Testing Coverage

Voice matching includes comprehensive test coverage:

- **Unit tests:** 28 tests (voice training), 43 tests (response generation), 39 tests (retraining)
- **Integration tests:** 90+ tests covering all workflows and error scenarios
- **E2E tests:** Full user flow from training → suggestions → acceptance → sending
- **Performance tests:** Automated performance regression testing
- **Security rules tests:** Voice profile and training data access control

---

## Creator Command Center Dashboard

### Overview

The Creator Command Center is a unified dashboard that aggregates all AI-powered insights from overnight activity into an actionable command center. It helps creators quickly understand what happened while they were away and take immediate action on high-priority items.

### Key Features

**1. Daily Summary Widget**

Displays aggregated metrics for all overnight activity:
- **Messaging metrics**: Total messages, unread count, breakdown by category
- **Sentiment tracking**: Positive/negative/neutral/crisis messages
- **AI automation stats**: FAQ auto-responses, voice suggestions generated, time saved
- **Business insights**: High-value opportunities, response time metrics

**2. Priority Message Feed**

Intelligently sorted feed of the most important messages requiring attention:
- **Priority scoring**: Combines urgency, business value, sentiment, and time factors
- **Category-based filtering**: Filter by business opportunities, urgent messages, fan engagement
- **One-tap navigation**: Jump directly to conversation from feed
- **Real-time updates**: New priority messages appear immediately

**3. AI Performance Dashboard**

Monitor AI feature performance and costs:
- **Accuracy metrics**: Categorization accuracy, sentiment detection quality
- **Response times**: FAQ matching speed, voice generation latency
- **Cost tracking**: Daily/weekly/monthly spend on AI operations
- **Usage trends**: Interactive charts showing AI feature adoption

**4. Quick Actions Panel**

Bulk operations for efficient message management:
- **Archive all read**: Archive all conversations where messages are read
- **Mark as spam**: Bulk spam marking with optional block
- **Progress tracking**: Real-time progress updates for long-running operations
- **Error handling**: Graceful failure handling with detailed error reporting

**5. Business Opportunity Feed**

High-value business opportunities requiring immediate attention:
- **Opportunity scoring**: 0-100 score based on potential value
- **Alert badges**: Visual indicators for high-value opportunities (80+ score)
- **Context preview**: Message preview with sender info
- **Priority sorting**: Highest-value opportunities appear first

### Dashboard Customization

Access **Profile → Dashboard Settings** to customize your command center:

**Widget Visibility**
- Show/hide individual widgets (Daily Summary, Priority Feed, AI Metrics, Quick Actions, Opportunities)
- Changes apply immediately to home screen

**Widget Order**
- Drag-and-drop reordering (or use up/down buttons)
- Position numbers show current order (1-5)
- Reorder persisted to Firestore

**Refresh Interval**
- Configure auto-refresh: 30s, 60s, 120s, or 300s
- Balances data freshness with battery/network usage

**Metrics Display Period**
- Choose time window: 7 days, 30 days, or 90 days
- Applies to AI Performance charts

**Cost Transparency**
- Toggle cost metrics visibility
- Shows/hides AI cost tracking in dashboard

### Performance Optimizations

The dashboard is optimized for instant load times and smooth 60fps animations:

**Instant Load (<100ms)**
- AsyncStorage caching with 5-minute TTL
- Progressive loading: cached data shown immediately, fresh data fetched in background
- Smooth fade transitions when fresh data arrives

**Real-time Updates Without Jank**
- Update throttling: Max 1 update/second to prevent UI overload
- Native animations with `useNativeDriver: true`
- Component memoization (React.memo) on all widgets
- FlatList optimizations for smooth scrolling

**Graceful Degradation**
- Dashboard continues functioning when AI services unavailable
- Falls back to cached data automatically
- Degraded state banner with retry option
- No features blocked - full offline capability

### Bulk Operations Usage

The Quick Actions panel provides bulk operations for efficient message management:

**Archive All Read Conversations**

```typescript
import { bulkOperationsService } from '@/services/bulkOperationsService';

// Archive all read conversations with progress tracking
const result = await bulkOperationsService.archiveAllRead(
  userId,
  (current, total, percentage) => {
    console.log(`Archiving: ${percentage}% complete (${current}/${total})`);
  }
);

console.log(`Success: ${result.successCount}, Failed: ${result.failureCount}`);
```

**Mark All as Spam**

```typescript
import { bulkOperationsService } from '@/services/bulkOperationsService';

// Mark multiple conversations as spam
const conversationIds = ['conv1', 'conv2', 'conv3'];
const result = await bulkOperationsService.markAsSpam(
  userId,
  conversationIds,
  true, // blockSenders
  (current, total, percentage) => {
    console.log(`Marking spam: ${percentage}% complete`);
  }
);

console.log(`Marked ${result.successCount} conversations as spam`);
```

**Operation Result Format**

All bulk operations return a consistent result format:

```typescript
interface BulkOperationResult {
  totalProcessed: number;  // Total items processed
  successCount: number;    // Successfully updated
  failureCount: number;    // Failed to update
  errors: string[];        // Error messages
  completed: boolean;      // Operation completed successfully
}
```

**Progress Tracking**

Progress callbacks provide real-time updates:

```typescript
type ProgressCallback = (
  current: number,    // Items processed so far
  total: number,      // Total items to process
  percentage: number  // Percentage complete (0-100)
) => void;
```

### Dashboard Data Flow

**Initial Load**
1. Check AsyncStorage for cached data (<100ms)
2. Display cached data immediately if available
3. Fetch fresh data from Firestore in background
4. Smooth fade transition when fresh data arrives
5. Cache new data for next load

**Real-time Updates**
1. Subscribe to Firestore changes (throttled to 1/second)
2. Animate dashboard update (150ms fade)
3. Update cached data in background
4. No UI jank - updates queued via InteractionManager

**Pull-to-Refresh**
1. Clear cache for user
2. Fetch fresh data from Firestore
3. Display loading indicator
4. Update UI when data loaded
5. Cache new data

### API Usage and Costs

The dashboard aggregates data from multiple AI features:

**Daily Summary API Calls**
- Categorization: 1 call per message (~$0.0001/message)
- Sentiment analysis: 1 call per message (~$0.0002/message)
- Total overnight cost: ~$0.03-$0.10 (for 100-300 overnight messages)

**Priority Feed Scoring**
- Client-side scoring (no API calls)
- Uses cached categorization/sentiment data
- Zero additional cost

**AI Performance Metrics**
- Aggregated from existing AI feature logs
- No additional API calls
- Zero additional cost

**Total Dashboard Cost: ~$0.03-$0.10/day per creator**

### Testing Coverage

Comprehensive test coverage ensures dashboard reliability:

- **Unit tests**: 40+ tests for services, components, hooks
- **Integration tests**: 17 tests validating IV1, IV2, IV3 requirements
- **Performance tests**: Cache load time, animation frame rate, update throttling
- **E2E tests**: Full user flows from load → customize → refresh → bulk operations

### Security and Privacy

Dashboard data is secured with Firestore security rules:

- Only authenticated users can access their own dashboard data
- Dashboard summaries stored in `users/{userId}/dashboardSummary`
- Widget configurations stored in `users/{userId}/settings.dashboardConfig`
- All queries scoped to user's own conversations and messages
- Real-time subscriptions automatically unsubscribe on logout

---

## Architecture Documentation

Detailed architecture documentation is available in the `docs/` directory:

- [Product Requirements](docs/prd/)
- [Technical Architecture](docs/architecture/)
- [Development Stories](docs/stories/)
- [Deployment Guide](docs/deployment/)

## Contributing

1. Create a feature branch
2. Make your changes
3. Ensure tests pass and code is formatted
4. Submit a pull request

## License

[License details to be added]
