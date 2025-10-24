/**
 * Unit tests for ResponseSuggestions component
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { ResponseSuggestions } from '@/components/chat/ResponseSuggestions';
import { voiceMatchingService } from '@/services/voiceMatchingService';

// Mock the voice matching service
jest.mock('@/services/voiceMatchingService', () => ({
  voiceMatchingService: {
    generateSuggestions: jest.fn(),
  },
  VoiceMatchingErrorType: {
    PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
    INSUFFICIENT_DATA: 'INSUFFICIENT_DATA',
    TIMEOUT: 'TIMEOUT',
    UNAUTHENTICATED: 'UNAUTHENTICATED',
  },
}));

describe('ResponseSuggestions', () => {
  const mockOnAccept = jest.fn();
  const mockOnReject = jest.fn();
  const mockOnEdit = jest.fn();
  const mockOnComplete = jest.fn();

  const defaultProps = {
    conversationId: 'conv123',
    incomingMessageId: 'msg456',
    onAccept: mockOnAccept,
    onReject: mockOnReject,
    onEdit: mockOnEdit,
    onComplete: mockOnComplete,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading State', () => {
    it('should show loading indicator while fetching suggestions', () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      expect(getByText('Generating suggestions...')).toBeTruthy();
    });
  });

  describe('Success State', () => {
    it('should display suggestions after successful load', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: [{ text: 'Suggestion 1' }, { text: 'Suggestion 2' }],
      });

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Suggestion 1')).toBeTruthy();
      });
    });

    it('should show first suggestion initially', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }],
      });

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('First')).toBeTruthy();
        expect(getByText('1 of 3')).toBeTruthy();
      });
    });

    it('should call generateSuggestions with correct parameters', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: ['Test'],
      });

      render(<ResponseSuggestions {...defaultProps} suggestionCount={3} />);

      await waitFor(() => {
        expect(voiceMatchingService.generateSuggestions).toHaveBeenCalledWith(
          'conv123',
          'msg456',
          3
        );
      });
    });
  });

  describe('Error States', () => {
    it('should show error message when profile not found', async () => {
      const error = new Error('Profile not found');
      (error as any).type = 'PROFILE_NOT_FOUND';

      (voiceMatchingService.generateSuggestions as jest.Mock).mockRejectedValue(error);

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(
          getByText('Voice profile not trained. Train your profile in settings to use this feature.')
        ).toBeTruthy();
      });
    });

    it('should show error message when insufficient data', async () => {
      const error = new Error('Insufficient data');
      (error as any).type = 'INSUFFICIENT_DATA';

      (voiceMatchingService.generateSuggestions as jest.Mock).mockRejectedValue(error);

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(
          getByText('Not enough messages to generate suggestions. Keep chatting!')
        ).toBeTruthy();
      });
    });

    it('should show error message when timeout occurs', async () => {
      const error = new Error('Timeout');
      (error as any).type = 'TIMEOUT';

      (voiceMatchingService.generateSuggestions as jest.Mock).mockRejectedValue(error);

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Suggestion generation timed out. Please try again.')).toBeTruthy();
      });
    });

    it('should show error message when unauthenticated', async () => {
      const error = new Error('Unauthenticated');
      (error as any).type = 'UNAUTHENTICATED';

      (voiceMatchingService.generateSuggestions as jest.Mock).mockRejectedValue(error);

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Please sign in to use AI suggestions.')).toBeTruthy();
      });
    });

    it('should show generic error message for unknown errors', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockRejectedValue(
        new Error('Unknown error')
      );

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('Failed to load suggestions. Please try again.')).toBeTruthy();
      });
    });

    it('should allow retry after error', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ suggestions: [{ text: 'Retry success' }] });

      const { getByTestId, getByText } = render(<ResponseSuggestions {...defaultProps} />);

      // Wait for error state
      await waitFor(() => {
        expect(getByText('Failed to load suggestions. Please try again.')).toBeTruthy();
      });

      // Click retry
      fireEvent.press(getByTestId('retry-button'));

      // Should show success
      await waitFor(() => {
        expect(getByText('Retry success')).toBeTruthy();
      });
    });
  });

  describe('Edit Functionality', () => {
    it('should call onEdit when edit button is pressed', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: [{ text: 'Test suggestion' }],
      });

      const { getByTestId } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByTestId('edit-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('edit-button'));

      expect(mockOnEdit).toHaveBeenCalledWith('Test suggestion');
    });
  });

  describe('Visibility', () => {
    it('should not render when visible is false', () => {
      const { queryByText } = render(<ResponseSuggestions {...defaultProps} visible={false} />);

      expect(queryByText('Generating suggestions...')).toBeNull();
    });

    it('should render when visible is true', () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      const { getByText } = render(<ResponseSuggestions {...defaultProps} visible={true} />);

      expect(getByText('Generating suggestions...')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should not render when suggestions array is empty', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: [],
      });

      const { queryByTestId, queryByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        // Component should not render when suggestions are empty
        expect(queryByText('AI Suggestion')).toBeNull();
        expect(queryByText('Generating suggestions...')).toBeNull();
      });
    });
  });

  describe('Multiple Suggestions', () => {
    it('should handle multiple suggestions correctly', async () => {
      (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
        suggestions: [{ text: 'First' }, { text: 'Second' }, { text: 'Third' }],
      });

      const { getByText } = render(<ResponseSuggestions {...defaultProps} />);

      await waitFor(() => {
        expect(getByText('First')).toBeTruthy();
        expect(getByText('1 of 3')).toBeTruthy();
      });
    });
  });
});
