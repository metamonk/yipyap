# Technical Assumptions

## Repository Structure: Monorepo

**Decision:** Single monorepo containing the React Native mobile application.

**Rationale:**

- MVP scope is limited to a single mobile app (no separate backend services, web clients, or microservices)
- Monorepo simplifies development workflow for a small team/solo developer
- All code (React Native app, Firebase configuration, shared utilities) lives in one repository
- Easier dependency management and atomic commits across the entire application
- Can evolve to multi-package monorepo later if Phase 2 introduces separate services (AI backend, admin dashboard, etc.)

## Service Architecture

**Architecture Pattern:** Client-Heavy Architecture with Backend-as-a-Service (Firebase)

**Technical Stack:**

- **Mobile Framework:** React Native with Expo managed workflow
- **Language:** TypeScript (required for type safety and developer experience)
- **Backend:** Firebase (fully managed, serverless)
  - **Authentication:** Firebase Auth
  - **Database:** Cloud Firestore (real-time NoSQL database)
  - **Storage:** Firebase Storage (for profile photos, future media if needed)
  - **Push Notifications:** Firebase Cloud Messaging (FCM)
  - **Hosting/Functions:** Firebase Cloud Functions (if needed for server-side logic)
- **State Management:** React Context API or Zustand (lightweight, sufficient for MVP scope)
- **Real-time Sync:** Firestore real-time listeners (native SDK)
- **Offline Support:** Firestore offline persistence + local caching

**Rationale:**

- **React Native/Expo:** Cross-platform development (iOS + Android from single codebase), rapid iteration, rich ecosystem
- **Expo managed workflow:** Simplifies native module management, faster development, OTA updates
- **TypeScript required:** Type safety reduces runtime errors, improves code maintainability, better IDE support, essential for scalable codebase
- **Firebase BaaS approach:** Eliminates need to build/maintain custom backend infrastructure, proven scalability, built-in real-time capabilities align perfectly with chat requirements
- **Firestore for chat:** Purpose-built for real-time sync, handles offline-first scenarios natively, scales to thousands of concurrent users
- **No custom backend needed for MVP:** All requirements (auth, real-time messaging, presence, notifications) satisfied by Firebase services
- **Client-heavy architecture:** Business logic in React Native app; Firebase handles data persistence, sync, and auth (appropriate for MVP, can add Cloud Functions later if needed)

## Testing Requirements

**MVP Testing Strategy:** Unit + Integration testing with manual QA focus

**Testing Approach:**

- **Unit Tests:** Critical business logic and utility functions (Jest)
- **Integration Tests:** Firebase integration points (auth flows, message CRUD, real-time listeners)
- **Component Tests:** React Native Testing Library for key UI components
- **Manual Testing:** Primary QA method for E2E user flows (creating accounts, sending messages, group chats, offline scenarios)
- **Performance Testing:** Manual load testing with Firebase Emulator Suite or staging environment (validate 1,000+ concurrent user target)
- **No E2E automation for MVP:** Manual E2E testing sufficient; automated E2E (Detox, Appium) deferred to post-MVP

**Test Coverage Goals:**

- Core messaging logic: 80%+ unit test coverage
- Firebase integration: Key flows tested (auth, CRUD, real-time sync)
- UI components: Critical user-facing components tested (ChatView, ConversationList, MessageInput)

**Rationale:**

- **Manual E2E prioritized:** MVP timeline favors shipping over extensive test automation; real device testing essential for React Native
- **Focus unit/integration tests on high-risk areas:** Message delivery logic, offline sync, optimistic UI updates
- **Performance validation critical:** Must prove <500ms latency and 1,000+ concurrent user scalability claims
- **Pragmatic for MVP:** Full testing pyramid deferred; sufficient confidence for launch with manual QA + targeted automated tests

## Additional Technical Assumptions and Requests

**Development & Deployment:**

- **Version Control:** Git repository (GitHub recommended for collaboration/CI/CD integration)
- **CI/CD:** GitHub Actions or Expo EAS Build for automated builds and deployments
- **Environment Management:** Separate Firebase projects for development, staging, and production
- **App Distribution:** Expo EAS Submit for streamlined iOS App Store and Google Play Store deployment

**Code Quality & Standards:**

- **TypeScript:** Required throughout the codebase with strict mode enabled
- **Linting:** ESLint with TypeScript and React Native recommended rules
- **Formatting:** Prettier for consistent code style
- **Type Coverage:** Aim for minimal use of `any` types; prefer proper type definitions

**Performance Optimization:**

- **Message List Rendering:** FlatList with proper keyExtractor, getItemLayout optimization for large lists
- **Bundle Size:** Monitor and optimize bundle size; code-splitting if app grows significantly
- **Firestore Query Optimization:** Indexed queries, pagination, and composite indexes to minimize read costs and maximize performance

**Security:**

- **Firebase Security Rules:** Properly configured Firestore and Storage security rules (users can only read/write their own data and authorized conversations)
- **Authentication:** Firebase Auth handles session management; no custom auth logic needed
- **API Keys:** Environment variables for Firebase config; never commit secrets to repository

**Future AI Integration Readiness (Phase 2 Preparation):**

- **Message Metadata Structure:** Include fields in Firestore documents for future AI categorization (e.g., `category`, `sentiment`, `aiProcessed` flags)
- **Data Export Capability:** Ensure Firestore data structure supports export for AI model training (structured, well-documented schema)
- **API Integration Points:** Design message handling to allow future injection of AI processing steps (e.g., before displaying messages, after receiving)

**Constraints:**

- **Expo Limitations Acknowledged:** Accept Expo managed workflow constraints (limited custom native modules); can eject to bare workflow if necessary in future
- **No Web Version for MVP:** React Native for mobile only; web client explicitly out of scope

---
