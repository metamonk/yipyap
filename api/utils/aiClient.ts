import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Message category types for AI categorization
 */
export type MessageCategory =
  | 'fan_engagement'
  | 'business_opportunity'
  | 'spam'
  | 'urgent'
  | 'general';

/**
 * Sentiment classification types
 */
export type SentimentType = 'positive' | 'negative' | 'neutral' | 'mixed';

/**
 * Opportunity types for business opportunity categorization
 */
export type OpportunityType = 'sponsorship' | 'collaboration' | 'partnership' | 'sale';

/**
 * Result from AI categorization operation
 */
export interface CategorizationResult {
  /** The assigned category */
  category: MessageCategory;
  /** Confidence score between 0 and 1 */
  confidence: number;
  /** Brief reasoning for the categorization */
  reasoning: string;
  /** Sentiment classification (positive, negative, neutral, mixed) */
  sentiment: SentimentType;
  /** Sentiment score on -1 to 1 scale (-1 = very negative, +1 = very positive) */
  sentimentScore: number;
  /** Array of emotional tones detected (e.g., ['excited', 'frustrated']) */
  emotionalTone: string[];
  /** Brief reasoning for the sentiment analysis */
  sentimentReasoning: string;
  /** Whether crisis situation detected (sentimentScore < -0.7) */
  crisisDetected: boolean;
}

/**
 * Result from AI opportunity scoring operation (Story 5.6)
 */
export interface OpportunityScoreResult {
  /** Business opportunity score (0-100) */
  score: number;
  /** Type of business opportunity detected */
  type: OpportunityType;
  /** Detected business keywords and signals */
  indicators: string[];
  /** Brief AI-generated analysis of the opportunity */
  analysis: string;
}

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
};

/**
 * Combined categorization and sentiment analysis prompt for GPT-4o-mini
 * Uses OpenAI-only approach per architecture/tech-stack.md
 */
const CATEGORIZATION_SENTIMENT_PROMPT = `You are a message analysis system for a creator messaging platform.

Analyze the following message and provide:
1. Category classification (ONE of: fan_engagement, business_opportunity, spam, urgent)
2. Sentiment analysis with emotional tone

Message to analyze: "{messageText}"

**Category Definitions:**
- **fan_engagement**: General fan messages, compliments, casual conversation, appreciation
- **business_opportunity**: Sponsorship inquiries, collaboration requests, partnership proposals, business deals
- **spam**: Promotional content, suspicious links, irrelevant messages, scams
- **urgent**: Negative sentiment, crisis situations, complaints, time-sensitive requests

**Sentiment Score Scale:**
- 1.0 to 0.5: Very positive to moderately positive
- 0.5 to -0.5: Neutral
- -0.5 to -1.0: Moderately negative to very negative

**Crisis Detection Keywords (when sentimentScore < -0.7):**
Anger/Hostility: angry, furious, hate, disgusted, enraged, livid, pissed, outraged
Threats: threatening, threaten, lawsuit, lawyer, sue, expose, revenge, retaliate, harm, hurt you
Self-Harm: suicidal, kill myself, end it, suicide, depression, hopeless, worthless, no reason to live, can't go on
Emergency: urgent, emergency, help, crisis, immediate, desperate, dying, scared
Severe Disappointment: devastated, crushed, heartbroken, ruined, destroyed, betrayed
Abandonment: abandoned, alone, nobody cares, give up, lost hope, can't take it anymore

**Emotional Tone Examples:** excited, frustrated, angry, grateful, curious, anxious, disappointed, hopeful, confused, supportive, demanding, appreciative

**Important:** Automatically categorize as "urgent" if sentimentScore < -0.5, regardless of other categorization.

Respond ONLY with valid JSON in this exact format:
{
  "category": "fan_engagement" | "business_opportunity" | "spam" | "urgent",
  "confidence": 0.95,
  "reasoning": "Brief explanation",
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "sentimentScore": 0.8,
  "emotionalTone": ["excited", "grateful"],
  "sentimentReasoning": "Brief explanation"
}`;

/**
 * Sleep utility for retry delays
 * @param ms - Milliseconds to sleep
 */
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 * @param attempt - Current retry attempt (0-indexed)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.initialDelayMs * Math.pow(2, attempt);
  return Math.min(exponentialDelay, config.maxDelayMs);
}

/**
 * Parse and validate AI response with sentiment analysis
 * @param response - Raw AI response text
 * @returns Parsed categorization and sentiment result
 * @throws {Error} If response is invalid or cannot be parsed
 */
function parseCategorizationResponse(response: string): CategorizationResult {
  try {
    const parsed = JSON.parse(response);

    // Validate required categorization fields
    if (!parsed.category || typeof parsed.confidence !== 'number') {
      throw new Error('Invalid response format: missing required categorization fields');
    }

    // Validate category value
    const validCategories: MessageCategory[] = [
      'fan_engagement',
      'business_opportunity',
      'spam',
      'urgent',
      'general',
    ];
    if (!validCategories.includes(parsed.category)) {
      throw new Error(`Invalid category: ${parsed.category}`);
    }

    // Validate confidence range
    if (parsed.confidence < 0 || parsed.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Validate required sentiment fields
    if (!parsed.sentiment || typeof parsed.sentimentScore !== 'number') {
      throw new Error('Invalid response format: missing required sentiment fields');
    }

    // Validate sentiment type
    const validSentiments: SentimentType[] = ['positive', 'negative', 'neutral', 'mixed'];
    if (!validSentiments.includes(parsed.sentiment)) {
      throw new Error(`Invalid sentiment: ${parsed.sentiment}`);
    }

    // Validate sentiment score range
    if (parsed.sentimentScore < -1 || parsed.sentimentScore > 1) {
      throw new Error('Sentiment score must be between -1 and 1');
    }

    // Validate emotional tone is an array
    if (!Array.isArray(parsed.emotionalTone)) {
      throw new Error('emotionalTone must be an array');
    }

    // Detect crisis: sentimentScore < -0.7
    const crisisDetected = parsed.sentimentScore < -0.7;

    // Override category to "urgent" if sentimentScore < -0.5
    let finalCategory = parsed.category;
    if (parsed.sentimentScore < -0.5) {
      finalCategory = 'urgent';
    }

    return {
      category: finalCategory,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning || 'No reasoning provided',
      sentiment: parsed.sentiment,
      sentimentScore: parsed.sentimentScore,
      emotionalTone: parsed.emotionalTone,
      sentimentReasoning: parsed.sentimentReasoning || 'No sentiment reasoning provided',
      crisisDetected,
    };
  } catch (error) {
    throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Categorize a message and analyze sentiment using GPT-4o-mini with retry logic
 * Uses OpenAI-only approach per architecture/tech-stack.md
 *
 * @param messageText - The message text to analyze
 * @param apiKey - OpenAI API key (ignored - uses OPENAI_API_KEY environment variable)
 * @param retryConfig - Optional retry configuration
 * @returns Promise resolving to combined categorization and sentiment analysis result
 * @throws {Error} When all retry attempts fail or response is invalid
 *
 * @example
 * ```typescript
 * const result = await categorizeMessage(
 *   'Love your content!',
 *   process.env.OPENAI_API_KEY!
 * );
 * console.warn(result.category); // 'fan_engagement'
 * console.warn(result.confidence); // 0.95
 * console.warn(result.sentiment); // 'positive'
 * console.warn(result.sentimentScore); // 0.85
 * console.warn(result.emotionalTone); // ['excited', 'grateful']
 * console.warn(result.crisisDetected); // false
 * ```
 */
export async function categorizeMessage(
  messageText: string,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<CategorizationResult> {
  // Note: API key should be set via OPENAI_API_KEY environment variable
  // This parameter is kept for backward compatibility

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Format prompt with message text
      const prompt = CATEGORIZATION_SENTIMENT_PROMPT.replace('{messageText}', messageText);

      // Call GPT-4o-mini for combined categorization + sentiment analysis
      // (OpenAI-only per tech-stack.md)
      // Note: apiKey parameter is ignored - using OPENAI_API_KEY from environment
      const { text } = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      // DEBUG: Log raw GPT response to diagnose sentiment parsing issues
      console.warn('[DEBUG] Raw GPT response:', text);

      // Parse and validate response (includes crisis detection and urgent flag logic)
      const result = parseCategorizationResponse(text);

      // Apply confidence threshold - default to "general" if confidence < 0.7
      // But preserve sentiment data
      if (result.confidence < 0.7) {
        return {
          ...result,
          category: 'general',
          reasoning: `Low confidence (${result.confidence}), defaulting to general`,
        };
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      // Don't retry on the last attempt
      if (attempt === retryConfig.maxRetries) {
        break;
      }

      // Calculate and apply exponential backoff delay
      const delay = calculateBackoffDelay(attempt, retryConfig);
      await sleep(delay);
    }
  }

  // All retries failed - throw error or return fallback
  throw new Error(
    `Categorization and sentiment analysis failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}`
  );
}

/**
 * Opportunity scoring prompt for GPT-4 Turbo
 * Uses high-quality model per Story 5.6 requirements for accurate business opportunity detection
 */
const OPPORTUNITY_SCORING_PROMPT = `You are a business opportunity detection system for a creator messaging platform.

Analyze this business opportunity message and score its value from 0-100.

Message: "{messageText}"

**Scoring Algorithm:**
- Brand/sponsorship mentions: +40 points (e.g., "sponsor", "brand deal", "sponsored content")
- Budget/compensation mentions: +30 points (e.g., "$", "budget", "payment", "compensation", "fee")
- Partnership/collaboration keywords: +20 points (e.g., "collaborate", "partner", "work together")
- Professionalism and seriousness: +10 points (formal tone, specific details, clear intent)

**Opportunity Types:**
- **sponsorship**: Brand sponsorship deals, sponsored content opportunities
- **collaboration**: Content collaborations, joint projects, creative partnerships
- **partnership**: Business partnerships, long-term agreements
- **sale**: Product purchases, service inquiries, one-time transactions

Respond ONLY with valid JSON in this exact format:
{
  "score": 85,
  "type": "sponsorship" | "collaboration" | "partnership" | "sale",
  "indicators": ["brand collaboration", "budget discussion", "long-term partnership"],
  "analysis": "Brief 1-sentence summary of the opportunity"
}`;

/**
 * Parse and validate opportunity scoring response
 * @param response - Raw AI response text
 * @returns Parsed opportunity score result
 * @throws {Error} If response is invalid or cannot be parsed
 */
function parseOpportunityScoreResponse(response: string): OpportunityScoreResult {
  try {
    const parsed = JSON.parse(response);

    // Validate required fields
    if (typeof parsed.score !== 'number') {
      throw new Error('Invalid response format: missing or invalid score');
    }

    // Validate score range
    if (parsed.score < 0 || parsed.score > 100) {
      throw new Error('Score must be between 0 and 100');
    }

    // Validate opportunity type
    const validTypes: OpportunityType[] = ['sponsorship', 'collaboration', 'partnership', 'sale'];
    if (!validTypes.includes(parsed.type)) {
      throw new Error(`Invalid opportunity type: ${parsed.type}`);
    }

    // Validate indicators is an array
    if (!Array.isArray(parsed.indicators)) {
      throw new Error('indicators must be an array');
    }

    // Validate analysis is a string
    if (typeof parsed.analysis !== 'string') {
      throw new Error('analysis must be a string');
    }

    return {
      score: parsed.score,
      type: parsed.type,
      indicators: parsed.indicators,
      analysis: parsed.analysis,
    };
  } catch (error) {
    throw new Error(`Failed to parse opportunity score response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Rule-based fallback scoring for when AI service fails
 * @param messageText - The message text to analyze
 * @returns Fallback opportunity score result
 */
function ruleBasedOpportunityScoring(messageText: string): OpportunityScoreResult {
  const text = messageText.toLowerCase();
  let score = 0;
  const indicators: string[] = [];

  // Brand/sponsorship mentions (+40 points)
  const sponsorshipKeywords = ['sponsor', 'brand deal', 'sponsored', 'brand partnership', 'endorsement'];
  if (sponsorshipKeywords.some(kw => text.includes(kw))) {
    score += 40;
    indicators.push('sponsorship keywords');
  }

  // Budget/compensation mentions (+30 points)
  const budgetKeywords = ['$', 'budget', 'payment', 'compensation', 'fee', 'paid', 'rate', 'price'];
  if (budgetKeywords.some(kw => text.includes(kw))) {
    score += 30;
    indicators.push('budget discussion');
  }

  // Partnership/collaboration keywords (+20 points)
  const collabKeywords = ['collaborate', 'collaboration', 'partner', 'partnership', 'work together', 'team up'];
  if (collabKeywords.some(kw => text.includes(kw))) {
    score += 20;
    indicators.push('collaboration proposal');
  }

  // Professionalism (+10 points)
  if (text.length > 100 && !text.includes('!!!')) {
    score += 10;
    indicators.push('professional tone');
  }

  // Determine type based on keywords
  let type: OpportunityType = 'sale';
  if (sponsorshipKeywords.some(kw => text.includes(kw))) {
    type = 'sponsorship';
  } else if (collabKeywords.some(kw => text.includes(kw))) {
    type = 'collaboration';
  } else if (text.includes('partner')) {
    type = 'partnership';
  }

  // Default score: 50 (medium priority) if no indicators found
  if (score === 0) {
    score = 50;
    indicators.push('business inquiry');
  }

  return {
    score: Math.min(score, 100),
    type,
    indicators,
    analysis: `Business opportunity detected (rule-based fallback scoring)`,
  };
}

/**
 * Score a business opportunity message using GPT-4 Turbo with retry logic and fallback
 * Uses GPT-4 Turbo for high-accuracy scoring per Story 5.6 requirements
 *
 * @param messageText - The message text to score
 * @param apiKey - OpenAI API key (ignored - uses OPENAI_API_KEY environment variable)
 * @param retryConfig - Optional retry configuration
 * @returns Promise resolving to opportunity score result
 * @throws {Error} When all retry attempts fail AND fallback fails
 *
 * @example
 * ```typescript
 * const result = await scoreOpportunity(
 *   'Hi, I represent Nike and we would like to sponsor your content for $5000',
 *   process.env.OPENAI_API_KEY!
 * );
 * console.warn(result.score); // 95
 * console.warn(result.type); // 'sponsorship'
 * console.warn(result.indicators); // ['brand sponsorship', 'budget discussion']
 * console.warn(result.analysis); // 'High-value brand sponsorship with clear budget'
 * ```
 */
export async function scoreOpportunity(
  messageText: string,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<OpportunityScoreResult> {
  // Note: API key should be set via OPENAI_API_KEY environment variable
  // This parameter is kept for backward compatibility

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Format prompt with message text
      const prompt = OPPORTUNITY_SCORING_PROMPT.replace('{messageText}', messageText);

      // Call GPT-4 Turbo for high-accuracy opportunity scoring
      // (OpenAI-only, quality model per tech-stack.md and Story 5.6)
      const { text } = await generateText({
        model: openai('gpt-4-turbo'), // Quality model for accurate scoring
        prompt,
        temperature: 0.5, // Moderate temperature for balanced creativity and consistency
      });

      console.warn('[DEBUG] Opportunity scoring GPT-4 Turbo response:', text);

      // Parse and validate response
      const result = parseOpportunityScoreResponse(text);

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      console.warn(`Opportunity scoring attempt ${attempt + 1} failed:`, lastError.message);

      // Don't retry on the last attempt
      if (attempt === retryConfig.maxRetries) {
        break;
      }

      // Calculate and apply exponential backoff delay
      const delay = calculateBackoffDelay(attempt, retryConfig);
      await sleep(delay);
    }
  }

  // All retries failed - fall back to rule-based scoring
  console.warn(
    `Opportunity scoring failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message || 'Unknown error'}. Falling back to rule-based scoring.`
  );

  return ruleBasedOpportunityScoring(messageText);
}
