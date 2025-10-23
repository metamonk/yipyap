/**
 * Root index screen
 * @component
 * @remarks
 * Initial landing screen - performs auth-based redirect
 * This screen redirects to the appropriate route based on auth state
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

/**
 * Index screen - performs immediate redirect based on auth state
 */
export default function Index() {
  const router = useRouter();
  const { isAuthenticated, hasProfile, isLoading } = useAuth();

  useEffect(() => {
    // Skip if still loading
    if (isLoading) return;

    // Redirect based on auth state
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !hasProfile) {
      router.replace('/(auth)/username-setup');
    } else if (isAuthenticated && hasProfile) {
      router.replace('/(tabs)/conversations');
    }
  }, [isAuthenticated, hasProfile, isLoading, router]);

  // Show loading while checking auth
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
