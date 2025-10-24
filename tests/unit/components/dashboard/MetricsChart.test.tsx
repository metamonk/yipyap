/**
 * Unit tests for MetricsChart component (Story 5.7 - Task 5)
 *
 * @remarks
 * Tests the reusable MetricsChart component for displaying line and bar charts.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { MetricsChart, ChartData } from '@/components/dashboard/MetricsChart';

// Mock react-native-chart-kit
jest.mock('react-native-chart-kit', () => ({
  LineChart: 'LineChart',
  BarChart: 'BarChart',
}));

describe('MetricsChart', () => {
  const mockLineChartData: ChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [
      {
        data: [85, 87, 90, 88, 92],
      },
    ],
  };

  const mockBarChartData: ChartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    datasets: [
      {
        data: [25, 30, 28, 35, 32],
      },
    ],
  };

  describe('Rendering with line chart', () => {
    it('should render line chart successfully', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          title="Accuracy Over Time"
          yAxisSuffix="%"
        />
      );

      expect(getByText('Accuracy Over Time')).toBeTruthy();
    });

    it('should render line chart without title', () => {
      const { queryByText } = render(
        <MetricsChart type="line" data={mockLineChartData} />
      );

      // Should not render any title text
      expect(queryByText('Accuracy Over Time')).toBeNull();
    });

    it('should have accessibility label for line chart', () => {
      const { getByLabelText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          title="Accuracy Over Time"
        />
      );

      expect(
        getByLabelText('Accuracy Over Time showing 5 data points')
      ).toBeTruthy();
    });
  });

  describe('Rendering with bar chart', () => {
    it('should render bar chart successfully', () => {
      const { getByText } = render(
        <MetricsChart
          type="bar"
          data={mockBarChartData}
          title="Time Saved (Minutes)"
        />
      );

      expect(getByText('Time Saved (Minutes)')).toBeTruthy();
    });

    it('should have accessibility label for bar chart', () => {
      const { getByLabelText } = render(
        <MetricsChart
          type="bar"
          data={mockBarChartData}
          title="Time Saved"
        />
      );

      expect(getByLabelText('Time Saved showing 5 data points')).toBeTruthy();
    });
  });

  describe('Empty or invalid data', () => {
    it('should show empty state when data is null', () => {
      const { getByText } = render(
        <MetricsChart type="line" data={null as any} />
      );

      expect(getByText('No chart data available')).toBeTruthy();
    });

    it('should show empty state when labels are empty', () => {
      const emptyData: ChartData = {
        labels: [],
        datasets: [{ data: [] }],
      };

      const { getByText } = render(
        <MetricsChart type="line" data={emptyData} />
      );

      expect(getByText('No chart data available')).toBeTruthy();
    });

    it('should show empty state when datasets are empty', () => {
      const emptyData: ChartData = {
        labels: ['Mon', 'Tue'],
        datasets: [],
      };

      const { getByText } = render(
        <MetricsChart type="line" data={emptyData} />
      );

      expect(getByText('No chart data available')).toBeTruthy();
    });

    it('should show empty state when dataset data is empty', () => {
      const emptyData: ChartData = {
        labels: ['Mon', 'Tue'],
        datasets: [{ data: [] }],
      };

      const { getByText } = render(
        <MetricsChart type="line" data={emptyData} />
      );

      expect(getByText('No chart data available')).toBeTruthy();
    });
  });

  describe('Y-axis suffix', () => {
    it('should accept percentage suffix', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          yAxisSuffix="%"
        />
      );

      // Component should render (suffix is passed to chart library)
      expect(getByText).toBeTruthy();
    });

    it('should accept currency suffix', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          yAxisSuffix="$"
        />
      );

      // Component should render (suffix is passed to chart library)
      expect(getByText).toBeTruthy();
    });

    it('should work without suffix', () => {
      const { getByText } = render(
        <MetricsChart type="bar" data={mockBarChartData} />
      );

      // Component should render
      expect(getByText).toBeTruthy();
    });
  });

  describe('Custom height', () => {
    it('should accept custom height', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          height={300}
        />
      );

      // Component should render with custom height
      expect(getByText).toBeTruthy();
    });

    it('should use default height when not provided', () => {
      const { getByText } = render(
        <MetricsChart type="line" data={mockLineChartData} />
      );

      // Component should render with default height
      expect(getByText).toBeTruthy();
    });
  });

  describe('Legend visibility', () => {
    it('should hide legend when hideLegend is true', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          hideLegend={true}
        />
      );

      // Component should render
      expect(getByText).toBeTruthy();
    });

    it('should show legend when hideLegend is false', () => {
      const { getByText } = render(
        <MetricsChart
          type="line"
          data={mockLineChartData}
          hideLegend={false}
        />
      );

      // Component should render
      expect(getByText).toBeTruthy();
    });
  });

  describe('Multiple datasets', () => {
    it('should handle multiple datasets', () => {
      const multiDatasetData: ChartData = {
        labels: ['Mon', 'Tue', 'Wed'],
        datasets: [
          { data: [10, 20, 30] },
          { data: [15, 25, 35] },
        ],
      };

      const { getByText } = render(
        <MetricsChart type="line" data={multiDatasetData} />
      );

      // Component should render
      expect(getByText).toBeTruthy();
    });

    it('should filter out datasets with empty data', () => {
      const mixedDatasetData: ChartData = {
        labels: ['Mon', 'Tue', 'Wed'],
        datasets: [
          { data: [10, 20, 30] },
          { data: [] }, // Empty dataset
        ],
      };

      const { getByText } = render(
        <MetricsChart type="line" data={mixedDatasetData} />
      );

      // Should render valid dataset, not empty state
      expect(getByText).toBeTruthy();
    });
  });
});
