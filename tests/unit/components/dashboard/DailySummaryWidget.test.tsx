/**
 * Unit tests for DailySummaryWidget component (Story 5.7 - Task 3)
 *
 * @remarks
 * Tests the enhanced Daily Summary Widget that displays comprehensive
 * overnight activity metrics from all AI features (Stories 5.2-5.6).
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { DailySummaryWidget } from '@/components/dashboard/DailySummaryWidget';
import type { DashboardSummary } from '@/types/dashboard';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Timestamp
const mockTimestamp = (date: string) => ({
  toDate: () => new Date(date),
  toMillis: () => new Date(date).getTime(),
  seconds: Math.floor(new Date(date).getTime() / 1000),
  nanoseconds: 0,
}) as Timestamp;

/**
 * Mock dashboard summary data for testing
 */
const mockSummary: DashboardSummary = {
  userId: 'test-user-123',
  period: 'overnight',
  periodStart: mockTimestamp('2025-10-23T22:00:00'),
  periodEnd: mockTimestamp('2025-10-24T08:00:00'),
  messagingMetrics: {
    totalMessages: 42,
    byCategory: {
      fan_engagement: 20,
      business_opportunity: 8,
      spam: 2,
      urgent: 5,
      general: 7,
    },
    highValueOpportunities: 3,
    crisisMessages: 1,
  },
  sentimentMetrics: {
    positiveCount: 25,
    negativeCount: 5,
    neutralCount: 10,
    mixedCount: 2,
    averageSentimentScore: 0.45,
    crisisDetections: 1,
  },
  faqMetrics: {
    newQuestionsDetected: 4,
    autoResponsesSent: 8,
    faqMatchRate: 19.05,
  },
  voiceMatchingMetrics: {
    suggestionsGenerated: 15,
    suggestionsAccepted: 12,
    suggestionsEdited: 2,
    suggestionsRejected: 1,
    acceptanceRate: 80,
  },
  comparisonWithPrevious: {
    messageCountChange: 15.5,
    opportunityCountChange: 50.0,
    sentimentScoreChange: 0.1,
  },
  lastUpdated: mockTimestamp('2025-10-24T08:00:00'),
};

describe('DailySummaryWidget', () => {
  describe('Rendering with valid data', () => {
    it('should render successfully with mock data', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);

      expect(getByText('Overnight Summary')).toBeTruthy();
      expect(getByText('42')).toBeTruthy();
      expect(getByText('Messages')).toBeTruthy();
    });

    it('should render custom title when provided', () => {
      const { getByText } = render(
        <DailySummaryWidget summary={mockSummary} title="Custom Title" />
      );
      expect(getByText('Custom Title')).toBeTruthy();
    });

    it('should display all main stats correctly', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);

      expect(getByText('42')).toBeTruthy();
      expect(getByText('Messages')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
      expect(getByText('Opportunities')).toBeTruthy();
      expect(getByText('1')).toBeTruthy();
      expect(getByText('Crisis')).toBeTruthy();
    });

    it('should hide crisis card when no crisis messages', () => {
      const summaryWithoutCrisis: DashboardSummary = {
        ...mockSummary,
        messagingMetrics: {
          ...mockSummary.messagingMetrics,
          crisisMessages: 0,
        },
      };

      const { queryByText } = render(<DailySummaryWidget summary={summaryWithoutCrisis} />);
      expect(queryByText('Crisis')).toBeNull();
    });
  });

  describe('Loading state', () => {
    it('should display loading indicator when loading', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} loading={true} />);
      expect(getByText('Loading overnight summary...')).toBeTruthy();
    });

    it('should not display main content when loading', () => {
      const { queryByText } = render(<DailySummaryWidget summary={mockSummary} loading={true} />);
      expect(queryByText('Messages')).toBeNull();
    });
  });

  describe('Error state', () => {
    it('should display error message', () => {
      const errorMessage = 'Failed to load dashboard data';
      const { getByText } = render(
        <DailySummaryWidget summary={mockSummary} error={errorMessage} />
      );
      expect(getByText(errorMessage)).toBeTruthy();
    });

    it('should call onRefresh when retry button pressed', () => {
      const mockRefresh = jest.fn();
      const { getByText } = render(
        <DailySummaryWidget summary={mockSummary} error="Error" onRefresh={mockRefresh} />
      );

      fireEvent.press(getByText('Retry'));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Category breakdown', () => {
    it('should expand category details when header pressed', async () => {
      const { getByText, queryByText } = render(<DailySummaryWidget summary={mockSummary} />);

      expect(queryByText('Fan')).toBeNull();

      fireEvent.press(getByText('Categories'));

      await waitFor(() => {
        expect(getByText('Fan')).toBeTruthy();
        expect(getByText('Business')).toBeTruthy();
        expect(getByText('Urgent')).toBeTruthy();
      });
    });
  });

  describe('Sentiment and FAQ metrics', () => {
    it('should display sentiment section', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);
      expect(getByText('Sentiment')).toBeTruthy();
      expect(getByText('25')).toBeTruthy();
      expect(getByText('5')).toBeTruthy();
      expect(getByText('10')).toBeTruthy();
    });

    it('should display FAQ metrics', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);
      expect(getByText('FAQs')).toBeTruthy();
      expect(getByText('4')).toBeTruthy();
      expect(getByText('8')).toBeTruthy();
    });

    it('should display average sentiment score', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);
      expect(getByText(/Avg: \+0\.45/)).toBeTruthy();
    });

    it('should not show sentiment score when zero', () => {
      const zeroSentimentSummary: DashboardSummary = {
        ...mockSummary,
        sentimentMetrics: {
          ...mockSummary.sentimentMetrics,
          averageSentimentScore: 0,
        },
      };

      const { queryByText } = render(<DailySummaryWidget summary={zeroSentimentSummary} />);
      expect(queryByText(/Avg:/)).toBeNull();
    });
  });

  describe('Comparison indicators', () => {
    it('should display percentage changes', () => {
      const { getByText } = render(<DailySummaryWidget summary={mockSummary} />);
      // 15.5% rounds to 16%
      expect(getByText('16%')).toBeTruthy();
      expect(getByText('50%')).toBeTruthy();
    });

    it('should not display indicators when change is 0', () => {
      const summaryWithNoChange: DashboardSummary = {
        ...mockSummary,
        comparisonWithPrevious: {
          messageCountChange: 0,
          opportunityCountChange: 0,
          sentimentScoreChange: 0,
        },
      };

      const { queryByText } = render(<DailySummaryWidget summary={summaryWithNoChange} />);
      expect(queryByText(/^\d+%$/)).toBeNull();
    });
  });

  describe('Refresh functionality', () => {
    it('should call onRefresh when refresh button pressed', () => {
      const mockRefresh = jest.fn();
      const { getByLabelText } = render(
        <DailySummaryWidget summary={mockSummary} onRefresh={mockRefresh} />
      );

      fireEvent.press(getByLabelText('Refresh dashboard data'));
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility labels for main stats', () => {
      const { getByLabelText } = render(<DailySummaryWidget summary={mockSummary} />);
      expect(getByLabelText('42 messages')).toBeTruthy();
      expect(getByLabelText('3 high-value opportunities')).toBeTruthy();
    });

    it('should have accessibility role for container', () => {
      const { getByLabelText } = render(<DailySummaryWidget summary={mockSummary} />);
      expect(getByLabelText('Daily summary widget')).toBeTruthy();
    });
  });
});
