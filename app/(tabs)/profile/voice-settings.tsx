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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
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

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 32,
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
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      ...theme.shadows.sm,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    settingRowWithBorder: {
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    settingLabel: {
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontWeight: '600',
      marginBottom: 4,
    },
    settingHint: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    infoCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accent,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    infoText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    warningCard: {
      backgroundColor: theme.colors.warningBackground || '#FFF3CD',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.warning || '#FFC107',
    },
    warningText: {
      fontSize: 14,
      color: theme.colors.warningText || '#856404',
      lineHeight: 20,
    },
    trainButton: {
      backgroundColor: theme.colors.accent,
      padding: 18,
      borderRadius: 12,
      marginBottom: 24,
      alignItems: 'center',
      ...theme.shadows.sm,
    },
    trainButtonDisabled: {
      backgroundColor: theme.colors.disabled || '#C7C7CC',
    },
    trainButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      marginLeft: 8,
    },
  });

  if (!userProfile) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Voice Settings"
        showBack={true}
        backAction={() => router.back()}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={dynamicStyles.title}>Voice Matching Settings</Text>
        <Text style={dynamicStyles.subtitle}>
          Customize how AI suggestions match your unique communication style
        </Text>

        {/* VOICE MATCHING SETTINGS CARD */}
        <Text style={dynamicStyles.sectionHeader}>VOICE MATCHING</Text>
        <View style={dynamicStyles.card}>
          {/* Enable Voice Matching */}
          <View style={[dynamicStyles.settingRow, dynamicStyles.settingRowWithBorder]}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Enable Voice Matching</Text>
              <Text style={dynamicStyles.settingHint}>
                Generate AI suggestions that match your style
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggleEnabled}
              disabled={isSaving}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
              testID="toggle-enabled"
            />
          </View>

          {/* Auto-Show Suggestions */}
          <View style={dynamicStyles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Auto-Show Suggestions</Text>
              <Text style={dynamicStyles.settingHint}>
                Automatically display suggestions for incoming messages
              </Text>
            </View>
            <Switch
              value={settings.autoShowSuggestions}
              onValueChange={handleToggleAutoShow}
              disabled={isSaving || !settings.enabled}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
              testID="toggle-auto-show"
            />
          </View>
        </View>

        {/* SUGGESTIONS SETTINGS CARD */}
        <Text style={dynamicStyles.sectionHeader}>SUGGESTIONS</Text>
        <View style={dynamicStyles.card}>
          {/* Suggestion Count */}
          <View style={[dynamicStyles.settingRow, dynamicStyles.settingRowWithBorder]}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Number of Suggestions</Text>
              <Text style={dynamicStyles.settingHint}>How many response options to generate</Text>
            </View>
          </View>
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

          {/* Retraining Schedule */}
          <View style={dynamicStyles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={dynamicStyles.settingLabel}>Retraining Schedule</Text>
              <Text style={dynamicStyles.settingHint}>How often to update your voice profile</Text>
            </View>
          </View>
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

        {/* TRAINING SECTION */}
        <Text style={dynamicStyles.sectionHeader}>TRAINING</Text>

        {/* Training Eligibility Status */}
        {!loadingProfile && voiceProfile && voiceProfile.trainingSampleCount < 10 && (
          <View style={dynamicStyles.warningCard}>
            <View style={styles.iconRow}>
              <Ionicons name="information-circle" size={20} color={theme.colors.warning || '#FF9500'} />
              <View style={styles.iconRowText}>
                <Text style={dynamicStyles.warningText}>
                  {voiceProfile.trainingSampleCount} / 10 messages - Send{' '}
                  {10 - voiceProfile.trainingSampleCount} more to enable training
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Stale Profile Warning */}
        {!loadingProfile && voiceProfile && voiceProfile.trainingSampleCount >= 10 && (
          <View style={dynamicStyles.infoCard}>
            <View style={styles.iconRow}>
              <Ionicons name="alert-circle" size={20} color={theme.colors.accent} />
              <View style={styles.iconRowText}>
                <Text style={dynamicStyles.infoText}>
                  Note: Profile shows {voiceProfile.trainingSampleCount} samples from previous training.
                  If training fails, your messages may have been deleted or you're using a different
                  environment.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Train Now Button */}
        <TouchableOpacity
          style={[
            dynamicStyles.trainButton,
            (isTraining ||
              !settings.enabled ||
              loadingProfile ||
              (voiceProfile && voiceProfile.trainingSampleCount < 10)) &&
              dynamicStyles.trainButtonDisabled,
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
              <Text style={dynamicStyles.trainButtonText}>Training...</Text>
            </View>
          ) : loadingProfile ? (
            <View style={styles.trainButtonContent}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={dynamicStyles.trainButtonText}>Loading...</Text>
            </View>
          ) : (
            <View style={styles.trainButtonContent}>
              <Ionicons name="flash" size={20} color="#FFFFFF" />
              <Text style={dynamicStyles.trainButtonText}>
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

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  pickerContainer: {
    marginTop: 12,
  },
  trainButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconRowText: {
    flex: 1,
  },
});
