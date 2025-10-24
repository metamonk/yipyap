import { categorizeMessage, scoreOpportunity, type MessageCategory, type OpportunityType } from './utils/aiClient';
import { createRateLimiter, type RateLimitResult } from './utils/rateLimiter';

/**
 * Edge Runtime configuration
 */
export const config = {
  runtime: 'edge',
};

/**
 * Request body for categorization endpoint
 */
interface CategorizationRequest {
  messageId: string;
  messageText: string;
  conversationId: string;
  senderId: string;
}

/**
 * Response body for successful categorization, sentiment analysis, and opportunity scoring
 */
interface CategorizationResponse {
  success: boolean;

  // Categorization fields
  category: MessageCategory;
  confidence: number;

  // Sentiment analysis fields
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  emotionalTone: string[];
  crisisDetected: boolean;

  // Opportunity scoring fields (Story 5.6)
  opportunityScore?: number;
  opportunityType?: OpportunityType;
  opportunityIndicators?: string[];
  opportunityAnalysis?: string;

  // Metadata
  latency: number;
  model: string;
  error?: string;
}

/**
 * Error response body
 */
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
}

/**
 * Validate request body has all required fields
 * @param body - Request body to validate
 * @returns True if valid, error message if invalid
 */
function validateRequestBody(body: any): body is CategorizationRequest {
  const requiredFields = ['messageId', 'messageText', 'conversationId', 'senderId'];

  for (const field of requiredFields) {
    if (!body[field] || typeof body[field] !== 'string') {
      return false;
    }
  }

  // Validate message text is not empty and within reasonable length
  if (body.messageText.trim().length === 0) {
    return false;
  }

  if (body.messageText.length > 10000) {
    return false;
  }

  return true;
}

/**
 * Extract user ID from Authorization header
 * @param request - HTTP request
 * @returns User ID or null if not authenticated
 */
function extractUserId(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  // In production, you would verify the JWT token and extract user ID
  // For now, we'll use a simplified approach where the token itself is the user ID
  // TODO: Implement proper JWT verification with Firebase Admin SDK
  const token = parts[1];

  if (!token || token.length === 0) {
    return null;
  }

  // For MVP: Use senderId from request body (already authenticated by client)
  // This will be replaced with proper JWT verification in production
  return token;
}

/**
 * Create error response with appropriate status code
 * @param status - HTTP status code
 * @param code - Error code
 * @param message - Error message
 * @returns Response object
 */
function createErrorResponse(
  status: number,
  code: string,
  message: string
): Response {
  const body: ErrorResponse = {
    success: false,
    error: message,
    code,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create rate limit exceeded response with retry information
 * @param rateLimitResult - Rate limit result
 * @returns Response object
 */
function createRateLimitResponse(rateLimitResult: RateLimitResult): Response {
  const body: ErrorResponse = {
    success: false,
    error: 'Rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED',
  };

  return new Response(JSON.stringify(body), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'X-RateLimit-Limit': rateLimitResult.limit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
      'Retry-After': Math.ceil(
        (rateLimitResult.resetAt * 1000 - Date.now()) / 1000
      ).toString(),
    },
  });
}

/**
 * Main Edge Function handler for message categorization and sentiment analysis
 *
 * POST /api/categorize-message
 *
 * Request body:
 * {
 *   messageId: string;
 *   messageText: string;
 *   conversationId: string;
 *   senderId: string;
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   category: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
 *   confidence: number;
 *   sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
 *   sentimentScore: number;
 *   emotionalTone: string[];
 *   crisisDetected: boolean;
 *   latency: number;
 *   model: string;
 * }
 *
 * @param request - HTTP request
 * @returns HTTP response
 */
export default async function handler(request: Request): Promise<Response> {
  const startTime = Date.now();

  // CORS headers for client requests
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return createErrorResponse(
      405,
      'METHOD_NOT_ALLOWED',
      'Only POST requests are allowed'
    );
  }

  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return createErrorResponse(
        400,
        'INVALID_JSON',
        'Request body must be valid JSON'
      );
    }

    // Validate request body
    if (!validateRequestBody(body)) {
      return createErrorResponse(
        400,
        'INVALID_REQUEST',
        'Missing or invalid required fields: messageId, messageText, conversationId, senderId'
      );
    }

    const { messageId, messageText, conversationId, senderId } = body;

    // Extract and validate user authentication
    const userId = extractUserId(request);
    if (!userId) {
      return createErrorResponse(
        401,
        'UNAUTHORIZED',
        'Missing or invalid Authorization header'
      );
    }

    // Check rate limit
    let rateLimiter;
    try {
      rateLimiter = createRateLimiter();
    } catch (error) {
      console.error('Failed to initialize rate limiter:', error);
      // Continue without rate limiting if Redis is unavailable
    }

    if (rateLimiter) {
      const rateLimitResult = await rateLimiter.checkLimit(senderId);
      if (!rateLimitResult.allowed) {
        console.log(`Rate limit exceeded for user ${senderId}`);
        return createRateLimitResponse(rateLimitResult);
      }
    }

    // Get API key from environment (OpenAI per tech-stack.md)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return createErrorResponse(
        500,
        'CONFIGURATION_ERROR',
        'AI service not configured'
      );
    }

    // Log request for monitoring
    console.log('Categorization and sentiment analysis request:', {
      messageId,
      conversationId,
      senderId,
      textLength: messageText.length,
      timestamp: new Date().toISOString(),
    });

    // Call AI client for combined categorization and sentiment analysis
    const result = await categorizeMessage(messageText, apiKey);

    // Step 2: If business_opportunity category, run detailed opportunity scoring (Story 5.6)
    let opportunityScore: number | undefined;
    let opportunityType: OpportunityType | undefined;
    let opportunityIndicators: string[] | undefined;
    let opportunityAnalysis: string | undefined;

    if (result.category === 'business_opportunity') {
      try {
        console.log('Business opportunity detected, initiating scoring with GPT-4 Turbo');
        const opportunityResult = await scoreOpportunity(messageText, apiKey);

        opportunityScore = opportunityResult.score;
        opportunityType = opportunityResult.type;
        opportunityIndicators = opportunityResult.indicators;
        opportunityAnalysis = opportunityResult.analysis;

        console.log('Opportunity scoring result:', {
          score: opportunityScore,
          type: opportunityType,
          indicators: opportunityIndicators,
          analysis: opportunityAnalysis,
        });
      } catch (error) {
        // Log error but don't fail the request - opportunity scoring is optional enhancement
        console.error('Opportunity scoring failed:', error);
        // Fallback will have already been applied by scoreOpportunity function
      }
    }

    // Calculate latency
    const latency = Date.now() - startTime;

    // Log response for monitoring
    console.log('Categorization, sentiment, and opportunity response:', {
      messageId,
      category: result.category,
      confidence: result.confidence,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      crisisDetected: result.crisisDetected,
      opportunityScore,
      opportunityType,
      latency,
      timestamp: new Date().toISOString(),
    });

    // Build response with categorization, sentiment, and opportunity data
    const response: CategorizationResponse = {
      success: true,
      category: result.category,
      confidence: result.confidence,
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
      emotionalTone: result.emotionalTone,
      crisisDetected: result.crisisDetected,
      opportunityScore,
      opportunityType,
      opportunityIndicators,
      opportunityAnalysis,
      latency,
      model: 'gpt-4o-mini' + (opportunityScore ? ' + gpt-4-turbo' : ''),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  } catch (error) {
    // Log error for monitoring
    console.error('Categorization error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Check if it's a timeout or AI service error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('timeout') || errorMessage.includes('Categorization failed')) {
      return createErrorResponse(
        503,
        'SERVICE_UNAVAILABLE',
        'AI service temporarily unavailable. Please try again.'
      );
    }

    // Generic error response
    return createErrorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred'
    );
  }
}
