/**
 * DashboardWidgetContainer - Dynamic widget system with drag-to-reorder (Story 5.7 - Task 7)
 *
 * @remarks
 * Manages dashboard widget visibility, ordering, and configuration.
 * Supports:
 * - Widget visibility toggles
 * - Drag-to-reorder widgets (long-press to activate)
 * - Persistent configuration in Firestore
 * - Default config for new users
 *
 * @example
 * ```tsx
 * <DashboardWidgetContainer
 *   userId="user123"
 *   onMessagePress={(convId) => router.push(`/conversations/${convId}`)}
 * />
 * ```
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import type { DashboardConfig, DashboardSummary } from '@/types/dashboard';
import type { Message } from '@/types/models';

// Widget components
import { DailySummaryWidget } from './DailySummaryWidget';
import { PriorityFeed } from './PriorityFeed';
import { AIMetricsDashboard } from './AIMetricsDashboard';
import { QuickActions } from './QuickActions';
import { OpportunityFeed } from './OpportunityFeed';

/**
 * Props for DashboardWidgetContainer component
 */
export interface DashboardWidgetContainerProps {
  /** User ID to load/save dashboard config for */
  userId: string;

  /** Callback when a priority message is pressed */
  onMessagePress: (conversationId: string) => void;

  /** Optional dashboard summary data (if already fetched) */
  dashboardSummary?: DashboardSummary;

  /** Optional opportunities data (if already fetched) */
  opportunities?: Message[];

  /** Loading state for externally fetched data */
  loading?: boolean;

  /** Error state for externally fetched data */
  error?: string | null;

  /** Callback to refresh dashboard data */
  onRefresh?: () => void;

  /** Refreshing state for pull-to-refresh */
  refreshing?: boolean;

  /** AI service availability (Story 5.7 - Task 11) */
  aiAvailable?: boolean;
}

/**
 * Widget item for rendering
 */
interface WidgetItem {
  id: string;
  key: string;
}

/**
 * Default dashboard configuration for new users
 */
export const DEFAULT_DASHBOARD_CONFIG: Omit<DashboardConfig, 'userId' | 'updatedAt'> = {
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
};

/**
 * DashboardWidgetContainer Component
 *
 * Manages dynamic widget rendering with visibility, ordering, and drag-to-reorder functionality.
 */
export const DashboardWidgetContainer = memo(({
  userId,
  onMessagePress,
  dashboardSummary,
  opportunities = [],
  loading = false,
  error = null,
  onRefresh,
  refreshing = false,
  aiAvailable = true, // Default to true (optimistic)
}: DashboardWidgetContainerProps) => {
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [widgetItems, setWidgetItems] = useState<WidgetItem[]>([]);

  /**
   * Load dashboard configuration from Firestore
   */
  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true);

      const userDocRef = doc(getFirebaseDb(), 'users', userId);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const savedConfig = userData?.settings?.dashboardConfig;

        if (savedConfig) {
          setConfig(savedConfig as DashboardConfig);
        } else {
          // No saved config - use default
          const defaultConfig: DashboardConfig = {
            ...DEFAULT_DASHBOARD_CONFIG,
            userId,
            updatedAt: Timestamp.now(),
          };
          setConfig(defaultConfig);
        }
      } else {
        // User document doesn't exist - use default
        const defaultConfig: DashboardConfig = {
          ...DEFAULT_DASHBOARD_CONFIG,
          userId,
          updatedAt: Timestamp.now(),
        };
        setConfig(defaultConfig);
      }
    } catch (err) {
      console.error('Failed to load dashboard config:', err);
      Alert.alert('Error', 'Failed to load dashboard configuration');

      // Fallback to default config
      const defaultConfig: DashboardConfig = {
        ...DEFAULT_DASHBOARD_CONFIG,
        userId,
        updatedAt: Timestamp.now(),
      };
      setConfig(defaultConfig);
    } finally {
      setConfigLoading(false);
    }
  }, [userId]);

  /**
   * Save dashboard configuration to Firestore
   */
  const saveConfig = useCallback(async (newConfig: DashboardConfig) => {
    try {
      const userDocRef = doc(getFirebaseDb(), 'users', userId);

      await updateDoc(userDocRef, {
        'settings.dashboardConfig': {
          ...newConfig,
          updatedAt: Timestamp.now(),
        },
      });

      setConfig({
        ...newConfig,
        updatedAt: Timestamp.now(),
      });
    } catch (err) {
      console.error('Failed to save dashboard config:', err);
      Alert.alert('Error', 'Failed to save dashboard configuration');
    }
  }, [userId]);

  /**
   * Handle widget reordering
   */
  const handleDragEnd = useCallback(async ({ data }: { data: WidgetItem[] }) => {
    if (!config) return;

    const newOrder = data.map((item) => item.id);

    // Update local state immediately for smooth UX
    setWidgetItems(data);

    // Save to Firestore
    const newConfig: DashboardConfig = {
      ...config,
      widgetOrder: newOrder,
      updatedAt: Timestamp.now(),
    };

    await saveConfig(newConfig);
  }, [config, saveConfig]);

  /**
   * Render individual widget based on ID
   */
  const renderWidget = useCallback((widgetId: string) => {
    switch (widgetId) {
      case 'dailySummary':
        if (!dashboardSummary) {
          // Data not available yet - show loading or placeholder
          return (
            <View style={styles.widgetPlaceholder}>
              <Text style={styles.placeholderText}>Daily Summary - Loading...</Text>
            </View>
          );
        }
        return (
          <DailySummaryWidget
            summary={dashboardSummary}
            loading={loading}
            error={error}
            onRefresh={onRefresh}
          />
        );

      case 'priorityFeed':
        return (
          <PriorityFeed
            userId={userId}
            maxResults={20}
            onMessagePress={onMessagePress}
          />
        );

      case 'aiMetrics':
        return (
          <AIMetricsDashboard
            userId={userId}
            showCostMetrics={config?.showCostMetrics ?? false}
            initiallyCollapsed={true}
            onRefresh={onRefresh}
          />
        );

      case 'quickActions':
        return (
          <QuickActions userId={userId} />
        );

      case 'opportunityAnalytics':
        return (
          <OpportunityFeed
            opportunities={opportunities}
            onRefresh={onRefresh}
            loading={loading}
          />
        );

      default:
        return null;
    }
  }, [userId, onMessagePress, dashboardSummary, opportunities, loading, error, onRefresh, config]);

  /**
   * Render draggable widget item
   */
  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<WidgetItem>) => {
    return (
      <ScaleDecorator>
        <View
          style={[
            styles.widgetWrapper,
            isActive && styles.widgetWrapperActive,
          ]}
          onLongPress={drag}
          delayLongPress={300}
        >
          {renderWidget(item.id)}
        </View>
      </ScaleDecorator>
    );
  }, [renderWidget]);

  /**
   * Load config on mount
   */
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  /**
   * Update widget items when config changes
   */
  useEffect(() => {
    if (!config) return;

    // Filter visible widgets and maintain order
    const visibleWidgets = config.widgetOrder
      .filter((widgetId) => {
        const visibility = config.widgetVisibility[widgetId as keyof typeof config.widgetVisibility];
        return visibility === true;
      })
      .map((widgetId) => ({
        id: widgetId,
        key: widgetId,
      }));

    setWidgetItems(visibleWidgets);
  }, [config]);

  // Loading state
  if (configLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3182CE" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  // No config (shouldn't happen with fallback)
  if (!config) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
      </View>
    );
  }

  // Empty state (no visible widgets)
  if (widgetItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No widgets enabled</Text>
        <Text style={styles.emptySubtext}>
          Go to Settings to customize your dashboard
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DraggableFlatList
        data={widgetItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        onDragEnd={handleDragEnd}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={true}
        activationDistance={10}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3182CE"
              colors={['#3182CE']}
            />
          ) : undefined
        }
      />
    </View>
  );
});

DashboardWidgetContainer.displayName = 'DashboardWidgetContainer';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  widgetWrapper: {
    marginBottom: 16,
  },
  widgetWrapperActive: {
    opacity: 0.7,
    transform: [{ scale: 1.02 }],
  },
  widgetPlaceholder: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  placeholderText: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#E53E3E',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
