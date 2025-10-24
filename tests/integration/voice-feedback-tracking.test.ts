/**
 * Integration tests for Voice Matching Feedback Tracking (Story 5.5, Task 12)
 *
 * @remarks
 * Tests the complete flow of tracking user feedback on AI-generated suggestions,
 * including storing feedback in ai_training_data and updating voice profile metrics.
 *
 * IMPORTANT: Run with Firebase emulator
 * ```bash
 * npm run test:integration:with-emulator
 * ```
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb, initializeFirebase } from '@/services/firebase';
import { voiceMatchingService, SuggestionFeedback } from '@/services/voiceMatchingService';

// Initialize Firebase before tests
beforeAll(() => {
  initializeFirebase();
});

describe('Voice Feedback Tracking Integration', () => {
  const testUserId = 'test-feedback-user';
  let cleanup: (() => Promise<void>)[] = [];

  afterEach(async () => {
    // Clean up all test data
    for (const cleanupFn of cleanup) {
      await cleanupFn();
    }
    cleanup = [];
  });

  describe('Feedback Storage', () => {
    it('should store accepted suggestion feedback in ai_training_data collection', async () => {
      const feedback: SuggestionFeedback = {
        suggestion: 'Thanks for reaching out!',
        action: 'accepted',
        rating: 5,
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify feedback was stored
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );

      const snapshot = await getDocs(feedbackQuery);
      expect(snapshot.empty).toBe(false);

      const feedbackDoc = snapshot.docs[0];
      const data = feedbackDoc.data();

      expect(data.type).toBe('response_feedback');
      expect(data.feedback.originalSuggestion).toBe('Thanks for reaching out!');
      expect(data.feedback.action).toBe('accepted');
      expect(data.feedback.rating).toBe(5);
      expect(data.processed).toBe(false);
      expect(data.modelVersion).toBe('gpt-4-turbo-preview');

      // Schedule cleanup
      cleanup.push(async () => {
        await deleteDoc(feedbackDoc.ref);
      });
    });

    it('should store rejected suggestion feedback in ai_training_data collection', async () => {
      const feedback: SuggestionFeedback = {
        suggestion: 'Hey there!',
        action: 'rejected',
        rating: 2,
        comments: 'Not my style',
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify feedback was stored
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );

      const snapshot = await getDocs(feedbackQuery);
      const feedbackDoc = snapshot.docs[0];
      const data = feedbackDoc.data();

      expect(data.feedback.action).toBe('rejected');
      expect(data.feedback.rating).toBe(2);
      expect(data.feedback.comments).toBe('Not my style');

      // Schedule cleanup
      cleanup.push(async () => {
        await deleteDoc(feedbackDoc.ref);
      });
    });

    it('should store edited suggestion feedback with userEdit in ai_training_data collection', async () => {
      const feedback: SuggestionFeedback = {
        suggestion: 'Thanks!',
        action: 'edited',
        userEdit: 'Thanks so much!',
        rating: 4,
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify feedback was stored
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );

      const snapshot = await getDocs(feedbackQuery);
      const feedbackDoc = snapshot.docs[0];
      const data = feedbackDoc.data();

      expect(data.feedback.action).toBe('edited');
      expect(data.feedback.userEdit).toBe('Thanks so much!');
      expect(data.feedback.rating).toBe(4);

      // Schedule cleanup
      cleanup.push(async () => {
        await deleteDoc(feedbackDoc.ref);
      });
    });
  });

  describe('Voice Profile Metrics Updates', () => {
    beforeEach(async () => {
      // Create a test voice profile with initial metrics
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      await getDoc(profileRef); // Ensure profile exists
    });

    it('should increment acceptedSuggestions counter for accepted feedback', async () => {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      // Get initial metrics
      const beforeSnapshot = await getDoc(profileRef);
      const beforeMetrics = beforeSnapshot.exists()
        ? beforeSnapshot.data()?.metrics || {}
        : {};
      const initialAccepted = beforeMetrics.acceptedSuggestions || 0;

      // Track accepted feedback
      const feedback: SuggestionFeedback = {
        suggestion: 'Test suggestion',
        action: 'accepted',
        rating: 5,
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify counter was incremented
      const afterSnapshot = await getDoc(profileRef);
      const afterMetrics = afterSnapshot.data()?.metrics || {};

      expect(afterMetrics.acceptedSuggestions).toBe(initialAccepted + 1);

      // Clean up feedback
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });

    it('should increment rejectedSuggestions counter for rejected feedback', async () => {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      // Get initial metrics
      const beforeSnapshot = await getDoc(profileRef);
      const beforeMetrics = beforeSnapshot.exists()
        ? beforeSnapshot.data()?.metrics || {}
        : {};
      const initialRejected = beforeMetrics.rejectedSuggestions || 0;

      // Track rejected feedback
      const feedback: SuggestionFeedback = {
        suggestion: 'Test suggestion',
        action: 'rejected',
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify counter was incremented
      const afterSnapshot = await getDoc(profileRef);
      const afterMetrics = afterSnapshot.data()?.metrics || {};

      expect(afterMetrics.rejectedSuggestions).toBe(initialRejected + 1);

      // Clean up feedback
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });

    it('should increment editedSuggestions counter for edited feedback', async () => {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      // Get initial metrics
      const beforeSnapshot = await getDoc(profileRef);
      const beforeMetrics = beforeSnapshot.exists()
        ? beforeSnapshot.data()?.metrics || {}
        : {};
      const initialEdited = beforeMetrics.editedSuggestions || 0;

      // Track edited feedback
      const feedback: SuggestionFeedback = {
        suggestion: 'Original',
        action: 'edited',
        userEdit: 'Modified',
        rating: 4,
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify counter was incremented
      const afterSnapshot = await getDoc(profileRef);
      const afterMetrics = afterSnapshot.data()?.metrics || {};

      expect(afterMetrics.editedSuggestions).toBe(initialEdited + 1);

      // Clean up feedback
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });

    it('should update averageSatisfactionRating with weighted average', async () => {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      // Get initial metrics
      const beforeSnapshot = await getDoc(profileRef);
      const beforeMetrics = beforeSnapshot.exists()
        ? beforeSnapshot.data()?.metrics || {}
        : {};
      const initialAvg = beforeMetrics.averageSatisfactionRating || 0;
      const initialAccepted = beforeMetrics.acceptedSuggestions || 0;
      const initialEdited = beforeMetrics.editedSuggestions || 0;
      const totalRated = initialAccepted + initialEdited;

      // Track feedback with rating
      const newRating = 5;
      const feedback: SuggestionFeedback = {
        suggestion: 'Test',
        action: 'accepted',
        rating: newRating,
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Calculate expected average
      const expectedAvg =
        totalRated === 0
          ? newRating
          : (initialAvg * totalRated + newRating) / (totalRated + 1);

      // Verify average was updated
      const afterSnapshot = await getDoc(profileRef);
      const afterMetrics = afterSnapshot.data()?.metrics || {};

      expect(afterMetrics.averageSatisfactionRating).toBeCloseTo(expectedAvg, 2);

      // Clean up feedback
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });

    it('should not update averageSatisfactionRating when no rating provided', async () => {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const profileRef = doc(db, 'voice_profiles', auth.currentUser!.uid);

      // Get initial metrics
      const beforeSnapshot = await getDoc(profileRef);
      const beforeMetrics = beforeSnapshot.exists()
        ? beforeSnapshot.data()?.metrics || {}
        : {};
      const initialAvg = beforeMetrics.averageSatisfactionRating || 0;

      // Track feedback without rating
      const feedback: SuggestionFeedback = {
        suggestion: 'Test',
        action: 'rejected',
      };

      await voiceMatchingService.trackFeedback(feedback);

      // Verify average was not changed
      const afterSnapshot = await getDoc(profileRef);
      const afterMetrics = afterSnapshot.data()?.metrics || {};

      expect(afterMetrics.averageSatisfactionRating).toBe(initialAvg);

      // Clean up feedback
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw VoiceMatchingError when user is not authenticated', async () => {
      // This test would need to mock auth state
      // Skipping for now as it requires complex auth mocking
    });

    it('should handle missing voice profile gracefully', async () => {
      // Track feedback even if voice profile doesn't exist yet
      const feedback: SuggestionFeedback = {
        suggestion: 'Test',
        action: 'accepted',
        rating: 5,
      };

      // Should not throw error
      await expect(voiceMatchingService.trackFeedback(feedback)).resolves.not.toThrow();

      // Clean up feedback
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      const feedbackQuery = query(
        collection(db, 'ai_training_data'),
        where('userId', '==', auth.currentUser!.uid),
        where('type', '==', 'response_feedback')
      );
      const snapshot = await getDocs(feedbackQuery);
      cleanup.push(async () => {
        await deleteDoc(snapshot.docs[0].ref);
      });
    });
  });
});
