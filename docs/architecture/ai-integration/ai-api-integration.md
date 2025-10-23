# API Design and Integration

## API Integration Strategy

**API Integration Strategy:** Three-tier architecture for optimal performance
**Authentication:** Firebase Auth tokens for Cloud Functions, API keys for Edge Functions
**Versioning:** Path-based versioning (`/api/v1/ai/*`)

## New API Endpoints

### Message Categorization

- **Method:** POST
- **Endpoint:** `/api/v1/ai/categorize`
- **Purpose:** Fast categorization of incoming messages
- **Integration:** Called async after message receipt

**Request:**

```json
{
  "messageId": "msg_123",
  "text": "Hey! Would love to collab on a sponsored post",
  "senderId": "user_456"
}
```

**Response:**

```json
{
  "category": "business",
  "confidence": 0.92,
  "processingTime": 287
}
```

### Sentiment Analysis

- **Method:** POST
- **Endpoint:** `/api/v1/ai/sentiment`
- **Purpose:** Detect negative sentiment and crisis situations
- **Integration:** Bundled with categorization for efficiency

**Request:**

```json
{
  "text": "I'm really upset about the latest video",
  "messageId": "msg_789"
}
```

**Response:**

```json
{
  "sentiment": {
    "score": -0.8,
    "label": "negative",
    "urgent": true
  }
}
```

### Response Generation

- **Method:** POST
- **Endpoint:** `/api/v1/ai/generate-response`
- **Purpose:** Create voice-matched response suggestions
- **Integration:** Cloud Function with Firestore access

**Request:**

```json
{
  "conversationId": "conv_123",
  "messageContext": ["previous", "messages"],
  "creatorId": "creator_456"
}
```

**Response:**

```json
{
  "suggestedResponse": "Thanks so much for reaching out! I'd love to discuss this opportunity. Can you email my team at...",
  "voiceMatchScore": 0.87
}
```

---
