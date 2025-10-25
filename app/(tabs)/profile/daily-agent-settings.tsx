/**
 * Daily Agent Settings Screen
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent
 * Provides configuration for daily agent workflow automation
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
  TouchableOpacity,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getDailyAgentConfig,
  updateDailyAgentConfig,
  validateScheduleTime,
} from '@/services/dailyAgentConfigService';
import { DailyAgentConfig } from '@/types/ai';

/**
 * Daily Agent Settings Screen Component
 * @component
 *
 * @example
 * ```tsx
 * <DailyAgentSettingsScreen />
 * ```
 */
export default function DailyAgentSettingsScreen() {
  const router = useRouter();
  const auth = getFirebaseAuth();

  // Configuration state
  const [config, setConfig] = useState<DailyAgentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Time picker state
  const [timePickerVisible, setTimePickerVisible] = useState(false);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [pickerDate, setPickerDate] = useState(new Date());

  /**
   * Converts HH:mm time string to Date object for picker
   * @param timeString - Time in HH:mm format
   * @returns Date object with the specified time
   */
  const timeStringToDate = (timeString: string): Date => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  /**
   * Converts Date object to HH:mm time string
   * @param date - Date object
   * @returns Time in HH:mm format
   */
  const dateToTimeString = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Wait for auth state to be ready
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [auth]);

  useEffect(() => {
    const loadConfig = async () => {
      // Wait for auth state to be ready
      if (!authReady) {
        return;
      }

      // Don't try to navigate back on logout - root layout handles redirect to login
      // Just return early if no user (component will unmount when navigation happens)
      if (!currentUser) {
        return;
      }

      try {
        // Wait a brief moment to ensure auth token has propagated to Firestore
        await new Promise(resolve => setTimeout(resolve, 100));

        const agentConfig = await getDailyAgentConfig(currentUser.uid);
        setConfig(agentConfig);
        const timeStr = agentConfig.workflowSettings.dailyWorkflowTime;
        setSelectedTime(timeStr);
        setPickerDate(timeStringToDate(timeStr));
      } catch (error: unknown) {
        console.error('Error loading daily agent config:', error);

        // Check if it's a permissions error
        const err = error as { message?: string; code?: string };
        if (err?.message?.includes('permission') || err?.code === 'permission-denied') {
          Alert.alert(
            'Authentication Error',
            'Please sign out and sign back in to refresh your permissions.',
            [
              { text: 'OK', style: 'default' },
              { text: 'Sign Out', style: 'destructive', onPress: () => router.push('/(tabs)/profile') }
            ]
          );
        } else {
          Alert.alert('Error', 'Failed to load daily agent settings. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [authReady, currentUser, router]);

  /**
   * Handles feature toggle updates
   * @param feature - Feature key to toggle
   * @param value - New toggle value
   */
  const handleFeatureToggle = async (
    feature: keyof DailyAgentConfig['features'],
    value: boolean
  ) => {
    if (!currentUser || !config) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Optimistic update
    const previousConfig = { ...config };
    setConfig({
      ...config,
      features: {
        ...config.features,
        [feature]: value,
      },
    });
    setIsSaving(true);

    try {
      await updateDailyAgentConfig({
        features: {
          [feature]: value,
        },
      });
    } catch (error) {
      console.error('Error updating feature toggle:', error);
      // Revert on error
      setConfig(previousConfig);
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles workflow settings updates
   * @param setting - Workflow setting key
   * @param value - New setting value
   */
  const handleWorkflowSettingUpdate = async (
    setting: keyof DailyAgentConfig['workflowSettings'],
    value: string | number | boolean
  ) => {
    if (!currentUser || !config) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Validate schedule time if being updated
    if (setting === 'dailyWorkflowTime' && typeof value === 'string') {
      if (!validateScheduleTime(value)) {
        Alert.alert('Invalid Time', 'Please enter time in HH:mm format (e.g., 09:00).');
        return;
      }
    }

    // Optimistic update
    const previousConfig = { ...config };
    setConfig({
      ...config,
      workflowSettings: {
        ...config.workflowSettings,
        [setting]: value,
      },
    });
    setIsSaving(true);

    try {
      await updateDailyAgentConfig({
        workflowSettings: {
          [setting]: value,
        },
      });
    } catch (error) {
      console.error('Error updating workflow setting:', error);
      // Revert on error
      setConfig(previousConfig);
      Alert.alert('Error', 'Failed to update settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles time change from native picker
   * @param event - Picker event
   * @param date - Selected date/time
   */
  const handleTimeChange = async (event: { type: string }, date?: Date) => {
    // On Android, the picker dismisses automatically
    if (Platform.OS === 'android') {
      setTimePickerVisible(false);
    }

    // User cancelled
    if (event.type === 'dismissed' || !date) {
      if (Platform.OS === 'android') {
        setTimePickerVisible(false);
      }
      return;
    }

    // Update the picker date
    setPickerDate(date);

    // Convert to time string and save
    const timeString = dateToTimeString(date);
    setSelectedTime(timeString);
    await handleWorkflowSettingUpdate('dailyWorkflowTime', timeString);
  };

  /**
   * Handles time picker confirmation (iOS only)
   */
  const handleTimeConfirm = () => {
    setTimePickerVisible(false);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Agent Settings" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  if (!config) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Agent Settings" showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load settings</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setIsLoading(true);
              // Reload config
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader title="Daily Agent Settings" showBack={true} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Enable/Disable Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Workflow</Text>
          <Text style={styles.sectionDescription}>
            Automatically process overnight messages every morning
          </Text>

          <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Daily Agent</Text>
              <Text style={styles.settingHint}>
                Process messages and send auto-responses
              </Text>
            </View>
            <Switch
              value={config.features.dailyWorkflowEnabled}
              onValueChange={(value) => handleFeatureToggle('dailyWorkflowEnabled', value)}
              disabled={isSaving}
              accessibilityLabel="Enable daily agent workflow"
              style={styles.switch}
            />
          </View>
        </View>

        {/* Schedule Settings */}
        {config.features.dailyWorkflowEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Schedule</Text>

            <View style={styles.settingSection}>
              <Text style={styles.settingLabel}>Daily Workflow Time</Text>
              <Text style={styles.settingHint}>When to run daily processing</Text>
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setTimePickerVisible(true)}
                accessible={true}
                accessibilityLabel={`Daily workflow time: ${selectedTime}`}
                accessibilityRole="button"
                accessibilityHint="Opens time picker"
              >
                <Text style={styles.timeButtonText}>{selectedTime}</Text>
                <Ionicons name="chevron-down" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Timezone</Text>
                <Text style={styles.settingHint}>{config.workflowSettings.timezone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Response Settings */}
        {config.features.dailyWorkflowEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Response Settings</Text>

            <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Require Approval</Text>
                <Text style={styles.settingHint}>
                  Review responses before sending
                </Text>
              </View>
              <Switch
                value={config.workflowSettings.requireApproval}
                onValueChange={(value) =>
                  handleWorkflowSettingUpdate('requireApproval', value)
                }
                disabled={isSaving}
                accessibilityLabel="Require approval for auto-responses"
                style={styles.switch}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>
                  Max Auto-Responses: {config.workflowSettings.maxAutoResponses}
                </Text>
                <Text style={styles.settingHint}>Daily limit (1-100)</Text>
              </View>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={config.workflowSettings.maxAutoResponses}
              onSlidingComplete={(value) =>
                handleWorkflowSettingUpdate('maxAutoResponses', Math.round(value))
              }
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E5E5E5"
              thumbTintColor="#007AFF"
              disabled={isSaving}
              accessible={true}
              accessibilityLabel={`Maximum auto-responses per day: ${config.workflowSettings.maxAutoResponses}`}
              accessibilityRole="adjustable"
            />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>
                  Escalation Threshold: {Math.round(config.workflowSettings.escalationThreshold * 100)}%
                </Text>
                <Text style={styles.settingHint}>
                  Skip messages below this sentiment score
                </Text>
              </View>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.05}
              value={config.workflowSettings.escalationThreshold}
              onSlidingComplete={(value) =>
                handleWorkflowSettingUpdate('escalationThreshold', value)
              }
              minimumTrackTintColor="#007AFF"
              maximumTrackTintColor="#E5E5E5"
              thumbTintColor="#007AFF"
              disabled={isSaving}
              accessible={true}
              accessibilityLabel={`Escalation threshold: ${Math.round(config.workflowSettings.escalationThreshold * 100)} percent`}
              accessibilityRole="adjustable"
            />
          </View>
        )}

        {/* AI Features */}
        {config.features.dailyWorkflowEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Features</Text>

            <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Message Categorization</Text>
                <Text style={styles.settingHint}>AI-powered category tagging</Text>
              </View>
              <Switch
                value={config.features.categorizationEnabled}
                onValueChange={(value) =>
                  handleFeatureToggle('categorizationEnabled', value)
                }
                disabled={isSaving}
                accessibilityLabel="Enable message categorization"
                style={styles.switch}
              />
            </View>

            <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>FAQ Detection</Text>
                <Text style={styles.settingHint}>Auto-respond to common questions</Text>
              </View>
              <Switch
                value={config.features.faqDetectionEnabled}
                onValueChange={(value) => handleFeatureToggle('faqDetectionEnabled', value)}
                disabled={isSaving}
                accessibilityLabel="Enable FAQ detection"
                style={styles.switch}
              />
            </View>

            <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Voice Matching</Text>
                <Text style={styles.settingHint}>Match your communication style</Text>
              </View>
              <Switch
                value={config.features.voiceMatchingEnabled}
                onValueChange={(value) => handleFeatureToggle('voiceMatchingEnabled', value)}
                disabled={isSaving}
                accessibilityLabel="Enable voice matching"
                style={styles.switch}
              />
            </View>

            <View style={styles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Sentiment Analysis</Text>
                <Text style={styles.settingHint}>Detect message sentiment</Text>
              </View>
              <Switch
                value={config.features.sentimentAnalysisEnabled}
                onValueChange={(value) =>
                  handleFeatureToggle('sentimentAnalysisEnabled', value)
                }
                disabled={isSaving}
                accessibilityLabel="Enable sentiment analysis"
                style={styles.switch}
              />
            </View>
          </View>
        )}

        {/* Saving Indicator */}
        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>

      {/* Native Time Picker */}
      {timePickerVisible && Platform.OS === 'ios' && (
        <Modal
          transparent={true}
          animationType="slide"
          visible={timePickerVisible}
          onRequestClose={() => setTimePickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setTimePickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.pickerModalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Set Daily Workflow Time</Text>
              </View>
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor="#000000"
                />
              </View>
              <View style={styles.pickerButtons}>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonCancel]}
                  onPress={() => {
                    setTimePickerVisible(false);
                    setPickerDate(timeStringToDate(config!.workflowSettings.dailyWorkflowTime));
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={styles.pickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerButton, styles.pickerButtonConfirm]}
                  onPress={handleTimeConfirm}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm time"
                >
                  <Text style={[styles.pickerButtonText, styles.pickerButtonTextConfirm]}>
                    Confirm
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}
      {timePickerVisible && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    minHeight: 44,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
  },
  settingSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 14,
    color: '#666666',
  },
  switch: {
    transform: Platform.OS === 'ios' ? [] : [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  slider: {
    width: '100%',
    height: 44,
    marginVertical: 8,
  },
  timeButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
    marginTop: 12,
  },
  timeButtonText: {
    fontSize: 16,
    color: '#000000',
    flex: 1,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  savingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, // Account for iOS safe area
  },
  pickerHeader: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
  },
  pickerButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  pickerButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  pickerButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000000',
  },
  pickerButtonTextConfirm: {
    color: '#FFFFFF',
  },
});
