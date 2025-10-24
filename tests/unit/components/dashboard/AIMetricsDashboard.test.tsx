/**
 * Unit tests for AIMetricsDashboard component (Story 5.7 - Task 5)
 *
 * @remarks
 * Tests the AI Performance Metrics Dashboard that displays metrics
 * from all AI features with trend charts and period selection.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { AIMetricsDashboard } from '@/components/dashboard/AIMetricsDashboard';
import { dashboardService } from '@/services/dashboardService';
import type { AIPerformanceMetrics } from '@/types/dashboard';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase Timestamp
const mockTimestamp = (date: string) => ({
  toDate: () => new Date(date),
  toMillis: () => new Date(date).getTime(),
  seconds: Math.floor(new Date(date).getTime() / 1000),
  nanoseconds: 0,
}) as Timestamp;

// Mock dashboardService
jest.mock('@/services/dashboardService', () => ({
  dashboardService: {
    getAIPerformanceMetrics: jest.fn(),
  },
}));

/**
 * Mock AI performance metrics data for testing
 */
const mockMetrics: AIPerformanceMetrics = {
  userId: 'test-user-123',
  period: '7days',
  periodStart: mockTimestamp('2025-10-17'),
  categorizationMetrics: {
    totalCategorized: 250,
    accuracy: 92.5,
    averageLatency: 150,
  },
  timeSavedMetrics: {
    totalMinutesSaved: 180,
    fromAutoResponses: 120,
    fromSuggestions: 45,
    fromCategorization: 15,
  },
  costMetrics: {
    totalCostUSD: 12.45,
    byCost: {
      categorization: 3.20,
      sentiment: 2.10,
      opportunityScoring: 1.80,
      voiceMatching: 3.50,
      faqDetection: 1.85,
    },
    averageCostPerMessage: 0.0498,
  },
  performanceTrends: [
    { date: '2025-10-18', accuracy: 90.0, timeSaved: 25, cost: 1.50 },
    { date: '2025-10-19', accuracy: 91.5, timeSaved: 28, cost: 1.75 },
    { date: '2025-10-20', accuracy: 92.0, timeSaved: 26, cost: 1.80 },
    { date: '2025-10-21', accuracy: 93.0, timeSaved: 30, cost: 1.90 },
    { date: '2025-10-22', accuracy: 92.5, timeSaved: 27, cost: 1.85 },
    { date: '2025-10-23', accuracy: 94.0, timeSaved: 29, cost: 2.00 },
    { date: '2025-10-24', accuracy: 92.5, timeSaved: 15, cost: 1.65 },
  ],
  lastCalculated: mockTimestamp('2025-10-24T08:00:00'),
};

describe('AIMetricsDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (dashboardService.getAIPerformanceMetrics as jest.Mock).mockResolvedValue(mockMetrics);
  });

  describe('Rendering with valid data', () => {
    it('should render successfully with mock data', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('AI Performance Metrics')).toBeTruthy();
      });
    });

    it('should display categorization accuracy metric', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('Categorization Accuracy')).toBeTruthy();
        expect(getByText('92.5%')).toBeTruthy();
        expect(getByText('250 messages')).toBeTruthy();
      });
    });

    it('should display time saved metric', async () => {
      const { getByText, getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('Time Saved')).toBeTruthy();
        expect(getByLabelText('180 minutes saved')).toBeTruthy();
        expect(getByText('Auto-responses: 120m')).toBeTruthy();
        expect(getByText('Suggestions: 45m')).toBeTruthy();
      });
    });

    it('should display voice matching metric', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('Voice Matching')).toBeTruthy();
        expect(getByText('Acceptance rate')).toBeTruthy();
      });
    });

    it('should display FAQ auto-response metric', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('FAQ Auto-Response')).toBeTruthy();
        expect(getByText('Match rate')).toBeTruthy();
      });
    });
  });

  describe('Loading state', () => {
    it('should show loading indicator while fetching data', () => {
      const { getByText } = render(<AIMetricsDashboard userId="test-user-123" />);

      expect(getByText('Loading AI metrics...')).toBeTruthy();
    });
  });

  describe('Error state', () => {
    it('should show error message when fetch fails', async () => {
      (dashboardService.getAIPerformanceMetrics as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByText } = render(<AIMetricsDashboard userId="test-user-123" />);

      await waitFor(() => {
        expect(getByText('Failed to load AI metrics')).toBeTruthy();
      });
    });

    it('should show retry button in error state', async () => {
      (dashboardService.getAIPerformanceMetrics as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const mockRefresh = jest.fn();
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" onRefresh={mockRefresh} />
      );

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('should call refresh when retry button is pressed', async () => {
      (dashboardService.getAIPerformanceMetrics as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      );

      const mockRefresh = jest.fn();
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" onRefresh={mockRefresh} />
      );

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });

      (dashboardService.getAIPerformanceMetrics as jest.Mock).mockResolvedValue(mockMetrics);
      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Collapsible functionality', () => {
    it('should start collapsed when initiallyCollapsed is true', async () => {
      const { queryByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={true} />
      );

      await waitFor(() => {
        expect(queryByText('7 Days')).toBeNull();
      });
    });

    it('should show collapsed preview with key metrics', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={true} />
      );

      await waitFor(() => {
        expect(getByText('Accuracy:')).toBeTruthy();
        expect(getByText('92.5%')).toBeTruthy();
        expect(getByText('Time Saved:')).toBeTruthy();
        expect(getByText('180 min')).toBeTruthy();
      });
    });

    it('should expand when header is pressed', async () => {
      const { getByLabelText, getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={true} />
      );

      await waitFor(() => {
        expect(getByText('AI Performance Metrics')).toBeTruthy();
      });

      const expandButton = getByLabelText('Expand AI metrics');
      fireEvent.press(expandButton);

      await waitFor(() => {
        expect(getByText('7 Days')).toBeTruthy();
        expect(getByText('30 Days')).toBeTruthy();
        expect(getByText('90 Days')).toBeTruthy();
      });
    });

    it('should collapse when header is pressed while expanded', async () => {
      const { getByLabelText, queryByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(queryByText('7 Days')).toBeTruthy();
      });

      const collapseButton = getByLabelText('Collapse AI metrics');
      fireEvent.press(collapseButton);

      await waitFor(() => {
        expect(queryByText('7 Days')).toBeNull();
      });
    });
  });

  describe('Period selector', () => {
    it('should render all period options', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('7 Days')).toBeTruthy();
        expect(getByText('30 Days')).toBeTruthy();
        expect(getByText('90 Days')).toBeTruthy();
      });
    });

    it('should have 7 days selected by default', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        const sevenDaysButton = getByLabelText('View 7 days metrics');
        expect(sevenDaysButton).toBeTruthy();
      });
    });

    it('should fetch new data when period changes', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(dashboardService.getAIPerformanceMetrics).toHaveBeenCalledWith(
          'test-user-123',
          '7days'
        );
      });

      const thirtyDaysButton = getByLabelText('View 30 days metrics');
      fireEvent.press(thirtyDaysButton);

      await waitFor(() => {
        expect(dashboardService.getAIPerformanceMetrics).toHaveBeenCalledWith(
          'test-user-123',
          '30days'
        );
      });
    });
  });

  describe('Cost metrics visibility', () => {
    it('should hide cost metrics when showCostMetrics is false', async () => {
      const { queryByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={false}
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(queryByText('AI Cost')).toBeNull();
        expect(queryByText('$12.45')).toBeNull();
      });
    });

    it('should show cost metrics when showCostMetrics is true', async () => {
      const { getByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={true}
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(getByText('AI Cost')).toBeTruthy();
        expect(getByText('$12.45')).toBeTruthy();
        expect(getByText('$0.0498/msg')).toBeTruthy();
      });
    });

    it('should show cost in collapsed preview when enabled', async () => {
      const { getByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={true}
          initiallyCollapsed={true}
        />
      );

      await waitFor(() => {
        expect(getByText('Cost:')).toBeTruthy();
        expect(getByText('$12.45')).toBeTruthy();
      });
    });

    it('should hide cost in collapsed preview when disabled', async () => {
      const { queryByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={false}
          initiallyCollapsed={true}
        />
      );

      await waitFor(() => {
        expect(queryByText('Cost:')).toBeNull();
      });
    });
  });

  describe('Trend charts', () => {
    it('should display performance trends section when data available', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('Performance Trends')).toBeTruthy();
        expect(getByText('Accuracy Over Time')).toBeTruthy();
        expect(getByText('Time Saved (Minutes)')).toBeTruthy();
      });
    });

    it('should show cost chart when showCostMetrics is true', async () => {
      const { getByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={true}
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(getByText('Cost Over Time')).toBeTruthy();
      });
    });

    it('should not show cost chart when showCostMetrics is false', async () => {
      const { queryByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          showCostMetrics={false}
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(queryByText('Cost Over Time')).toBeNull();
      });
    });
  });

  describe('Refresh functionality', () => {
    it('should call refresh callback when refresh button is pressed', async () => {
      const mockRefresh = jest.fn();
      const { getByLabelText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          onRefresh={mockRefresh}
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(getByLabelText('Refresh AI metrics')).toBeTruthy();
      });

      fireEvent.press(getByLabelText('Refresh AI metrics'));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it('should not show refresh button when collapsed', async () => {
      const { queryByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={true} />
      );

      await waitFor(() => {
        expect(queryByLabelText('Refresh AI metrics')).toBeNull();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility label', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByLabelText('AI performance metrics widget')).toBeTruthy();
      });
    });

    it('should have accessible period selector buttons', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByLabelText('View 7 days metrics')).toBeTruthy();
        expect(getByLabelText('View 30 days metrics')).toBeTruthy();
        expect(getByLabelText('View 90 days metrics')).toBeTruthy();
      });
    });

    it('should have accessible expand/collapse button', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={true} />
      );

      await waitFor(() => {
        expect(getByLabelText('Expand AI metrics')).toBeTruthy();
      });
    });

    it('should have accessible metric values with units', async () => {
      const { getByLabelText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(
          getByLabelText('Categorization accuracy 92.5 percent')
        ).toBeTruthy();
        expect(getByLabelText('180 minutes saved')).toBeTruthy();
      });
    });
  });

  describe('Custom title', () => {
    it('should use custom title when provided', async () => {
      const { getByText } = render(
        <AIMetricsDashboard
          userId="test-user-123"
          title="My Custom Title"
          initiallyCollapsed={false}
        />
      );

      await waitFor(() => {
        expect(getByText('My Custom Title')).toBeTruthy();
      });
    });

    it('should use default title when not provided', async () => {
      const { getByText } = render(
        <AIMetricsDashboard userId="test-user-123" initiallyCollapsed={false} />
      );

      await waitFor(() => {
        expect(getByText('AI Performance Metrics')).toBeTruthy();
      });
    });
  });
});
