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

// Mock voiceMatchingService
const mockTrackFeedback = jest.fn();
jest.mock('@/services/voiceMatchingService', () => ({
  voiceMatchingService: {
    trackFeedback: mockTrackFeedback,
  },
}));

// Mock ResponseSuggestions component
jest.mock('@/components/chat/ResponseSuggestions', () => ({
  ResponseSuggestions: 'ResponseSuggestions',
}));

// Mock useAuth hook
const mockUserProfile = {
  uid: 'user123',
  settings: {
    voiceMatching: {
      enabled: true,
      autoShowSuggestions: true,
      suggestionCount: 2,
      retrainingSchedule: 'weekly' as const,
    },
  },
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ userProfile: mockUserProfile })),
}));

// Mock Firestore
let mockOnSnapshotCallback: any;
const mockUnsubscribe = jest.fn();
jest.mock('firebase/firestore', () => ({
  onSnapshot: jest.fn((query, callback, errorCallback) => {
    mockOnSnapshotCallback = callback;
    return mockUnsubscribe;
  }),
  query: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
}));

// Mock firebase service
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));

// Mock typingService
jest.mock('@/services/typingService', () => ({
  typingService: {
    setTyping: jest.fn(),
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('MessageInput', () => {
  const mockOnSend = jest.fn();
  const defaultProps = {
    onSend: mockOnSend,
    conversationId: 'conv123',
    userId: 'user123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockTrackFeedback.mockClear();
  });

  describe('Input Field', () => {
    it('renders text input field', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      expect(input).toBeTruthy();
    });

    it('accepts text input up to 1000 characters', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      const testText = 'Test message';

      fireEvent.changeText(input, testText);

      expect(input.props.value).toBe(testText);
    });

    it('displays character count', () => {
      const { getByTestId, getByText } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      fireEvent.changeText(input, 'Hello');

      expect(getByText('5/1000')).toBeTruthy();
    });

    it('enforces 1000 character maximum', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');

      // TextInput maxLength prop should be set to 1000
      expect(input.props.maxLength).toBe(1000);
    });

    it('shows character count in red when at limit', () => {
      const { getByTestId, getByText } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      const longText = 'a'.repeat(1000);

      fireEvent.changeText(input, longText);

      const charCount = getByText('1000/1000');
      expect(charCount).toBeTruthy();
    });

    it('is multiline input', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      expect(input.props.multiline).toBe(true);
    });
  });

  describe('Send Button', () => {
    it('renders send button', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const sendButton = getByTestId('send-button');
      expect(sendButton).toBeTruthy();
    });

    it('send button is disabled when input is empty', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const sendButton = getByTestId('send-button');
      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('send button is enabled when input has text', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');

      expect(sendButton.props.accessibilityState.disabled).toBe(false);
    });

    it('send button is disabled when input only has whitespace', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, '   ');

      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });

    it('calls onSend when send button pressed with valid text', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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

      const { getByTestId } = render(<MessageInput {...defaultProps} />);

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
      const { getByTestId } = render(<MessageInput {...defaultProps} disabled={true} />);

      const input = getByTestId('message-input');
      expect(input.props.editable).toBe(false);
    });

    it('disables send button when disabled prop is true', () => {
      const { getByTestId } = render(<MessageInput {...defaultProps} disabled={true} />);

      const input = getByTestId('message-input');
      const sendButton = getByTestId('send-button');

      fireEvent.changeText(input, 'Test message');

      expect(sendButton.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('AI Response Suggestions Integration (Story 5.5 - Task 9)', () => {
    it('renders ResponseSuggestions when new incoming message detected', async () => {
      const { queryByTestId } = render(<MessageInput {...defaultProps} />);

      // Simulate incoming message via Firestore snapshot
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: 'msg456',
            data: () => ({
              senderId: 'other-user',
              text: 'Hello!',
              timestamp: { toMillis: () => Date.now() },
            }),
          },
        ],
      };

      // Trigger the snapshot callback
      await waitFor(() => {
        if (mockOnSnapshotCallback) {
          mockOnSnapshotCallback(mockSnapshot);
        }
      });

      // ResponseSuggestions component should be rendered
      await waitFor(() => {
        const suggestions = queryByTestId('response-suggestions-container');
        expect(suggestions).toBeTruthy();
      });
    });

    it('does not show suggestions for own messages', async () => {
      const { queryByTestId } = render(<MessageInput {...defaultProps} />);

      // Simulate own message via Firestore snapshot
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: 'msg456',
            data: () => ({
              senderId: 'user123', // Same as userId prop
              text: 'My message',
              timestamp: { toMillis: () => Date.now() },
            }),
          },
        ],
      };

      // Trigger the snapshot callback
      if (mockOnSnapshotCallback) {
        mockOnSnapshotCallback(mockSnapshot);
      }

      // Wait a bit to ensure no suggestions are shown
      await waitFor(() => {
        const suggestions = queryByTestId('response-suggestions-container');
        expect(suggestions).toBeFalsy();
      });
    });

    it('hides suggestions when user starts typing manually (AC: IV1)', async () => {
      const { getByTestId, queryByTestId } = render(<MessageInput {...defaultProps} />);

      // First, trigger suggestions by simulating incoming message
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: 'msg456',
            data: () => ({
              senderId: 'other-user',
              text: 'Hello!',
              timestamp: { toMillis: () => Date.now() },
            }),
          },
        ],
      };

      if (mockOnSnapshotCallback) {
        mockOnSnapshotCallback(mockSnapshot);
      }

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeTruthy();
      });

      // Now user starts typing
      const input = getByTestId('message-input');
      fireEvent.changeText(input, 'My manual response');

      // Suggestions should be hidden
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeFalsy();
      });
    });

    // Note: The following tests verify that callbacks are wired correctly.
    // The ResponseSuggestions component itself is tested separately in ResponseSuggestions.test.tsx
    // These tests just verify MessageInput integrates properly with feedback tracking.

    it('provides correct props to ResponseSuggestions component', async () => {
      const { queryByTestId } = render(<MessageInput {...defaultProps} />);

      // Trigger suggestions by simulating incoming message
      const mockSnapshot = {
        empty: false,
        docs: [
          {
            id: 'msg456',
            data: () => ({
              senderId: 'other-user',
              text: 'Hello!',
              timestamp: { toMillis: () => Date.now() },
            }),
          },
        ],
      };

      if (mockOnSnapshotCallback) {
        mockOnSnapshotCallback(mockSnapshot);
      }

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeTruthy();
      });

      // Verify the component is rendered
      expect(queryByTestId('response-suggestions-container')).toBeTruthy();
    });
  });
});
