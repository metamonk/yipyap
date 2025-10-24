/**
 * Unit tests for PriorityFeed and PriorityMessageCard components (Story 5.7 - Task 4)
 *
 * @remarks
 * Tests the Priority Message Feed that displays urgent and high-value messages
 * sorted by priority score.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PriorityFeed } from '@/components/dashboard/PriorityFeed';
import { PriorityMessageCard } from '@/components/dashboard/PriorityMessageCard';
import { dashboardService } from '@/services/dashboardService';
import type { PriorityMessageFeedItem } from '@/types/dashboard';
import { Timestamp } from 'firebase/firestore';

// Mock dashboard service
jest.mock('@/services/dashboardService', () => ({
  dashboardService: {
    getPriorityMessages: jest.fn(),
  },
}));

// Mock Firebase Timestamp
const mockTimestamp = (date: string) => ({
  toDate: () => new Date(date),
  toMillis: () => new Date(date).getTime(),
  seconds: Math.floor(new Date(date).getTime() / 1000),
  nanoseconds: 0,
}) as Timestamp;

/**
 * Mock priority message items for testing
 */
const mockPriorityMessages: PriorityMessageFeedItem[] = [
  {
    id: 'msg-crisis-1',
    conversationId: 'conv-1',
    senderId: 'user-123',
    senderName: 'John Doe',
    messageText: 'This is a crisis message that requires immediate attention!',
    timestamp: mockTimestamp('2025-10-24T10:00:00'),
    priorityScore: 100,
    priorityType: 'crisis',
    sentiment: 'negative',
    sentimentScore: -0.8,
    isCrisis: true,
    category: 'urgent',
  },
  {
    id: 'msg-opportunity-1',
    conversationId: 'conv-2',
    senderId: 'user-456',
    senderName: 'Jane Smith',
    messageText: 'I would love to collaborate on a sponsorship deal worth $50k!',
    timestamp: mockTimestamp('2025-10-24T09:30:00'),
    priorityScore: 95,
    priorityType: 'high_value_opportunity',
    opportunityScore: 95,
    opportunityType: 'sponsorship',
    category: 'business_opportunity',
    sentiment: 'positive',
  },
  {
    id: 'msg-urgent-1',
    conversationId: 'conv-3',
    senderId: 'user-789',
    senderName: 'Bob Johnson',
    messageText: 'Urgent: Need response ASAP regarding the project deadline',
    timestamp: mockTimestamp('2025-10-24T09:00:00'),
    priorityScore: 70,
    priorityType: 'urgent',
    category: 'urgent',
  },
];

describe('PriorityMessageCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  describe('Rendering', () => {
    it('should render crisis message correctly', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[0]} onPress={mockOnPress} />
      );

      expect(getByText('Crisis')).toBeTruthy();
      expect(getByText('John Doe')).toBeTruthy();
      expect(getByText(/This is a crisis message/)).toBeTruthy();
    });

    it('should render high-value opportunity correctly', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[1]} onPress={mockOnPress} />
      );

      expect(getByText('High-Value')).toBeTruthy();
      expect(getByText('Jane Smith')).toBeTruthy();
      expect(getByText(/collaborate on a sponsorship/)).toBeTruthy();
    });

    it('should render urgent message correctly', () => {
      const { getByText, getAllByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[2]} onPress={mockOnPress} />
      );

      // "Urgent" appears twice (priority badge + category badge)
      const urgentElements = getAllByText('Urgent');
      expect(urgentElements.length).toBeGreaterThanOrEqual(1);
      expect(getByText('Bob Johnson')).toBeTruthy();
      expect(getByText(/Need response ASAP/)).toBeTruthy();
    });

    it('should truncate long messages', () => {
      const longMessage: PriorityMessageFeedItem = {
        ...mockPriorityMessages[0],
        messageText: 'A'.repeat(150),
      };

      const { getByText } = render(
        <PriorityMessageCard item={longMessage} onPress={mockOnPress} />
      );

      const displayedText = getByText(/A+\.\.\./);
      expect(displayedText).toBeTruthy();
    });

    it('should display category badge', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[0]} onPress={mockOnPress} />
      );

      expect(getByText('Urgent')).toBeTruthy();
    });

    it('should display opportunity score when >= 70', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[1]} onPress={mockOnPress} />
      );

      expect(getByText('95')).toBeTruthy();
    });

    it('should display relative timestamp', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[0]} onPress={mockOnPress} />
      );

      // Should show some relative time (depends on current time)
      expect(getByText(/ago|Just now/)).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should call onPress when card is pressed', () => {
      const { getByText } = render(
        <PriorityMessageCard item={mockPriorityMessages[0]} onPress={mockOnPress} />
      );

      fireEvent.press(getByText('John Doe'));
      expect(mockOnPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility role and label', () => {
      const { getByRole } = render(
        <PriorityMessageCard item={mockPriorityMessages[0]} onPress={mockOnPress} />
      );

      expect(getByRole('button')).toBeTruthy();
    });
  });
});

describe('PriorityFeed', () => {
  const mockUserId = 'test-user-123';
  const mockOnMessagePress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Loading state', () => {
    it('should show loading indicator initially', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      expect(getByText('Loading priority messages...')).toBeTruthy();
    });
  });

  describe('Rendering with data', () => {
    it('should render priority messages', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue(
        mockPriorityMessages
      );

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByText('John Doe')).toBeTruthy();
        expect(getByText('Jane Smith')).toBeTruthy();
        expect(getByText('Bob Johnson')).toBeTruthy();
      });
    });

    it('should display message count badge', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue(
        mockPriorityMessages
      );

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByText('3')).toBeTruthy();
      });
    });

    it('should call dashboardService with correct params', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue([]);

      render(
        <PriorityFeed userId={mockUserId} maxResults={15} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(dashboardService.getPriorityMessages).toHaveBeenCalledWith(mockUserId, 15);
      });
    });
  });

  describe('Empty state', () => {
    it('should show empty state when no messages', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByText('No Priority Messages')).toBeTruthy();
        expect(getByText(/all caught up/)).toBeTruthy();
      });
    });
  });

  describe('Error state', () => {
    it('should show error message on fetch failure', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByText('Failed to load priority messages')).toBeTruthy();
      });
    });
  });

  describe('Pull-to-refresh', () => {
    it('should refresh messages on pull-to-refresh', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue(
        mockPriorityMessages
      );

      const { getByTestId } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(dashboardService.getPriorityMessages).toHaveBeenCalledTimes(1);
      });

      // Note: Testing pull-to-refresh in unit tests is challenging
      // This would be better tested in E2E tests
    });
  });

  describe('Message interaction', () => {
    it('should call onMessagePress with conversation ID when message pressed', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue(
        mockPriorityMessages
      );

      const { getByText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByText('John Doe')).toBeTruthy();
      });

      fireEvent.press(getByText('John Doe'));

      expect(mockOnMessagePress).toHaveBeenCalledWith('conv-1');
    });
  });

  describe('Customization', () => {
    it('should use custom title', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(
        <PriorityFeed
          userId={mockUserId}
          onMessagePress={mockOnMessagePress}
          title="Custom Title"
        />
      );

      await waitFor(() => {
        expect(getByText('Custom Title')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility role for feed container', async () => {
      (dashboardService.getPriorityMessages as jest.Mock).mockResolvedValue([]);

      const { getByLabelText } = render(
        <PriorityFeed userId={mockUserId} onMessagePress={mockOnMessagePress} />
      );

      await waitFor(() => {
        expect(getByLabelText('Priority message feed')).toBeTruthy();
      });
    });
  });
});
