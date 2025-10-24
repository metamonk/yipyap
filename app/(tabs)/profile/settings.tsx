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
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  getOpportunityNotificationSettings,
  updateOpportunityNotificationSettings,
} from '@/services/userService';
import { NotificationPreferences, User } from '@/types/user';

/**
 * Settings Screen Component
 * @component
 */
export default function SettingsScreen() {
  const router = useRouter();
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
  const [opportunitySettings, setOpportunitySettings] = useState<NonNullable<User['settings']['opportunityNotifications']>>({
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
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to view settings.');
        router.back();
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
  const handleToggle = async (
    field: keyof NotificationPreferences,
    value: boolean | string
  ) => {
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

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Settings"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => router.back(),
        }}
      />

      <ScrollView style={styles.content}>
        {/* Global Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive push notifications for new messages
              </Text>
            </View>
            <Switch
              value={preferences.enabled}
              onValueChange={(value) => handleToggle('enabled', value)}
              disabled={isSaving}
              trackColor={{ false: '#D1D1D6', true: '#34C759' }}
              ios_backgroundColor="#D1D1D6"
            />
          </View>

          {preferences.enabled && (
            <>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Show Message Preview</Text>
                  <Text style={styles.settingDescription}>
                    Display message content in notifications
                  </Text>
                </View>
                <Switch
                  value={preferences.showPreview}
                  onValueChange={(value) => handleToggle('showPreview', value)}
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sound</Text>
                  <Text style={styles.settingDescription}>Play notification sound</Text>
                </View>
                <Switch
                  value={preferences.sound}
                  onValueChange={(value) => handleToggle('sound', value)}
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Vibration</Text>
                  <Text style={styles.settingDescription}>Vibrate on notification</Text>
                </View>
                <Switch
                  value={preferences.vibration}
                  onValueChange={(value) => handleToggle('vibration', value)}
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>
            </>
          )}
        </View>

        {/* Notification Types Section */}
        {preferences.enabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Types</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Direct Messages</Text>
                <Text style={styles.settingDescription}>
                  Notifications for 1-on-1 conversations
                </Text>
              </View>
              <Switch
                value={preferences.directMessages}
                onValueChange={(value) => handleToggle('directMessages', value)}
                disabled={isSaving}
                trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Group Messages</Text>
                <Text style={styles.settingDescription}>
                  Notifications for group conversations
                </Text>
              </View>
              <Switch
                value={preferences.groupMessages}
                onValueChange={(value) => handleToggle('groupMessages', value)}
                disabled={isSaving}
                trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                ios_backgroundColor="#D1D1D6"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>System Messages</Text>
                <Text style={styles.settingDescription}>
                  Notifications for system announcements
                </Text>
              </View>
              <Switch
                value={preferences.systemMessages}
                onValueChange={(value) => handleToggle('systemMessages', value)}
                disabled={isSaving}
                trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                ios_backgroundColor="#D1D1D6"
              />
            </View>
          </View>
        )}

        {/* Opportunity Notifications Section (Story 5.6 - Task 9) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Opportunities</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Opportunity Notifications</Text>
              <Text style={styles.settingDescription}>
                Get notified about high-value business opportunities
              </Text>
            </View>
            <Switch
              value={opportunitySettings.enabled}
              onValueChange={(value) => handleOpportunitySettingsUpdate({ enabled: value })}
              disabled={isSaving}
              trackColor={{ false: '#D1D1D6', true: '#34C759' }}
              ios_backgroundColor="#D1D1D6"
            />
          </View>

          {opportunitySettings.enabled && (
            <>
              {/* Minimum Score Slider */}
              <View style={styles.sliderRow}>
                <View style={styles.sliderInfo}>
                  <Text style={styles.settingLabel}>Minimum Score Threshold</Text>
                  <Text style={styles.settingDescription}>
                    Only notify for opportunities scoring {opportunitySettings.minimumScore} or higher
                  </Text>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={70}
                  maximumValue={100}
                  step={5}
                  value={opportunitySettings.minimumScore}
                  onValueChange={(value: number) => handleOpportunitySettingsUpdate({ minimumScore: value })}
                  minimumTrackTintColor="#007AFF"
                  maximumTrackTintColor="#D1D1D6"
                  thumbTintColor="#007AFF"
                  disabled={isSaving}
                />
                <Text style={styles.sliderValue}>{opportunitySettings.minimumScore}</Text>
              </View>

              {/* Opportunity Types */}
              <Text style={styles.subsectionTitle}>Notify By Type</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sponsorships</Text>
                  <Text style={styles.settingDescription}>Brand deals and sponsorship offers</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.sponsorship}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, sponsorship: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Collaborations</Text>
                  <Text style={styles.settingDescription}>Creative partnerships and collabs</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.collaboration}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, collaboration: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Partnerships</Text>
                  <Text style={styles.settingDescription}>Long-term business partnerships</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.partnership}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, partnership: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Sales & Products</Text>
                  <Text style={styles.settingDescription}>Product purchases and sales inquiries</Text>
                </View>
                <Switch
                  value={opportunitySettings.notifyByType.sale}
                  onValueChange={(value) =>
                    handleOpportunitySettingsUpdate({
                      notifyByType: { ...opportunitySettings.notifyByType, sale: value },
                    })
                  }
                  disabled={isSaving}
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              {/* Quiet Hours */}
              <Text style={styles.subsectionTitle}>Quiet Hours</Text>

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>Enable Quiet Hours</Text>
                  <Text style={styles.settingDescription}>
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
                  trackColor={{ false: '#D1D1D6', true: '#34C759' }}
                  ios_backgroundColor="#D1D1D6"
                />
              </View>

              {opportunitySettings.quietHours?.enabled && (
                <>
                  <View style={styles.timeInputRow}>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeInputLabel}>Start Time</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={opportunitySettings.quietHours?.start || '22:00'}
                        onChangeText={(value) =>
                          handleOpportunitySettingsUpdate({
                            quietHours: { ...opportunitySettings.quietHours!, start: value },
                          })
                        }
                        placeholder="22:00"
                        placeholderTextColor="#C7C7CC"
                        editable={!isSaving}
                      />
                    </View>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeInputLabel}>End Time</Text>
                      <TextInput
                        style={styles.timeInput}
                        value={opportunitySettings.quietHours?.end || '08:00'}
                        onChangeText={(value) =>
                          handleOpportunitySettingsUpdate({
                            quietHours: { ...opportunitySettings.quietHours!, end: value },
                          })
                        }
                        placeholder="08:00"
                        placeholderTextColor="#C7C7CC"
                        editable={!isSaving}
                      />
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 20,
    paddingVertical: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    color: '#000000',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#8E8E93',
  },
  savingIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#8E8E93',
  },
  // Opportunity settings styles (Story 5.6 - Task 9)
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sliderRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  sliderInfo: {
    marginBottom: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 8,
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
  timeInputLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  timeInput: {
    fontSize: 17,
    color: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C6C6C8',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
});
