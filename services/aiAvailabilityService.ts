import { Config } from '@/constants/Config';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getFirebaseApp } from './firebase';

/**
 * AI Service Availability Checker
 * Story 5.7 - Task 11: Graceful Degradation
 * Story 5.9 - Task 5: Budget Enforcement
 *
 * Checks if AI services (categorization, sentiment, etc.) are available
 * by making lightweight HEAD requests to API endpoints.
 * Also checks if user's AI features are disabled due to budget limits.
 */

/**
 * Check if AI services are available
 * Makes a lightweight HEAD request to categorization endpoint
 *
 * @returns Promise<boolean> - True if AI services are available
 *
 * @example
 * ```typescript
 * const available = await checkAIAvailability();
 * if (!available) {
 *   // Show degraded state UI
 * }
 * ```
 */
export async function checkAIAvailability(): Promise<boolean> {
  // Check if AI is explicitly disabled in config
  if (!Config.ai.aiEnabled) {
    return false;
  }

  try {
    // Use AbortController with timeout (3 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const apiUrl = Config.ai.vercelEdgeUrl || 'https://api.yipyap.wtf';
    const response = await fetch(`${apiUrl}/api/categorize-message`, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Consider service available if we get any response (including 404)
    // This checks connectivity, not authentication
    return response.status < 500;
  } catch (error) {
    // Network error, timeout, or server unavailable
    return false;
  }
}

/**
 * Retry checker with exponential backoff
 * Used to periodically check if AI services have recovered
 */
export class AIAvailabilityMonitor {
  private retryCount = 0;
  private readonly maxRetries = 5;
  private timeoutId?: NodeJS.Timeout;
  private onAvailabilityChange?: (available: boolean) => void;

  /**
   * Start monitoring AI availability with exponential backoff
   *
   * @param callback - Called when availability changes
   *
   * @example
   * ```typescript
   * const monitor = new AIAvailabilityMonitor();
   * monitor.startMonitoring((available) => {
   *   setAiAvailable(available);
   * });
   * ```
   */
  startMonitoring(callback: (available: boolean) => void): void {
    this.onAvailabilityChange = callback;
    this.retryCount = 0;
    this.scheduleCheck();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.onAvailabilityChange = undefined;
  }

  /**
   * Schedule next availability check with exponential backoff
   */
  private scheduleCheck(): void {
    if (this.retryCount >= this.maxRetries) {
      // Max retries reached - stop automatic checking
      // User can manually trigger refresh
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
    const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);

    this.timeoutId = setTimeout(async () => {
      const available = await checkAIAvailability();

      if (this.onAvailabilityChange) {
        this.onAvailabilityChange(available);
      }

      if (available) {
        // Service recovered - reset retry count
        this.retryCount = 0;
      } else {
        // Still unavailable - increment retry count and schedule next check
        this.retryCount++;
        this.scheduleCheck();
      }
    }, delay);
  }

  /**
   * Force immediate availability check
   * Resets retry count on successful check
   */
  async checkNow(): Promise<boolean> {
    const available = await checkAIAvailability();

    if (available) {
      this.retryCount = 0;
      this.scheduleCheck(); // Resume monitoring with reset counter
    }

    if (this.onAvailabilityChange) {
      this.onAvailabilityChange(available);
    }

    return available;
  }
}

/**
 * Budget status check result
 */
export interface BudgetStatus {
  /** Whether AI features are enabled for this user */
  enabled: boolean;
  /** Reason for AI features being disabled (if applicable) */
  disabledReason?: 'budget_exceeded' | 'manual_disable' | 'unknown';
  /** When AI features were disabled */
  disabledAt?: Date;
  /** User-friendly message explaining the status */
  message?: string;
}

/**
 * Check if user's AI features are enabled or disabled due to budget limits
 *
 * @param userId - User ID to check budget status for
 * @returns Promise<BudgetStatus> - Budget status information
 *
 * @remarks
 * Story 5.9 - Task 5: Budget Alerts & Controls
 * Checks the `aiFeatures.disabled` flag set by budget monitor Cloud Function.
 * This function should be called before performing any AI operations.
 *
 * @example
 * ```typescript
 * const status = await checkUserBudgetStatus(userId);
 * if (!status.enabled) {
 *   throw new Error(status.message || 'AI features temporarily disabled');
 * }
 * ```
 */
export async function checkUserBudgetStatus(userId: string): Promise<BudgetStatus> {
  try {
    const db = getFirestore(getFirebaseApp());
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      // User doesn't exist - return enabled by default
      return {
        enabled: true,
      };
    }

    const userData = userDoc.data();
    const aiFeatures = userData?.aiFeatures;

    // Check if AI features are explicitly disabled
    if (aiFeatures?.disabled === true) {
      const disabledReason = aiFeatures.disabledReason || 'unknown';
      const disabledAt = aiFeatures.disabledAt?.toDate();

      let message: string;
      if (disabledReason === 'budget_exceeded') {
        message = 'AI features are temporarily disabled because you have reached your daily budget limit. They will be re-enabled tomorrow.';
      } else {
        message = 'AI features are currently disabled. Please contact support if you believe this is an error.';
      }

      return {
        enabled: false,
        disabledReason,
        disabledAt,
        message,
      };
    }

    // AI features are enabled
    return {
      enabled: true,
    };
  } catch (error) {
    console.error('[aiAvailabilityService] Error checking budget status:', error);
    // On error, default to enabled to avoid blocking users
    // This is safer than defaulting to disabled which could break the app
    return {
      enabled: true,
      message: 'Unable to verify budget status. Assuming enabled.',
    };
  }
}
