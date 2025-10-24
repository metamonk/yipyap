/**
 * Unit Tests for Daily Agent Configuration Service
 * @module tests/unit/services/dailyAgentConfigService.test
 *
 * Tests the daily agent configuration service layer including:
 * - Fetching user configuration
 * - Updating configuration with validation
 * - Schedule time validation
 * - Real-time subscriptions
 * - Default configuration handling
 * - Error handling
 */

import {
  getDailyAgentConfig,
  updateDailyAgentConfig,
  validateScheduleTime,
  subscribeToConfigUpdates,
} from '@/services/dailyAgentConfigService';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('@/services/firebase');

import * as firestore from 'firebase/firestore';
import * as firebase from '@/services/firebase';

describe('dailyAgentConfigService', () => {
  let mockDb: any;
  let mockAuth: any;
  let mockCurrentUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock current user
    mockCurrentUser = {
      uid: 'user123',
      email: 'user@example.com',
    };

    // Mock auth
    mockAuth = {
      currentUser: mockCurrentUser,
    };

    // Mock Firestore
    mockDb = {};

    // Setup mocks
    (firebase.getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (firebase.getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
  });

  describe('validateScheduleTime', () => {
    it('should validate correct time formats', () => {
      expect(validateScheduleTime('00:00')).toBe(true);
      expect(validateScheduleTime('09:00')).toBe(true);
      expect(validateScheduleTime('13:30')).toBe(true);
      expect(validateScheduleTime('23:59')).toBe(true);
    });

    it('should reject invalid time formats', () => {
      expect(validateScheduleTime('9:00')).toBe(false); // Missing leading zero
      expect(validateScheduleTime('25:00')).toBe(false); // Invalid hour
      expect(validateScheduleTime('12:60')).toBe(false); // Invalid minute
      expect(validateScheduleTime('12:5')).toBe(false); // Missing leading zero in minute
      expect(validateScheduleTime('12:')).toBe(false); // Missing minute
      expect(validateScheduleTime(':30')).toBe(false); // Missing hour
      expect(validateScheduleTime('invalid')).toBe(false); // Not a time
      expect(validateScheduleTime('')).toBe(false); // Empty string
    });
  });

  describe('getDailyAgentConfig', () => {
    it('should return existing configuration', async () => {
      const mockConfig = {
        id: 'user123',
        userId: 'user123',
        features: {
          dailyWorkflowEnabled: true,
          categorizationEnabled: true,
          faqDetectionEnabled: true,
          voiceMatchingEnabled: true,
          sentimentAnalysisEnabled: true,
        },
        workflowSettings: {
          dailyWorkflowTime: '10:00',
          timezone: 'America/New_York',
          maxAutoResponses: 30,
          requireApproval: false,
          escalationThreshold: 0.2,
        },
        modelPreferences: {
          categorization: 'gpt-4o-mini',
          responseGeneration: 'gpt-4-turbo-preview',
          sentimentAnalysis: 'gpt-4o-mini',
        },
        createdAt: { seconds: 1234567890, nanoseconds: 0 },
        updatedAt: { seconds: 1234567900, nanoseconds: 0 },
      };

      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => true,
        data: () => mockConfig,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await getDailyAgentConfig();

      expect(firestore.doc).toHaveBeenCalledWith(
        mockDb,
        'users',
        'user123',
        'ai_workflow_config',
        'user123'
      );
      expect(result).toEqual(mockConfig);
    });

    it('should return default configuration when document does not exist', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.Timestamp.now as jest.Mock).mockReturnValue({
        seconds: 1234567890,
        nanoseconds: 0,
      });

      const result = await getDailyAgentConfig();

      expect(result.id).toBe('user123');
      expect(result.userId).toBe('user123');
      expect(result.features.dailyWorkflowEnabled).toBe(false);
      expect(result.workflowSettings.dailyWorkflowTime).toBe('09:00');
      expect(result.workflowSettings.maxAutoResponses).toBe(20);
      expect(result.workflowSettings.requireApproval).toBe(true);
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      await expect(getDailyAgentConfig()).rejects.toThrow(
        'User must be authenticated to access daily agent configuration'
      );
    });

    it('should handle Firestore errors gracefully', async () => {
      const firestoreError = new Error('Firestore error') as any;
      firestoreError.code = 'permission-denied';

      (firestore.doc as jest.Mock).mockReturnValue({});
      (firestore.getDoc as jest.Mock).mockRejectedValue(firestoreError);

      await expect(getDailyAgentConfig()).rejects.toThrow();
    });

    it('should allow fetching config for a specific user ID', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.Timestamp.now as jest.Mock).mockReturnValue({
        seconds: 1234567890,
        nanoseconds: 0,
      });

      await getDailyAgentConfig('user456');

      expect(firestore.doc).toHaveBeenCalledWith(
        mockDb,
        'users',
        'user456',
        'ai_workflow_config',
        'user456'
      );
    });
  });

  describe('updateDailyAgentConfig', () => {
    it('should update existing configuration', async () => {
      const existingConfig = {
        id: 'user123',
        userId: 'user123',
        features: {
          dailyWorkflowEnabled: false,
          categorizationEnabled: true,
          faqDetectionEnabled: true,
          voiceMatchingEnabled: true,
          sentimentAnalysisEnabled: true,
        },
        workflowSettings: {
          dailyWorkflowTime: '09:00',
          timezone: 'America/Los_Angeles',
          maxAutoResponses: 20,
          requireApproval: true,
          escalationThreshold: 0.3,
        },
        modelPreferences: {
          categorization: 'gpt-4o-mini',
          responseGeneration: 'gpt-4-turbo-preview',
          sentimentAnalysis: 'gpt-4o-mini',
        },
        createdAt: { seconds: 1234567890, nanoseconds: 0 },
        updatedAt: { seconds: 1234567890, nanoseconds: 0 },
      };

      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => true,
        data: () => existingConfig,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.updateDoc as jest.Mock).mockResolvedValue(undefined);
      (firestore.serverTimestamp as jest.Mock).mockReturnValue('SERVER_TIMESTAMP');
      (firestore.Timestamp.now as jest.Mock).mockReturnValue({
        seconds: 1234567900,
        nanoseconds: 0,
      });

      const updates = {
        features: { dailyWorkflowEnabled: true },
        workflowSettings: { dailyWorkflowTime: '08:00', maxAutoResponses: 50 },
      };

      const result = await updateDailyAgentConfig(updates);

      expect(result.features.dailyWorkflowEnabled).toBe(true);
      expect(result.workflowSettings.dailyWorkflowTime).toBe('08:00');
      expect(result.workflowSettings.maxAutoResponses).toBe(50);
      expect(result.workflowSettings.timezone).toBe('America/Los_Angeles'); // Unchanged
      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('should create new configuration if document does not exist', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.setDoc as jest.Mock).mockResolvedValue(undefined);
      (firestore.serverTimestamp as jest.Mock).mockReturnValue('SERVER_TIMESTAMP');
      (firestore.Timestamp.now as jest.Mock).mockReturnValue({
        seconds: 1234567890,
        nanoseconds: 0,
      });

      const updates = {
        features: { dailyWorkflowEnabled: true },
      };

      const result = await updateDailyAgentConfig(updates);

      expect(result.id).toBe('user123');
      expect(result.features.dailyWorkflowEnabled).toBe(true);
      expect(firestore.setDoc).toHaveBeenCalled();
    });

    it('should validate schedule time format', async () => {
      const updates = {
        workflowSettings: { dailyWorkflowTime: '9:00' }, // Invalid format
      };

      await expect(updateDailyAgentConfig(updates)).rejects.toThrow(
        'Invalid schedule time format'
      );
    });

    it('should validate maxAutoResponses range', async () => {
      const mockDocRef = {};
      const mockDocSnap = { exists: () => false };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      // Test below minimum
      await expect(
        updateDailyAgentConfig({
          workflowSettings: { maxAutoResponses: 0 },
        })
      ).rejects.toThrow('Maximum auto-responses must be between 1 and 100');

      // Test above maximum
      await expect(
        updateDailyAgentConfig({
          workflowSettings: { maxAutoResponses: 101 },
        })
      ).rejects.toThrow('Maximum auto-responses must be between 1 and 100');
    });

    it('should validate escalationThreshold range', async () => {
      const mockDocRef = {};
      const mockDocSnap = { exists: () => false };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      // Test below minimum
      await expect(
        updateDailyAgentConfig({
          workflowSettings: { escalationThreshold: -0.1 },
        })
      ).rejects.toThrow('Escalation threshold must be between 0.0 and 1.0');

      // Test above maximum
      await expect(
        updateDailyAgentConfig({
          workflowSettings: { escalationThreshold: 1.5 },
        })
      ).rejects.toThrow('Escalation threshold must be between 0.0 and 1.0');
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      await expect(
        updateDailyAgentConfig({
          features: { dailyWorkflowEnabled: true },
        })
      ).rejects.toThrow('User must be authenticated to update daily agent configuration');
    });
  });

  describe('subscribeToConfigUpdates', () => {
    it('should set up real-time listener for configuration updates', () => {
      const mockUnsubscribe = jest.fn();
      const mockCallback = jest.fn();
      const mockDocRef = {};

      const mockConfig = {
        id: 'user123',
        userId: 'user123',
        features: { dailyWorkflowEnabled: true },
        workflowSettings: {
          dailyWorkflowTime: '09:00',
          timezone: 'America/Los_Angeles',
          maxAutoResponses: 20,
          requireApproval: true,
          escalationThreshold: 0.3,
        },
        modelPreferences: {
          categorization: 'gpt-4o-mini',
          responseGeneration: 'gpt-4-turbo-preview',
          sentimentAnalysis: 'gpt-4o-mini',
        },
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.onSnapshot as jest.Mock).mockImplementation(
        (docRef, successCallback, errorCallback) => {
          // Simulate snapshot callback
          successCallback({
            exists: () => true,
            data: () => mockConfig,
          });
          return mockUnsubscribe;
        }
      );

      const unsubscribe = subscribeToConfigUpdates(mockCallback);

      expect(firestore.doc).toHaveBeenCalledWith(
        mockDb,
        'users',
        'user123',
        'ai_workflow_config',
        'user123'
      );
      expect(mockCallback).toHaveBeenCalledWith(mockConfig);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should return default config when document does not exist', () => {
      const mockUnsubscribe = jest.fn();
      const mockCallback = jest.fn();
      const mockDocRef = {};

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.Timestamp.now as jest.Mock).mockReturnValue({
        seconds: 1234567890,
        nanoseconds: 0,
      });
      (firestore.onSnapshot as jest.Mock).mockImplementation(
        (docRef, successCallback, errorCallback) => {
          // Simulate snapshot with non-existent document
          successCallback({
            exists: () => false,
          });
          return mockUnsubscribe;
        }
      );

      subscribeToConfigUpdates(mockCallback);

      expect(mockCallback).toHaveBeenCalled();
      const callArg = mockCallback.mock.calls[0][0];
      expect(callArg.id).toBe('user123');
      expect(callArg.features.dailyWorkflowEnabled).toBe(false);
    });

    it('should throw error when user is not authenticated', () => {
      mockAuth.currentUser = null;

      expect(() => subscribeToConfigUpdates(jest.fn())).toThrow(
        'User must be authenticated to subscribe to configuration updates'
      );
    });

    it('should handle listener errors', () => {
      const mockCallback = jest.fn();
      const mockDocRef = {};
      const mockError = new Error('Firestore error');

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.onSnapshot as jest.Mock).mockImplementation(
        (docRef, successCallback, errorCallback) => {
          // Simulate error callback
          errorCallback(mockError);
          return jest.fn();
        }
      );

      expect(() => subscribeToConfigUpdates(mockCallback)).toThrow();
    });
  });
});
