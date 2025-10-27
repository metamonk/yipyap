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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const searchParams = useLocalSearchParams();

  // Check if we came from daily digest
  const from = searchParams.from as string | undefined;
  const handleBack = () => {
    if (from === 'daily-digest') {
      router.push('/(tabs)/daily-digest');
    } else {
      router.back();
    }
  };

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
      marginTop: 8,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: theme.spacing.base,
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: theme.spacing.lg,
    },
    errorText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.error,
      marginBottom: theme.spacing.base,
    },
    retryButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      minWidth: 120,
      minHeight: 44,
    },
    retryButtonText: {
      color: '#FFFFFF',
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    sectionDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.base,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: theme.spacing.md,
      minHeight: 44,
    },
    settingSection: {
      paddingVertical: theme.spacing.base,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    settingLabel: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    settingHint: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    timeButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.base,
      paddingVertical: 14,
      minHeight: 50,
      marginTop: theme.spacing.md,
    },
    timeButtonText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    savingText: {
      marginLeft: theme.spacing.sm,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    pickerModalContent: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    pickerHeader: {
      paddingVertical: theme.spacing.base,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    pickerContainer: {
      backgroundColor: theme.colors.surface,
      paddingVertical: theme.spacing.sm,
    },
    pickerButtonCancel: {
      backgroundColor: theme.colors.backgroundSecondary,
    },
    pickerButtonConfirm: {
      backgroundColor: theme.colors.accent,
    },
    pickerButtonText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    pickerButtonTextConfirm: {
      color: '#FFFFFF',
    },
  });

  if (isLoading) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Daily Agent Settings" showBack={true} backAction={handleBack} />
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={dynamicStyles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  if (!config) {
    return (
      <View style={dynamicStyles.container}>
        <NavigationHeader title="Daily Agent Settings" showBack={true} backAction={handleBack} />
        <View style={dynamicStyles.errorContainer}>
          <Text style={dynamicStyles.errorText}>Failed to load settings</Text>
          <TouchableOpacity
            style={dynamicStyles.retryButton}
            onPress={() => {
              setIsLoading(true);
              // Reload config
            }}
          >
            <Text style={dynamicStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader title="Daily Agent Settings" showBack={true} backAction={handleBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Page Header */}
        <Text style={[styles.title, dynamicStyles.title]}>Daily Agent Settings</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Configure automated workflow, schedule, and AI features for daily message processing
        </Text>

        {/* Enable/Disable Section */}
        <Text style={dynamicStyles.sectionHeader}>DAILY WORKFLOW</Text>
        <View style={styles.section}>
          <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Enable Daily Agent</Text>
              <Text style={dynamicStyles.settingHint}>
                Process messages and send auto-responses
              </Text>
            </View>
            <Switch
              value={config.features.dailyWorkflowEnabled}
              onValueChange={(value) => handleFeatureToggle('dailyWorkflowEnabled', value)}
              disabled={isSaving}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
              accessibilityLabel="Enable daily agent workflow"
              style={styles.switch}
            />
          </View>
        </View>

        {/* Schedule Settings */}
        {config.features.dailyWorkflowEnabled && (
          <>
            <Text style={dynamicStyles.sectionHeader}>SCHEDULE</Text>
            <View style={styles.section}>
              <View style={dynamicStyles.settingSection}>
              <Text style={dynamicStyles.settingLabel}>Daily Workflow Time</Text>
              <Text style={dynamicStyles.settingHint}>When to run daily processing</Text>
              <TouchableOpacity
                style={dynamicStyles.timeButton}
                onPress={() => setTimePickerVisible(true)}
                accessible={true}
                accessibilityLabel={`Daily workflow time: ${selectedTime}`}
                accessibilityRole="button"
                accessibilityHint="Opens time picker"
              >
                <Text style={dynamicStyles.timeButtonText}>{selectedTime}</Text>
                <Ionicons name="chevron-down" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Timezone</Text>
                <Text style={dynamicStyles.settingHint}>{config.workflowSettings.timezone}</Text>
              </View>
            </View>
            </View>
          </>
        )}

        {/* Response Settings */}
        {config.features.dailyWorkflowEnabled && (
          <>
            <Text style={dynamicStyles.sectionHeader}>RESPONSE SETTINGS</Text>
            <View style={styles.section}>
              <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Require Approval</Text>
                <Text style={dynamicStyles.settingHint}>
                  Review responses before sending
                </Text>
              </View>
              <Switch
                value={config.workflowSettings.requireApproval}
                onValueChange={(value) =>
                  handleWorkflowSettingUpdate('requireApproval', value)
                }
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
                accessibilityLabel="Require approval for auto-responses"
                style={styles.switch}
              />
            </View>

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>
                  Max Auto-Responses: {config.workflowSettings.maxAutoResponses}
                </Text>
                <Text style={dynamicStyles.settingHint}>Daily limit (1-100)</Text>
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
              minimumTrackTintColor={theme.colors.accent}
              maximumTrackTintColor={theme.colors.borderLight}
              thumbTintColor={theme.colors.accent}
              disabled={isSaving}
              accessible={true}
              accessibilityLabel={`Maximum auto-responses per day: ${config.workflowSettings.maxAutoResponses}`}
              accessibilityRole="adjustable"
            />

            <View style={dynamicStyles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>
                  Escalation Threshold: {Math.round(config.workflowSettings.escalationThreshold * 100)}%
                </Text>
                <Text style={dynamicStyles.settingHint}>
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
              minimumTrackTintColor={theme.colors.accent}
              maximumTrackTintColor={theme.colors.borderLight}
              thumbTintColor={theme.colors.accent}
              disabled={isSaving}
              accessible={true}
              accessibilityLabel={`Escalation threshold: ${Math.round(config.workflowSettings.escalationThreshold * 100)} percent`}
              accessibilityRole="adjustable"
            />
            </View>
          </>
        )}

        {/* AI Features */}
        {config.features.dailyWorkflowEnabled && (
          <>
            <Text style={dynamicStyles.sectionHeader}>AI FEATURES</Text>
            <View style={styles.section}>
              <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Message Categorization</Text>
                <Text style={dynamicStyles.settingHint}>AI-powered category tagging</Text>
              </View>
              <Switch
                value={config.features.categorizationEnabled}
                onValueChange={(value) =>
                  handleFeatureToggle('categorizationEnabled', value)
                }
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
                accessibilityLabel="Enable message categorization"
                style={styles.switch}
              />
            </View>

            <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>FAQ Detection</Text>
                <Text style={dynamicStyles.settingHint}>Auto-respond to common questions</Text>
              </View>
              <Switch
                value={config.features.faqDetectionEnabled}
                onValueChange={(value) => handleFeatureToggle('faqDetectionEnabled', value)}
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
                accessibilityLabel="Enable FAQ detection"
                style={styles.switch}
              />
            </View>

            <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Voice Matching</Text>
                <Text style={dynamicStyles.settingHint}>Match your communication style</Text>
              </View>
              <Switch
                value={config.features.voiceMatchingEnabled}
                onValueChange={(value) => handleFeatureToggle('voiceMatchingEnabled', value)}
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
                accessibilityLabel="Enable voice matching"
                style={styles.switch}
              />
            </View>

            <View style={dynamicStyles.settingRow} accessible={true} accessibilityRole="switch">
              <View style={styles.settingInfo}>
                <Text style={dynamicStyles.settingLabel}>Sentiment Analysis</Text>
                <Text style={dynamicStyles.settingHint}>Detect message sentiment</Text>
              </View>
              <Switch
                value={config.features.sentimentAnalysisEnabled}
                onValueChange={(value) =>
                  handleFeatureToggle('sentimentAnalysisEnabled', value)
                }
                disabled={isSaving}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={theme.colors.borderLight}
                accessibilityLabel="Enable sentiment analysis"
                style={styles.switch}
              />
            </View>
            </View>
          </>
        )}

        {/* Saving Indicator */}
        {isSaving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={dynamicStyles.savingText}>Saving...</Text>
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
              style={dynamicStyles.pickerModalContent}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={dynamicStyles.pickerHeader}>
                <Text style={dynamicStyles.pickerTitle}>Set Daily Workflow Time</Text>
              </View>
              <View style={dynamicStyles.pickerContainer}>
                <DateTimePicker
                  value={pickerDate}
                  mode="time"
                  display="spinner"
                  onChange={handleTimeChange}
                  textColor={theme.colors.textPrimary}
                />
              </View>
              <View style={styles.pickerButtons}>
                <TouchableOpacity
                  style={[styles.pickerButton, dynamicStyles.pickerButtonCancel]}
                  onPress={() => {
                    setTimePickerVisible(false);
                    setPickerDate(timeStringToDate(config!.workflowSettings.dailyWorkflowTime));
                  }}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                >
                  <Text style={dynamicStyles.pickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pickerButton, dynamicStyles.pickerButtonConfirm]}
                  onPress={handleTimeConfirm}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm time"
                >
                  <Text style={[dynamicStyles.pickerButtonText, dynamicStyles.pickerButtonTextConfirm]}>
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

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollView: {
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
    marginBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  switch: {
    transform: Platform.OS === 'ios' ? [] : [{ scaleX: 1.2 }, { scaleY: 1.2 }],
  },
  slider: {
    width: '100%',
    height: 44,
    marginVertical: 8,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
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
});
