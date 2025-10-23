/**
 * Unit tests for useGroupValidation hook
 * @module tests/unit/hooks/useGroupValidation.test
 */

import { renderHook } from '@testing-library/react-native';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import {
  GROUP_SIZE_LIMIT,
  GROUP_SIZE_WARNING_THRESHOLD,
  GROUP_SIZE_ERROR_MESSAGE,
  GROUP_SIZE_WARNING_MESSAGE,
} from '@/constants/groupLimits';

describe('useGroupValidation', () => {
  describe('validation state', () => {
    it('should return success state for 1-7 members', () => {
      const { result } = renderHook(() => useGroupValidation(5));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('success');
      expect(result.current.validationState.errorMessage).toBeNull();
      expect(result.current.validationState.warningMessage).toBeNull();
      expect(result.current.validationState.canSubmit).toBe(true);
      expect(result.current.validationState.memberCount).toBe(5);
    });

    it('should return warning state for 8 members (threshold)', () => {
      const { result } = renderHook(() => useGroupValidation(8));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('warning');
      expect(result.current.validationState.errorMessage).toBeNull();
      expect(result.current.validationState.warningMessage).toBe(GROUP_SIZE_WARNING_MESSAGE);
      expect(result.current.validationState.canSubmit).toBe(true);
      expect(result.current.validationState.memberCount).toBe(8);
    });

    it('should return warning state for 9 members', () => {
      const { result } = renderHook(() => useGroupValidation(9));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('warning');
      expect(result.current.validationState.errorMessage).toBeNull();
      expect(result.current.validationState.warningMessage).toBe(GROUP_SIZE_WARNING_MESSAGE);
      expect(result.current.validationState.canSubmit).toBe(true);
      expect(result.current.validationState.memberCount).toBe(9);
    });

    it('should return warning state for 10 members (at limit)', () => {
      const { result } = renderHook(() => useGroupValidation(10));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('warning');
      expect(result.current.validationState.errorMessage).toBeNull();
      expect(result.current.validationState.warningMessage).toBe(GROUP_SIZE_WARNING_MESSAGE);
      expect(result.current.validationState.canSubmit).toBe(true);
      expect(result.current.validationState.memberCount).toBe(10);
    });

    it('should return error state for 11 members (exceeds limit)', () => {
      const { result } = renderHook(() => useGroupValidation(11));

      expect(result.current.validationState.isValid).toBe(false);
      expect(result.current.validationState.severity).toBe('error');
      expect(result.current.validationState.errorMessage).toBe(GROUP_SIZE_ERROR_MESSAGE);
      expect(result.current.validationState.warningMessage).toBeNull();
      expect(result.current.validationState.canSubmit).toBe(false);
      expect(result.current.validationState.memberCount).toBe(11);
    });

    it('should return error state for 15 members (well over limit)', () => {
      const { result } = renderHook(() => useGroupValidation(15));

      expect(result.current.validationState.isValid).toBe(false);
      expect(result.current.validationState.severity).toBe('error');
      expect(result.current.validationState.errorMessage).toBe(GROUP_SIZE_ERROR_MESSAGE);
      expect(result.current.validationState.canSubmit).toBe(false);
    });
  });

  describe('boolean flags', () => {
    it('should set isValid to true for valid member counts', () => {
      const { result: result5 } = renderHook(() => useGroupValidation(5));
      const { result: result8 } = renderHook(() => useGroupValidation(8));
      const { result: result10 } = renderHook(() => useGroupValidation(10));

      expect(result5.current.isValid).toBe(true);
      expect(result8.current.isValid).toBe(true);
      expect(result10.current.isValid).toBe(true);
    });

    it('should set isValid to false for invalid member counts', () => {
      const { result: result11 } = renderHook(() => useGroupValidation(11));
      const { result: result15 } = renderHook(() => useGroupValidation(15));

      expect(result11.current.isValid).toBe(false);
      expect(result15.current.isValid).toBe(false);
    });

    it('should set canAddMore correctly based on member count', () => {
      const { result: result5 } = renderHook(() => useGroupValidation(5));
      const { result: result9 } = renderHook(() => useGroupValidation(9));
      const { result: result10 } = renderHook(() => useGroupValidation(10));
      const { result: result11 } = renderHook(() => useGroupValidation(11));

      expect(result5.current.canAddMore).toBe(true);
      expect(result9.current.canAddMore).toBe(true);
      expect(result10.current.canAddMore).toBe(false);
      expect(result11.current.canAddMore).toBe(false);
    });

    it('should set limitReached correctly', () => {
      const { result: result9 } = renderHook(() => useGroupValidation(9));
      const { result: result10 } = renderHook(() => useGroupValidation(10));
      const { result: result11 } = renderHook(() => useGroupValidation(11));

      expect(result9.current.limitReached).toBe(false);
      expect(result10.current.limitReached).toBe(true);
      expect(result11.current.limitReached).toBe(true);
    });

    it('should set warningThresholdReached correctly', () => {
      const { result: result7 } = renderHook(() => useGroupValidation(7));
      const { result: result8 } = renderHook(() => useGroupValidation(8));
      const { result: result10 } = renderHook(() => useGroupValidation(10));

      expect(result7.current.warningThresholdReached).toBe(false);
      expect(result8.current.warningThresholdReached).toBe(true);
      expect(result10.current.warningThresholdReached).toBe(true);
    });
  });

  describe('validateMemberCount function', () => {
    it('should provide a function to validate arbitrary counts', () => {
      const { result } = renderHook(() => useGroupValidation(5));

      const validation3 = result.current.validateMemberCount(3);
      expect(validation3.severity).toBe('success');
      expect(validation3.isValid).toBe(true);

      const validation8 = result.current.validateMemberCount(8);
      expect(validation8.severity).toBe('warning');
      expect(validation8.isValid).toBe(true);

      const validation12 = result.current.validateMemberCount(12);
      expect(validation12.severity).toBe('error');
      expect(validation12.isValid).toBe(false);
    });

    it('should be stable across re-renders', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useGroupValidation(count),
        { initialProps: { count: 5 } }
      );

      const firstFunction = result.current.validateMemberCount;

      rerender({ count: 7 });

      const secondFunction = result.current.validateMemberCount;

      // Function reference should remain the same
      expect(firstFunction).toBe(secondFunction);
    });
  });

  describe('configuration constant usage', () => {
    it('should respect GROUP_SIZE_LIMIT constant', () => {
      const { result: atLimit } = renderHook(() => useGroupValidation(GROUP_SIZE_LIMIT));
      const { result: overLimit } = renderHook(() => useGroupValidation(GROUP_SIZE_LIMIT + 1));

      expect(atLimit.current.isValid).toBe(true);
      expect(overLimit.current.isValid).toBe(false);
    });

    it('should respect GROUP_SIZE_WARNING_THRESHOLD constant', () => {
      const { result: beforeThreshold } = renderHook(() =>
        useGroupValidation(GROUP_SIZE_WARNING_THRESHOLD - 1)
      );
      const { result: atThreshold } = renderHook(() =>
        useGroupValidation(GROUP_SIZE_WARNING_THRESHOLD)
      );

      expect(beforeThreshold.current.validationState.severity).toBe('success');
      expect(atThreshold.current.validationState.severity).toBe('warning');
    });
  });

  describe('edge cases', () => {
    it('should handle 1 member (minimum)', () => {
      const { result } = renderHook(() => useGroupValidation(1));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('success');
      expect(result.current.canAddMore).toBe(true);
    });

    it('should handle 0 members', () => {
      const { result } = renderHook(() => useGroupValidation(0));

      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('success');
      expect(result.current.canAddMore).toBe(true);
    });

    it('should handle very large member counts', () => {
      const { result } = renderHook(() => useGroupValidation(1000));

      expect(result.current.validationState.isValid).toBe(false);
      expect(result.current.validationState.severity).toBe('error');
      expect(result.current.canAddMore).toBe(false);
      expect(result.current.limitReached).toBe(true);
    });
  });

  describe('memoization', () => {
    it('should not recreate validation state unnecessarily', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useGroupValidation(count),
        { initialProps: { count: 5 } }
      );

      const firstState = result.current.validationState;

      // Re-render with same count
      rerender({ count: 5 });

      const secondState = result.current.validationState;

      // State object should be memoized
      expect(firstState).toBe(secondState);
    });

    it('should update validation state when count changes', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useGroupValidation(count),
        { initialProps: { count: 5 } }
      );

      const firstState = result.current.validationState;
      expect(firstState.severity).toBe('success');

      // Re-render with different count
      rerender({ count: 8 });

      const secondState = result.current.validationState;
      expect(secondState.severity).toBe('warning');

      // State object should be different
      expect(firstState).not.toBe(secondState);
    });
  });
});
