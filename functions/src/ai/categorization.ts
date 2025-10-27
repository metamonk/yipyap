import OpenAI from 'openai';

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
 * Uses OpenAI SDK directly instead of Vercel AI SDK for improved performance
 *
 * @param messageText - The message text to analyze
 * @param apiKey - OpenAI API key
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
 * console.log(result.category); // 'fan_engagement'
 * console.log(result.confidence); // 0.95
 * console.log(result.sentiment); // 'positive'
 * console.log(result.sentimentScore); // 0.85
 * console.log(result.emotionalTone); // ['excited', 'grateful']
 * console.log(result.crisisDetected); // false
 * ```
 */
export async function categorizeMessage(
  messageText: string,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<CategorizationResult> {
  const openai = new OpenAI({ apiKey });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Format prompt with message text
      const prompt = CATEGORIZATION_SENTIMENT_PROMPT.replace('{messageText}', messageText);

      // Call GPT-4o-mini for combined categorization + sentiment analysis
      // (OpenAI-only per tech-stack.md)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent analysis
      });

      const text = completion.choices[0]?.message?.content;

      if (!text) {
        throw new Error('No response from OpenAI');
      }

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
