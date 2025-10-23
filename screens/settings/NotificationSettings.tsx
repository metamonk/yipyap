/**
 * Notification Settings Screen
 * @component
 *
 * @remarks
 * Allows users to configure notification preferences including:
 * - Master notification toggle
 * - Category-specific toggles (direct, group, system)
 * - Message preview settings
 * - Sound and vibration preferences
 * - Quiet hours configuration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
  Alert,
} from 'react-native';
import { updateNotificationPreferences } from '@/services/userService';
import { notificationService } from '@/services/notificationService';
import type { NotificationPreferences } from '@/types/user';

/**
 * Props for NotificationSettings component
 */
export interface NotificationSettingsProps {
  /** Current user ID */
  userId: string;

  /** Current notification preferences */
  initialPreferences?: NotificationPreferences;

  /** Callback when preferences are saved */
  onSave?: (preferences: NotificationPreferences) => void;
}

/**
 * Default notification preferences
 */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  showPreview: true,
  sound: true,
  vibration: true,
  directMessages: true,
  groupMessages: true,
  systemMessages: false,
};

/**
 * Notification Settings Screen Component
 *
 * @example
 * ```tsx
 * <NotificationSettings
 *   userId="user123"
 *   initialPreferences={userPreferences}
 *   onSave={(prefs) => console.log('Saved:', prefs)}
 * />
 * ```
 */
export function NotificationSettings({
  userId,
  initialPreferences,
  onSave,
}: NotificationSettingsProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    initialPreferences || DEFAULT_PREFERENCES
  );
  const [saving, setSaving] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);

  // Check notification permissions on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  /**
   * Checks if notification permissions are granted
   */
  const checkPermissions = async () => {
    const granted = await notificationService.checkPermissions();
    setHasPermission(granted);
  };

  /**
   * Requests notification permissions
   */
  const requestPermissions = async () => {
    const granted = await notificationService.requestPermissions();
    setHasPermission(granted);

    if (!granted) {
      Alert.alert(
        'Permissions Required',
        'Please enable notifications in your device settings to receive push notifications.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Updates a preference value
   */
  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    savePreferences(updated);
  };

  /**
   * Saves preferences to Firestore via service layer
   */
  const savePreferences = async (prefs: NotificationPreferences) => {
    if (saving) return;

    try {
      setSaving(true);

      // Update via service layer (follows architecture principle: never access Firebase directly)
      await updateNotificationPreferences(userId, prefs);

      // Update in notification service
      notificationService.setPreferences(prefs);

      // Call callback if provided
      if (onSave) {
        onSave(prefs);
      }
    } catch (error) {
      console.error('[NotificationSettings] Error saving preferences:', error);
      Alert.alert(
        'Save Failed',
        'Failed to save notification preferences. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Permission Status */}
      {!hasPermission && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            Notifications are disabled. Tap to enable.
          </Text>
          <Text style={styles.permissionLink} onPress={requestPermissions}>
            Enable
          </Text>
        </View>
      )}

      {/* Master Toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive push notifications for messages
            </Text>
          </View>
          <Switch
            value={preferences.enabled}
            onValueChange={(value) => updatePreference('enabled', value)}
            disabled={!hasPermission}
          />
        </View>
      </View>

      {/* Categories */}
      {preferences.enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Direct Messages</Text>
              <Text style={styles.settingDescription}>
                Notifications for one-on-one conversations
              </Text>
            </View>
            <Switch
              value={preferences.directMessages}
              onValueChange={(value) => updatePreference('directMessages', value)}
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
              onValueChange={(value) => updatePreference('groupMessages', value)}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>System Messages</Text>
              <Text style={styles.settingDescription}>
                Important updates and announcements
              </Text>
            </View>
            <Switch
              value={preferences.systemMessages}
              onValueChange={(value) => updatePreference('systemMessages', value)}
            />
          </View>
        </View>
      )}

      {/* Display Options */}
      {preferences.enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Display</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Show Message Preview</Text>
              <Text style={styles.settingDescription}>
                Display message content in notifications
              </Text>
            </View>
            <Switch
              value={preferences.showPreview}
              onValueChange={(value) => updatePreference('showPreview', value)}
            />
          </View>
        </View>
      )}

      {/* Alerts */}
      {preferences.enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Sound</Text>
              <Text style={styles.settingDescription}>
                Play sound for new notifications
              </Text>
            </View>
            <Switch
              value={preferences.sound}
              onValueChange={(value) => updatePreference('sound', value)}
            />
          </View>

          {Platform.OS === 'android' && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Vibration</Text>
                <Text style={styles.settingDescription}>
                  Vibrate for new notifications
                </Text>
              </View>
              <Switch
                value={preferences.vibration}
                onValueChange={(value) => updatePreference('vibration', value)}
              />
            </View>
          )}
        </View>
      )}

      {/* Quiet Hours */}
      {preferences.enabled && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <Text style={styles.sectionDescription}>
            Mute notifications during specified hours
          </Text>

          {/* TODO: Add time pickers for quiet hours */}
          {preferences.quietHoursStart && preferences.quietHoursEnd && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                Active: {preferences.quietHoursStart} - {preferences.quietHoursEnd}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Save Status */}
      {saving && (
        <View style={styles.savingIndicator}>
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  permissionBanner: {
    backgroundColor: '#ff9800',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  permissionLink: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#666',
  },
  savingIndicator: {
    padding: 16,
    alignItems: 'center',
  },
  savingText: {
    fontSize: 14,
    color: '#666',
  },
});
