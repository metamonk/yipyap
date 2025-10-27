The Daily Agent Workflow System

  This is a multi-step autonomous agent that processes overnight messages for
  content creators. Here's what it does:

  Core Capabilities

  1. Intelligent Message Triage
    - Fetches unprocessed messages from the last 12 hours
    - Filters out crisis messages, active conversations, and messages from the
  creator themselves
    - Categorizes messages using GPT-4o-mini (via Edge Functions)
  2. FAQ Detection & Auto-Response
    - Uses Pinecone vector embeddings to match incoming messages against FAQ
  templates
    - Auto-responds with confidence >80% (respecting user's approval settings)
    - Rate-limited to prevent spam (max auto-responses configurable per user)
  3. Voice-Matched Response Drafting
    - Generates personalized draft responses that match the creator's
  communication style
    - Uses GPT-4 Turbo for quality
    - Stores voice profiles with characteristics like tone, vocabulary, sentence
   structure
  4. Relationship Scoring & Prioritization (Epic 6 - Recently deployed)
    - Calculates relationship scores (0-100) based on:
        - Business opportunities (+50 points)
      - Urgent messages (+40 points)
      - VIP relationships (+30 points for >10 messages, >30 days old)
      - Recent interactions (+15 points if within 7 days)
      - Crisis sentiment (+100 points for negative sentiment <-0.7)
    - Generates "Meaningful 10" digest with priority tiers:
        - High priority: Top 3 messages (respond today)
      - Medium priority: Next 2-7 messages (respond this week)
      - Auto-handled: FAQ auto-responses + auto-archived conversations
  5. Auto-Archive with Kind Boundaries (Story 6.4)
    - Automatically archives low-priority messages beyond the creator's capacity
    - Sends kind boundary messages to fans (max 1 per week per fan)
    - Safety checks prevent archiving business/urgent/VIP/crisis messages
    - 24-hour undo window with Firestore TTL

  Intelligent Orchestration Features

  The agent has sophisticated awareness:

  - Manual Override Detection: Skips auto-response if creator manually replied
  during workflow execution
  - Online/Active Status Checks: Doesn't run if creator is currently using the
  app (within 30 min threshold)
  - Quiet Hours Support: Respects notification quiet hours for boundary messages
  - Timeout Management: 5-minute workflow timeout with per-step performance
  tracking
  - Cost Tracking: Monitors AI API costs in real-time (categorization, FAQ
  detection, response generation)
  - Shadow Mode Validation: New algorithms run in logging-only mode before
  production deployment

  Architecture Pattern

  Cloud Functions (Orchestrator)
  ├── Step 1: Fetch unprocessed messages
  ├── Step 2: Batch categorization (Edge Function → OpenAI)
  ├── Step 3: FAQ detection (Edge Function → Pinecone)
  ├── Step 4: Voice-matched drafting (GPT-4 Turbo)
  ├── Step 5: Relationship scoring + Meaningful 10 digest
  └── Step 6: Push notification (FCM/APNs)

  AI Models Used

  - GPT-4o-mini: Cost-efficient categorization and sentiment analysis
  (~$0.05/msg)
  - GPT-4 Turbo: High-quality voice-matched response generation (~$1.50/msg)
  - Pinecone: Vector embedding search for FAQ matching

  Why This is "Agentic"

  This qualifies as agentic AI because it:

  1. Autonomous Decision-Making: Decides which messages to archive, which to
  auto-respond to, and which to escalate
  2. Multi-Step Planning: Orchestrates a complex 6-step workflow with
  dependencies and error handling
  3. Context-Aware: Understands relationship dynamics, conversation history,
  sentiment, and business opportunities
  4. Goal-Oriented: Optimizes for creator capacity management and authentic
  engagement
  5. Adaptive: Adjusts behavior based on user settings, online status, quiet
  hours, and manual overrides