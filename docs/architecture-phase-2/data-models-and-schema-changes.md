# Data Models and Schema Changes

## New Data Models

### AI Message Metadata

**Purpose:** Store AI-generated metadata for each message
**Integration:** Extends existing message documents

**Key Attributes:**

- `aiCategory`: string (enum: 'fan' | 'business' | 'spam' | 'urgent') - Message category
- `aiSentiment`: object { score: number, label: string } - Sentiment analysis
- `aiOpportunityScore`: number (0-100) - Business opportunity likelihood
- `aiProcessedAt`: timestamp - When AI processing completed
- `aiFaqMatched`: boolean - Whether FAQ was detected
- `aiSuggestedResponse`: string - AI-generated response draft

**Relationships:**

- **With Existing:** Extends message documents in `messages/{messageId}`
- **With New:** References FAQ templates in `faqs/{faqId}`

### FAQ Templates

**Purpose:** Store creator-approved FAQ responses
**Integration:** New collection, referenced by messages

**Key Attributes:**

- `faqId`: string - Unique identifier
- `creatorId`: string - Owner reference
- `question`: string - FAQ pattern to match
- `response`: string - Approved response template
- `isActive`: boolean - Whether auto-response is enabled
- `usageCount`: number - Times used
- `lastUsed`: timestamp - Last usage time

**Relationships:**

- **With Existing:** References users via `creatorId`
- **With New:** Referenced by messages when FAQ detected

### AI Training Data

**Purpose:** Store creator communication patterns for voice matching
**Integration:** New collection for AI model training

**Key Attributes:**

- `creatorId`: string - Creator reference
- `trainingMessages`: array - Selected historical messages
- `voiceProfile`: object - Extracted communication patterns
- `lastTrainedAt`: timestamp - Last training date
- `modelVersion`: string - AI model version used

## Schema Integration Strategy

**Database Changes Required:**

- **New Collections:** `faqs`, `aiTraining`, `aiAuditLogs`
- **Modified Collections:** `messages` (add optional AI fields), `users` (add AI preferences)
- **New Indexes:**
  - `messages`: compound index on `conversationId` + `aiCategory`
  - `messages`: index on `aiOpportunityScore` for sorting
  - `faqs`: index on `creatorId` + `isActive`

**Migration Strategy:** No migration needed - all AI fields are optional additions

**Backward Compatibility:**

- Existing messages work without AI metadata
- UI gracefully handles missing AI fields
- AI features can be disabled per user

---
