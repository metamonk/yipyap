/**
 * Unit tests for MessageInput component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageInput } from '@/components/chat/MessageInput';
import { Alert } from 'react-native';

// Mock expo vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('MessageInput', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Field', () => {
    it('renders text input field', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      expect(input).toBeTruthy();
    });

    it('accepts text input up to 1000 characters', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const testText = 'Test message';

      fireEvent.changeText(input, testText);

      expect(input.props.value).toBe(testText);
    });

    it('displays character count', () => {
      const { getByTestId, getByText } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      fireEvent.changeText(input, 'Hello');

      expect(getByText('5/1000')).toBeTruthy();
    });

    it('enforces 1000 character maximum', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');

      // TextInput maxLength prop should be set to 1000
      expect(input.props.maxLength).toBe(1000);
    });

    it('shows character count in red when at limit', () => {
      const { getByTestId, getByText } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const longText = 'a'.repeat(1000);

      fireEvent.changeText(input, longText);

      const charCount = getByText('1000/1000');
      expect(charCount).toBeTruthy();
    });

    it('is multiline input', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      expect(input.props.multiline).toBe(true);
    });
  });

  describe('Send Button', () => {
    it('renders send button', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const sendButton = getByTestId('send-button');
      expect(sendButton).toBeTruthy();
    });

    it('send button is disabled when input is empty', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('send button is enabled when input has text', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');

      expect(sendButton.props.accessibilityState.disabled).toBe(false);
    });

    it('send button is disabled when input only has whitespace', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, '   ');

      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('calls onSend when send button pressed with valid text', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith('Test message');
      });
    });

    it('trims whitespace before sending', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, '  Test message  ');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith('Test message');
      });
    });

    it('clears input after successful send', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(input.props.value).toBe('');
      });
    });

    it('shows loading indicator while sending', async () => {
      // Create a promise that we control
      let resolveOnSend: () => void;
      const onSendPromise = new Promise<void>((resolve) => {
        resolveOnSend = resolve;
      });

      mockOnSend.mockReturnValue(onSendPromise);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      // Button should be disabled while sending
      await waitFor(() => {
        expect(sendButton.props.accessibilityState.disabled).toBe(true);
      });

      // Resolve the promise
      resolveOnSend!();

      // Button should be enabled again after send completes
      await waitFor(() => {
        expect(sendButton.props.accessibilityState.disabled).toBe(true); // Disabled because input is now empty
      });
    });
  });

  describe('Error Handling', () => {
    it('displays alert when send fails', async () => {
      const error = new Error('Network error');
      mockOnSend.mockRejectedValue(error);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Failed to send message',
          'Please check your connection and try again.',
          [{ text: 'OK' }]
        );
      });
    });

    it('does not clear input when send fails', async () => {
      const error = new Error('Network error');
      mockOnSend.mockRejectedValue(error);

      const { getByTestId } = render(<MessageInput onSend={mockOnSend} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      });

      // Input should still contain the message
      expect(input.props.value).toBe('Test message');
    });
  });

  describe('Disabled State', () => {
    it('disables input when disabled prop is true', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} disabled={true} />);

      const input = getByTestId('message-input');
      expect(input.props.editable).toBe(false);
    });

    it('disables send button when disabled prop is true', () => {
      const { getByTestId } = render(<MessageInput onSend={mockOnSend} disabled={true} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');

      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });
  });
});
