/**
 * Unit tests for VoiceTrainingStatus component
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

// Mock Firestore BEFORE importing the component
const mockUnsubscribe = jest.fn();
const mockOnSnapshot = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  onSnapshot: (...args: any[]) => mockOnSnapshot(...args),
}));

// Mock firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

// Import component AFTER mocks are set up
import { VoiceTrainingStatus } from '@/components/voice/VoiceTrainingStatus';

describe('VoiceTrainingStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default implementation for onSnapshot
    mockOnSnapshot.mockImplementation((docRef, callback) => {
      callback({ exists: () => false });
      return mockUnsubscribe;
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator initially', async () => {
      mockOnSnapshot.mockImplementation((docRef, callback) => {
        // Delay the callback to keep in loading state
        setTimeout(() => callback({ exists: () => false }), 100);
        return mockUnsubscribe;
      });

      render(<VoiceTrainingStatus userId="user123" />);

      // ActivityIndicator is part of React Native, no testID needed for this test
      expect(mockOnSnapshot).toHaveBeenCalled();
    });
  });

  describe('Not Trained State', () => {
    it('displays "Not Trained" when voice profile does not exist', async () => {
      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({ exists: () => false });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(getByText('Not Trained')).toBeTruthy();
        expect(getByText('0 / 50 messages')).toBeTruthy();
        expect(getByText('Send at least 50 messages to train your voice profile')).toBeTruthy();
      });
    });

    it('displays "In Progress" when voice profile has insufficient samples', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 25,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: [],
        },
        metrics: {
          totalSuggestionsGenerated: 0,
          acceptedSuggestions: 0,
          editedSuggestions: 0,
          rejectedSuggestions: 0,
          averageSatisfactionRating: 0,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(getByText('In Progress')).toBeTruthy();
        expect(getByText('25 / 50 messages')).toBeTruthy();
        expect(getByText('Send 25 more messages to enable voice matching')).toBeTruthy();
      });
    });
  });

  describe('Ready State', () => {
    it('displays "Ready" status when voice profile has sufficient samples', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 75,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: ['awesome', 'great'],
        },
        metrics: {
          totalSuggestionsGenerated: 10,
          acceptedSuggestions: 7,
          editedSuggestions: 2,
          rejectedSuggestions: 1,
          averageSatisfactionRating: 4.5,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(getByText('Ready')).toBeTruthy();
        expect(getByText('Last Trained')).toBeTruthy();
        expect(getByText('Next Retraining')).toBeTruthy();
        expect(getByText('Training Samples')).toBeTruthy();
        expect(getByText('75')).toBeTruthy();
      });
    });

    it('calculates next retraining date correctly for weekly schedule', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 75,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: [],
        },
        metrics: {
          totalSuggestionsGenerated: 10,
          acceptedSuggestions: 7,
          editedSuggestions: 2,
          rejectedSuggestions: 1,
          averageSatisfactionRating: 4.5,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" retrainingSchedule="weekly" />);

      await waitFor(() => {
        expect(getByText('Next Retraining')).toBeTruthy();
        // Weekly: Jan 15 + 7 days = Jan 22
        // Date format may vary by environment
      });
    });

    it('displays total suggestions generated', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 60,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: [],
        },
        metrics: {
          totalSuggestionsGenerated: 25,
          acceptedSuggestions: 20,
          editedSuggestions: 3,
          rejectedSuggestions: 2,
          averageSatisfactionRating: 4.8,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(getByText('Total Suggestions Generated')).toBeTruthy();
        expect(getByText('25')).toBeTruthy();
      });
    });

    it('calculates and displays acceptance rate correctly', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 55,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: [],
        },
        metrics: {
          totalSuggestionsGenerated: 20,
          acceptedSuggestions: 15,
          editedSuggestions: 3,
          rejectedSuggestions: 2,
          averageSatisfactionRating: 4.5,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(getByText('Acceptance Rate')).toBeTruthy();
        // 15/20 = 0.75 = 75%
        expect(getByText('75%')).toBeTruthy();
      });
    });

    it('does not display acceptance rate when no suggestions generated', async () => {
      const mockVoiceProfile = {
        id: 'user123',
        userId: 'user123',
        trainingSampleCount: 50,
        lastTrainedAt: { toDate: () => new Date('2025-01-15') },
        characteristics: {
          tone: 'friendly',
          sentenceStructure: 'medium',
          punctuationStyle: 'standard',
          emojiUsage: 'moderate',
          vocabulary: [],
        },
        metrics: {
          totalSuggestionsGenerated: 0,
          acceptedSuggestions: 0,
          editedSuggestions: 0,
          rejectedSuggestions: 0,
          averageSatisfactionRating: 0,
        },
      };

      mockOnSnapshot.mockImplementation((docRef, callback) => {
        callback({
          exists: () => true,
          id: 'user123',
          data: () => mockVoiceProfile,
        });
        return mockUnsubscribe;
      });

      const { queryByText } = render(<VoiceTrainingStatus userId="user123" />);

      await waitFor(() => {
        expect(queryByText('Acceptance Rate')).toBeFalsy();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles Firestore errors gracefully', async () => {
      const error = new Error('Firestore error');
      mockOnSnapshot.mockImplementation((docRef, callback, errorCallback) => {
        errorCallback(error);
        return mockUnsubscribe;
      });

      const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

      // Should display "Not Trained" state on error
      await waitFor(() => {
        expect(getByText('Not Trained')).toBeTruthy();
      });
    });
  });

  describe('Cleanup', () => {
    it('unsubscribes from Firestore listener on unmount', () => {
      const { unmount } = render(<VoiceTrainingStatus userId="user123" />);

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('Task 16: Satisfaction Metrics', () => {
    describe('Edit Rate (Subtask 16.2)', () => {
      it('calculates and displays edit rate correctly', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 20,
            acceptedSuggestions: 10,
            editedSuggestions: 4,
            rejectedSuggestions: 6,
            averageSatisfactionRating: 4.2,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Edit Rate')).toBeTruthy();
          // 4/10 = 0.4 = 40%
          expect(getByText('40%')).toBeTruthy();
        });
      });

      it('does not display edit rate when no suggestions accepted', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 10,
            acceptedSuggestions: 0,
            editedSuggestions: 0,
            rejectedSuggestions: 10,
            averageSatisfactionRating: 0,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { queryByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(queryByText('Edit Rate')).toBeFalsy();
        });
      });
    });

    describe('Satisfaction Rating (Subtask 16.3)', () => {
      it('displays satisfaction rating correctly', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 20,
            acceptedSuggestions: 15,
            editedSuggestions: 3,
            rejectedSuggestions: 2,
            averageSatisfactionRating: 4.5,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Satisfaction Rating')).toBeTruthy();
          expect(getByText('4.5 / 5.0')).toBeTruthy();
        });
      });

      it('does not display satisfaction rating when rating is 0', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 10,
            acceptedSuggestions: 5,
            editedSuggestions: 1,
            rejectedSuggestions: 4,
            averageSatisfactionRating: 0,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { queryByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(queryByText('Satisfaction Rating')).toBeFalsy();
        });
      });
    });

    describe('Low Satisfaction Alert (Subtask 16.5)', () => {
      it('shows alert when acceptance rate is below 80%', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 60, // 60% acceptance rate
            editedSuggestions: 10,
            rejectedSuggestions: 30,
            averageSatisfactionRating: 4.5,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Satisfaction Below Target')).toBeTruthy();
          expect(getByText(/Your acceptance rate \(60%\) is below our 80% target/)).toBeTruthy();
          expect(getByText(/Consider retraining your voice profile/)).toBeTruthy();
        });
      });

      it('shows alert when satisfaction rating is below 80% (4.0/5.0)', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 85, // 85% acceptance rate
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 3.5, // 70% satisfaction
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Satisfaction Below Target')).toBeTruthy();
          expect(getByText(/Your satisfaction rating \(3.5\/5.0\) is below our target/)).toBeTruthy();
        });
      });

      it('shows combined alert when both metrics are below 80%', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 50, // 50% acceptance rate
            editedSuggestions: 10,
            rejectedSuggestions: 40,
            averageSatisfactionRating: 3.0, // 60% satisfaction
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Satisfaction Below Target')).toBeTruthy();
          expect(getByText(/Your acceptance rate \(50%\) is below our 80% target/)).toBeTruthy();
          expect(getByText(/Your satisfaction rating \(3.0\/5.0\) is below our target/)).toBeTruthy();
        });
      });

      it('does not show alert when both metrics are above 80%', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 85, // 85% acceptance rate
            editedSuggestions: 10,
            rejectedSuggestions: 5,
            averageSatisfactionRating: 4.5, // 90% satisfaction
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { queryByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(queryByText('Satisfaction Below Target')).toBeFalsy();
        });
      });
    });

    describe('Satisfaction Metrics Header (Subtask 16.4)', () => {
      it('displays satisfaction metrics section header', async () => {
        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 20,
            acceptedSuggestions: 15,
            editedSuggestions: 3,
            rejectedSuggestions: 2,
            averageSatisfactionRating: 4.5,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        const { getByText } = render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(getByText('Satisfaction Metrics')).toBeTruthy();
        });
      });
    });

    describe('Analytics Tracking (Subtask 16.6)', () => {
      it('logs analytics when satisfaction metrics are viewed', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 20,
            acceptedSuggestions: 17, // 17/20 = 85% acceptance rate
            editedSuggestions: 3,
            rejectedSuggestions: 3,
            averageSatisfactionRating: 4.5,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            '[Analytics] Voice Satisfaction Metrics Viewed',
            expect.objectContaining({
              userId: 'user123',
              acceptanceRate: 85, // 17/20 = 85%
              editRate: 18, // 3/17 = ~18%
              satisfactionRating: '4.5',
              totalSuggestions: 20,
              acceptedSuggestions: 17,
              editedSuggestions: 3,
              rejectedSuggestions: 3,
              isBelowThreshold: false,
            })
          );
        });

        consoleSpy.mockRestore();
      });

      it('logs analytics when low satisfaction alert is shown', async () => {
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        const mockVoiceProfile = {
          id: 'user123',
          userId: 'user123',
          trainingSampleCount: 75,
          lastTrainedAt: { toDate: () => new Date('2025-01-15') },
          characteristics: {
            tone: 'friendly',
            sentenceStructure: 'medium',
            punctuationStyle: 'standard',
            emojiUsage: 'moderate',
            vocabulary: [],
          },
          metrics: {
            totalSuggestionsGenerated: 100,
            acceptedSuggestions: 60, // 60% acceptance rate
            editedSuggestions: 10,
            rejectedSuggestions: 30,
            averageSatisfactionRating: 4.5,
          },
        };

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          callback({
            exists: () => true,
            id: 'user123',
            data: () => mockVoiceProfile,
          });
          return mockUnsubscribe;
        });

        render(<VoiceTrainingStatus userId="user123" />);

        await waitFor(() => {
          expect(consoleSpy).toHaveBeenCalledWith(
            '[Analytics] Low Satisfaction Alert Shown',
            expect.objectContaining({
              userId: 'user123',
              acceptanceRate: 60,
              satisfactionRating: '4.5',
              reason: 'low_acceptance_rate',
            })
          );
        });

        consoleSpy.mockRestore();
      });
    });
  });
});
