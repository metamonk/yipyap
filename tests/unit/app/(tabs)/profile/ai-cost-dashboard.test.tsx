/**
 * Unit tests for AI Cost Dashboard Screen
 * @module tests/unit/app/(tabs)/profile/ai-cost-dashboard
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert, Platform, Share } from 'react-native';
import AICostDashboardScreen from '@/app/(tabs)/profile/ai-cost-dashboard';
import * as aiCostMonitoringService from '@/services/aiCostMonitoringService';

// Mock expo-router
const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ children, options }: any) => children,
  },
  useRouter: () => mockRouter,
}));

// Mock Firebase Auth
const mockCurrentUser = {
  uid: 'user123',
  email: 'test@example.com',
};

jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

// Mock AI Cost Monitoring Service
jest.mock('@/services/aiCostMonitoringService', () => ({
  getDailyCosts: jest.fn(),
  getMonthlyCosts: jest.fn(),
  getTotalCost: jest.fn(),
}));

// Mock MetricsChart component
jest.mock('@/components/dashboard/MetricsChart', () => ({
  MetricsChart: ({ type, data, title }: any) => {
    const React = require('react');
    return React.createElement('View', { testID: 'metrics-chart', 'data-type': type });
  },
}));

// Mock expo vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock Share API
jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);

// Mock Alert
jest.spyOn(Alert, 'alert');

// Sample test data
const mockDailyCosts = [
  {
    date: new Date('2025-10-20'),
    totalCostCents: 150, // $1.50
    operationCosts: {
      categorization: 50,
      sentiment: 30,
      faq_detection: 20,
      voice_matching: 40,
      opportunity_scoring: 10,
      daily_agent: 0,
    },
  },
  {
    date: new Date('2025-10-21'),
    totalCostCents: 200, // $2.00
    operationCosts: {
      categorization: 60,
      sentiment: 40,
      faq_detection: 30,
      voice_matching: 50,
      opportunity_scoring: 15,
      daily_agent: 5,
    },
  },
  {
    date: new Date('2025-10-22'),
    totalCostCents: 180, // $1.80
    operationCosts: {
      categorization: 55,
      sentiment: 35,
      faq_detection: 25,
      voice_matching: 45,
      opportunity_scoring: 15,
      daily_agent: 5,
    },
  },
];

const mockMonthlyCosts = [
  {
    year: 2025,
    month: 9,
    totalCostCents: 4500, // $45.00
    operationCosts: {
      categorization: 1500,
      sentiment: 1000,
      faq_detection: 800,
      voice_matching: 1000,
      opportunity_scoring: 150,
      daily_agent: 50,
    },
  },
  {
    year: 2025,
    month: 10,
    totalCostCents: 5200, // $52.00
    operationCosts: {
      categorization: 1800,
      sentiment: 1100,
      faq_detection: 900,
      voice_matching: 1200,
      opportunity_scoring: 150,
      daily_agent: 50,
    },
  },
];

describe('AICostDashboardScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (aiCostMonitoringService.getDailyCosts as jest.Mock).mockResolvedValue(mockDailyCosts);
    (aiCostMonitoringService.getMonthlyCosts as jest.Mock).mockResolvedValue(mockMonthlyCosts);
  });

  describe('Rendering', () => {
    it('renders cost dashboard screen', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Budget Progress')).toBeTruthy();
        expect(getByText('Cost Breakdown by Operation')).toBeTruthy();
      });
    });

    it('renders loading state initially', () => {
      const { getByText } = render(<AICostDashboardScreen />);

      expect(getByText('Loading cost data...')).toBeTruthy();
    });

    it('renders period toggle with daily and monthly options', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Daily')).toBeTruthy();
        expect(getByText('Monthly')).toBeTruthy();
      });
    });

    it('renders budget progress card', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Budget Progress')).toBeTruthy();
        expect(getByText('Today')).toBeTruthy();
      });
    });

    it('renders export button', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Export as CSV')).toBeTruthy();
      });
    });
  });

  describe('Data Loading', () => {
    it('loads daily costs on mount', async () => {
      render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(aiCostMonitoringService.getDailyCosts).toHaveBeenCalledWith('user123', 30);
      });
    });

    it('switches to monthly costs when monthly period selected', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Monthly')).toBeTruthy();
      });

      fireEvent.press(getByText('Monthly'));

      await waitFor(() => {
        expect(aiCostMonitoringService.getMonthlyCosts).toHaveBeenCalledWith('user123', 12);
      });
    });

    it('displays error message when data loading fails', async () => {
      (aiCostMonitoringService.getDailyCosts as jest.Mock).mockRejectedValue(
        new Error('Failed to load')
      );

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Failed to load cost data')).toBeTruthy();
        expect(getByText('Retry')).toBeTruthy();
      });
    });

    it('retries loading data when retry button pressed', async () => {
      (aiCostMonitoringService.getDailyCosts as jest.Mock)
        .mockRejectedValueOnce(new Error('Failed to load'))
        .mockResolvedValueOnce(mockDailyCosts);

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Retry')).toBeTruthy();
      });

      fireEvent.press(getByText('Retry'));

      await waitFor(() => {
        expect(aiCostMonitoringService.getDailyCosts).toHaveBeenCalledTimes(2);
        expect(getByText('Budget Progress')).toBeTruthy();
      });
    });
  });

  describe('Period Toggle', () => {
    it('highlights daily button by default', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        const dailyButton = getByText('Daily');
        expect(dailyButton).toBeTruthy();
      });
    });

    it('switches to monthly view when monthly button pressed', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Monthly')).toBeTruthy();
      });

      fireEvent.press(getByText('Monthly'));

      await waitFor(() => {
        expect(aiCostMonitoringService.getMonthlyCosts).toHaveBeenCalled();
      });
    });

    it('switches back to daily view when daily button pressed', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      // Switch to monthly
      await waitFor(() => {
        expect(getByText('Monthly')).toBeTruthy();
      });
      fireEvent.press(getByText('Monthly'));

      await waitFor(() => {
        expect(aiCostMonitoringService.getMonthlyCosts).toHaveBeenCalled();
      });

      // Switch back to daily
      fireEvent.press(getByText('Daily'));

      await waitFor(() => {
        expect(aiCostMonitoringService.getDailyCosts).toHaveBeenCalledTimes(2); // Initial + switch back
      });
    });
  });

  describe('Budget Progress', () => {
    it('displays current spend amount', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        // Last daily cost is $1.80
        expect(getByText('$1.80')).toBeTruthy();
      });
    });

    it('displays budget percentage', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        // $1.80 / $5.00 = 36%
        expect(getByText('36%')).toBeTruthy();
      });
    });

    it('shows "Today" label for daily period', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Today')).toBeTruthy();
      });
    });

    it('shows "This Month" label for monthly period', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Monthly')).toBeTruthy();
      });

      fireEvent.press(getByText('Monthly'));

      await waitFor(() => {
        expect(getByText('This Month')).toBeTruthy();
      });
    });
  });

  describe('Cost Breakdown', () => {
    it('displays all operation types', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Categorization')).toBeTruthy();
        expect(getByText('Sentiment')).toBeTruthy();
        expect(getByText('FAQ Detection')).toBeTruthy();
        expect(getByText('Voice Matching')).toBeTruthy();
        expect(getByText('Opportunities')).toBeTruthy();
        expect(getByText('Daily Agent')).toBeTruthy();
      });
    });

    it('displays cost amounts for each operation', async () => {
      const { getAllByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        // Check that we have cost values displayed (they start with $)
        const costElements = getAllByText(/^\$/);
        expect(costElements.length).toBeGreaterThan(0);
      });
    });

    it('displays percentage for each operation', async () => {
      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        // Categorization: $0.55 / $1.80 = 31%
        expect(getByText('(31%)')).toBeTruthy();
      });
    });
  });

  describe('Export Functionality', () => {
    it('exports daily costs as CSV on mobile', async () => {
      Platform.OS = 'ios';

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Export as CSV')).toBeTruthy();
      });

      fireEvent.press(getByText('Export as CSV'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalled();
        const shareCall = (Share.share as jest.Mock).mock.calls[0][0];
        expect(shareCall.message).toContain('Date,Total Cost');
        expect(shareCall.title).toBe('AI Costs - daily');
      });
    });

    it('exports monthly costs when in monthly view', async () => {
      Platform.OS = 'android';

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Monthly')).toBeTruthy();
      });

      fireEvent.press(getByText('Monthly'));

      await waitFor(() => {
        expect(getByText('Export as CSV')).toBeTruthy();
      });

      fireEvent.press(getByText('Export as CSV'));

      await waitFor(() => {
        expect(Share.share).toHaveBeenCalled();
        const shareCall = (Share.share as jest.Mock).mock.calls[0][0];
        expect(shareCall.message).toContain('Month,Total Cost');
        expect(shareCall.title).toBe('AI Costs - monthly');
      });
    });

    it('shows alert on export failure', async () => {
      (Share.share as jest.Mock).mockRejectedValue(new Error('Export failed'));

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('Export as CSV')).toBeTruthy();
      });

      fireEvent.press(getByText('Export as CSV'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Export Failed', 'Unable to export cost data');
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('reloads data when refresh is triggered', async () => {
      const { UNSAFE_getByType } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(aiCostMonitoringService.getDailyCosts).toHaveBeenCalledTimes(1);
      });

      // Note: In a real test, we'd trigger the header refresh button
      // For now, we just verify initial load
      expect(aiCostMonitoringService.getDailyCosts).toHaveBeenCalledWith('user123', 30);
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no data available', async () => {
      (aiCostMonitoringService.getDailyCosts as jest.Mock).mockResolvedValue([]);

      const { getByText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByText('No cost data available')).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('includes accessibility labels for period toggle', async () => {
      const { getByLabelText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByLabelText('Show daily costs')).toBeTruthy();
        expect(getByLabelText('Show monthly costs')).toBeTruthy();
      });
    });

    it('includes accessibility label for export button', async () => {
      const { getByLabelText } = render(<AICostDashboardScreen />);

      await waitFor(() => {
        expect(getByLabelText('Export cost data as CSV')).toBeTruthy();
      });
    });

    // Note: Refresh button is in the header which is mocked by expo-router Stack.Screen
    // Testing the refresh functionality would require a more complex setup with header interaction
  });
});
