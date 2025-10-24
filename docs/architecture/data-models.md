# Data Models

## User

**Purpose:** Represents a registered user in the system with comprehensive profile information, multi-device support, and advanced preferences

**Key Attributes:**

- `uid`: string - Unique Firebase Auth ID (same as document ID)
- `username`: string - Unique username (3-20 chars, lowercase, alphanumeric + underscore)
- `displayName`: string - User's display name (up to 50 characters)
- `email`: string - User's email address from Firebase Auth
- `photoURL`: string | null - Firebase Storage URL for profile photo
- `fcmTokens`: PushToken[] - Array of push tokens for multi-device support
- `presence`: object - Online/offline status and last seen timestamp
- `settings`: object - Comprehensive user preferences
- `createdAt`: timestamp - Account creation timestamp
- `updatedAt`: timestamp - Last profile update

### TypeScript Interface

```typescript
interface User {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  photoURL?: string;
  fcmToken?: string; // Legacy single token support
  fcmTokens?: PushToken[]; // Multi-device push tokens
  presence: {
    status: 'online' | 'offline';
    lastSeen: firebase.firestore.Timestamp;
  };
  settings: {
    sendReadReceipts: boolean;
    notificationsEnabled: boolean;
    notifications?: NotificationPreferences;
    presence?: PresencePreferences;
    voiceMatching?: VoiceMatchingPreferences; // Phase 2: Story 5.5
    opportunityNotifications?: OpportunityNotificationPreferences; // Phase 2: Story 5.6
  };
  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}

interface PushToken {
  token: string;
  type: 'expo' | 'fcm' | 'apns';
  platform: 'ios' | 'android';
  deviceId: string;
  appVersion: string;
  createdAt: firebase.firestore.Timestamp;
  lastUsed: firebase.firestore.Timestamp;
}

interface NotificationPreferences {
  enabled: boolean;
  showPreview: boolean;
  sound: boolean;
  vibration: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  systemMessages: boolean;
  quietHoursStart?: string; // "22:00" format
  quietHoursEnd?: string; // "08:00" format
}

interface PresencePreferences {
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  awayTimeoutMinutes: number;
  awayDetectionEnabled: boolean;
  invisibleMode: boolean;
}

interface VoiceMatchingPreferences {
  enabled: boolean; // Default: true
  autoShowSuggestions: boolean; // Default: true
  suggestionCount: number; // 1-3, default: 2
  retrainingSchedule: 'weekly' | 'biweekly' | 'monthly'; // Default: weekly
}

interface OpportunityNotificationPreferences {
  enabled: boolean; // Default: true
  minimumScore: number; // 0-100, default: 70 (high-value only)
  notifyByType: {
    sponsorship: boolean; // Default: true
    collaboration: boolean; // Default: true
    partnership: boolean; // Default: true
    sale: boolean; // Default: false
  };
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00" format
    end: string; // "08:00" format
  };
}
```

### Relationships

- One-to-Many with Conversations (participates in multiple conversations)
- One-to-Many with Messages (sends multiple messages)

## Conversation

**Purpose:** Represents a chat conversation between users (1:1 or group) with enhanced group management

**Key Attributes:**

- `id`: string - Unique conversation ID (deterministic for 1:1, random for groups)
- `type`: string - Either 'direct' or 'group'
- `participantIds`: string[] - Array of user UIDs in conversation (indexed for queries)
- `groupName`: string | null - Name for group chats
- `groupPhotoURL`: string | null - Group photo URL
- `creatorId`: string | null - UID of group creator
- `adminIds`: string[] | null - Array of user IDs with admin privileges (groups only)
- `lastMessage`: object - Preview of most recent message
- `lastMessageTimestamp`: timestamp - Time of last message (indexed for sorting)
- `unreadCount`: map - Per-user unread message counts
- `archivedBy`: map - Per-user archive status
- `deletedBy`: map - Per-user soft deletion status
- `mutedBy`: map - Per-user mute status

### TypeScript Interface

```typescript
interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[]; // Note: Was 'participants' in early docs
  groupName?: string;
  groupPhotoURL?: string;
  creatorId?: string;
  adminIds?: string[]; // Group admin privileges
  lastMessage: {
    text: string;
    senderId: string;
    timestamp: firebase.firestore.Timestamp;
  };
  lastMessageTimestamp: firebase.firestore.Timestamp;
  unreadCount: Record<string, number>;
  archivedBy: Record<string, boolean>;
  deletedBy: Record<string, boolean>;
  mutedBy: Record<string, boolean>;
  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

### Relationships

- Many-to-Many with Users (through participantIds)
- One-to-Many with Messages (contains multiple messages)

## Message

**Purpose:** Represents an individual message within a conversation

**Key Attributes:**

- `id`: string - Unique message ID (Firestore document ID)
- `conversationId`: string - Parent conversation ID
- `senderId`: string - UID of message sender
- `text`: string - Message content (up to 1000 characters)
- `status`: string - Delivery status (sending, delivered, read)
- `readBy`: string[] - Array of UIDs who have read the message
- `timestamp`: timestamp - Message creation time
- `metadata`: object - AI-ready fields for future features

### TypeScript Interface

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: 'sending' | 'delivered' | 'read';
  readBy: string[];
  timestamp: firebase.firestore.Timestamp;
  metadata: {
    category?: string;
    sentiment?: string;
    aiProcessed?: boolean;
  };
}
```

### Relationships

- Many-to-One with Conversation (belongs to one conversation)
- Many-to-One with User (sent by one user)

## Additional Implementation Types

### Presence System (Realtime Database)

**Purpose:** Real-time presence tracking using Firebase Realtime Database for instant updates

```typescript
interface PresenceData {
  state: 'online' | 'offline' | 'away';
  lastSeen: number; // Unix timestamp (ms)
  devices: Record<string, DevicePresence>;
}

interface DevicePresence {
  state: 'online' | 'offline';
  platform: 'ios' | 'android' | 'web';
  lastActivity: number;
  appVersion?: string;
}

interface TypingIndicator {
  isTyping: boolean;
  timestamp: number;
}
```

### Resilience & Error Handling

**Purpose:** Retry queue and batch operations for reliable message delivery

```typescript
interface RetryQueueItem {
  id: string;
  operationType: 'READ_RECEIPT_BATCH' | 'MESSAGE_SEND' | 'STATUS_UPDATE';
  data: {
    messageIds?: string[];
    userId?: string;
    timestamp?: Timestamp;
    conversationId?: string;
    [key: string]: unknown;
  };
  retryCount: number;
  nextRetryTime: number;
  createdAt: number;
  lastError?: string;
}

interface BatchUpdateResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  totalCount: number;
  duration: number;
  errors: Array<{
    itemId: string;
    error: string;
    errorType: 'network' | 'permission' | 'quota' | 'validation' | 'unknown';
  }>;
  retryQueued: boolean;
}
```

### Group Management

**Purpose:** Validation and state management for group creation and editing

```typescript
interface MemberSelectionState {
  selectedMemberIds: string[];
  currentCount: number;
  canAddMore: boolean;
  limitReached: boolean;
  warningThresholdReached: boolean;
}

interface GroupValidationState {
  isValid: boolean;
  errorMessage: string | null;
  warningMessage: string | null;
  severity: 'error' | 'warning' | 'success';
  memberCount: number;
  canSubmit: boolean;
}

type GroupCreationError =
  | { type: 'SIZE_LIMIT_EXCEEDED'; message: string; currentCount: number; limit: number }
  | { type: 'INSUFFICIENT_MEMBERS'; message: string; currentCount: number; minimumRequired: number }
  | { type: 'MISSING_GROUP_NAME'; message: string }
  | { type: 'NETWORK_ERROR'; message: string; details?: string }
  | { type: 'PERMISSION_ERROR'; message: string; details?: string };
```

### Conversation Operations

**Purpose:** Atomic operations and multi-select UI management

```typescript
interface CreateConversationWithMessageParams {
  type: 'direct' | 'group';
  participantIds: string[];
  messageText: string;
  senderId: string;
  groupName?: string;
  groupPhotoURL?: string;
}

interface CreateConversationResult {
  conversationId: string;
  messageId: string;
}

interface ConversationSelectionState {
  isSelectionMode: boolean;
  selectedConversationIds: Set<string>;
}
```

---

## Phase 2: AI Intelligence Layer Data Models

### AI Message Metadata (Extension)

**Purpose:** Extends the base Message model with comprehensive AI processing metadata

**Enhanced Attributes:**

```typescript
interface AIMessageMetadata extends Message {
  metadata: {
    // Categorization
    category: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
    categoryConfidence: number; // 0-1 confidence score

    // Sentiment Analysis
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore: number; // -1 to 1 scale
    emotionalTone: string[]; // ['excited', 'frustrated', 'curious']

    // Business Intelligence (Story 5.6)
    opportunityScore: number; // 0-100 business value score
    opportunityType?: 'sponsorship' | 'collaboration' | 'partnership' | 'sale';
    opportunityIndicators?: string[]; // Detected keywords/signals (e.g., ['sponsorship', 'budget'])
    opportunityAnalysis?: string; // Brief AI analysis of the opportunity

    // AI Processing Status
    aiProcessed: boolean;
    aiProcessedAt?: firebase.firestore.Timestamp;
    aiVersion: string; // Model version used

    // Response Assistance
    suggestedResponse?: string;
    suggestedResponseApproved?: boolean;
    autoResponseSent?: boolean;
    autoResponseId?: string;

    // FAQ Detection
    isFAQ: boolean;
    faqTemplateId?: string;
    faqMatchConfidence?: number;

    // Voice Matching (Story 5.5)
    suggestionUsed?: boolean; // User accepted suggestion
    suggestionEdited?: boolean; // User edited before sending
    suggestionRejected?: boolean; // User rejected suggestion
    suggestionRating?: number; // 1-5 stars (optional feedback)
  };
}
```

### FAQ Template

**Purpose:** Stores creator-approved FAQ templates for automatic responses

**Key Attributes:**

```typescript
interface FAQTemplate {
  id: string;
  creatorId: string; // User who created template
  question: string; // The FAQ question pattern
  answer: string; // Approved response text
  keywords: string[]; // Keywords for matching
  embedding?: number[]; // Vector embedding for semantic search
  category: string; // FAQ category (pricing, availability, etc.)
  isActive: boolean;
  useCount: number; // Times this FAQ has been used
  lastUsedAt?: firebase.firestore.Timestamp;
  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

### AI Training Data

**Purpose:** Stores user-specific training data for voice matching and personalization

**Key Attributes:**

```typescript
interface AITrainingData {
  id: string;
  userId: string;
  type: 'voice_sample' | 'response_feedback' | 'categorization_feedback';

  // Voice Training
  voiceSample?: {
    originalMessage: string;
    userResponse: string;
    context: string;
    approved: boolean;
  };

  // Feedback Data
  feedback?: {
    originalSuggestion: string;
    userEdit?: string;
    rating: number; // 1-5 stars
    comments?: string;
  };

  // Training Metadata
  modelVersion: string;
  processed: boolean;
  processedAt?: firebase.firestore.Timestamp;
  createdAt: firebase.firestore.Timestamp;
}
```

### AI Workflow Configuration

**Purpose:** Stores user preferences for autonomous AI workflows

**Key Attributes:**

```typescript
interface AIWorkflowConfig {
  id: string;
  userId: string;

  // Feature Toggles
  features: {
    autoCategorizatioEnabled: boolean;
    voiceMatchingEnabled: boolean;
    faqAutoResponseEnabled: boolean;
    sentimentAnalysisEnabled: boolean;
    opportunityScoringEnabled: boolean;
    dailyWorkflowEnabled: boolean;
  };

  // Workflow Settings
  workflowSettings: {
    dailyWorkflowTime: string; // "09:00" format
    timezone: string;
    maxAutoResponses: number; // Per day limit
    requireApproval: boolean; // Manual approval for AI actions
    escalationThreshold: number; // Sentiment score for escalation
  };

  // Model Preferences
  modelPreferences: {
    preferredProvider: 'openai' | 'auto';
    costOptimization: 'performance' | 'balanced' | 'economy';
  };

  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

### AI Analytics

**Purpose:** Tracks AI performance metrics and usage statistics

**Key Attributes:**

```typescript
interface AIAnalytics {
  id: string;
  userId: string;
  period: 'daily' | 'weekly' | 'monthly';
  periodStart: firebase.firestore.Timestamp;

  metrics: {
    messagesProcessed: number;
    messagesAutoCategorized: number;
    categoryAccuracy: number; // Percentage

    responsesGenerated: number;
    responsesApproved: number;
    responsesEdited: number;
    responseApprovalRate: number; // Percentage

    faqsMatched: number;
    faqsAutoResponded: number;

    opportunitiesIdentified: number;
    highValueOpportunities: number;

    timeSaved: number; // Minutes
    costIncurred: number; // USD cents
  };

  createdAt: firebase.firestore.Timestamp;
}
```

### Voice Profile (Story 5.5)

**Purpose:** Stores creator voice characteristics for AI-matched response generation

**Firestore Collection:** `voice_profiles` (root-level collection)

**Key Attributes:**

```typescript
interface VoiceProfile {
  id: string;
  userId: string;

  // Voice Characteristics
  characteristics: {
    tone: string; // "friendly", "professional", "casual", etc.
    vocabulary: string[]; // Common words/phrases
    sentenceStructure: string; // "short", "medium", "complex"
    punctuationStyle: string; // "minimal", "expressive"
    emojiUsage: "none" | "occasional" | "frequent";
  };

  // Training Metadata
  trainingSampleCount: number;
  lastTrainedAt: firebase.firestore.Timestamp;
  modelVersion: string; // GPT-4 Turbo version

  // Performance Metrics
  metrics: {
    totalSuggestionsGenerated: number;
    acceptedSuggestions: number;
    editedSuggestions: number;
    rejectedSuggestions: number;
    averageSatisfactionRating: number; // 1-5
  };

  createdAt: firebase.firestore.Timestamp;
  updatedAt: firebase.firestore.Timestamp;
}
```

**Firestore Indexes Required:**
- Single field index: `userId` (ASC)

### Relationships (Phase 2)

- AIMessageMetadata: One-to-One extension of Message
- FAQTemplate: Many-to-One with User (creator)
- AITrainingData: Many-to-One with User
- AIWorkflowConfig: One-to-One with User
- AIAnalytics: Many-to-One with User
- VoiceProfile: One-to-One with User (Story 5.5)

---
