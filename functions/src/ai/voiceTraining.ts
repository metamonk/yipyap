/**
 * Voice Profile Training Cloud Function (Story 5.5)
 * @module functions/src/ai/voiceTraining
 *
 * @remarks
 * Generates and updates creator voice profiles from message history.
 * Uses GPT-4 Turbo for voice characteristic analysis.
 * Requires minimum 10 message samples for training (testing threshold - production: 50+).
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

/**
 * Minimum number of messages required to create a voice profile
 * @constant
 * @remarks
 * NOTE: Lowered to 10 for testing purposes. Recommended production value: 50+
 */
const MIN_TRAINING_SAMPLES = 10;

/**
 * Maximum number of messages to analyze for training
 * @constant
 */
const MAX_TRAINING_SAMPLES = 200;

/**
 * GPT-4 Turbo model identifier
 * @constant
 */
const VOICE_ANALYSIS_MODEL = 'gpt-4-turbo-preview';

/**
 * Voice characteristics structure from AI analysis
 * @interface
 */
interface VoiceCharacteristicsResponse {
  tone: string;
  vocabulary: string[];
  sentenceStructure: string;
  punctuationStyle: string;
  emojiUsage: 'none' | 'occasional' | 'frequent';
  writingPatterns?: string;
}

/**
 * Request data for generateVoiceProfile callable function
 * @interface
 */
interface GenerateVoiceProfileRequest {
  /** User ID to generate profile for */
  userId: string;

  /** Minimum samples required (defaults to MIN_TRAINING_SAMPLES) */
  minSamples?: number;
}

/**
 * Response data from generateVoiceProfile callable function
 * @interface
 */
interface GenerateVoiceProfileResponse {
  /** Whether operation succeeded */
  success: boolean;

  /** Generated voice profile data */
  profile?: {
    userId: string;
    characteristics: VoiceCharacteristicsResponse;
    trainingSampleCount: number;
    lastTrainedAt: admin.firestore.FieldValue;
    modelVersion: string;
    metrics: {
      totalSuggestionsGenerated: number;
      acceptedSuggestions: number;
      editedSuggestions: number;
      rejectedSuggestions: number;
      averageSatisfactionRating: number;
    };
  };

  /** Error message if operation failed */
  error?: string;
}

/**
 * Generates or updates a creator's voice profile based on their message history
 *
 * @remarks
 * This Cloud Function analyzes a creator's message history to generate a voice profile
 * that captures their unique communication style. The profile is used to generate
 * voice-matched response suggestions.
 *
 * **Requirements:**
 * - User must be authenticated
 * - User can only generate their own voice profile
 * - Minimum 50 messages required for training
 * - Analyzes last 200 messages maximum
 *
 * **Processing:**
 * 1. Validates authentication and authorization
 * 2. Fetches creator's message history from Firestore
 * 3. Validates sufficient training samples
 * 4. Generates voice profile using GPT-4 Turbo
 * 5. Stores/updates voice profile in Firestore
 *
 * **Error Handling:**
 * - `permission-denied`: Unauthorized access
 * - `failed-precondition`: Insufficient training data
 * - `internal`: AI service failure or database error
 *
 * @param data - Request data containing userId and optional minSamples
 * @param context - Firebase callable function context with auth info
 * @returns Promise resolving to voice profile generation result
 *
 * @example
 * ```typescript
 * // Client-side call
 * const generateVoiceProfile = httpsCallable(functions, 'generateVoiceProfile');
 * const result = await generateVoiceProfile({ userId: 'user123' });
 *
 * if (result.data.success) {
 *   console.log('Voice profile created:', result.data.profile);
 * }
 * ```
 */
export const generateVoiceProfile = functions.https.onCall(
  async (
    data: GenerateVoiceProfileRequest,
    context
  ): Promise<GenerateVoiceProfileResponse> => {
    const startTime = Date.now();
    const { userId, minSamples = MIN_TRAINING_SAMPLES } = data;

    try {
      // Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'User must be authenticated to generate voice profile'
        );
      }

      // Verify authorization (users can only generate their own profile)
      if (context.auth.uid !== userId) {
        throw new functions.https.HttpsError(
          'permission-denied',
          'Users can only generate their own voice profile'
        );
      }

      console.log(`[VoiceTraining] Starting voice profile generation for user ${userId}`);

      // Fetch creator's message history using collectionGroup query
      // This gets all messages sent by the user across all conversations
      const messagesSnapshot = await admin
        .firestore()
        .collectionGroup('messages')
        .where('senderId', '==', userId)
        .orderBy('timestamp', 'desc')
        .limit(MAX_TRAINING_SAMPLES)
        .get();

      console.log(`[VoiceTraining] Found ${messagesSnapshot.size} messages for user ${userId}`);

      // Validate sufficient training data
      if (messagesSnapshot.size < minSamples) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          `Insufficient training data. Need at least ${minSamples} messages, found ${messagesSnapshot.size}. ` +
            `Keep chatting to unlock voice matching!`
        );
      }

      // Extract message texts for analysis
      const messageSamples: string[] = [];
      messagesSnapshot.forEach((doc) => {
        const messageData = doc.data();
        if (messageData.text && typeof messageData.text === 'string') {
          messageSamples.push(messageData.text);
        }
      });

      console.log(`[VoiceTraining] Extracted ${messageSamples.length} message samples`);

      // Generate voice profile using GPT-4 Turbo
      const analysisPrompt = `Analyze the following ${messageSamples.length} messages from a creator and generate a detailed voice profile.

Messages:
${messageSamples.map((msg, i) => `${i + 1}. ${msg}`).join('\n')}

Analyze their communication style and provide a JSON response with the following structure:
{
  "tone": "friendly|professional|casual|enthusiastic|warm|confident|etc",
  "vocabulary": ["array", "of", "common", "words", "phrases", "they", "use"],
  "sentenceStructure": "short|medium|complex",
  "punctuationStyle": "minimal|moderate|expressive",
  "emojiUsage": "none|occasional|frequent",
  "writingPatterns": "Any notable patterns in how they write (optional)"
}

Focus on:
1. Overall tone and emotional style
2. Common words, phrases, and expressions they frequently use
3. Sentence length and complexity patterns
4. How they use punctuation (minimal, lots of exclamation marks, etc.)
5. How often they use emojis
6. Any unique writing patterns or quirks

Return ONLY valid JSON, no additional text.`;

      console.log(`[VoiceTraining] Sending analysis request to GPT-4 Turbo`);

      const { text: aiResponse } = await generateText({
        model: openai(VOICE_ANALYSIS_MODEL),
        prompt: analysisPrompt,
        temperature: 0.3, // Lower temperature for consistent analysis
      });

      console.log(`[VoiceTraining] Received AI response, parsing...`);

      // Parse AI response - extract JSON from potential markdown wrapping
      let voiceCharacteristics: VoiceCharacteristicsResponse;
      try {
        // Remove markdown code blocks if present
        let cleanedResponse = aiResponse.trim();

        // Remove ```json ... ``` or ``` ... ``` wrapping
        const codeBlockMatch = cleanedResponse.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
        if (codeBlockMatch) {
          cleanedResponse = codeBlockMatch[1].trim();
        }

        // Try to extract JSON object if there's surrounding text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }

        console.log(`[VoiceTraining] Cleaned response for parsing: ${cleanedResponse.substring(0, 200)}...`);
        voiceCharacteristics = JSON.parse(cleanedResponse) as VoiceCharacteristicsResponse;
      } catch (parseError) {
        console.error('[VoiceTraining] Failed to parse AI response. Raw response:', aiResponse);
        console.error('[VoiceTraining] Parse error:', parseError);
        throw new functions.https.HttpsError(
          'internal',
          'Failed to parse voice analysis from AI. Please try again.'
        );
      }

      // Validate required fields in AI response
      if (
        !voiceCharacteristics.tone ||
        !Array.isArray(voiceCharacteristics.vocabulary) ||
        !voiceCharacteristics.sentenceStructure ||
        !voiceCharacteristics.punctuationStyle ||
        !voiceCharacteristics.emojiUsage
      ) {
        console.error('[VoiceTraining] Invalid AI response structure:', voiceCharacteristics);
        throw new functions.https.HttpsError(
          'internal',
          'AI returned incomplete voice analysis. Please try again.'
        );
      }

      console.log(`[VoiceTraining] Voice analysis complete:`, voiceCharacteristics);

      // Get existing profile to preserve metrics
      const profileRef = admin.firestore().collection('voice_profiles').doc(userId);
      const existingProfile = await profileRef.get();

      // Prepare voice profile data
      const profileData: any = {
        userId,
        characteristics: voiceCharacteristics,
        trainingSampleCount: messageSamples.length,
        lastTrainedAt: admin.firestore.FieldValue.serverTimestamp(),
        modelVersion: VOICE_ANALYSIS_MODEL,
        metrics: existingProfile.exists && existingProfile.data()?.metrics
          ? existingProfile.data()!.metrics
          : {
              totalSuggestionsGenerated: 0,
              acceptedSuggestions: 0,
              editedSuggestions: 0,
              rejectedSuggestions: 0,
              averageSatisfactionRating: 0,
            },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Add createdAt only for new profiles
      if (!existingProfile.exists) {
        profileData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        console.log(`[VoiceTraining] Creating new voice profile for user ${userId}`);
      } else {
        console.log(`[VoiceTraining] Updating existing voice profile for user ${userId}`);
      }

      // Store voice profile in Firestore
      await profileRef.set(profileData, { merge: true });

      const duration = Date.now() - startTime;
      console.log(
        `[VoiceTraining] Voice profile ${existingProfile.exists ? 'updated' : 'created'} successfully ` +
          `for user ${userId} in ${duration}ms`
      );

      // Return success response
      return {
        success: true,
        profile: profileData,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Re-throw HttpsError instances
      if (error instanceof functions.https.HttpsError) {
        console.error(
          `[VoiceTraining] Voice profile generation failed for user ${userId} ` +
            `after ${duration}ms:`,
          error.message
        );
        throw error;
      }

      // Handle unexpected errors
      console.error(
        `[VoiceTraining] Unexpected error during voice profile generation for user ${userId}:`,
        error
      );

      throw new functions.https.HttpsError(
        'internal',
        `Failed to generate voice profile: ${error.message || 'Unknown error'}. Please try again later.`
      );
    }
  }
);
