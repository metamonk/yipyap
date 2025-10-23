/**
 * Unit tests for MessageStatus component
 *
 * @remarks
 * Tests message delivery status indicators:
 * - sending: clock icon
 * - delivered: double gray checkmark
 * - read: double blue checkmark
 * - failed: red exclamation with retry button
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageStatus } from '@/components/chat/MessageStatus';

describe('MessageStatus', () => {
  describe('sending status', () => {
    it('displays clock icon for sending status', () => {
      const { getByTestId } = render(<MessageStatus status="sending" />);

      const sendingElement = getByTestId('status-sending');
      expect(sendingElement).toBeTruthy();
    });

    it('does not display retry button for sending status', () => {
      const { queryByTestId } = render(<MessageStatus status="sending" />);

      const retryButton = queryByTestId('retry-button');
      expect(retryButton).toBeNull();
    });
  });

  describe('delivered status', () => {
    it('displays double checkmark for delivered status', () => {
      const { getByTestId } = render(<MessageStatus status="delivered" />);

      const deliveredElement = getByTestId('status-delivered');
      expect(deliveredElement).toBeTruthy();
    });

    it('does not display retry button for delivered status', () => {
      const { queryByTestId } = render(<MessageStatus status="delivered" />);

      const retryButton = queryByTestId('retry-button');
      expect(retryButton).toBeNull();
    });
  });

  describe('read status', () => {
    it('displays double blue checkmark for read status', () => {
      const { getByTestId } = render(<MessageStatus status="read" />);

      const readElement = getByTestId('status-read');
      expect(readElement).toBeTruthy();
    });

    // Story 3.3 TEST-004: Verify blue checkmark color
    it('displays checkmarks in blue color (#007AFF) for read status', () => {
      const { getByTestId, UNSAFE_getAllByType } = render(<MessageStatus status="read" />);

      const readElement = getByTestId('status-read');
      expect(readElement).toBeTruthy();

      // Get all Ionicons within the read status element
      const checkmarks = UNSAFE_getAllByType(
        require('@expo/vector-icons').Ionicons as React.ComponentType
      );

      // Should have 2 checkmarks (double checkmark)
      expect(checkmarks.length).toBeGreaterThanOrEqual(2);

      // Both checkmarks should be blue (#007AFF)
      const blueCheckmarks = checkmarks.filter((icon) => icon.props.color === '#007AFF');
      expect(blueCheckmarks.length).toBeGreaterThanOrEqual(2);

      // Verify checkmark icon name
      const checkmarkIcons = checkmarks.filter((icon) => icon.props.name === 'checkmark');
      expect(checkmarkIcons.length).toBeGreaterThanOrEqual(2);
    });

    it('displays two checkmarks (double checkmark) for read status', () => {
      const { UNSAFE_getAllByType } = render(<MessageStatus status="read" />);

      const checkmarks = UNSAFE_getAllByType(
        require('@expo/vector-icons').Ionicons as React.ComponentType
      );

      // Filter to checkmark icons only (in case there are other icons)
      const checkmarkIcons = checkmarks.filter((icon) => icon.props.name === 'checkmark');

      // Should have exactly 2 checkmarks
      expect(checkmarkIcons.length).toBe(2);
    });

    it('does not display retry button for read status', () => {
      const { queryByTestId } = render(<MessageStatus status="read" />);

      const retryButton = queryByTestId('retry-button');
      expect(retryButton).toBeNull();
    });
  });

  describe('failed status', () => {
    it('displays exclamation icon for failed status', () => {
      const { getByTestId } = render(<MessageStatus status="failed" />);

      const failedElement = getByTestId('status-failed');
      expect(failedElement).toBeTruthy();
    });

    it('displays retry button when onRetry is provided', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(<MessageStatus status="failed" onRetry={onRetry} />);

      const retryButton = getByTestId('retry-button');
      expect(retryButton).toBeTruthy();
    });

    it('calls onRetry when retry button is pressed', () => {
      const onRetry = jest.fn();
      const { getByTestId } = render(<MessageStatus status="failed" onRetry={onRetry} />);

      const retryButton = getByTestId('retry-button');
      fireEvent.press(retryButton);

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not display retry button when onRetry is not provided', () => {
      const { queryByTestId } = render(<MessageStatus status="failed" />);

      const retryButton = queryByTestId('retry-button');
      expect(retryButton).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles rapid status changes without errors', () => {
      const { rerender } = render(<MessageStatus status="sending" />);

      rerender(<MessageStatus status="delivered" />);
      rerender(<MessageStatus status="read" />);
      rerender(<MessageStatus status="failed" />);

      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('handles retry callback changes', () => {
      const onRetry1 = jest.fn();
      const onRetry2 = jest.fn();

      const { getByTestId, rerender } = render(
        <MessageStatus status="failed" onRetry={onRetry1} />
      );

      const retryButton = getByTestId('retry-button');
      fireEvent.press(retryButton);
      expect(onRetry1).toHaveBeenCalledTimes(1);

      // Change callback
      rerender(<MessageStatus status="failed" onRetry={onRetry2} />);
      fireEvent.press(retryButton);
      expect(onRetry2).toHaveBeenCalledTimes(1);
      expect(onRetry1).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });
});
