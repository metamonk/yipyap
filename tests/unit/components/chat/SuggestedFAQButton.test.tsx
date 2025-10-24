/**
 * Unit tests for SuggestedFAQButton component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SuggestedFAQButton } from '@/components/chat/SuggestedFAQButton';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('SuggestedFAQButton', () => {
  const mockOnSend = jest.fn();

  const baseMessage: Message = {
    id: 'msg123',
    conversationId: 'conv123',
    senderId: 'user456',
    text: 'What are your rates?',
    status: 'delivered',
    readBy: ['user456'],
    timestamp: Timestamp.now(),
    metadata: {
      aiProcessed: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility', () => {
    it('should render when suggestedFAQ is present', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          faqMatchConfidence: 0.75,
          suggestedFAQ: {
            templateId: 'faq123',
            question: 'What are your rates?',
            answer: 'My rates start at $150 per hour.',
            confidence: 0.75,
          },
        },
      };

      const { getByTestId, getByText } = render(
        <SuggestedFAQButton message={message} onSend={mockOnSend} />
      );

      expect(getByTestId('suggested-faq-button')).toBeTruthy();
      expect(getByText('Suggested FAQ')).toBeTruthy();
    });

    it('should not render when suggestedFAQ is undefined', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          faqMatchConfidence: 0.75,
          // No suggestedFAQ field
        },
      };

      const { queryByTestId } = render(
        <SuggestedFAQButton message={message} onSend={mockOnSend} />
      );

      expect(queryByTestId('suggested-faq-button')).toBeNull();
    });

    it('should not render when metadata is undefined', () => {
      const message: Message = {
        ...baseMessage,
        metadata: undefined,
      };

      const { queryByTestId } = render(
        <SuggestedFAQButton message={message} onSend={mockOnSend} />
      );

      expect(queryByTestId('suggested-faq-button')).toBeNull();
    });
  });

  describe('Content Display', () => {
    const suggestedFAQMessage: Message = {
      ...baseMessage,
      metadata: {
        ...baseMessage.metadata,
        suggestedFAQ: {
          templateId: 'faq123',
          question: 'What are your rates?',
          answer: 'My rates start at $150 per hour.',
          confidence: 0.75,
        },
      },
    };

    it('should display FAQ question', () => {
      const { getByText } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      expect(getByText('What are your rates?')).toBeTruthy();
    });

    it('should display confidence percentage', () => {
      const { getByText } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      expect(getByText('75% match')).toBeTruthy();
    });

    it('should display "Send FAQ Response" button', () => {
      const { getByText } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      expect(getByText('Send FAQ Response')).toBeTruthy();
    });

    it('should display confidence as percentage rounded to nearest integer', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          suggestedFAQ: {
            templateId: 'faq123',
            question: 'Test question',
            answer: 'Test answer',
            confidence: 0.726, // 72.6% -> should round to 73%
          },
        },
      };

      const { getByText } = render(<SuggestedFAQButton message={message} onSend={mockOnSend} />);

      expect(getByText('73% match')).toBeTruthy();
    });
  });

  describe('Send Functionality', () => {
    const suggestedFAQMessage: Message = {
      ...baseMessage,
      metadata: {
        ...baseMessage.metadata,
        suggestedFAQ: {
          templateId: 'faq123',
          question: 'What are your rates?',
          answer: 'My rates start at $150 per hour.',
          confidence: 0.75,
        },
      },
    };

    it('should call onSend when Send button is pressed', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      const sendButton = getByTestId('send-faq-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith('faq123', 'My rates start at $150 per hour.');
      });
    });

    it('should disable button while sending', async () => {
      mockOnSend.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { getByTestId } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      const sendButton = getByTestId('send-faq-button');
      fireEvent.press(sendButton);

      // Button should be disabled during send
      expect(sendButton.props.accessibilityState?.disabled).toBe(true);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalled();
      });
    });

    it('should show loading indicator while sending', async () => {
      mockOnSend.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { getByTestId, queryByText, UNSAFE_queryByType } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      const sendButton = getByTestId('send-faq-button');
      fireEvent.press(sendButton);

      // Loading indicator should be shown
      await waitFor(() => {
        expect(UNSAFE_queryByType('ActivityIndicator' as any)).toBeTruthy();
      });

      // Button text should be hidden during loading
      expect(queryByText('Send FAQ Response')).toBeNull();
    });

    it('should show error alert when send fails', async () => {
      mockOnSend.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      const sendButton = getByTestId('send-faq-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to send FAQ response. Please try again.',
          [{ text: 'OK' }]
        );
      });
    });

    it('should re-enable button after send completes', async () => {
      mockOnSend.mockResolvedValue(undefined);

      const { getByTestId } = render(
        <SuggestedFAQButton message={suggestedFAQMessage} onSend={mockOnSend} />
      );

      const sendButton = getByTestId('send-faq-button');
      fireEvent.press(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalled();
      });

      // Button should be re-enabled after completion
      expect(sendButton.props.accessibilityState?.disabled).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty FAQ question gracefully', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          suggestedFAQ: {
            templateId: 'faq123',
            question: '',
            answer: 'Test answer',
            confidence: 0.75,
          },
        },
      };

      const { getByTestId } = render(<SuggestedFAQButton message={message} onSend={mockOnSend} />);

      // Should still render the component
      expect(getByTestId('suggested-faq-button')).toBeTruthy();
    });

    it('should handle confidence of 1.0 (100% match)', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          suggestedFAQ: {
            templateId: 'faq123',
            question: 'Exact match',
            answer: 'Perfect answer',
            confidence: 1.0,
          },
        },
      };

      const { getByText } = render(<SuggestedFAQButton message={message} onSend={mockOnSend} />);

      expect(getByText('100% match')).toBeTruthy();
    });

    it('should handle confidence at threshold (0.70)', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          suggestedFAQ: {
            templateId: 'faq123',
            question: 'Threshold match',
            answer: 'Threshold answer',
            confidence: 0.70,
          },
        },
      };

      const { getByText } = render(<SuggestedFAQButton message={message} onSend={mockOnSend} />);

      expect(getByText('70% match')).toBeTruthy();
    });
  });
});
