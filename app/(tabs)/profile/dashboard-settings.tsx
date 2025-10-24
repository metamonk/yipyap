/**
 * Dashboard Settings Screen - Story 5.7 Task 13
 *
 * @remarks
 * Allows users to customize their Command Center dashboard:
 * - Widget visibility toggles
 * - Widget reordering (up/down buttons)
 * - Refresh interval configuration
 * - Metrics display period selection
 * - Cost metrics visibility toggle
 *
 * @example
 * Navigate from profile screen or settings menu
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';
import { useAuth } from '@/hooks/useAuth';
import { NavigationHeader } from '@/app/_components/NavigationHeader';
import type { DashboardConfig } from '@/types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG } from '@/components/dashboard/DashboardWidgetContainer';

/**
 * Widget display names for UI
 */
const WIDGET_NAMES: Record<string, string> = {
  dailySummary: 'Daily Summary',
  priorityFeed: 'Priority Messages',
  aiMetrics: 'AI Performance',
  quickActions: 'Quick Actions',
  opportunityAnalytics: 'Opportunities',
};

/**
 * Widget descriptions for UI
 */
const WIDGET_DESCRIPTIONS: Record<string, string> = {
  dailySummary: 'Overnight activity and trends',
  priorityFeed: 'Urgent messages and opportunities',
  aiMetrics: 'AI accuracy and performance metrics',
  quickActions: 'Bulk operations panel',
  opportunityAnalytics: 'High-value business opportunities',
};

/**
 * Dashboard Settings Screen Component
 */
export default function DashboardSettingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  /**
   * Load current dashboard configuration from Firestore
   */
  const loadConfig = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);

      const userDocRef = doc(getFirebaseDb(), 'users', user.uid);
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
            userId: user.uid,
            updatedAt: Timestamp.now(),
          };
          setConfig(defaultConfig);
        }
      } else {
        // User document doesn't exist - use default
        const defaultConfig: DashboardConfig = {
          ...DEFAULT_DASHBOARD_CONFIG,
          userId: user.uid,
          updatedAt: Timestamp.now(),
        };
        setConfig(defaultConfig);
      }
    } catch (err) {
      console.error('Failed to load dashboard config:', err);
      Alert.alert('Error', 'Failed to load dashboard settings');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  /**
   * Save dashboard configuration to Firestore
   */
  const saveConfig = useCallback(async () => {
    if (!user?.uid || !config) return;

    try {
      setSaving(true);

      const userDocRef = doc(getFirebaseDb(), 'users', user.uid);

      await updateDoc(userDocRef, {
        'settings.dashboardConfig': {
          ...config,
          updatedAt: Timestamp.now(),
        },
      });

      setHasChanges(false);
      Alert.alert('Success', 'Dashboard settings saved successfully');
    } catch (err) {
      console.error('Failed to save dashboard config:', err);
      Alert.alert('Error', 'Failed to save dashboard settings');
    } finally {
      setSaving(false);
    }
  }, [user?.uid, config]);

  /**
   * Toggle widget visibility
   */
  const toggleWidgetVisibility = useCallback((widgetId: keyof typeof config.widgetVisibility) => {
    if (!config) return;

    setConfig({
      ...config,
      widgetVisibility: {
        ...config.widgetVisibility,
        [widgetId]: !config.widgetVisibility[widgetId],
      },
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Move widget up in order
   */
  const moveWidgetUp = useCallback((index: number) => {
    if (!config || index === 0) return;

    const newOrder = [...config.widgetOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];

    setConfig({
      ...config,
      widgetOrder: newOrder,
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Move widget down in order
   */
  const moveWidgetDown = useCallback((index: number) => {
    if (!config || index === config.widgetOrder.length - 1) return;

    const newOrder = [...config.widgetOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];

    setConfig({
      ...config,
      widgetOrder: newOrder,
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Update refresh interval
   */
  const updateRefreshInterval = useCallback((interval: number) => {
    if (!config) return;

    setConfig({
      ...config,
      refreshInterval: interval,
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Update metrics display period
   */
  const updateMetricsPeriod = useCallback((period: '7days' | '30days' | '90days') => {
    if (!config) return;

    setConfig({
      ...config,
      metricsDisplayPeriod: period,
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Toggle cost metrics visibility
   */
  const toggleCostMetrics = useCallback(() => {
    if (!config) return;

    setConfig({
      ...config,
      showCostMetrics: !config.showCostMetrics,
    });
    setHasChanges(true);
  }, [config]);

  /**
   * Reset to default configuration
   */
  const resetToDefault = useCallback(() => {
    if (!user?.uid) return;

    Alert.alert(
      'Reset to Default',
      'Are you sure you want to reset all dashboard settings to default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            const defaultConfig: DashboardConfig = {
              ...DEFAULT_DASHBOARD_CONFIG,
              userId: user.uid,
              updatedAt: Timestamp.now(),
            };
            setConfig(defaultConfig);
            setHasChanges(true);
          },
        },
      ]
    );
  }, [user?.uid]);

  /**
   * Handle back navigation with unsaved changes warning
   */
  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save before leaving?',
        [
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save', onPress: async () => {
            await saveConfig();
            router.back();
          }},
        ]
      );
    } else {
      router.back();
    }
  }, [hasChanges, router, saveConfig]);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <NavigationHeader
          title="Dashboard Settings"
          leftAction={{
            icon: 'arrow-back',
            onPress: () => router.back(),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182CE" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  // No config (shouldn't happen with fallback)
  if (!config) {
    return (
      <View style={styles.container}>
        <NavigationHeader
          title="Dashboard Settings"
          leftAction={{
            icon: 'arrow-back',
            onPress: () => router.back(),
          }}
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load settings</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConfig}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Dashboard Settings"
        leftAction={{
          icon: 'arrow-back',
          onPress: handleBack,
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Widget Visibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Widget Visibility</Text>
          <Text style={styles.sectionDescription}>
            Choose which widgets to display on your dashboard
          </Text>

          {Object.entries(config.widgetVisibility).map(([widgetId, isVisible]) => (
            <View key={widgetId} style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>{WIDGET_NAMES[widgetId]}</Text>
                <Text style={styles.settingDescription}>
                  {WIDGET_DESCRIPTIONS[widgetId]}
                </Text>
              </View>
              <Switch
                value={isVisible}
                onValueChange={() => toggleWidgetVisibility(widgetId as keyof typeof config.widgetVisibility)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={isVisible ? '#3182CE' : '#F3F4F6'}
              />
            </View>
          ))}
        </View>

        {/* Widget Order Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Widget Order</Text>
          <Text style={styles.sectionDescription}>
            Arrange widgets in your preferred order (top to bottom)
          </Text>

          {config.widgetOrder.map((widgetId, index) => (
            <View key={widgetId} style={styles.orderRow}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderNumber}>{index + 1}</Text>
                <Text style={styles.orderLabel}>{WIDGET_NAMES[widgetId]}</Text>
              </View>
              <View style={styles.orderButtons}>
                <TouchableOpacity
                  style={[styles.orderButton, index === 0 && styles.orderButtonDisabled]}
                  onPress={() => moveWidgetUp(index)}
                  disabled={index === 0}
                >
                  <Ionicons
                    name="chevron-up"
                    size={20}
                    color={index === 0 ? '#D1D5DB' : '#3182CE'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    index === config.widgetOrder.length - 1 && styles.orderButtonDisabled,
                  ]}
                  onPress={() => moveWidgetDown(index)}
                  disabled={index === config.widgetOrder.length - 1}
                >
                  <Ionicons
                    name="chevron-down"
                    size={20}
                    color={index === config.widgetOrder.length - 1 ? '#D1D5DB' : '#3182CE'}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Refresh Interval Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refresh Interval</Text>
          <Text style={styles.sectionDescription}>
            How often to refresh dashboard data (in seconds)
          </Text>

          <View style={styles.intervalContainer}>
            {[30, 60, 120, 300].map((interval) => (
              <TouchableOpacity
                key={interval}
                style={[
                  styles.intervalButton,
                  config.refreshInterval === interval && styles.intervalButtonActive,
                ]}
                onPress={() => updateRefreshInterval(interval)}
              >
                <Text
                  style={[
                    styles.intervalButtonText,
                    config.refreshInterval === interval && styles.intervalButtonTextActive,
                  ]}
                >
                  {interval}s
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Metrics Display Period Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metrics Display Period</Text>
          <Text style={styles.sectionDescription}>
            Time period for AI performance metrics
          </Text>

          <View style={styles.periodContainer}>
            {[
              { value: '7days', label: '7 Days' },
              { value: '30days', label: '30 Days' },
              { value: '90days', label: '90 Days' },
            ].map(({ value, label }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.periodButton,
                  config.metricsDisplayPeriod === value && styles.periodButtonActive,
                ]}
                onPress={() => updateMetricsPeriod(value as '7days' | '30days' | '90days')}
              >
                <Text
                  style={[
                    styles.periodButtonText,
                    config.metricsDisplayPeriod === value && styles.periodButtonTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Cost Metrics Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cost Transparency</Text>
          <Text style={styles.sectionDescription}>
            Show AI API costs in performance metrics
          </Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Cost Metrics</Text>
              <Text style={styles.settingDescription}>
                Display estimated API costs for transparency
              </Text>
            </View>
            <Switch
              value={config.showCostMetrics}
              onValueChange={toggleCostMetrics}
              trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
              thumbColor={config.showCostMetrics ? '#3182CE' : '#F3F4F6'}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetToDefault}
          >
            <Ionicons name="refresh" size={18} color="#DC2626" />
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, (!hasChanges || saving) && styles.saveButtonDisabled]}
            onPress={saveConfig}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {hasChanges ? 'Save Changes' : 'No Changes'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3182CE',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182CE',
    width: 32,
  },
  orderLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  orderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  orderButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  orderButtonDisabled: {
    opacity: 0.5,
  },
  intervalContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  intervalButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  intervalButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3182CE',
  },
  intervalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
  },
  intervalButtonTextActive: {
    color: '#3182CE',
    fontWeight: '600',
  },
  periodContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  periodButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3182CE',
  },
  periodButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6B7280',
  },
  periodButtonTextActive: {
    color: '#3182CE',
    fontWeight: '600',
  },
  actionsSection: {
    marginTop: 8,
    gap: 12,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#3182CE',
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
