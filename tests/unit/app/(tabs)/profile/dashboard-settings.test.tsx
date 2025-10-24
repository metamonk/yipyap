/**
 * Tests for Dashboard Settings Screen - Story 5.7 Task 13
 */

// Mock Timestamp class
class MockTimestamp {
  private date: Date;

  constructor(seconds: number, nanoseconds: number) {
    this.date = new Date(seconds * 1000 + nanoseconds / 1000000);
  }

  toDate(): Date {
    return this.date;
  }

  toMillis(): number {
    return this.date.getTime();
  }

  static fromDate(date: Date): MockTimestamp {
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = (date.getTime() % 1000) * 1000000;
    return new MockTimestamp(seconds, nanoseconds);
  }

  static now(): MockTimestamp {
    return MockTimestamp.fromDate(new Date());
  }
}

// Mock firebase/firestore
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDoc = jest.fn();

jest.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  doc: mockDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import DashboardSettingsScreen from '@/app/(tabs)/profile/dashboard-settings';
import type { DashboardConfig } from '@/types/dashboard';

const Timestamp = MockTimestamp as any;

// Mock expo-router
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

// Mock useAuth
const mockUseAuth = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

// Mock firebase service
const mockFirestore = {};
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: () => mockFirestore,
}));

// Mock NavigationHeader
jest.mock('@/app/_components/NavigationHeader', () => ({
  NavigationHeader: ({ title, leftAction }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="nav-header">
        <Text>{title}</Text>
        {leftAction && (
          <TouchableOpacity testID="nav-back-button" onPress={leftAction.onPress}>
            <Text>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

// Mock DEFAULT_DASHBOARD_CONFIG from DashboardWidgetContainer
jest.mock('@/components/dashboard/DashboardWidgetContainer', () => ({
  DEFAULT_DASHBOARD_CONFIG: {
    widgetVisibility: {
      dailySummary: true,
      priorityFeed: true,
      aiMetrics: true,
      quickActions: true,
      opportunityAnalytics: true,
    },
    widgetOrder: ['dailySummary', 'priorityFeed', 'opportunityAnalytics', 'aiMetrics', 'quickActions'],
    refreshInterval: 60,
    metricsDisplayPeriod: '7days',
    showCostMetrics: false,
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Helper to create mock dashboard config
function createMockConfig(): DashboardConfig {
  return {
    userId: 'test-user-123',
    widgetVisibility: {
      dailySummary: true,
      priorityFeed: true,
      aiMetrics: true,
      quickActions: true,
      opportunityAnalytics: true,
    },
    widgetOrder: ['dailySummary', 'priorityFeed', 'opportunityAnalytics', 'aiMetrics', 'quickActions'],
    refreshInterval: 60,
    metricsDisplayPeriod: '7days',
    showCostMetrics: false,
    updatedAt: Timestamp.now(),
  };
}

describe('DashboardSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Alert.alert as jest.Mock).mockClear();

    // Default user
    mockUseAuth.mockReturnValue({
      user: { uid: 'test-user-123' },
      isLoading: false,
    });

    // Mock doc() to return a reference object
    mockDoc.mockReturnValue({
      id: 'test-user-123',
      path: 'users/test-user-123',
    });

    // Default successful config load
    const mockConfig = createMockConfig();
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        settings: {
          dashboardConfig: mockConfig,
        },
      }),
    });
  });

  describe('Component Rendering', () => {
    it('should render dashboard settings screen', async () => {
      const { getByText, findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      const widgetVisibility = await findByText('Widget Visibility', {}, { timeout: 3000 });
      expect(widgetVisibility).toBeTruthy();
    });

    it('should display all settings sections', async () => {
      const { findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Widget Visibility', {}, { timeout: 3000 });

      const widgetVisibility = await findByText('Widget Visibility');
      const widgetOrder = await findByText('Widget Order');
      const refreshInterval = await findByText('Refresh Interval');
      const metricsDisplayPeriod = await findByText('Metrics Display Period');
      const costTransparency = await findByText('Cost Transparency');

      expect(widgetVisibility).toBeTruthy();
      expect(widgetOrder).toBeTruthy();
      expect(refreshInterval).toBeTruthy();
      expect(metricsDisplayPeriod).toBeTruthy();
      expect(costTransparency).toBeTruthy();
    });

    it('should display all widget options', async () => {
      const { findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Widget Visibility', {}, { timeout: 3000 });

      const dailySummary = await findByText('Daily Summary');
      const priorityMessages = await findByText('Priority Messages');
      const aiPerformance = await findByText('AI Performance');
      const quickActions = await findByText('Quick Actions');
      const opportunities = await findByText('Opportunities');

      expect(dailySummary).toBeTruthy();
      expect(priorityMessages).toBeTruthy();
      expect(aiPerformance).toBeTruthy();
      expect(quickActions).toBeTruthy();
      expect(opportunities).toBeTruthy();
    });
  });

  describe('Widget Visibility Toggles', () => {
    it('should enable save button when toggling widget visibility', async () => {
      const { getByText, findByText, UNSAFE_getAllByType } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Daily Summary', {}, { timeout: 3000 });

      // Initially no changes
      expect(getByText('No Changes')).toBeTruthy();

      // Toggle first switch
      const { Switch } = require('react-native');
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);

      // Should show Save Changes
      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
    });
  });

  describe('Widget Ordering', () => {
    it('should display widget order numbers', async () => {
      const { findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Widget Order', {}, { timeout: 3000 });

      const one = await findByText('1');
      const two = await findByText('2');
      const three = await findByText('3');

      expect(one).toBeTruthy();
      expect(two).toBeTruthy();
      expect(three).toBeTruthy();
    });

    it('should enable save button when reordering widgets', async () => {
      const { getByText, findByText, getAllByTestId } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Widget Order', {}, { timeout: 3000 });

      // Find chevron-down icon for first widget
      const downIcons = getAllByTestId('icon-chevron-down');
      const firstDownButton = downIcons[0].parent;

      if (firstDownButton) {
        fireEvent.press(firstDownButton);

        // Should enable save
        await waitFor(() => {
          expect(getByText('Save Changes')).toBeTruthy();
        }, { timeout: 2000 });
      }
    });
  });

  describe('Refresh Interval', () => {
    it('should display refresh interval options', async () => {
      const { findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Refresh Interval', {}, { timeout: 3000 });

      const thirtyS = await findByText('30s');
      const sixtyS = await findByText('60s');
      const onetwentyS = await findByText('120s');
      const threehundredS = await findByText('300s');

      expect(thirtyS).toBeTruthy();
      expect(sixtyS).toBeTruthy();
      expect(onetwentyS).toBeTruthy();
      expect(threehundredS).toBeTruthy();
    });

    it('should update refresh interval', async () => {
      const { getByText, findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('120s', {}, { timeout: 3000 });

      fireEvent.press(getByText('120s'));

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
    });
  });

  describe('Metrics Display Period', () => {
    it('should display metrics period options', async () => {
      const { findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Metrics Display Period', {}, { timeout: 3000 });

      const sevenDays = await findByText('7 Days');
      const thirtyDays = await findByText('30 Days');
      const ninetyDays = await findByText('90 Days');

      expect(sevenDays).toBeTruthy();
      expect(thirtyDays).toBeTruthy();
      expect(ninetyDays).toBeTruthy();
    });

    it('should update metrics period', async () => {
      const { getByText, findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('30 Days', {}, { timeout: 3000 });

      fireEvent.press(getByText('30 Days'));

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
    });
  });

  describe('Saving Configuration', () => {
    it('should save configuration to Firestore', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { getByText, findByText, UNSAFE_getAllByType } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Daily Summary', {}, { timeout: 3000 });

      // Make a change
      const { Switch } = require('react-native');
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);

      // Click save
      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
      const saveButton = getByText('Save Changes');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(mockUpdateDoc).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should display save success alert', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);

      const { getByText, findByText, UNSAFE_getAllByType } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Daily Summary', {}, { timeout: 3000 });

      // Make a change and save
      const { Switch } = require('react-native');
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
      fireEvent.press(getByText('Save Changes'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Dashboard settings saved successfully'
        );
      }, { timeout: 2000 });
    });

    it('should handle save errors', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Network error'));

      const { getByText, findByText, UNSAFE_getAllByType } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Daily Summary', {}, { timeout: 3000 });

      // Make a change and save
      const { Switch } = require('react-native');
      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'valueChange', false);

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
      fireEvent.press(getByText('Save Changes'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to save dashboard settings'
        );
      }, { timeout: 2000 });
    });
  });

  describe('Reset to Default', () => {
    it('should show confirmation dialog when resetting', async () => {
      const { getByText, findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      const resetButton = await findByText('Reset to Default', {}, { timeout: 3000 });
      expect(resetButton).toBeTruthy();

      fireEvent.press(getByText('Reset to Default'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Reset to Default',
        'Are you sure you want to reset all dashboard settings to default values?',
        expect.any(Array)
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle load errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'));

      const { findByText } = render(<DashboardSettingsScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load dashboard settings'
        );
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when pressing back button', async () => {
      const { getByTestID, findByText } = render(<DashboardSettingsScreen />);

      // Wait for component to finish loading
      await findByText('Widget Visibility', {}, { timeout: 3000 });

      const backButton = getByTestID('nav-back-button');
      expect(backButton).toBeTruthy();

      fireEvent.press(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });
});
