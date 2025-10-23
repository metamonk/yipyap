/**
 * Unit tests for GroupSizeError component
 * @module tests/unit/components/groups/GroupSizeError.test
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { GroupSizeError } from '@/components/groups/GroupSizeError';

// Mock AccessibilityInfo using jest.spyOn
const announceForAccessibility = jest.fn();
jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(announceForAccessibility);

describe('GroupSizeError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render error message', () => {
      const { getByText } = render(
        <GroupSizeError message="Test error message" severity="error" />
      );

      expect(getByText('Test error message')).toBeTruthy();
    });

    it('should render warning message', () => {
      const { getByText } = render(
        <GroupSizeError message="Test warning message" severity="warning" />
      );

      expect(getByText('Test warning message')).toBeTruthy();
    });

    it('should render suggestion text when provided', () => {
      const { getByText } = render(
        <GroupSizeError
          message="Error message"
          severity="error"
          suggestion="Remove some members"
        />
      );

      expect(getByText('Error message')).toBeTruthy();
      expect(getByText('Remove some members')).toBeTruthy();
    });

    it('should not render suggestion text when not provided', () => {
      const { queryByTestId } = render(
        <GroupSizeError message="Error message" severity="error" />
      );

      expect(queryByTestId('group-size-error-suggestion')).toBeNull();
    });

    it('should use custom testID when provided', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" testID="custom-error" />
      );

      expect(getByTestId('custom-error')).toBeTruthy();
      expect(getByTestId('custom-error-icon')).toBeTruthy();
      expect(getByTestId('custom-error-message')).toBeTruthy();
    });
  });

  describe('severity styling', () => {
    it('should display error icon for error severity', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Error" severity="error" />
      );

      const icon = getByTestId('group-size-error-icon');
      expect(icon.props.name).toBe('alert-circle');
    });

    it('should display warning icon for warning severity', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Warning" severity="warning" />
      );

      const icon = getByTestId('group-size-error-icon');
      expect(icon.props.name).toBe('warning');
    });

    it('should apply error color scheme', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Error" severity="error" />
      );

      const container = getByTestId('group-size-error');
      expect(container.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#FFEBEE' })
      );

      const message = getByTestId('group-size-error-message');
      expect(message.props.style).toContainEqual({ color: '#C62828' });
    });

    it('should apply warning color scheme', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Warning" severity="warning" />
      );

      const container = getByTestId('group-size-error');
      expect(container.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#FFF3E0' })
      );

      const message = getByTestId('group-size-error-message');
      expect(message.props.style).toContainEqual({ color: '#E65100' });
    });
  });

  describe('dismiss functionality', () => {
    it('should show dismiss button by default', () => {
      const onDismiss = jest.fn();
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" onDismiss={onDismiss} />
      );

      expect(getByTestId('group-size-error-dismiss')).toBeTruthy();
    });

    it('should hide dismiss button when dismissible is false', () => {
      const onDismiss = jest.fn();
      const { queryByTestId } = render(
        <GroupSizeError
          message="Test"
          severity="error"
          dismissible={false}
          onDismiss={onDismiss}
        />
      );

      expect(queryByTestId('group-size-error-dismiss')).toBeNull();
    });

    it('should hide dismiss button when onDismiss is not provided', () => {
      const { queryByTestId } = render(
        <GroupSizeError message="Test" severity="error" />
      );

      expect(queryByTestId('group-size-error-dismiss')).toBeNull();
    });

    it('should call onDismiss when dismiss button is pressed', () => {
      const onDismiss = jest.fn();
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" onDismiss={onDismiss} />
      );

      const dismissButton = getByTestId('group-size-error-dismiss');
      fireEvent.press(dismissButton);

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('should remove component from view after dismiss', () => {
      const onDismiss = jest.fn();
      const { getByTestId, queryByTestId, rerender } = render(
        <GroupSizeError message="Test" severity="error" onDismiss={onDismiss} />
      );

      const dismissButton = getByTestId('group-size-error-dismiss');
      fireEvent.press(dismissButton);

      // Component should be removed immediately after dismiss
      rerender(<GroupSizeError message="Test" severity="error" onDismiss={onDismiss} />);
      expect(queryByTestId('group-size-error')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('should have alert role', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" />
      );

      const container = getByTestId('group-size-error');
      expect(container.props.accessibilityRole).toBe('alert');
    });

    it('should have polite live region', () => {
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" />
      );

      const container = getByTestId('group-size-error');
      expect(container.props.accessibilityLiveRegion).toBe('polite');
    });

    it('should announce message to screen readers on mount', () => {
      render(<GroupSizeError message="Test error" severity="error" />);

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Test error');
    });

    it('should announce message with suggestion to screen readers', () => {
      render(
        <GroupSizeError
          message="Test error"
          severity="error"
          suggestion="Try this fix"
        />
      );

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        'Test error. Try this fix'
      );
    });

    it('should have accessible dismiss button', () => {
      const onDismiss = jest.fn();
      const { getByTestId } = render(
        <GroupSizeError message="Test" severity="error" onDismiss={onDismiss} />
      );

      const dismissButton = getByTestId('group-size-error-dismiss');
      expect(dismissButton.props.accessibilityRole).toBe('button');
      expect(dismissButton.props.accessibilityLabel).toBe('Dismiss message');
      expect(dismissButton.props.accessibilityHint).toBe('Removes this message from view');
    });

    it('should have accessible text roles', () => {
      const { getByTestId } = render(
        <GroupSizeError
          message="Test"
          severity="error"
          suggestion="Fix it"
        />
      );

      const message = getByTestId('group-size-error-message');
      expect(message.props.accessibilityRole).toBe('text');

      const suggestion = getByTestId('group-size-error-suggestion');
      expect(suggestion.props.accessibilityRole).toBe('text');
    });
  });

  describe('message updates', () => {
    it('should announce new message when updated', () => {
      const { rerender } = render(
        <GroupSizeError message="First message" severity="error" />
      );

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('First message');

      rerender(<GroupSizeError message="Second message" severity="error" />);

      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Second message');
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(2);
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      const { getByTestId } = render(<GroupSizeError message="" severity="error" />);

      expect(getByTestId('group-size-error')).toBeTruthy();
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(500);
      const { getByText } = render(
        <GroupSizeError message={longMessage} severity="error" />
      );

      expect(getByText(longMessage)).toBeTruthy();
    });

    it('should handle special characters in message', () => {
      const specialMessage = "Error: Can't add more users (limit: 10)";
      const { getByText } = render(
        <GroupSizeError message={specialMessage} severity="error" />
      );

      expect(getByText(specialMessage)).toBeTruthy();
    });
  });

  describe('multiple errors', () => {
    it('should render multiple error components independently', () => {
      const { getByTestId } = render(
        <>
          <GroupSizeError message="Error 1" severity="error" testID="error-1" />
          <GroupSizeError message="Warning 1" severity="warning" testID="warning-1" />
        </>
      );

      // Verify both components render independently
      expect(getByTestId('error-1')).toBeTruthy();
      expect(getByTestId('warning-1')).toBeTruthy();
    });
  });
});
