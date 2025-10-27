import OpenAI from 'openai';

/**
 * Opportunity types for business opportunity categorization
 */
export type OpportunityType = 'sponsorship' | 'collaboration' | 'partnership' | 'sale';

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
 * Uses OpenAI SDK directly instead of Vercel AI SDK for improved performance
 *
 * @param messageText - The message text to score
 * @param apiKey - OpenAI API key
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
 * console.log(result.score); // 95
 * console.log(result.type); // 'sponsorship'
 * console.log(result.indicators); // ['brand sponsorship', 'budget discussion']
 * console.log(result.analysis); // 'High-value brand sponsorship with clear budget'
 * ```
 */
export async function scoreOpportunity(
  messageText: string,
  apiKey: string,
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<OpportunityScoreResult> {
  const openai = new OpenAI({ apiKey });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Format prompt with message text
      const prompt = OPPORTUNITY_SCORING_PROMPT.replace('{messageText}', messageText);

      // Call GPT-4 Turbo for high-accuracy opportunity scoring
      // (OpenAI-only, quality model per tech-stack.md and Story 5.6)
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5, // Moderate temperature for balanced creativity and consistency
      });

      const text = completion.choices[0]?.message?.content;

      if (!text) {
        throw new Error('No response from OpenAI');
      }

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
