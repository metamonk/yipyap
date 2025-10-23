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
} from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/userService';
import { NotificationPreferences } from '@/types/user';

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
        const prefs = await getNotificationPreferences(currentUser.uid);
        if (prefs) {
          setPreferences(prefs);
        }
      } catch (error) {
        console.error('Error loading notification preferences:', error);
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
});
