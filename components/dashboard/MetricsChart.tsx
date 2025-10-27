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
import { useTheme } from '@/contexts/ThemeContext';

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
  const { theme } = useTheme();
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 600); // Max 600px, 24px padding each side

  // Helper to convert hex color to rgba
  const hexToRgba = (hex: string, opacity: number = 1) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(49, 130, 206, ${opacity})`;
    return `rgba(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${opacity})`;
  };

  // Use a slightly elevated background for charts to ensure visibility in dark mode
  const chartBackgroundColor = theme.colors.backgroundSecondary || theme.colors.surface;

  const dynamicStyles = StyleSheet.create({
    title: {
      color: theme.colors.textPrimary,
    },
    chartContainer: {
      backgroundColor: chartBackgroundColor,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    emptyContainer: {
      backgroundColor: theme.colors.backgroundSecondary || theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
  });

  const chartConfig = {
    backgroundColor: chartBackgroundColor,
    backgroundGradientFrom: chartBackgroundColor,
    backgroundGradientTo: chartBackgroundColor,
    decimalPlaces: 0,
    color: (opacity = 1) => hexToRgba(theme.colors.accent, opacity),
    // Use primary text color for better visibility
    labelColor: (opacity = 1) => hexToRgba(theme.colors.textPrimary, opacity),
    style: {
      borderRadius: 12,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: theme.colors.accent,
    },
    propsForBackgroundLines: {
      // More visible grid lines
      stroke: theme.colors.border || theme.colors.borderLight,
      strokeWidth: 1,
      strokeDasharray: '5,5',
    },
  };

  // Ensure data has valid structure
  if (!data || !data.labels || !data.datasets || data.datasets.length === 0) {
    return (
      <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No chart data available</Text>
      </View>
    );
  }

  // Ensure all datasets have data
  const validDatasets = data.datasets.filter(ds => ds.data && ds.data.length > 0);
  if (validDatasets.length === 0) {
    return (
      <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No chart data available</Text>
      </View>
    );
  }

  const chartData = {
    ...data,
    datasets: validDatasets,
  };

  return (
    <View style={styles.container}>
      {title && <Text style={[styles.title, dynamicStyles.title]}>{title}</Text>}

      <View style={[styles.chartContainer, dynamicStyles.chartContainer]}>
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

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  chart: {
    borderRadius: 12,
  },
  emptyContainer: {
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
  },
});
