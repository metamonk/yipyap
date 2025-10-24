/**
 * Voice Settings Screen
 * @remarks
 * Allows users to configure voice matching settings and train their voice profile
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';
import { updateUserSettings } from '@/services/userService';
import { voiceMatchingService } from '@/services/voiceMatchingService';
import { VoiceTrainingStatus } from '@/components/voice/VoiceTrainingStatus';
import type { VoiceMatchingSettings } from '@/types/user';

/**
 * Voice Settings Screen Component
 * @component
 */
export default function VoiceSettingsScreen() {
  const router = useRouter();
  const { userProfile } = useAuth();

  // Initialize settings from user profile or use defaults
  const [settings, setSettings] = useState<VoiceMatchingSettings>({
    enabled: true,
    autoShowSuggestions: true,
    suggestionCount: 2,
    retrainingSchedule: 'weekly',
  });

  const [isTraining, setIsTraining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load settings from user profile when available
  useEffect(() => {
    if (userProfile?.settings?.voiceMatching) {
      setSettings(userProfile.settings.voiceMatching);
    }
  }, [userProfile]);

  /**
   * Handles toggling voice matching enabled/disabled
   */
  const handleToggleEnabled = async (enabled: boolean) => {
    const newSettings = { ...settings, enabled };
    setSettings(newSettings);

    setIsSaving(true);
    try {
      await updateUserSettings(userProfile!.uid, { 'voiceMatching.enabled': enabled });
    } catch (error) {
      console.error('Failed to update voice matching enabled setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
      // Revert on error
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles toggling auto-show suggestions
   */
  const handleToggleAutoShow = async (autoShow: boolean) => {
    const newSettings = { ...settings, autoShowSuggestions: autoShow };
    setSettings(newSettings);

    setIsSaving(true);
    try {
      await updateUserSettings(userProfile!.uid, { 'voiceMatching.autoShowSuggestions': autoShow });
    } catch (error) {
      console.error('Failed to update auto-show suggestions setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles changing suggestion count
   */
  const handleSuggestionCountChange = async (count: number) => {
    const newSettings = { ...settings, suggestionCount: count };
    setSettings(newSettings);

    setIsSaving(true);
    try {
      await updateUserSettings(userProfile!.uid, { 'voiceMatching.suggestionCount': count });
    } catch (error) {
      console.error('Failed to update suggestion count setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles changing retraining schedule
   */
  const handleRetrainingScheduleChange = async (schedule: 'weekly' | 'biweekly' | 'monthly') => {
    const newSettings = { ...settings, retrainingSchedule: schedule };
    setSettings(newSettings);

    setIsSaving(true);
    try {
      await updateUserSettings(userProfile!.uid, { 'voiceMatching.retrainingSchedule': schedule });
    } catch (error) {
      console.error('Failed to update retraining schedule setting:', error);
      Alert.alert('Error', 'Failed to update setting. Please try again.');
      setSettings(settings);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handles training voice profile
   */
  const handleTrainProfile = async () => {
    if (!userProfile) {
      Alert.alert('Error', 'User profile not loaded. Please try again.');
      return;
    }

    setIsTraining(true);
    try {
      await voiceMatchingService.trainVoiceProfile(userProfile.uid);
      Alert.alert('Success', 'Voice profile trained successfully!', [{ text: 'OK' }]);
    } catch (error: any) {
      console.error('Failed to train voice profile:', error);
      Alert.alert('Error', error.message || 'Failed to train voice profile. Please try again.', [
        { text: 'OK' },
      ]);
    } finally {
      setIsTraining(false);
    }
  };

  if (!userProfile) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Voice Settings"
        showBack={true}
        backAction={() => router.back()}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={styles.title}>Voice Matching Settings</Text>
        <Text style={styles.subtitle}>
          Customize how AI suggestions match your unique communication style
        </Text>

        {/* Enable Voice Matching */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Enable Voice Matching</Text>
            <Text style={styles.settingHint}>
              Generate AI suggestions that match your style
            </Text>
          </View>
          <Switch
            value={settings.enabled}
            onValueChange={handleToggleEnabled}
            disabled={isSaving}
            testID="toggle-enabled"
          />
        </View>

        {/* Auto-Show Suggestions */}
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Auto-Show Suggestions</Text>
            <Text style={styles.settingHint}>
              Automatically display suggestions for incoming messages
            </Text>
          </View>
          <Switch
            value={settings.autoShowSuggestions}
            onValueChange={handleToggleAutoShow}
            disabled={isSaving || !settings.enabled}
            testID="toggle-auto-show"
          />
        </View>

        {/* Suggestion Count */}
        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>Number of Suggestions</Text>
          <Text style={styles.settingHint}>How many response options to generate</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={settings.suggestionCount}
              onValueChange={handleSuggestionCountChange}
              enabled={!isSaving && settings.enabled}
              style={styles.picker}
              testID="picker-suggestion-count"
            >
              <Picker.Item label="1 suggestion" value={1} />
              <Picker.Item label="2 suggestions" value={2} />
              <Picker.Item label="3 suggestions" value={3} />
            </Picker>
          </View>
        </View>

        {/* Retraining Schedule */}
        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>Retraining Schedule</Text>
          <Text style={styles.settingHint}>How often to update your voice profile</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={settings.retrainingSchedule}
              onValueChange={handleRetrainingScheduleChange}
              enabled={!isSaving && settings.enabled}
              style={styles.picker}
              testID="picker-retraining-schedule"
            >
              <Picker.Item label="Weekly" value="weekly" />
              <Picker.Item label="Bi-weekly" value="biweekly" />
              <Picker.Item label="Monthly" value="monthly" />
            </Picker>
          </View>
        </View>

        {/* Train Now Button */}
        <TouchableOpacity
          style={[styles.trainButton, (isTraining || !settings.enabled) && styles.trainButtonDisabled]}
          onPress={handleTrainProfile}
          disabled={isTraining || !settings.enabled}
          testID="train-button"
        >
          {isTraining ? (
            <View style={styles.trainButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.trainButtonText}>Training...</Text>
            </View>
          ) : (
            <View style={styles.trainButtonContent}>
              <Ionicons name="flash" size={20} color="#FFFFFF" />
              <Text style={styles.trainButtonText}>Train Voice Profile Now</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Voice Training Status */}
        <VoiceTrainingStatus
          userId={userProfile.uid}
          retrainingSchedule={settings.retrainingSchedule}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 32,
    lineHeight: 22,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  settingLabel: {
    fontSize: 17,
    color: '#000000',
    fontWeight: '500',
    marginBottom: 4,
  },
  settingHint: {
    fontSize: 14,
    color: '#999999',
    lineHeight: 18,
  },
  pickerContainer: {
    marginTop: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  trainButton: {
    backgroundColor: '#6C63FF',
    padding: 18,
    borderRadius: 16,
    marginTop: 32,
    alignItems: 'center',
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  trainButtonDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  trainButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trainButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 8,
  },
});
