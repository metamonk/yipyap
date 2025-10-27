/**
 * Unit tests for Engagement Health Dashboard Screen (Story 6.6)
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import EngagementHealthScreen from '@/app/(tabs)/profile/engagement-health';
import { engagementMetricsService } from '@/services/engagementMetricsService';
import { getFirebaseAuth } from '@/services/firebase';
import { EngagementMetrics } from '@/types/user';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/services/firebase');
jest.mock('@/services/engagementMetricsService');
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
}));
jest.mock('@/app/_components/NavigationHeader', () => ({
  NavigationHeader: () => null,
}));

const mockGetFirebaseAuth = getFirebaseAuth as jest.MockedFunction<typeof getFirebaseAuth>;
const mockEngagementMetricsService = engagementMetricsService as jest.Mocked<
  typeof engagementMetricsService
>;

describe('EngagementHealthScreen', () => {
  const mockUserId = 'test-user-123';
  const mockTimestamp = Timestamp.now();

  const mockHealthyMetrics: EngagementMetrics = {
    id: 'metric-1',
    userId: mockUserId,
    period: 'daily',
    startDate: mockTimestamp,
    endDate: mockTimestamp,
    metrics: {
      qualityScore: 85,
      personalResponseRate: 90,
      avgResponseTime: 18,
      conversationDepth: 50,
      capacityUsage: 75,
      burnoutRisk: 'low',
    },
    trends: {
      qualityScoreDiff: 5,
      personalResponseRateDiff: 3,
      avgResponseTimeDiff: -2,
      conversationDepthDiff: 1,
    },
    createdAt: mockTimestamp,
  };

  const mockUnhealthyMetrics: EngagementMetrics = {
    id: 'metric-2',
    userId: mockUserId,
    period: 'daily',
    startDate: mockTimestamp,
    endDate: mockTimestamp,
    metrics: {
      qualityScore: 45,
      personalResponseRate: 50,
      avgResponseTime: 60,
      conversationDepth: 20,
      capacityUsage: 95,
      burnoutRisk: 'high',
    },
    trends: {
      qualityScoreDiff: -10,
      personalResponseRateDiff: -5,
      avgResponseTimeDiff: 15,
      conversationDepthDiff: -8,
    },
    createdAt: mockTimestamp,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Firebase Auth
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: {
        uid: mockUserId,
        email: 'test@example.com',
      },
    } as any);

    // Clear all timers
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Loading States', () => {
    it('displays loading indicator while fetching metrics', () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<EngagementHealthScreen />);

      expect(screen.getByText('Loading your health metrics...')).toBeTruthy();
    });

    it('displays empty state when no metrics available', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(null);

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText(/No Data Available Yet/i)).toBeTruthy();
        expect(
          screen.getByText(/once you start having conversations/i)
        ).toBeTruthy();
      });
    });
  });

  describe('Overall Health Score Display', () => {
    it('displays health score correctly', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('85/100')).toBeTruthy();
      });
    });

    it('displays "Excellent" badge for score >= 80', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Excellent')).toBeTruthy();
      });
    });

    it('displays "Good" badge for score 60-79', async () => {
      const mediumMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, qualityScore: 70 },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mediumMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Good')).toBeTruthy();
      });
    });

    it('displays "Needs Attention" badge for score < 60', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockUnhealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Needs Attention')).toBeTruthy();
      });
    });

    it('displays week-over-week trend', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText(/↑ 5 points from last week/)).toBeTruthy();
      });
    });
  });

  describe('Metric Cards Display', () => {
    it('displays personal response rate metric', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Personal Response Rate')).toBeTruthy();
        expect(screen.getByText('90%')).toBeTruthy();
      });
    });

    it('displays average response time metric', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Average Response Time')).toBeTruthy();
        expect(screen.getByText('18.0h')).toBeTruthy();
      });
    });

    it('displays conversation depth metric', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Conversation Depth')).toBeTruthy();
        expect(screen.getByText('50%')).toBeTruthy();
      });
    });

    it('displays capacity usage metric', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Capacity Usage')).toBeTruthy();
        expect(screen.getByText('75%')).toBeTruthy();
      });
    });
  });

  describe('Status Icons', () => {
    it('displays healthy status icon (✅) when metric meets target', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        const healthyIcons = screen.getAllByText('✅');
        expect(healthyIcons.length).toBeGreaterThan(0);
      });
    });

    it('displays warning status icon (⚠️) when metric at risk', async () => {
      const atRiskMetrics = {
        ...mockHealthyMetrics,
        metrics: {
          ...mockHealthyMetrics.metrics,
          personalResponseRate: 70, // At risk: 60-79%
        },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        atRiskMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        const warningIcons = screen.getAllByText('⚠️');
        expect(warningIcons.length).toBeGreaterThan(0);
      });
    });

    it('displays unhealthy status icon (❌) when metric below threshold', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockUnhealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        const unhealthyIcons = screen.getAllByText('❌');
        expect(unhealthyIcons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Burnout Risk Card', () => {
    it('displays low burnout risk with green styling', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Low Burnout Risk')).toBeTruthy();
        expect(
          screen.getByText(/maintaining healthy engagement patterns/i)
        ).toBeTruthy();
      });
    });

    it('displays high burnout risk with red styling and adjust button', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockUnhealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('High Burnout Risk')).toBeTruthy();
        expect(screen.getByText(/risk of burning out/i)).toBeTruthy();
        expect(screen.getByText('Adjust Capacity Settings')).toBeTruthy();
      });
    });

    it('displays medium burnout risk', async () => {
      const mediumRiskMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, burnoutRisk: 'medium' as const },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mediumRiskMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('Medium Burnout Risk')).toBeTruthy();
      });
    });
  });

  describe('Recommendations', () => {
    it('displays recommendations when metrics are unhealthy', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockUnhealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText('💡 Recommendations')).toBeTruthy();
        expect(
          screen.getByText(/Edit AI drafts more frequently/i)
        ).toBeTruthy();
      });
    });

    it('does not display recommendations when all metrics are healthy', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.queryByText('💡 Recommendations')).toBeNull();
      });
    });

    it('recommends editing more when personal response rate is low', async () => {
      const lowEditingMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, personalResponseRate: 50 },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        lowEditingMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(/Edit AI drafts more frequently/i)
        ).toBeTruthy();
      });
    });

    it('recommends reducing capacity when response time is slow', async () => {
      const slowResponseMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, avgResponseTime: 50 },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        slowResponseMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(/Response times are increasing/i)
        ).toBeTruthy();
      });
    });

    it('recommends improving conversation depth when low', async () => {
      const lowDepthMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, conversationDepth: 20 },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        lowDepthMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText(/Try asking more questions/i)).toBeTruthy();
      });
    });

    it('recommends reducing capacity when usage is high', async () => {
      const highUsageMetrics = {
        ...mockHealthyMetrics,
        metrics: { ...mockHealthyMetrics.metrics, capacityUsage: 95 },
      };
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        highUsageMetrics
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(screen.getByText(/Running at high capacity/i)).toBeTruthy();
      });
    });
  });

  describe('Auto-Refresh Functionality', () => {
    it('auto-refreshes every 5 minutes', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      render(<EngagementHealthScreen />);

      // Initial load
      await waitFor(() => {
        expect(
          mockEngagementMetricsService.getLatestEngagementMetrics
        ).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(
          mockEngagementMetricsService.getLatestEngagementMetrics
        ).toHaveBeenCalledTimes(2);
      });
    });

    it('cleans up auto-refresh interval on unmount', async () => {
      mockEngagementMetricsService.getLatestEngagementMetrics.mockResolvedValue(
        mockHealthyMetrics
      );

      const { unmount } = render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(
          mockEngagementMetricsService.getLatestEngagementMetrics
        ).toHaveBeenCalledTimes(1);
      });

      unmount();

      // Fast-forward 5 minutes after unmount
      jest.advanceTimersByTime(5 * 60 * 1000);

      // Should not call again after unmount
      expect(
        mockEngagementMetricsService.getLatestEngagementMetrics
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    it('handles error when loading metrics fails', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      mockEngagementMetricsService.getLatestEngagementMetrics.mockRejectedValue(
        new Error('Network error')
      );

      render(<EngagementHealthScreen />);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Error loading engagement metrics:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('handles case when user is not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({
        currentUser: null,
      } as any);

      render(<EngagementHealthScreen />);

      // Should not call service when user is not authenticated
      expect(
        mockEngagementMetricsService.getLatestEngagementMetrics
      ).not.toHaveBeenCalled();
    });
  });
});
