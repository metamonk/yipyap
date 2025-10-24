/**
 * Unit tests for AutoReplyBadge component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { AutoReplyBadge } from '@/components/chat/AutoReplyBadge';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

describe('AutoReplyBadge', () => {
  const baseMessage: Message = {
    id: 'msg123',
    conversationId: 'conv123',
    senderId: 'user123',
    text: 'This is an auto-replied message',
    status: 'delivered',
    readBy: ['user123'],
    timestamp: Timestamp.now(),
    metadata: {
      aiProcessed: true,
      aiVersion: 'faq-auto-response-v1',
    },
  };

  describe('Visibility', () => {
    it('should render when autoResponseSent is true', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: true,
          faqTemplateId: 'faq123',
        },
      };

      const { getByTestId, getByText } = render(<AutoReplyBadge message={message} />);

      expect(getByTestId('auto-reply-badge')).toBeTruthy();
      expect(getByText('Auto-replied')).toBeTruthy();
    });

    it('should not render when autoResponseSent is false', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: false,
        },
      };

      const { queryByTestId, queryByText } = render(<AutoReplyBadge message={message} />);

      expect(queryByTestId('auto-reply-badge')).toBeNull();
      expect(queryByText('Auto-replied')).toBeNull();
    });

    it('should not render when autoResponseSent is undefined', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          // autoResponseSent not defined
        },
      };

      const { queryByTestId, queryByText } = render(<AutoReplyBadge message={message} />);

      expect(queryByTestId('auto-reply-badge')).toBeNull();
      expect(queryByText('Auto-replied')).toBeNull();
    });

    it('should not render when metadata is undefined', () => {
      const message: Message = {
        ...baseMessage,
        metadata: undefined,
      };

      const { queryByTestId, queryByText } = render(<AutoReplyBadge message={message} />);

      expect(queryByTestId('auto-reply-badge')).toBeNull();
      expect(queryByText('Auto-replied')).toBeNull();
    });
  });

  describe('Content Display', () => {
    it('should display "Auto-replied" text', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: true,
        },
      };

      const { getByText } = render(<AutoReplyBadge message={message} />);

      const text = getByText('Auto-replied');
      expect(text).toBeTruthy();
      expect(text.props.children).toBe('Auto-replied');
    });

    it('should display badge container with icon and text', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: true,
        },
      };

      const { getByTestId, getByText } = render(<AutoReplyBadge message={message} />);

      // Verify badge container is present
      const badge = getByTestId('auto-reply-badge');
      expect(badge).toBeTruthy();

      // Verify text is present within the badge
      expect(getByText('Auto-replied')).toBeTruthy();
    });
  });

  describe('Integration with Message Metadata', () => {
    it('should render for messages with FAQ template ID', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: true,
          faqTemplateId: 'faq456',
          faqMatchConfidence: 0.95,
        },
      };

      const { getByTestId } = render(<AutoReplyBadge message={message} />);

      expect(getByTestId('auto-reply-badge')).toBeTruthy();
    });

    it('should render for messages with auto-response ID', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          ...baseMessage.metadata,
          autoResponseSent: true,
          autoResponseId: 'response123',
        },
      };

      const { getByTestId } = render(<AutoReplyBadge message={message} />);

      expect(getByTestId('auto-reply-badge')).toBeTruthy();
    });

    it('should render even without FAQ metadata (other auto-response types)', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          autoResponseSent: true,
          // No faqTemplateId or other FAQ fields
        },
      };

      const { getByTestId } = render(<AutoReplyBadge message={message} />);

      // Badge should still render - autoResponseSent is the only requirement
      expect(getByTestId('auto-reply-badge')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle message with only autoResponseSent flag', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          autoResponseSent: true,
        },
      };

      const { getByTestId } = render(<AutoReplyBadge message={message} />);

      expect(getByTestId('auto-reply-badge')).toBeTruthy();
    });

    it('should not render for manual messages with FAQ detection but no auto-response', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {
          isFAQ: true,
          faqTemplateId: 'faq123',
          faqMatchConfidence: 0.87,
          autoResponseSent: false, // Manual response, not auto
        },
      };

      const { queryByTestId } = render(<AutoReplyBadge message={message} />);

      // Should NOT render because autoResponseSent is false
      expect(queryByTestId('auto-reply-badge')).toBeNull();
    });

    it('should handle empty metadata object', () => {
      const message: Message = {
        ...baseMessage,
        metadata: {},
      };

      const { queryByTestId } = render(<AutoReplyBadge message={message} />);

      expect(queryByTestId('auto-reply-badge')).toBeNull();
    });
  });
});
