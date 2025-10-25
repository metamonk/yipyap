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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';
import { updateUserSettings } from '@/services/userService';
import { voiceMatchingService } from '@/services/voiceMatchingService';
import { VoiceTrainingStatus } from '@/components/voice/VoiceTrainingStatus';
import { SettingsPicker } from '@/components/voice/SettingsPicker';
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
  const [voiceProfile, setVoiceProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Load settings from user profile when available
  useEffect(() => {
    if (userProfile?.settings?.voiceMatching) {
      setSettings(userProfile.settings.voiceMatching);
    }
  }, [userProfile]);

  // Subscribe to voice profile to check training eligibility
  useEffect(() => {
    if (!userProfile) return;

    const loadVoiceProfile = async () => {
      try {
        setLoadingProfile(true);
        const { getFirebaseDb } = await import('@/services/firebase');
        const { doc, onSnapshot } = await import('firebase/firestore');
        const db = getFirebaseDb();

        // Subscribe to voice profile updates
        const profileRef = doc(db, 'voice_profiles', userProfile.uid);
        const unsubscribe = onSnapshot(
          profileRef,
          (snapshot) => {
            if (snapshot.exists()) {
              setVoiceProfile(snapshot.data());
            } else {
              setVoiceProfile(null);
            }
            setLoadingProfile(false);
          },
          (error) => {
            console.error('Error loading voice profile:', error);
            setVoiceProfile(null);
            setLoadingProfile(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up voice profile listener:', error);
        setLoadingProfile(false);
      }
    };

    const unsubscribePromise = loadVoiceProfile();
    return () => {
      unsubscribePromise?.then((unsubscribe) => unsubscribe?.());
    };
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
      // Enhanced error handling for stale profile scenario
      const errorMessage = error.message || '';

      if (errorMessage.includes('Insufficient training data') || errorMessage.includes('Need at least')) {
        // Stale profile detected - backend found fewer messages than profile claims
        // This is expected behavior, log as info not error
        console.info('[VoiceSettings] Training failed - insufficient messages:', errorMessage);

        Alert.alert(
          'Profile Out of Sync',
          'Your voice profile shows previous training data, but no recent messages were found in your account. ' +
          'This can happen if:\n\n' +
          '• Messages were deleted\n' +
          '• You\'re using a different environment\n' +
          '• Database was reset\n\n' +
          'Please send at least 10 messages to retrain your profile.',
          [{ text: 'OK' }]
        );
      } else {
        // Unexpected error - log as error
        console.error('[VoiceSettings] Failed to train voice profile:', error);
        Alert.alert('Error', errorMessage || 'Failed to train voice profile. Please try again.', [
          { text: 'OK' },
        ]);
      }
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
            <SettingsPicker
              value={settings.suggestionCount}
              items={[
                { label: '1 suggestion', value: 1 },
                { label: '2 suggestions', value: 2 },
                { label: '3 suggestions', value: 3 },
              ]}
              onValueChange={handleSuggestionCountChange}
              disabled={isSaving || !settings.enabled}
              testID="picker-suggestion-count"
            />
          </View>
        </View>

        {/* Retraining Schedule */}
        <View style={styles.settingSection}>
          <Text style={styles.settingLabel}>Retraining Schedule</Text>
          <Text style={styles.settingHint}>How often to update your voice profile</Text>
          <View style={styles.pickerContainer}>
            <SettingsPicker
              value={settings.retrainingSchedule}
              items={[
                { label: 'Weekly', value: 'weekly' },
                { label: 'Bi-weekly', value: 'biweekly' },
                { label: 'Monthly', value: 'monthly' },
              ]}
              onValueChange={handleRetrainingScheduleChange}
              disabled={isSaving || !settings.enabled}
              testID="picker-retraining-schedule"
            />
          </View>
        </View>

        {/* Training Eligibility Status */}
        {!loadingProfile && voiceProfile && voiceProfile.trainingSampleCount < 10 && (
          <View style={styles.messageCountContainer}>
            <Ionicons name="information-circle" size={20} color="#FF9500" />
            <Text style={styles.messageCountText}>
              {voiceProfile.trainingSampleCount} / 10 messages - Send{' '}
              {10 - voiceProfile.trainingSampleCount} more to enable training
            </Text>
          </View>
        )}

        {/* Stale Profile Warning */}
        {!loadingProfile && voiceProfile && voiceProfile.trainingSampleCount >= 10 && (
          <View style={styles.staleProfileWarning}>
            <Ionicons name="alert-circle" size={20} color="#856404" />
            <Text style={styles.staleProfileText}>
              Note: Profile shows {voiceProfile.trainingSampleCount} samples from previous training.
              If training fails, your messages may have been deleted or you're using a different
              environment.
            </Text>
          </View>
        )}

        {/* Train Now Button */}
        <TouchableOpacity
          style={[
            styles.trainButton,
            (isTraining ||
              !settings.enabled ||
              loadingProfile ||
              (voiceProfile && voiceProfile.trainingSampleCount < 10)) &&
              styles.trainButtonDisabled,
          ]}
          onPress={handleTrainProfile}
          disabled={
            isTraining ||
            !settings.enabled ||
            loadingProfile ||
            (voiceProfile && voiceProfile.trainingSampleCount < 10)
          }
          testID="train-button"
        >
          {isTraining ? (
            <View style={styles.trainButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.trainButtonText}>Training...</Text>
            </View>
          ) : loadingProfile ? (
            <View style={styles.trainButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.trainButtonText}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.trainButtonContent}>
              <Ionicons name="flash" size={20} color="#FFFFFF" />
              <Text style={styles.trainButtonText}>
                {voiceProfile && voiceProfile.trainingSampleCount < 10
                  ? 'Insufficient Messages'
                  : 'Train Voice Profile Now'}
              </Text>
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
  messageCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#FFC107',
    gap: 8,
  },
  messageCountText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
    textAlign: 'center',
  },
  staleProfileWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E7F3FF',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
    gap: 8,
  },
  staleProfileText: {
    flex: 1,
    fontSize: 13,
    color: '#1565C0',
    lineHeight: 18,
  },
});
