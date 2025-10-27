/**
 * App Settings Screen
 * @remarks
 * Provides global notification settings management
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { ThemeSelector } from '@/components/common/ThemeSelector';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/hooks/useAuth';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getOpportunityNotificationSettings,
  updateOpportunityNotificationSettings,
} from '@/services/userService';
import { clearCache } from '@/services/cacheService';
import { NotificationPreferences, User } from '@/types/user';

/**
 * Settings Screen Component
 * @component
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { signOut } = useAuth();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: true,
    showPreview: true,
    sound: true,
    vibration: true,
    directMessages: true,
    groupMessages: true,
    systemMessages: true,
  });

  // Opportunity notification settings (Story 5.6 - Task 9)
  const [opportunitySettings, setOpportunitySettings] = useState<
    NonNullable<User['settings']['opportunityNotifications']>
  >({
    enabled: true,
    minimumScore: 70,
    notifyByType: {
      sponsorship: true,
      collaboration: true,
      partnership: true,
      sale: false,
    },
    quietHours: {
      enabled: false,
      start: '22:00',
      end: '08:00',
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      // Don't try to navigate back on logout - root layout handles redirect to login
      // Just return early if no user (component will unmount when navigation happens)
      if (!currentUser) {
        return;
      }

      try {
        // Load notification preferences
        const prefs = await getNotificationPreferences(currentUser.uid);
        if (prefs) {
          setPreferences(prefs);
        }

        // Load opportunity notification settings (Story 5.6 - Task 9)
        const oppSettings = await getOpportunityNotificationSettings(currentUser.uid);
        if (oppSettings) {
          setOpportunitySettings(oppSettings);
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
        Alert.alert('Error', 'Failed to load settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [currentUser, router]);

  /**
   * Handles toggle change for notification preferences
   * @param field - The preference field to update
   * @param value - The new value
   */
  const handleToggle = async (field: keyof NotificationPreferences, value: boolean | string) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Optimistic update
    const previousPreferences = { ...preferences };
    setPreferences((prev) => ({ ...prev, [field]: value }));
    setIsSaving(true);

    try {
      const updatedPreferences = { ...preferences, [field]: value };
      await updateNotificationPreferences(currentUser.uid, updatedPreferences);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      // Revert on error
      setPreferences(previousPreferences);
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles opportunity notification settings updates (Story 5.6 - Task 9)
   * @param updates - Partial updates to apply to opportunity settings
   */
  const handleOpportunitySettingsUpdate = async (
    updates: Partial<NonNullable<User['settings']['opportunityNotifications']>>
  ) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Optimistic update
    const previousSettings = { ...opportunitySettings };
    const updatedSettings = { ...opportunitySettings, ...updates };
    setOpportunitySettings(updatedSettings);
    setIsSaving(true);

    try {
      await updateOpportunityNotificationSettings(currentUser.uid, updatedSettings);
    } catch (error) {
      console.error('Error updating opportunity settings:', error);
      // Revert on error
      setOpportunitySettings(previousSettings);
      Alert.alert('Error', 'Failed to update opportunity settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles sign out
   */
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear cache on logout
              if (currentUser?.uid) {
                await clearCache(currentUser.uid);
              }
              // Sign out - RootLayout will handle redirect to login
              await signOut();
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 24,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      marginBottom: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: 12,
      borderWidth: 1,
      ...theme.shadows.sm,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderLight,
    },
    settingLabel: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
    },
    subsectionTitle: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing.base,
      paddingTop: theme.spacing.base,
      paddingBottom: theme.spacing.sm,
    },
    sliderRow: {
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderLight,
    },
    sliderValue: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.accent,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    timeInputLabel: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    timeInput: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
    },
    savingText: {
      marginLeft: theme.spacing.sm,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.md,
      gap: 8,
    },
    signOutText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.error,
      fontWeight: theme.typography.fontWeight.semibold,
    },
  });

  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Settings"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => router.back(),
        }}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {/* Page Header */}
        <Text style={[styles.title, dynamicStyles.title]}>Settings</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Configure app preferences, notifications, and opportunity alerts
        </Text>

        {/* Theme Selection Section */}
        <Text style={dynamicStyles.sectionHeader}>APPEARANCE</Text>
        <View style={dynamicStyles.section}>
          <ThemeSelector />
        </View>

        {/* Global Notifications Section */}
        <Text style={dynamicStyles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={dynamicStyles.section}>

          <View style={dynamicStyles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Enable Notifications</Text>
              <Text style={dynamicStyles.settingDescription}>
                Receive push notifications for new messages
              </Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(value) => handleToggle('enabled', value)}
              disabled={isSaving}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>

          {preferences.enabled && (
            <>
              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Show Message Preview</Text>
                  <Text style={dynamicStyles.settingDescription}>
                    Display message content in notifications
                  </Text>
                </View>
                <Switch
                  value={preferences.showPreview}
                  onValueChange={(value) => handleToggle('showPreview', value)}
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Sound</Text>
                  <Text style={dynamicStyles.settingDescription}>Play notification sound</Text>
                </View>
                <Switch
                  value={preferences.sound}
                  onValueChange={(value) => handleToggle('sound', value)}
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Vibration</Text>
                  <Text style={dynamicStyles.settingDescription}>Vibrate on notification</Text>
                </View>
                <Switch
                  value={preferences.vibration}
                  onValueChange={(value) => handleToggle('vibration', value)}
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>
            </>
          )}
        </View>

        {/* Notification Types Section */}
        {preferences.enabled && (
          <>
            <Text style={dynamicStyles.sectionHeader}>NOTIFICATION TYPES</Text>
            <View style={dynamicStyles.section}>

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Direct Messages</Text>
                <Text style={dynamicStyles.settingDescription}>
                  Notifications for 1-on-1 conversations
                </Text>
              </View>
              <Switch
                value={preferences.directMessages}
                onValueChange={(value) => handleToggle('directMessages', value)}
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
              />
            </View>

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Group Messages</Text>
                <Text style={dynamicStyles.settingDescription}>Notifications for group conversations</Text>
              </View>
              <Switch
                value={preferences.groupMessages}
                onValueChange={(value) => handleToggle('groupMessages', value)}
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
              />
            </View>

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>System Messages</Text>
                <Text style={dynamicStyles.settingDescription}>
                  Notifications for system announcements
                </Text>
              </View>
              <Switch
                value={preferences.systemMessages}
                onValueChange={(value) => handleToggle('systemMessages', value)}
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
              />
            </View>
            </View>
          </>
        )}

        {/* Opportunity Notifications Section (Story 5.6 - Task 9) */}
        <Text style={dynamicStyles.sectionHeader}>BUSINESS OPPORTUNITIES</Text>
        <View style={dynamicStyles.section}>
          <View style={dynamicStyles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Opportunity Notifications</Text>
              <Text style={dynamicStyles.settingDescription}>
                Get notified about high-value business opportunities
              </Text>
            </View>
            <Switch
              value={opportunitySettings.enabled}
              onValueChange={(value) => handleOpportunitySettingsUpdate({ enabled: value })}
              disabled={isSaving}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>

          {opportunitySettings.enabled && (
            <>
              {/* Minimum Score Slider */}
              <View style={dynamicStyles.sliderRow}>
                <View style={styles.sliderInfo}>
                  <Text style={dynamicStyles.settingLabel}>Minimum Score Threshold</Text>
                  <Text style={dynamicStyles.settingDescription}>
                    Only notify for opportunities scoring {opportunitySettings.minimumScore} or
                    higher
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={70}
                  maximumValue={100}
                  step={5}
                  value={opportunitySettings.minimumScore}
                  onValueChange={(value: number) =>
                    handleOpportunitySettingsUpdate({ minimumScore: value })
                  }
                  minimumTrackTintColor={theme.colors.accent}
                  maximumTrackTintColor={theme.colors.borderLight}
                  thumbTintColor={theme.colors.accent}
                  disabled={isSaving}
                />
                <Text style={dynamicStyles.sliderValue}>{opportunitySettings.minimumScore}</Text>
              </View>

              {/* Opportunity Types */}
              <Text style={dynamicStyles.subsectionTitle}>Notify By Type</Text>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Sponsorships</Text>
                  <Text style={dynamicStyles.settingDescription}>Brand deals and sponsorship offers</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.sponsorship}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, sponsorship: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Collaborations</Text>
                  <Text style={dynamicStyles.settingDescription}>Creative partnerships and collabs</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.collaboration}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, collaboration: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Partnerships</Text>
                  <Text style={dynamicStyles.settingDescription}>Long-term business partnerships</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.partnership}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, partnership: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Sales & Products</Text>
                  <Text style={dynamicStyles.settingDescription}>
                    Product purchases and sales inquiries
                  </Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.sale}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, sale: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              {/* Quiet Hours */}
              <Text style={dynamicStyles.subsectionTitle}>Quiet Hours</Text>

              <View style={dynamicStyles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={dynamicStyles.settingLabel}>Enable Quiet Hours</Text>
                  <Text style={dynamicStyles.settingDescription}>
                    Pause opportunity notifications during quiet hours
                  </Text>
                </View>
                <Switch
                  value={opportunitySettings.quietHours?.enabled || false}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      quietHours: { ...opportunitySettings.quietHours!, enabled: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                />
              </View>

              {opportunitySettings.quietHours?.enabled && (
                <>
                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputContainer}>
                      <Text style={dynamicStyles.timeInputLabel}>Start Time</Text>
                      <TextInput
                        style={dynamicStyles.timeInput}
                        value={opportunitySettings.quietHours?.start || '22:00'}
                        onChangeText={(value) =>
                          handleOpportunitySettingsUpdate({
                            quietHours: { ...opportunitySettings.quietHours!, start: value },
                          })
                        }
                        placeholder="22:00"
                        placeholderTextColor={theme.colors.textTertiary}
                        editable={!isSaving}
                      />
                    </View>
                    <View style={styles.timeInputContainer}>
                      <Text style={dynamicStyles.timeInputLabel}>End Time</Text>
                      <TextInput
                        style={dynamicStyles.timeInput}
                        value={opportunitySettings.quietHours?.end || '08:00'}
                        onChangeText={(value) =>
                          handleOpportunitySettingsUpdate({
                            quietHours: { ...opportunitySettings.quietHours!, end: value },
                          })
                        }
                        placeholder="08:00"
                        placeholderTextColor={theme.colors.textTertiary}
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Account Section */}
        <Text style={dynamicStyles.sectionHeader}>ACCOUNT</Text>
        <View style={dynamicStyles.section}>
          <TouchableOpacity
            style={dynamicStyles.signOutButton}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
            <Text style={dynamicStyles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={dynamicStyles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  savingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sliderInfo: {
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  timeInputContainer: {
    flex: 1,
  },
});
