/**
 * Voice-Matched Response Generation Cloud Function (Story 5.5)
 * @module functions/src/ai/voiceMatching
 *
 * @remarks
 * Generates personalized response suggestions that match the creator's communication style.
 * Uses GPT-4 Turbo for high-quality, context-aware suggestions.
 * Target latency: <2 seconds for real-time UX.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * GPT-4 Turbo model for high-quality response generation
 * @constant
 */
const RESPONSE_GENERATION_MODEL = 'gpt-4-turbo-preview';

/**
 * Number of context messages to include in prompt
 * @constant
 */
const CONTEXT_MESSAGE_LIMIT = 5;

/**
 * Timeout for response generation (30 seconds)
 * @constant
 * @remarks
 * Increased from 2s to 30s to accommodate GPT-4 API response times.
 * GPT-4 typically takes 3-10 seconds, with occasional spikes to 15-20s.
 * 30s provides a reasonable buffer while still preventing indefinite hangs.
 */
const GENERATION_TIMEOUT_MS = 30000;

/**
 * Request data for generateResponseSuggestions callable function
 * @interface
 */
interface GenerateResponseSuggestionsRequest {
  /** Conversation ID where the response will be sent */
  conversationId: string;

  /** ID of the incoming message to respond to */
  incomingMessageId: string;

  /** Number of suggestions to generate (1-3, defaults to 2) */
  suggestionCount?: number;
}

/**
 * Response suggestion structure
 * @interface
 */
interface ResponseSuggestion {
  /** The suggested response text */
  text: string;
}

/**
 * Response data from generateResponseSuggestions callable function
 * @interface
 */
interface GenerateResponseSuggestionsResponse {
  /** Whether operation succeeded */
  success: boolean;

  /** Array of response suggestions */
  suggestions?: ResponseSuggestion[];

  /** Generation latency in milliseconds */
  latency?: number;

  /** Error message if operation failed */
  error?: string;
}

/**
 * Generates voice-matched response suggestions for a given message
 *
 * @remarks
 * This Cloud Function analyzes the incoming message and conversation context,
 * then generates 1-3 response suggestions that match the creator's unique voice.
 *
 * **Requirements:**
 * - User must be authenticated
 * - User must have a trained voice profile
 * - Target latency: <2 seconds
 *
 * **Processing:**
 * 1. Validates authentication
 * 2. Fetches user's voice profile
 * 3. Retrieves incoming message and conversation context (last 5 messages)
 * 4. Generates response suggestions using GPT-4 Turbo
 * 5. Updates voice profile metrics
 *
 * **Error Handling:**
 * - `unauthenticated`: User not authenticated
 * - `failed-precondition`: Voice profile not found
 * - `deadline-exceeded`: Generation timeout (>2s)
 * - `internal`: AI service failure or database error
 *
 * @param data - Request data containing conversationId, incomingMessageId, and optional suggestionCount
 * @param context - Firebase callable function context with auth info
 * @returns Promise resolving to response suggestions
 *
 * @example
 * ```typescript
 * // Client-side call
 * const generateResponseSuggestions = httpsCallable(functions, 'generateResponseSuggestions');
 * const result = await generateResponseSuggestions({
 *   conversationId: 'conv123',
 *   incomingMessageId: 'msg456',
 *   suggestionCount: 2
 * });
 *
 * if (result.data.success) {
 *   console.log('Suggestions:', result.data.suggestions);
 * }
 * ```
 */
export const generateResponseSuggestions = functions
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB',
  })
  .https.onCall(
    async (
      data: GenerateResponseSuggestionsRequest,
      context
    ): Promise<GenerateResponseSuggestionsResponse> => {
    const startTime = Date.now();
    const { conversationId, incomingMessageId, suggestionCount = 2 } = data;
    const userId = context.auth?.uid;

    try {
      // Verify authentication
      if (!userId) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to generate response suggestions'
        );
      }

      console.log(
        `[VoiceMatching] Generating ${suggestionCount} response suggestions for user ${userId} in conversation ${conversationId}`
      );

      // Validate suggestion count
      const validSuggestionCount = Math.min(Math.max(1, suggestionCount), 3);
      if (validSuggestionCount !== suggestionCount) {
        console.warn(
          `[VoiceMatching] Suggestion count adjusted from ${suggestionCount} to ${validSuggestionCount}`
        );
      }

      // Fetch user's voice profile
      const profileDoc = await admin
        .firestore()
        .collection('voice_profiles')
        .doc(userId)
        .get();

      if (!profileDoc.exists) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Voice profile not found. Please train your voice profile first by going to Settings > Voice Matching.'
        );
      }

      const voiceProfile = profileDoc.data();
      console.log(`[VoiceMatching] Voice profile loaded for user ${userId}`);

      // Get incoming message
      const messageDoc = await admin
        .firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(incomingMessageId)
        .get();

      if (!messageDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Incoming message not found'
        );
      }

      const incomingMessage = messageDoc.data();

      // Get conversation context (last 5 messages)
      const contextSnapshot = await admin
        .firestore()
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .orderBy('timestamp', 'desc')
        .limit(CONTEXT_MESSAGE_LIMIT)
        .get();

      // Build conversation context string
      const contextMessages: string[] = [];
      contextSnapshot.docs.reverse().forEach((doc) => {
        const msg = doc.data();
        const sender = msg.senderId === userId ? 'You' : 'Them';
        contextMessages.push(`${sender}: ${msg.text}`);
      });

      const conversationContext = contextMessages.join('\n');

      console.log(
        `[VoiceMatching] Context loaded: ${contextSnapshot.size} messages`
      );

      // Get conversation metadata for additional context
      const conversationDoc = await admin
        .firestore()
        .collection('conversations')
        .doc(conversationId)
        .get();

      const conversationType = conversationDoc.data()?.type || 'direct';

      // Extract message metadata for context-aware generation (Task 14, Subtask 14.3)
      const messageMetadata = incomingMessage!.metadata || {};
      const messageCategory = messageMetadata.category || 'general';
      const messageSentiment = messageMetadata.sentiment || 'neutral';
      const emotionalTone = messageMetadata.emotionalTone || [];
      const isFAQ = messageMetadata.isFAQ || false;

      console.log(
        `[VoiceMatching] Message context: category=${messageCategory}, sentiment=${messageSentiment}, isFAQ=${isFAQ}`
      );

      // Build context-aware description for the AI prompt
      let contextDescription = '';

      // Conversation type context
      if (conversationType === 'group') {
        contextDescription += 'This is a group conversation, so responses should be suitable for multiple participants. ';
      } else {
        contextDescription += 'This is a direct 1:1 conversation, so responses can be more personal and direct. ';
      }

      // Category context
      if (messageCategory === 'business_opportunity') {
        contextDescription += 'The message appears to be a business opportunity, so maintain a professional and business-focused tone. ';
      } else if (messageCategory === 'urgent') {
        contextDescription += 'The message is marked as urgent, so respond promptly and address the urgency. ';
      } else if (messageCategory === 'fan_engagement') {
        contextDescription += 'The message is from a fan, so be warm, appreciative, and engaging. ';
      } else if (messageCategory === 'spam') {
        contextDescription += 'The message might be spam, so keep the response brief and professional. ';
      }

      // Sentiment context
      if (messageSentiment === 'negative') {
        contextDescription += 'The message has a negative sentiment, so be empathetic, understanding, and focus on problem-solving. ';
      } else if (messageSentiment === 'positive') {
        contextDescription += 'The message has a positive sentiment, so match the enthusiasm and positivity. ';
      } else if (messageSentiment === 'mixed') {
        contextDescription += 'The message has mixed emotions, so acknowledge different aspects appropriately. ';
      }

      // FAQ context
      if (isFAQ) {
        contextDescription += 'This appears to be a frequently asked question, so the response can be clear and informative. ';
      }

      // Build AI prompt with voice profile and context
      const prompt = `You are helping a creator respond to a message in their authentic voice.

**Creator's Voice Profile:**
- Tone: ${voiceProfile!.characteristics.tone}
- Sentence Structure: ${voiceProfile!.characteristics.sentenceStructure}
- Punctuation Style: ${voiceProfile!.characteristics.punctuationStyle}
- Emoji Usage: ${voiceProfile!.characteristics.emojiUsage}
- Common Vocabulary: ${voiceProfile!.characteristics.vocabulary.slice(0, 10).join(', ')}
${voiceProfile!.characteristics.writingPatterns ? `- Writing Patterns: ${voiceProfile!.characteristics.writingPatterns}` : ''}

**Conversation Type:** ${conversationType === 'group' ? 'Group chat with multiple participants' : 'Direct 1:1 message'}

**Message Context:**
- Category: ${messageCategory}
- Sentiment: ${messageSentiment}
${emotionalTone.length > 0 ? `- Emotional Tone: ${emotionalTone.join(', ')}` : ''}
${isFAQ ? '- This appears to be a frequently asked question' : ''}

**Context Guidance:**
${contextDescription}

**Conversation History:**
${conversationContext}

**Latest Message to Respond To:**
${incomingMessage!.text}

**Task:** Generate ${validSuggestionCount} response suggestion${validSuggestionCount > 1 ? 's' : ''} that match the creator's voice profile. Each response should:
1. Sound natural and authentic to the creator's communication style
2. Be contextually appropriate for a ${conversationType} conversation
3. Address the ${messageCategory} nature of the message appropriately
4. Respond to the ${messageSentiment} sentiment with appropriate empathy and tone
5. Match the voice profile's tone, vocabulary, and sentence structure patterns
6. Use emojis according to their usage preference (${voiceProfile!.characteristics.emojiUsage})
7. Be concise and ready to send (no explanations or meta-commentary)
8. Vary slightly in tone/length if generating multiple suggestions

Return ONLY a valid JSON array (no additional text):
[
${Array.from({ length: validSuggestionCount }, (_, i) => `  { "text": "Response ${i + 1} here" }`).join(',\n')}
]`;

      console.log(`[VoiceMatching] Sending request to GPT-4 Turbo`);

      // Generate response suggestions with timeout
      const generationPromise = generateText({
        model: openai(RESPONSE_GENERATION_MODEL),
        prompt,
        temperature: 0.7, // Higher temperature for creative variety
      });

      // Implement timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('Response generation timeout'));
        }, GENERATION_TIMEOUT_MS);
      });

      let aiResponse: string;
      try {
        const { text } = await Promise.race([
          generationPromise,
          timeoutPromise,
        ]);
        aiResponse = text;
      } catch (error: any) {
        if (error.message === 'Response generation timeout') {
          console.error(
            `[VoiceMatching] Generation timeout (>${GENERATION_TIMEOUT_MS}ms) for user ${userId}`
          );
          throw new functions.https.HttpsError(
            'deadline-exceeded',
            'Response generation took too long. Please try again.'
          );
        }
        throw error;
      }

      const generationLatency = Date.now() - startTime;
      console.log(
        `[VoiceMatching] AI response received in ${generationLatency}ms`
      );

      // Parse AI response - extract JSON from potential markdown wrapping
      let suggestions: ResponseSuggestion[];
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = aiResponse.trim();

        // Remove ```json ... ``` or ``` ... ``` wrapping
        const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          cleanedResponse = codeBlockMatch[1].trim();
        }

        // Try to extract JSON array if there's surrounding text
        const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        console.log(`[VoiceMatching] Cleaned response for parsing: ${cleanedResponse.substring(0, 200)}...`);
        suggestions = JSON.parse(cleanedResponse) as ResponseSuggestion[];

        // Validate response structure
        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          throw new Error('Invalid response structure');
        }

        // Validate each suggestion has text
        for (const suggestion of suggestions) {
          if (!suggestion.text || typeof suggestion.text !== 'string') {
            throw new Error('Invalid suggestion structure');
          }
        }
      } catch (parseError) {
        console.error('[VoiceMatching] Failed to parse AI response. Raw response:', aiResponse);
        console.error('[VoiceMatching] Parse error:', parseError);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to parse response suggestions. Please try again.'
        );
      }

      // Update voice profile metrics
      await profileDoc.ref.update({
        'metrics.totalSuggestionsGenerated':
          admin.firestore.FieldValue.increment(suggestions.length),
      });

      const totalLatency = Date.now() - startTime;
      console.log(
        `[VoiceMatching] Successfully generated ${suggestions.length} suggestions for user ${userId} in ${totalLatency}ms`
      );

      // Return response suggestions
      return {
        success: true,
        suggestions,
        latency: totalLatency,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Re-throw HttpsError instances
      if (error instanceof functions.https.HttpsError) {
        console.error(
          `[VoiceMatching] Response generation failed for user ${userId} ` +
            `after ${duration}ms:`,
          error.message
        );
        throw error;
      }

      // Handle unexpected errors
      console.error(
        `[VoiceMatching] Unexpected error during response generation for user ${userId}:`,
        error
      );

      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate response suggestions: ${error.message || 'Unknown error'}. Please try again.`
      );
    }
  }
);
