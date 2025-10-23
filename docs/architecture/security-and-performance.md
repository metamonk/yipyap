# Security and Performance

## Security Requirements

**Frontend Security:**

- CSP Headers: Not applicable for native mobile apps
- XSS Prevention: React Native's built-in protection against script injection
- Secure Storage: AsyncStorage with Firebase Auth persistence for session management
- Input Sanitization: All user inputs validated before Firestore writes

**Backend Security:**

- **Comprehensive Firestore Security Rules:**
  - Field-level validation for all user profiles
  - Username format validation (3-20 chars, lowercase, alphanumeric + underscore)
  - Display name validation (1-50 chars)
  - Participant verification for conversations and messages
  - Immutable username claims (prevent username hijacking)
  - Email field validation
  - Presence and settings structure validation

- **Multi-Device Security:**
  - Individual push tokens per device tracked with metadata
  - Device ID verification for presence updates
  - Platform-specific token validation (Expo, FCM, APNs)

- **Rate Limiting:** Firebase App Check for API abuse prevention (ready for Phase 2)
- **CORS Policy:** Not applicable (native apps don't use CORS)

**Authentication Security:**

- Token Storage: Firebase Auth with AsyncStorage persistence
- Session Management: Automatic token refresh with React Native persistence
- Multi-Session Support: Per-device session tracking
- Password Requirements: Minimum 8 characters, uppercase, lowercase, and numbers
- Password Reset: Secure email-based password reset via Firebase Auth
- Username Uniqueness: Separate collection for atomic username claims

**Realtime Database Security:**

- Presence data isolated per user
- Multi-device presence tracking with device-level permissions
- Typing indicators scoped to conversation participants
- onDisconnect handlers for automatic cleanup

**Privacy Features:**

- **Granular Notification Control:**
  - Per-category notification preferences (DMs, groups, system)
  - Quiet hours scheduling
  - Preview visibility toggle
  - Sound/vibration controls

- **Presence Privacy:**
  - Optional invisible mode
  - Configurable "last seen" visibility
  - Online status hiding
  - Away detection with configurable timeout

## Performance Optimization

**Frontend Performance:**

- Bundle Size Target: < 5MB for initial download
- Loading Strategy: Lazy loading for screens, code splitting with dynamic imports
- Rendering Optimization: FlatList with optimized getItemLayout for message lists
- Caching Strategy: Multi-layer caching approach

**Multi-Layer Caching Strategy:**

1. **User Cache Service:**
   - In-memory cache for active session
   - LRU eviction for memory management
   - Automatic invalidation on logout
   - Search result caching (5-minute TTL)

2. **Firestore Offline Persistence:**
   - Persistent local cache enabled by default
   - Automatic sync on reconnection
   - Message and conversation data cached

3. **Image Caching:**
   - Profile photos cached with expo-image
   - CDN for Firebase Storage assets

**Backend Performance:**

- **Response Time Targets:**
  - Message delivery: < 500ms P95
  - Presence updates: < 100ms (RTDB)
  - Typing indicators: < 100ms (RTDB)
  - Profile updates: < 1s P95

- **Database Optimization:**
  - Composite indexes on participantIds + lastMessageTimestamp
  - Message timestamp indexes for ordering
  - Query limits (50 messages default)
  - Cursor-based pagination for all lists
  - Username search optimization with prefix matching

- **Batch Operations:**
  - Read receipts batched per conversation
  - Bulk conversation operations (archive/delete up to 50 at once)
  - Message pagination in 50-item chunks
  - Debounced search queries (300ms)

- **Realtime Database for Low-Latency:**
  - Presence state on RTDB (not Firestore) for sub-100ms updates
  - Typing indicators on RTDB with automatic timeout
  - Multi-device presence aggregation

**Resilience Optimizations:**

- **Retry Queue:**
  - Exponential backoff (1s → 30s)
  - Circuit breaker (10 failure threshold)
  - Operation-specific retry strategies
  - Persistent queue across app restarts

- **Optimistic UI:**
  - Instant message display
  - Background reconciliation
  - Graceful failure handling

- **Connection Management:**
  - RTDB connection monitoring (.info/connected)
  - Automatic reconnection logic
  - Offline queue for pending operations

**Monitoring:**

- Firebase Crashlytics for error tracking
- Firebase Analytics for usage patterns
- Performance metrics collection
- Retry queue metrics for reliability

---
