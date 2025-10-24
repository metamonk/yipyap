/**
 * Home screen component - Creator Command Center Dashboard (Story 5.7)
 * @component
 * @remarks
 * Comprehensive dashboard aggregating all AI features into a unified Command Center.
 * Uses dynamic widget system for customizable layout with real-time updates.
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, Animated, InteractionManager, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../_components/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';
import { DashboardWidgetContainer } from '@/components/dashboard/DashboardWidgetContainer';
import { opportunityService } from '@/services/opportunityService';
import { dashboardService } from '@/services/dashboardService';
import {
  getCachedDashboardSummary,
  cacheDashboardSummary,
  getCachedOpportunities,
  cacheOpportunities,
  clearCache,
} from '@/services/cacheService';
import { AIAvailabilityMonitor } from '@/services/aiAvailabilityService';
import type { Message } from '@/types/models';
import type { DashboardSummary } from '@/types/dashboard';

/**
 * Creator Command Center - Main home screen
 * Story 5.7 - Task 8: Transform home screen into comprehensive dashboard
 * @component
 */
export default function HomeScreen() {
  const { signOut, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [opportunities, setOpportunities] = useState<Message[]>([]);
  const [dailySummary, setDailySummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true); // Task 11: AI availability state

  // Animation for smooth updates (Story 5.7 - Task 9)
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // AI availability monitor (Story 5.7 - Task 11)
  const availabilityMonitor = useRef<AIAvailabilityMonitor | null>(null);

  /**
   * Animate dashboard update with smooth fade effect
   * Story 5.7 - Task 9: Smooth animations for real-time updates
   */
  const animateDashboardUpdate = useCallback((callback: () => void) => {
    // Use InteractionManager to avoid UI jank during animations
    InteractionManager.runAfterInteractions(() => {
      // Fade out briefly
      Animated.timing(fadeAnim, {
        toValue: 0.85,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        // Update data
        callback();

        // Fade back in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }).start();
      });
    });
  }, [fadeAnim]);

  /**
   * Load dashboard data (opportunities and summary)
   * Story 5.7 - Task 8: Fetch data for Command Center widgets
   * Story 5.7 - Task 10: Cache fetched data for instant load
   */
  const loadDashboardData = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch both opportunities and daily summary in parallel
      const [opps, summary] = await Promise.all([
        opportunityService.getHighValueOpportunities(user.uid, 70, 20),
        dashboardService.getDailySummary(user.uid),
      ]);

      setOpportunities(opps);
      setDailySummary(summary);

      // Cache the fresh data (fire and forget - don't await)
      // This ensures subsequent loads are instant (<1s)
      cacheOpportunities(user.uid, opps);
      cacheDashboardSummary(user.uid, summary);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  /**
   * Handle pull-to-refresh
   * Story 5.7 - Task 8: Pull-to-refresh for Command Center
   * Story 5.7 - Task 10: Clear cache on manual refresh
   */
  const handleRefresh = useCallback(async () => {
    if (!user?.uid) return;

    setRefreshing(true);
    // Clear cache on manual refresh to force fresh data
    await clearCache(user.uid);
    await loadDashboardData();
    setRefreshing(false);
  }, [user?.uid, loadDashboardData]);

  /**
   * Handle message press - navigate to conversation
   * Story 5.7 - Task 8: Navigation from priority messages
   */
  const handleMessagePress = useCallback(
    (conversationId: string) => {
      router.push(`/conversations/${conversationId}`);
    },
    [router]
  );

  /**
   * Initialize dashboard and subscribe to real-time updates
   * Story 5.7 - Task 9: Real-time updates with smooth animations
   * Story 5.7 - Task 10: Instant load with cached data (<1s)
   */
  useEffect(() => {
    if (!user?.uid) return;

    // Story 5.7 - Task 10: Load cached data immediately (instant <100ms)
    const loadCachedData = async () => {
      const startTime = Date.now();

      const [cachedOpps, cachedSummary] = await Promise.all([
        getCachedOpportunities(user.uid),
        getCachedDashboardSummary(user.uid),
      ]);

      if (cachedOpps) {
        setOpportunities(cachedOpps);
      }
      if (cachedSummary) {
        setDailySummary(cachedSummary);
        // Show cached data immediately - user sees content instantly
        setLoading(false);
      }

      const loadTime = Date.now() - startTime;
      console.log(`Dashboard cached data loaded in ${loadTime}ms`);
    };

    // Load cached data immediately (doesn't block)
    loadCachedData();

    // Then fetch fresh data in background
    loadDashboardData();

    // Subscribe to real-time opportunity updates (high-value only)
    const unsubscribeOpportunities = opportunityService.subscribeToOpportunities(
      user.uid,
      70, // High-value threshold
      (newOpportunity) => {
        console.log('New high-value opportunity received:', newOpportunity.id);

        // Animate the update for smooth UX
        animateDashboardUpdate(() => {
          // Add new opportunity to the top of the list
          setOpportunities((prev) => [newOpportunity, ...prev]);
        });
      }
    );

    // Subscribe to dashboard summary updates (Story 5.7 - Task 9.2)
    // Throttled to max 1 update per second in dashboardService
    const unsubscribeDashboard = dashboardService.subscribeToDashboardUpdates(
      user.uid,
      (updatedSummary) => {
        console.log('Dashboard summary updated:', updatedSummary.lastUpdated);

        // Animate the update for smooth UX
        animateDashboardUpdate(() => {
          setDailySummary(updatedSummary);
        });
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeOpportunities();
      unsubscribeDashboard();
    };
  }, [user?.uid, loadDashboardData, animateDashboardUpdate]);

  /**
   * Monitor AI service availability
   * Story 5.7 - Task 11: Graceful degradation when AI unavailable
   */
  useEffect(() => {
    // Initialize availability monitor
    availabilityMonitor.current = new AIAvailabilityMonitor();

    // Start monitoring with callback
    availabilityMonitor.current.startMonitoring((available) => {
      console.log(`AI services ${available ? 'available' : 'unavailable'}`);
      setAiAvailable(available);
    });

    // Check immediately on mount
    availabilityMonitor.current.checkNow();

    // Cleanup on unmount
    return () => {
      availabilityMonitor.current?.stopMonitoring();
    };
  }, []);

  /**
   * Manually retry AI availability check
   * Story 5.7 - Task 11: Manual refresh for degraded state
   */
  const handleRetryAI = useCallback(async () => {
    if (availabilityMonitor.current) {
      const available = await availabilityMonitor.current.checkNow();
      if (available) {
        // AI recovered - refresh dashboard data
        await loadDashboardData();
      }
    }
  }, [loadDashboardData]);

  const handleLogout = async () => {
    try {
      // Clear cache on logout (Story 5.7 - Task 10)
      if (user?.uid) {
        await clearCache(user.uid);
      }

      // Call signOut from auth service
      // RootLayout's reactive routing will handle redirect to login after auth state changes
      await signOut();
    } catch (logoutError) {
      console.error('Logout error:', logoutError);
    }
  };

  // Don't render if no user
  if (!user?.uid) {
    return null;
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Command Center"
        rightAction={{
          icon: 'log-out-outline',
          onPress: handleLogout,
          disabled: authLoading,
        }}
      />

      {/* Degraded State Banner (Story 5.7 - Task 11) */}
      {!aiAvailable && (
        <View style={styles.degradedBanner}>
          <Ionicons name="alert-circle" size={20} color="#E53E3E" />
          <Text style={styles.degradedText}>
            AI features temporarily unavailable. Showing cached data.
          </Text>
          <TouchableOpacity onPress={handleRetryAI} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[styles.dashboardContainer, { opacity: fadeAnim }]}>
        <DashboardWidgetContainer
          userId={user.uid}
          onMessagePress={handleMessagePress}
          dashboardSummary={dailySummary}
          opportunities={opportunities}
          loading={loading}
          aiAvailable={aiAvailable}
          error={error}
          onRefresh={loadDashboardData}
          refreshing={refreshing}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  dashboardContainer: {
    flex: 1,
  },
  degradedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FEE2E2',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  degradedText: {
    flex: 1,
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E53E3E',
    borderRadius: 6,
  },
  retryText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
