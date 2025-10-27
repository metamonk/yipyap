/**
 * FAQ Analytics Screen
 *
 * @remarks
 * Screen for viewing FAQ performance metrics and usage statistics.
 * Accessible from the Profile tab via FAQ Library.
 *
 * @module app/(tabs)/profile/faq-analytics
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { FAQAnalytics } from '@/components/faq/FAQAnalytics';
import { getFAQAnalytics } from '@/services/faqService';
import { getFirebaseAuth } from '@/services/firebase';
import type { FAQAnalytics as FAQAnalyticsData } from '@/types/faq';

/**
 * FAQ Analytics Screen Component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Displays total FAQ templates and active count
 * - Shows auto-responses sent count
 * - Calculates and displays time saved estimate
 * - Lists top 10 FAQs by usage count
 * - Shows usage breakdown by category
 * - Loading state while fetching data
 * - Error handling with user-friendly messages
 */
export default function FAQAnalyticsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [analytics, setAnalytics] = useState<FAQAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    if (!currentUser) {
      setError('You must be logged in to view analytics');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await getFAQAnalytics(currentUser.uid);
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading FAQ analytics:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="FAQ Analytics"
        leftAction={{
          icon: 'chevron-back',
          onPress: () => router.back(),
        }}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading analytics...</Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
        </View>
      )}

      {!isLoading && !error && analytics && <FAQAnalytics analytics={analytics} />}
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
