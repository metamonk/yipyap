/**
 * MetricsChart - Reusable chart component for displaying AI performance metrics (Story 5.7 - Task 5)
 *
 * @remarks
 * Supports both line and bar charts with customizable data and styling.
 * Uses react-native-chart-kit for rendering.
 *
 * @example
 * ```tsx
 * <MetricsChart
 *   type="line"
 *   data={chartData}
 *   title="Accuracy Over Time"
 *   yAxisSuffix="%"
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';

/** Chart data format */
export interface ChartData {
  /** X-axis labels (e.g., dates) */
  labels: string[];

  /** Y-axis data points */
  datasets: Array<{
    data: number[];
    /** Optional color for this dataset */
    color?: (opacity?: number) => string;
  }>;
}

/** MetricsChart component props */
export interface MetricsChartProps {
  /** Chart type - line or bar */
  type: 'line' | 'bar';

  /** Chart data to display */
  data: ChartData;

  /** Optional chart title */
  title?: string;

  /** Y-axis label suffix (e.g., "%", "min", "$") */
  yAxisSuffix?: string;

  /** Chart height in pixels */
  height?: number;

  /** Whether to hide legend */
  hideLegend?: boolean;
}

const CHART_COLORS = ['#3182CE', '#38A169', '#D69E2E', '#E53E3E', '#805AD5'];

/**
 * Reusable chart component for displaying metrics data
 */
export function MetricsChart({
  type,
  data,
  title,
  yAxisSuffix = '',
  height = 220,
  hideLegend = false,
}: MetricsChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 600); // Max 600px, 24px padding each side

  const chartConfig = {
    backgroundColor: '#FFFFFF',
    backgroundGradientFrom: '#FFFFFF',
    backgroundGradientTo: '#FFFFFF',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(49, 130, 206, ${opacity})`, // Primary blue
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`, // Gray-600
    style: {
      borderRadius: 12,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#3182CE',
    },
    propsForBackgroundLines: {
      stroke: '#E2E8F0', // Gray-200
      strokeWidth: 1,
    },
  };

  // Ensure data has valid structure
  if (!data || !data.labels || !data.datasets || data.datasets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No chart data available</Text>
      </View>
    );
  }

  // Ensure all datasets have data
  const validDatasets = data.datasets.filter(ds => ds.data && ds.data.length > 0);
  if (validDatasets.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No chart data available</Text>
      </View>
    );
  }

  const chartData = {
    ...data,
    datasets: validDatasets,
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}

      <View style={styles.chartContainer}>
        {type === 'line' ? (
          <LineChart
            data={chartData}
            width={chartWidth}
            height={height}
            chartConfig={chartConfig}
            bezier
            yAxisSuffix={yAxisSuffix}
            withInnerLines
            withOuterLines
            withVerticalLines={false}
            withHorizontalLines
            style={styles.chart}
            accessible
            accessibilityLabel={`${title || 'Line chart'} showing ${data.labels.length} data points`}
          />
        ) : (
          <BarChart
            data={chartData}
            width={chartWidth}
            height={height}
            chartConfig={chartConfig}
            yAxisSuffix={yAxisSuffix}
            withInnerLines
            withVerticalLines={false}
            style={styles.chart}
            showBarTops={false}
            accessible
            accessibilityLabel={`${title || 'Bar chart'} showing ${data.labels.length} data points`}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937', // Gray-900
    marginBottom: 12,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  chart: {
    borderRadius: 12,
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB', // Gray-50
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280', // Gray-500
  },
});
