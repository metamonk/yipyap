/**
 * Daily Agent Configuration service for managing workflow settings
 *
 * @remarks
 * This service handles all daily agent configuration operations including:
 * - Retrieving user's daily agent configuration
 * - Updating workflow settings (schedule, limits, approval requirements)
 * - Validating schedule time format
 * - Real-time subscription to configuration changes
 * Never access Firestore directly from components - always use this service layer.
 *
 * @module services/dailyAgentConfigService
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  FirestoreError,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import type { DailyAgentConfig } from '@/types/ai';

/**
 * Default configuration for new users
 *
 * @remarks
 * Applied when user has no existing configuration document.
 * Users can customize all settings from the daily agent settings screen.
 */
const DEFAULT_CONFIG: Omit<DailyAgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
  features: {
    dailyWorkflowEnabled: false, // Disabled by default, user must opt-in
    categorizationEnabled: true,
    faqDetectionEnabled: true,
    voiceMatchingEnabled: true,
    sentimentAnalysisEnabled: true,
  },
  workflowSettings: {
    dailyWorkflowTime: '09:00', // 9 AM default
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, // User's local timezone
    maxAutoResponses: 20, // Reasonable daily limit
    requireApproval: true, // Safe default - require manual approval
    escalationThreshold: 0.3, // Negative sentiment threshold
  },
  modelPreferences: {
    categorization: 'gpt-4o-mini', // Fast, cost-effective
    responseGeneration: 'gpt-4-turbo-preview', // High quality
    sentimentAnalysis: 'gpt-4o-mini', // Fast, cost-effective
  },
};

/**
 * Validates schedule time format (HH:mm)
 *
 * @param time - Time string to validate (e.g., "09:00", "13:30")
 * @returns True if valid 24-hour time format, false otherwise
 *
 * @example
 * ```typescript
 * validateScheduleTime('09:00'); // true
 * validateScheduleTime('13:30'); // true
 * validateScheduleTime('9:00');  // false (missing leading zero)
 * validateScheduleTime('25:00'); // false (invalid hour)
 * validateScheduleTime('12:60'); // false (invalid minute)
 * ```
 */
export function validateScheduleTime(time: string): boolean {
  // Regex for HH:mm format (00:00 to 23:59)
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Retrieves the current user's daily agent configuration
 *
 * @param userId - User ID to fetch configuration for (optional, defaults to current user)
 * @returns Promise resolving to the user's configuration, or default config if none exists
 * @throws {FirebaseError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const config = await getDailyAgentConfig();
 * console.log(config.workflowSettings.dailyWorkflowTime); // "09:00"
 * ```
 */
export async function getDailyAgentConfig(userId?: string): Promise<DailyAgentConfig> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access daily agent configuration');
    }

    const uid = userId || currentUser!.uid;
    const configDoc = doc(db, 'users', uid, 'ai_workflow_config', uid);

    console.log('[getDailyAgentConfig] Fetching config for user:', uid);
    console.log('[getDailyAgentConfig] Auth user:', currentUser?.uid);

    const configSnapshot = await getDoc(configDoc);

    if (!configSnapshot.exists()) {
      console.log('[getDailyAgentConfig] Config does not exist, returning default');
      // Return default configuration for new users
      return {
        id: uid,
        userId: uid,
        ...DEFAULT_CONFIG,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    }

    console.log('[getDailyAgentConfig] Config loaded successfully');
    return configSnapshot.data() as DailyAgentConfig;
  } catch (error) {
    console.error('[getDailyAgentConfig] Error fetching daily agent configuration:', error);
    if (error instanceof FirestoreError) {
      console.error('[getDailyAgentConfig] Firestore error code:', error.code);
      console.error('[getDailyAgentConfig] Firestore error message:', error.message);

      // Provide specific error message for permissions errors
      if (error.code === 'permission-denied') {
        throw new Error('Permission denied: Please ensure you are signed in and have permission to access this resource.');
      }

      throw new Error(`Failed to load daily agent settings: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Updates the current user's daily agent configuration
 *
 * @param updates - Partial configuration updates to apply
 * @param userId - User ID to update configuration for (optional, defaults to current user)
 * @returns Promise resolving to the updated configuration
 * @throws {Error} When schedule time format is invalid
 * @throws {FirebaseError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * // Enable daily workflow and change schedule time
 * await updateDailyAgentConfig({
 *   features: { dailyWorkflowEnabled: true },
 *   workflowSettings: { dailyWorkflowTime: '08:00' }
 * });
 *
 * // Update max auto-responses limit
 * await updateDailyAgentConfig({
 *   workflowSettings: { maxAutoResponses: 50 }
 * });
 * ```
 */
export async function updateDailyAgentConfig(
  updates: Partial<Omit<DailyAgentConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  userId?: string
): Promise<DailyAgentConfig> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to update daily agent configuration');
    }

    const uid = userId || currentUser!.uid;

    // Validate schedule time if being updated
    if (updates.workflowSettings?.dailyWorkflowTime) {
      if (!validateScheduleTime(updates.workflowSettings.dailyWorkflowTime)) {
        throw new Error(
          'Invalid schedule time format. Must be HH:mm (e.g., "09:00", "13:30")'
        );
      }
    }

    // Validate maxAutoResponses if being updated
    if (updates.workflowSettings?.maxAutoResponses !== undefined) {
      const max = updates.workflowSettings.maxAutoResponses;
      if (max < 1 || max > 100) {
        throw new Error('Maximum auto-responses must be between 1 and 100');
      }
    }

    // Validate escalationThreshold if being updated
    if (updates.workflowSettings?.escalationThreshold !== undefined) {
      const threshold = updates.workflowSettings.escalationThreshold;
      if (threshold < 0 || threshold > 1) {
        throw new Error('Escalation threshold must be between 0.0 and 1.0');
      }
    }

    const configDoc = doc(db, 'users', uid, 'ai_workflow_config', uid);
    const configSnapshot = await getDoc(configDoc);

    if (!configSnapshot.exists()) {
      // Create new configuration document with default values + updates
      const newConfig: DailyAgentConfig = {
        id: uid,
        userId: uid,
        ...DEFAULT_CONFIG,
        ...updates,
        // Deep merge for nested objects
        features: {
          ...DEFAULT_CONFIG.features,
          ...updates.features,
        },
        workflowSettings: {
          ...DEFAULT_CONFIG.workflowSettings,
          ...updates.workflowSettings,
        },
        modelPreferences: {
          ...DEFAULT_CONFIG.modelPreferences,
          ...updates.modelPreferences,
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(configDoc, newConfig);
      return {
        ...newConfig,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
    }

    // Update existing configuration
    const existingConfig = configSnapshot.data() as DailyAgentConfig;
    const updatedConfig: DailyAgentConfig = {
      ...existingConfig,
      ...updates,
      // Deep merge for nested objects
      features: {
        ...existingConfig.features,
        ...updates.features,
      },
      workflowSettings: {
        ...existingConfig.workflowSettings,
        ...updates.workflowSettings,
      },
      modelPreferences: {
        ...existingConfig.modelPreferences,
        ...updates.modelPreferences,
      },
      updatedAt: serverTimestamp(),
    };

    await updateDoc(configDoc, updatedConfig as any);

    return {
      ...updatedConfig,
      updatedAt: Timestamp.now(),
    };
  } catch (error) {
    console.error('Error updating daily agent configuration:', error);
    if (error instanceof Error) {
      throw error; // Re-throw validation errors
    }
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to save daily agent settings: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Subscribes to real-time updates for the current user's daily agent configuration
 *
 * @param callback - Function called when configuration changes
 * @param userId - User ID to subscribe for (optional, defaults to current user)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirebaseError} When Firestore listener setup fails
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToConfigUpdates((config) => {
 *   console.log('Config updated:', config);
 *   if (config.features.dailyWorkflowEnabled) {
 *     console.log('Daily workflow is enabled');
 *   }
 * });
 *
 * // Later, stop listening
 * unsubscribe();
 * ```
 */
export function subscribeToConfigUpdates(
  callback: (config: DailyAgentConfig) => void,
  userId?: string
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to subscribe to configuration updates');
    }

    const uid = userId || currentUser!.uid;
    const configDoc = doc(db, 'users', uid, 'ai_workflow_config', uid);

    return onSnapshot(
      configDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Return default configuration if document doesn't exist
          callback({
            id: uid,
            userId: uid,
            ...DEFAULT_CONFIG,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          return;
        }

        callback(snapshot.data() as DailyAgentConfig);
      },
      (error) => {
        console.error('Error in configuration subscription:', error);
        throw new Error(`Failed to listen for configuration updates: ${error.message}`);
      }
    );
  } catch (error) {
    console.error('Error setting up configuration subscription:', error);
    throw error;
  }
}
