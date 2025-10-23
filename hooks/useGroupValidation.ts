import { useMemo } from 'react';
import {
  GROUP_SIZE_LIMIT,
  GROUP_SIZE_WARNING_THRESHOLD,
  GROUP_SIZE_ERROR_MESSAGE,
  GROUP_SIZE_WARNING_MESSAGE,
} from '@/constants/groupLimits';
import type { GroupValidationState, ValidationSeverity } from '@/types/models';

/**
 * Return type for the useGroupValidation hook
 * @interface UseGroupValidationResult
 *
 * @remarks
 * Provides validation state and helper methods for group member selection.
 * All properties are memoized for performance.
 */
export interface UseGroupValidationResult {
  /** Current validation state with error/warning messages */
  validationState: GroupValidationState;

  /** Whether the current member count is valid (< GROUP_SIZE_LIMIT) */
  isValid: boolean;

  /** Whether more members can be added without exceeding limit */
  canAddMore: boolean;

  /** Whether the hard limit has been reached */
  limitReached: boolean;

  /** Whether the warning threshold has been reached */
  warningThresholdReached: boolean;

  /** Validates a specific member count and returns validation state */
  validateMemberCount: (count: number) => GroupValidationState;
}

/**
 * Custom hook for validating group member selection and size limits
 *
 * @param memberCount - Current number of selected members (including current user)
 * @returns Validation state and helper methods
 *
 * @remarks
 * This hook provides real-time validation for group creation UI, checking:
 * - Hard limit enforcement (max 10 members)
 * - Warning threshold detection (8+ members)
 * - User-friendly error/warning messages
 * - Submit eligibility
 *
 * All validation results are memoized to prevent unnecessary recalculations.
 * The validation logic matches Firebase Security Rules for consistency.
 *
 * @example
 * ```tsx
 * function GroupCreationScreen() {
 *   const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
 *   const currentUser = useAuth();
 *
 *   // Include current user in count
 *   const memberCount = selectedUsers.length + 1;
 *
 *   const {
 *     validationState,
 *     canAddMore,
 *     limitReached
 *   } = useGroupValidation(memberCount);
 *
 *   return (
 *     <>
 *       <GroupMemberCounter
 *         count={memberCount}
 *         severity={validationState.severity}
 *       />
 *       {validationState.errorMessage && (
 *         <ErrorMessage text={validationState.errorMessage} />
 *       )}
 *       <Button
 *         disabled={!validationState.canSubmit}
 *         onPress={handleCreate}
 *       />
 *     </>
 *   );
 * }
 * ```
 *
 * @see GROUP_SIZE_LIMIT - Maximum members allowed
 * @see GROUP_SIZE_WARNING_THRESHOLD - Warning display threshold
 * @see GroupValidationState - Return type structure
 */
export function useGroupValidation(memberCount: number): UseGroupValidationResult {
  /**
   * Validates a given member count and returns validation state
   * Extracted as a stable function for reusability
   */
  const validateMemberCount = useMemo(() => {
    return (count: number): GroupValidationState => {
      // Error: Exceeds hard limit
      if (count > GROUP_SIZE_LIMIT) {
        return {
          isValid: false,
          errorMessage: GROUP_SIZE_ERROR_MESSAGE,
          warningMessage: null,
          severity: 'error' as ValidationSeverity,
          memberCount: count,
          canSubmit: false,
        };
      }

      // Warning: Approaching limit
      if (count >= GROUP_SIZE_WARNING_THRESHOLD) {
        return {
          isValid: true,
          errorMessage: null,
          warningMessage: GROUP_SIZE_WARNING_MESSAGE,
          severity: 'warning' as ValidationSeverity,
          memberCount: count,
          canSubmit: true,
        };
      }

      // Success: Normal state
      return {
        isValid: true,
        errorMessage: null,
        warningMessage: null,
        severity: 'success' as ValidationSeverity,
        memberCount: count,
        canSubmit: true,
      };
    };
  }, []); // Stable function, never changes

  // Current validation state (memoized)
  const validationState = useMemo(() => {
    return validateMemberCount(memberCount);
  }, [memberCount, validateMemberCount]);

  // Derived boolean flags (memoized)
  const isValid = useMemo(() => validationState.isValid, [validationState.isValid]);

  const canAddMore = useMemo(
    () => memberCount < GROUP_SIZE_LIMIT,
    [memberCount]
  );

  const limitReached = useMemo(
    () => memberCount >= GROUP_SIZE_LIMIT,
    [memberCount]
  );

  const warningThresholdReached = useMemo(
    () => memberCount >= GROUP_SIZE_WARNING_THRESHOLD,
    [memberCount]
  );

  return {
    validationState,
    isValid,
    canAddMore,
    limitReached,
    warningThresholdReached,
    validateMemberCount,
  };
}
