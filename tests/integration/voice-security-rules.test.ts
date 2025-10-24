/**
 * Security Rules Tests for Voice Matching Feature (Story 5.5)
 *
 * @remarks
 * Tests Firestore security rules for voice_profiles and ai_training_data collections.
 * Ensures only authenticated users can access their own data.
 *
 * @group integration
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp, setDoc, getDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';

let testEnv: RulesTestEnvironment;

const USER_ID_1 = 'user123';
const USER_ID_2 = 'user456';

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'voice-matching-rules-test',
    firestore: {
      rules: readFileSync('firebase/firestore.rules', 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe('Voice Profiles Security Rules', () => {
  describe('Read Access', () => {
    test('should allow users to read their own voice profile', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      // Seed data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'voice_profiles', USER_ID_1), {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome', 'definitely'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 50,
            acceptedSuggestions: 35,
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 4.5,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Try to read own profile
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertSucceeds(getDoc(profileRef));
    });

    test('should deny users from reading other users voice profiles', async () => {
      const context = testEnv.authenticatedContext(USER_ID_2);

      // Seed data for USER_ID_1
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'voice_profiles', USER_ID_1), {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 50,
            acceptedSuggestions: 35,
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 4.5,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // USER_ID_2 tries to read USER_ID_1's profile
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertFails(getDoc(profileRef));
    });

    test('should deny unauthenticated users from reading voice profiles', async () => {
      const context = testEnv.unauthenticatedContext();

      // Seed data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'voice_profiles', USER_ID_1), {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 0,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 0,
            averageSatisfactionRating: 0,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Unauthenticated user tries to read profile
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertFails(getDoc(profileRef));
    });
  });

  describe('Write Access', () => {
    test('should allow users to create their own voice profile', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertSucceeds(
        setDoc(profileRef, {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome', 'definitely'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 0,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 0,
            averageSatisfactionRating: 0,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    test('should deny users from creating voice profiles for other users', async () => {
      const context = testEnv.authenticatedContext(USER_ID_2);

      // USER_ID_2 tries to create profile for USER_ID_1
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertFails(
        setDoc(profileRef, {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 0,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 0,
            averageSatisfactionRating: 0,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    test('should allow users to update their own voice profile', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      // Seed data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'voice_profiles', USER_ID_1), {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 50,
            acceptedSuggestions: 35,
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 4.5,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // Update metrics
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertSucceeds(
        updateDoc(profileRef, {
          'metrics.totalSuggestionsGenerated': 55,
          'metrics.acceptedSuggestions': 40,
          updatedAt: serverTimestamp(),
        })
      );
    });

    test('should deny users from updating other users voice profiles', async () => {
      const context = testEnv.authenticatedContext(USER_ID_2);

      // Seed data for USER_ID_1
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'voice_profiles', USER_ID_1), {
          userId: USER_ID_1,
          characteristics: {
            tone: 'friendly',
            vocabulary: ['awesome'],
            sentenceStructure: 'short',
            punctuationStyle: 'minimal',
            emojiUsage: 'occasional',
          },
          trainingSampleCount: 100,
          lastTrainedAt: serverTimestamp(),
          modelVersion: 'gpt-4-turbo-preview',
          metrics: {
            totalSuggestionsGenerated: 50,
            acceptedSuggestions: 35,
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 4.5,
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      // USER_ID_2 tries to update USER_ID_1's profile
      const profileRef = doc(context.firestore(), 'voice_profiles', USER_ID_1);
      await assertFails(
        updateDoc(profileRef, {
          'metrics.totalSuggestionsGenerated': 60,
        })
      );
    });
  });
});

describe('AI Training Data Security Rules', () => {
  describe('Read Access', () => {
    test('should allow users to read their own training data', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      // Seed data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ai_training_data', 'training123'), {
          userId: USER_ID_1,
          type: 'response_feedback',
          feedback: {
            originalSuggestion: 'Thanks for reaching out!',
            userEdit: 'Thanks so much for reaching out!',
            rating: 4,
          },
          modelVersion: 'gpt-4-turbo-preview',
          processed: false,
          createdAt: serverTimestamp(),
        });
      });

      // Try to read own training data
      const trainingRef = doc(context.firestore(), 'ai_training_data', 'training123');
      await assertSucceeds(getDoc(trainingRef));
    });

    test('should deny users from reading other users training data', async () => {
      const context = testEnv.authenticatedContext(USER_ID_2);

      // Seed data for USER_ID_1
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ai_training_data', 'training123'), {
          userId: USER_ID_1,
          type: 'response_feedback',
          feedback: {
            originalSuggestion: 'Thanks!',
            rating: 5,
          },
          modelVersion: 'gpt-4-turbo-preview',
          processed: false,
          createdAt: serverTimestamp(),
        });
      });

      // USER_ID_2 tries to read USER_ID_1's training data
      const trainingRef = doc(context.firestore(), 'ai_training_data', 'training123');
      await assertFails(getDoc(trainingRef));
    });
  });

  describe('Write Access', () => {
    test('should allow users to create their own training data', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      const trainingRef = doc(context.firestore(), 'ai_training_data', 'training123');
      await assertSucceeds(
        setDoc(trainingRef, {
          userId: USER_ID_1,
          type: 'response_feedback',
          feedback: {
            originalSuggestion: 'Thanks for reaching out!',
            userEdit: 'Thanks so much!',
            rating: 4,
          },
          modelVersion: 'gpt-4-turbo-preview',
          processed: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    test('should deny users from creating training data for other users', async () => {
      const context = testEnv.authenticatedContext(USER_ID_2);

      // USER_ID_2 tries to create training data for USER_ID_1
      const trainingRef = doc(context.firestore(), 'ai_training_data', 'training123');
      await assertFails(
        setDoc(trainingRef, {
          userId: USER_ID_1,
          type: 'response_feedback',
          feedback: {
            originalSuggestion: 'Thanks!',
            rating: 5,
          },
          modelVersion: 'gpt-4-turbo-preview',
          processed: false,
          createdAt: serverTimestamp(),
        })
      );
    });

    test('should allow users to update their own training data', async () => {
      const context = testEnv.authenticatedContext(USER_ID_1);

      // Seed data
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), 'ai_training_data', 'training123'), {
          userId: USER_ID_1,
          type: 'response_feedback',
          feedback: {
            originalSuggestion: 'Thanks!',
            rating: 4,
          },
          modelVersion: 'gpt-4-turbo-preview',
          processed: false,
          createdAt: serverTimestamp(),
        });
      });

      // Mark as processed
      const trainingRef = doc(context.firestore(), 'ai_training_data', 'training123');
      await assertSucceeds(
        updateDoc(trainingRef, {
          processed: true,
          processedAt: serverTimestamp(),
        })
      );
    });
  });
});
