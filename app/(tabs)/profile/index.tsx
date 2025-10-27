/**
 * Profile View Screen
 * @remarks
 * Displays user profile information with option to edit
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import { getUserProfile } from '@/services/userService';
import { useUserStore } from '@/stores/userStore';
import { useFocusEffect } from 'expo-router';

/**
 * Profile View Screen Component
 * @component
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const authUser = auth.currentUser;

  const { currentUser: profile, isLoading, setCurrentUser, setLoading } = useUserStore();

  const loadProfile = async () => {
    if (!authUser) {
      Alert.alert('Error', 'You must be logged in to view your profile.');
      return;
    }

    setLoading(true);
    try {
      const userProfile = await getUserProfile(authUser.uid);
      setCurrentUser(userProfile);
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, [authUser?.uid]);

  // Reload profile when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [authUser?.uid])
  );

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.backgroundSecondary, // Subtle gray for grouped layout
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    errorText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
    },
    // Profile info card
    profileCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      marginHorizontal: theme.spacing.base,
      marginTop: theme.spacing.base,
      marginBottom: theme.spacing.lg,
      alignItems: 'center',
      ...theme.shadows.md,
    },
    infoLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textTertiary,
      marginBottom: theme.spacing.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontWeight: theme.typography.fontWeight.medium,
    },
    infoValue: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    // Section headers
    sectionHeader: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginLeft: theme.spacing.base,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    // Settings cards
    settingsCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.xl,
      marginHorizontal: theme.spacing.base,
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
      ...theme.shadows.sm,
    },
    settingsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    settingsButtonLast: {
      borderBottomWidth: 0,
    },
    settingsContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingsText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      marginLeft: theme.spacing.md,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });

  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <Text style={dynamicStyles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Profile"
        rightAction={{
          icon: 'create-outline',
          onPress: () => router.push('/(tabs)/profile/edit'),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Info Card - Robinhood style */}
        <View style={dynamicStyles.profileCard}>
          <View style={styles.photoContainer}>
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: theme.colors.accent }]}>
                <Text style={styles.photoPlaceholderText}>
                  {profile.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.presenceIndicatorContainer}>
              <PresenceIndicator userId={profile.uid} size="large" showPulse={true} />
            </View>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Username</Text>
              <Text style={dynamicStyles.infoValue}>@{profile.username}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Display Name</Text>
              <Text style={dynamicStyles.infoValue}>{profile.displayName}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={dynamicStyles.infoLabel}>Email</Text>
              <Text style={dynamicStyles.infoValue}>{profile.email}</Text>
            </View>
          </View>
        </View>

        {/* MESSAGING Section - Card grouping */}
        <Text style={dynamicStyles.sectionHeader}>Messaging</Text>
        <View style={dynamicStyles.settingsCard}>
          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/faq-library')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>FAQ Library</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.settingsButton, dynamicStyles.settingsButtonLast]}
            onPress={() => router.push('/(tabs)/profile/voice-settings')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="finger-print" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Voice Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* AI FEATURES Section - Card grouping */}
        <Text style={dynamicStyles.sectionHeader}>AI Features</Text>
        <View style={dynamicStyles.settingsCard}>
          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/capacity-settings')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="hourglass-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Daily Capacity</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="calendar-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Daily Agent</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.settingsButton, dynamicStyles.settingsButtonLast]}
            onPress={() => router.push('/(tabs)/profile/engagement-health')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="heart-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Engagement Health</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* ADMIN Section - Card grouping */}
        <Text style={dynamicStyles.sectionHeader}>Admin</Text>
        <View style={dynamicStyles.settingsCard}>
          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/ai-cost-dashboard')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="analytics-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Cost Dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/ai-performance-dashboard')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="speedometer-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Performance Dashboard</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/dashboard-settings')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="options-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Dashboard Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/archived-messages')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="archive-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Auto-Archive History</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/test-daily-agent')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="flask-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Test Agent</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={dynamicStyles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/agent-execution-logs')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="list-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Execution Logs</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[dynamicStyles.settingsButton, dynamicStyles.settingsButtonLast]}
            onPress={() => router.push('/(tabs)/profile/settings')}
          >
            <View style={dynamicStyles.settingsContent}>
              <Ionicons name="settings-outline" size={22} color={theme.colors.textSecondary} />
              <Text style={dynamicStyles.settingsText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* Bottom padding for breathing room */}
        <View style={{ height: theme.spacing['3xl'] }} />
      </ScrollView>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 0,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presenceIndicatorContainer: {
    position: 'absolute',
    bottom: 4,
    right: 4,
  },
  photoPlaceholderText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  infoSection: {
    width: '100%',
  },
  infoRow: {
    marginBottom: 16,
    alignItems: 'center',
  },
});
