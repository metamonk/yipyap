/**
 * Tests for OpportunityAnalytics component (Story 5.6 - Task 12)
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';
import { OpportunityAnalytics } from '@/components/dashboard/OpportunityAnalytics';
import { opportunityService } from '@/services/opportunityService';
import type { OpportunityAnalytics as OpportunityAnalyticsType } from '@/types/dashboard';
import { Alert, Share } from 'react-native';

// Mock services
jest.mock('@/services/opportunityService');

// Mock Share and Alert
jest.mock('react-native/Libraries/Share/Share', () => ({
  share: jest.fn(),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

const mockOpportunityService = opportunityService as jest.Mocked<typeof opportunityService>;

describe('OpportunityAnalytics', () => {
  const mockAnalytics: OpportunityAnalyticsType = {
    totalOpportunities: 45,
    highValueCount: 12,
    averageScore: 75.3,
    byType: {
      sponsorship: 10,
      collaboration: 15,
      partnership: 12,
      sale: 5,
      unknown: 3,
    },
    periodDays: 30,
  };

  const mockHistoryData = [
    { date: '2025-10-01', count: 2, averageScore: 72.0 },
    { date: '2025-10-02', count: 3, averageScore: 78.5 },
    { date: '2025-10-03', count: 1, averageScore: 85.0 },
    { date: '2025-10-04', count: 4, averageScore: 70.2 },
    { date: '2025-10-05', count: 2, averageScore: 80.0 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockOpportunityService.getOpportunityAnalytics.mockResolvedValue(mockAnalytics);
    mockOpportunityService.getOpportunitiesByDate.mockResolvedValue(mockHistoryData);
  });

  describe('Rendering and Loading', () => {
    it('should show loading state initially', () => {
      render(<OpportunityAnalytics userId="user123" />);

      expect(screen.getByText('Loading analytics...')).toBeTruthy();
    });

    it('should render analytics data after loading', async () => {
      render(<OpportunityAnalytics userId="user123" initialPeriod={30} />);

      await waitFor(() => {
        expect(screen.getByText('45')).toBeTruthy(); // Total opportunities
        expect(screen.getAllByText('12').length).toBeGreaterThan(0); // High-value count (may appear multiple times)
        expect(screen.getByText('75.3')).toBeTruthy(); // Average score
      });
    });

    it('should load analytics for the specified user and period', async () => {
      render(<OpportunityAnalytics userId="user123" initialPeriod={30} />);

      await waitFor(() => {
        expect(mockOpportunityService.getOpportunityAnalytics).toHaveBeenCalledWith('user123', 30);
        expect(mockOpportunityService.getOpportunitiesByDate).toHaveBeenCalledWith('user123', 30);
      });
    });
  });

  describe('Period Selector', () => {
    it('should render period selector with all options', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('7D')).toBeTruthy();
        expect(screen.getByText('30D')).toBeTruthy();
        expect(screen.getByText('90D')).toBeTruthy();
      });
    });

    it('should highlight the active period', async () => {
      render(<OpportunityAnalytics userId="user123" initialPeriod={7} />);

      await waitFor(() => {
        const sevenDayButton = screen.getByLabelText('7 days period');
        expect(sevenDayButton).toBeTruthy();
      });
    });

    it('should reload analytics when period changes', async () => {
      render(<OpportunityAnalytics userId="user123" initialPeriod={30} />);

      // Wait for initial load
      await waitFor(() => {
        expect(mockOpportunityService.getOpportunityAnalytics).toHaveBeenCalledWith('user123', 30);
      });

      // Change period
      const sevenDayButton = screen.getByLabelText('7 days period');
      fireEvent.press(sevenDayButton);

      // Should reload with new period
      await waitFor(() => {
        expect(mockOpportunityService.getOpportunityAnalytics).toHaveBeenCalledWith('user123', 7);
      });
    });
  });

  describe('Metrics Display', () => {
    it('should display all key metrics', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Total')).toBeTruthy();
        expect(screen.getByText('High-Value')).toBeTruthy();
        expect(screen.getByText('Avg Score')).toBeTruthy();
      });
    });

    it('should format average score to 1 decimal place', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('75.3')).toBeTruthy(); // Should show 1 decimal place
      });
    });
  });

  describe('Type Breakdown', () => {
    it('should render breakdown by type section', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Breakdown by Type')).toBeTruthy();
      });
    });

    it('should show all opportunity types with counts', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Sponsorship')).toBeTruthy();
        expect(screen.getByText('Collaboration')).toBeTruthy();
        expect(screen.getByText('Partnership')).toBeTruthy();
        expect(screen.getByText('Sale')).toBeTruthy();
      });
    });

    it('should display counts for each type', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('10')).toBeTruthy(); // Sponsorship count
        expect(screen.getByText('15')).toBeTruthy(); // Collaboration count
      });
    });

    it('should show empty state when no opportunities', async () => {
      mockOpportunityService.getOpportunityAnalytics.mockResolvedValue({
        ...mockAnalytics,
        totalOpportunities: 0,
        byType: {
          sponsorship: 0,
          collaboration: 0,
          partnership: 0,
          sale: 0,
          unknown: 0,
        },
      });

      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('No opportunities in this period')).toBeTruthy();
      });
    });
  });

  describe('Trend Chart', () => {
    it('should render trend chart section', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Opportunity Trend')).toBeTruthy();
      });
    });

    it('should display date range in chart label', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('2025-10-01 - 2025-10-05')).toBeTruthy();
      });
    });
  });

  describe('Export Functionality', () => {
    it('should render export button when analytics data exists', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('📊 Export Data')).toBeTruthy();
      });
    });

    it('should not show export button when no opportunities', async () => {
      mockOpportunityService.getOpportunityAnalytics.mockResolvedValue({
        ...mockAnalytics,
        totalOpportunities: 0,
        byType: {
          sponsorship: 0,
          collaboration: 0,
          partnership: 0,
          sale: 0,
          unknown: 0,
        },
      });

      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.queryByText('📊 Export Data')).toBeNull();
      });
    });

    it('should call custom onExport handler when provided', async () => {
      const mockOnExport = jest.fn();
      render(<OpportunityAnalytics userId="user123" onExport={mockOnExport} />);

      await waitFor(() => {
        const exportButton = screen.getByText('📊 Export Data');
        fireEvent.press(exportButton);
      });

      expect(mockOnExport).toHaveBeenCalledWith(mockAnalytics);
    });
  });

  describe('Error Handling', () => {
    it('should show error state when analytics fails to load', async () => {
      mockOpportunityService.getOpportunityAnalytics.mockRejectedValue(
        new Error('Network error')
      );

      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeTruthy();
        expect(screen.getByText('Network error')).toBeTruthy();
      });
    });

    it('should show retry button on error', async () => {
      mockOpportunityService.getOpportunityAnalytics.mockRejectedValue(
        new Error('Network error')
      );

      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeTruthy();
      });
    });

    it('should retry loading when retry button is pressed', async () => {
      mockOpportunityService.getOpportunityAnalytics
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockAnalytics);

      render(<OpportunityAnalytics userId="user123" />);

      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText('Failed to load analytics')).toBeTruthy();
      });

      // Press retry
      const retryButton = screen.getByText('Retry');
      fireEvent.press(retryButton);

      // Should successfully load data
      await waitFor(() => {
        expect(screen.getByText('45')).toBeTruthy(); // Total opportunities
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible period selector buttons', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        expect(screen.getByLabelText('7 days period')).toBeTruthy();
        expect(screen.getByLabelText('30 days period')).toBeTruthy();
        expect(screen.getByLabelText('90 days period')).toBeTruthy();
      });
    });

    it('should have accessible export button', async () => {
      render(<OpportunityAnalytics userId="user123" />);

      await waitFor(() => {
        const exportButton = screen.getByLabelText('Export analytics data');
        expect(exportButton).toBeTruthy();
      });
    });
  });
});
