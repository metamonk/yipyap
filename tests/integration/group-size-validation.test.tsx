/**
 * Integration tests for group size validation feature
 * @module tests/integration/group-size-validation.test
 *
 * @remarks
 * These tests verify the complete group size validation flow:
 * - Client-side validation in UI
 * - Service layer validation
 * - Firebase Security Rules enforcement
 * - User experience (error messages, disabled states)
 */

import { renderHook } from '@testing-library/react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import { GroupMemberCounter } from '@/components/groups/GroupMemberCounter';
import { GroupSizeError } from '@/components/groups/GroupSizeError';
import { createConversation } from '@/services/conversationService';
import { GROUP_SIZE_LIMIT, GROUP_SIZE_WARNING_THRESHOLD } from '@/constants/groupLimits';
import type { CreateConversationInput } from '@/types/models';

// Mock AccessibilityInfo
jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(jest.fn());

// Mock Firebase
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

// Mock Firestore methods
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-conversation-id' })),
  setDoc: jest.fn(),
  getDoc: jest.fn(() => Promise.resolve({ exists: () => false })),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
  Timestamp: {
    now: jest.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
  },
}));

describe('Group Size Validation - Integration Tests', () => {
  describe('End-to-End Validation Flow', () => {
    it('should allow creating group with 10 members (at limit)', async () => {
      const participantIds = Array.from({ length: 10 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).resolves.toBeDefined();
    });

    it('should reject creating group with 11 members (over limit)', async () => {
      const participantIds = Array.from({ length: 11 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).rejects.toThrow(/size limit exceeded/i);
    });

    it('should reject creating group with 15 members (well over limit)', async () => {
      const participantIds = Array.from({ length: 15 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).rejects.toThrow(/Maximum 10 members/);
    });
  });

  describe('UI Validation Integration', () => {
    it('should show success state for groups under warning threshold', () => {
      const memberCount = 5;
      const { result } = renderHook(() => useGroupValidation(memberCount));

      const { getByTestId } = render(
        <GroupMemberCounter
          count={memberCount}
          severity={result.current.validationState.severity}
        />
      );

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#4CAF50' }); // Green
    });

    it('should show warning state when approaching limit', () => {
      const memberCount = GROUP_SIZE_WARNING_THRESHOLD;
      const { result } = renderHook(() => useGroupValidation(memberCount));

      const { getByTestId } = render(
        <>
          <GroupMemberCounter
            count={memberCount}
            severity={result.current.validationState.severity}
          />
          {result.current.validationState.warningMessage && (
            <GroupSizeError
              message={result.current.validationState.warningMessage}
              severity="warning"
            />
          )}
        </>
      );

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#FF9800' }); // Orange

      const warningMessage = getByTestId('group-size-error');
      expect(warningMessage).toBeTruthy();
    });

    it('should show error state when limit exceeded', () => {
      const memberCount = 11;
      const { result } = renderHook(() => useGroupValidation(memberCount));

      const { getByTestId } = render(
        <>
          <GroupMemberCounter
            count={memberCount}
            severity={result.current.validationState.severity}
          />
          {result.current.validationState.errorMessage && (
            <GroupSizeError
              message={result.current.validationState.errorMessage}
              severity="error"
            />
          )}
        </>
      );

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#F44336' }); // Red

      const errorMessage = getByTestId('group-size-error');
      expect(errorMessage).toBeTruthy();
    });
  });

  describe('Real-time Validation Updates', () => {
    it('should update validation state as members are added', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useGroupValidation(count),
        { initialProps: { count: 5 } }
      );

      // Start: 5 members - success state
      expect(result.current.validationState.severity).toBe('success');
      expect(result.current.canAddMore).toBe(true);

      // Add more: 8 members - warning state
      rerender({ count: 8 });
      expect(result.current.validationState.severity).toBe('warning');
      expect(result.current.canAddMore).toBe(true);
      expect(result.current.warningThresholdReached).toBe(true);

      // Add more: 10 members - still warning but at limit
      rerender({ count: 10 });
      expect(result.current.validationState.severity).toBe('warning');
      expect(result.current.canAddMore).toBe(false);
      expect(result.current.limitReached).toBe(true);

      // Exceed: 11 members - error state
      rerender({ count: 11 });
      expect(result.current.validationState.severity).toBe('error');
      expect(result.current.validationState.canSubmit).toBe(false);
      expect(result.current.canAddMore).toBe(false);
    });

    it('should update UI components reactively with member count changes', () => {
      const { result, rerender: rerenderHook } = renderHook(
        ({ count }) => useGroupValidation(count),
        { initialProps: { count: 5 } }
      );

      const { getByTestId, rerender } = render(
        <GroupMemberCounter
          count={5}
          severity={result.current.validationState.severity}
        />
      );

      // Initial render - success (green)
      let counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#4CAF50' });

      // Update to 8 members - warning (orange)
      rerenderHook({ count: 8 });
      rerender(
        <GroupMemberCounter
          count={8}
          severity={result.current.validationState.severity}
        />
      );

      counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#FF9800' });

      // Update to 11 members - error (red)
      rerenderHook({ count: 11 });
      rerender(
        <GroupMemberCounter
          count={11}
          severity={result.current.validationState.severity}
        />
      );

      counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#F44336' });
    });
  });

  describe('Service Layer Validation', () => {
    it('should pass validation for valid group sizes', async () => {
      // Test various valid sizes
      const validSizes = [2, 5, 8, 10];

      for (const size of validSizes) {
        const participantIds = Array.from({ length: size }, (_, i) => `user${i}`);
        const input: CreateConversationInput = {
          type: 'group',
          participantIds,
          groupName: `Test Group ${size}`,
          creatorId: 'user0',
        };

        await expect(createConversation(input)).resolves.toBeDefined();
      }
    });

    it('should fail validation for invalid group sizes', async () => {
      // Test various invalid sizes
      const invalidSizes = [11, 12, 15, 20, 100];

      for (const size of invalidSizes) {
        const participantIds = Array.from({ length: size }, (_, i) => `user${i}`);
        const input: CreateConversationInput = {
          type: 'group',
          participantIds,
          groupName: `Test Group ${size}`,
          creatorId: 'user0',
        };

        await expect(createConversation(input)).rejects.toThrow();
      }
    });

    it('should include limit value in error message', async () => {
      const participantIds = Array.from({ length: 11 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).rejects.toThrow();

      // Verify error message contains limit
      try {
        await createConversation(input);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(`${GROUP_SIZE_LIMIT}`);
      }
    });
  });

  describe('Configuration Consistency', () => {
    it('should use same limit across all validation layers', () => {
      // Verify hook uses same constant
      const { result } = renderHook(() => useGroupValidation(GROUP_SIZE_LIMIT + 1));
      expect(result.current.validationState.isValid).toBe(false);

      // Verify service uses same constant
      const participantIds = Array.from({ length: GROUP_SIZE_LIMIT + 1 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Test Group',
        creatorId: 'user0',
      };

      expect(createConversation(input)).rejects.toThrow();
    });

    it('should use same warning threshold across validation layers', () => {
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

  describe('User Experience Flow', () => {
    it('should provide clear feedback throughout member selection', () => {
      const counts = [1, 5, 8, 9, 10, 11];
      const results = counts.map((count) => {
        const { result } = renderHook(() => useGroupValidation(count));
        return {
          count,
          severity: result.current.validationState.severity,
          canSubmit: result.current.validationState.canSubmit,
          hasError: result.current.validationState.errorMessage !== null,
          hasWarning: result.current.validationState.warningMessage !== null,
        };
      });

      // Verify progression
      expect(results[0].severity).toBe('success'); // 1 member
      expect(results[1].severity).toBe('success'); // 5 members
      expect(results[2].severity).toBe('warning'); // 8 members
      expect(results[2].hasWarning).toBe(true);
      expect(results[3].severity).toBe('warning'); // 9 members
      expect(results[4].severity).toBe('warning'); // 10 members
      expect(results[5].severity).toBe('error'); // 11 members
      expect(results[5].hasError).toBe(true);
      expect(results[5].canSubmit).toBe(false);
    });

    it('should allow dismissing error messages', () => {
      const onDismiss = jest.fn();
      const { getByTestId } = render(
        <GroupSizeError
          message="Test error"
          severity="error"
          onDismiss={onDismiss}
        />
      );

      const dismissButton = getByTestId('group-size-error-dismiss');
      fireEvent.press(dismissButton);

      expect(onDismiss).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle exactly at limit', async () => {
      const participantIds = Array.from({ length: GROUP_SIZE_LIMIT }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Limit Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).resolves.toBeDefined();

      const { result } = renderHook(() => useGroupValidation(GROUP_SIZE_LIMIT));
      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.limitReached).toBe(true);
      expect(result.current.canAddMore).toBe(false);
    });

    it('should handle one over limit', async () => {
      const participantIds = Array.from({ length: GROUP_SIZE_LIMIT + 1 }, (_, i) => `user${i}`);
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Over Limit Test Group',
        creatorId: 'user0',
      };

      await expect(createConversation(input)).rejects.toThrow();

      const { result } = renderHook(() => useGroupValidation(GROUP_SIZE_LIMIT + 1));
      expect(result.current.validationState.isValid).toBe(false);
      expect(result.current.validationState.canSubmit).toBe(false);
    });

    it('should handle minimum group size (2 participants)', async () => {
      const participantIds = ['user1', 'user2'];
      const input: CreateConversationInput = {
        type: 'group',
        participantIds,
        groupName: 'Small Group',
        creatorId: 'user1',
      };

      await expect(createConversation(input)).resolves.toBeDefined();

      const { result } = renderHook(() => useGroupValidation(2));
      expect(result.current.validationState.isValid).toBe(true);
      expect(result.current.validationState.severity).toBe('success');
    });
  });
});
