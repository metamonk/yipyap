/**
 * Capacity Settings Screen (Stories 6.3 + 6.5)
 * @remarks
 * Allows creators to set their daily response capacity (5-20 messages)
 * and customize advanced settings like boundary messages and toggles
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getCapacitySettings,
  updateCapacitySettings,
  updateAdvancedCapacitySettings,
  getUserProfile,
} from '@/services/userService';
import {
  suggestCapacity,
  getAverageDailyMessages,
  previewDistribution,
  calculateTimeCommitment,
  MessageDistribution,
} from '@/services/capacityService';
import {
  DEFAULT_CAPACITY,
  MIN_CAPACITY,
  MAX_CAPACITY,
  DEFAULT_BOUNDARY_MESSAGE,
  MAX_BOUNDARY_MESSAGE_LENGTH,
  validateBoundaryMessage,
  renderBoundaryTemplate,
} from '@/types/user';

/**
 * Capacity Settings Screen Component
 * @component
 */
export default function CapacitySettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [capacity, setCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [suggestedCapacity, setSuggestedCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [avgDailyMessages, setAvgDailyMessages] = useState<number>(0);
  const [distribution, setDistribution] = useState<MessageDistribution>({
    deep: DEFAULT_CAPACITY,
    faq: 0,
    archived: 0,
  });

  // Story 6.5: Advanced settings state
  const [boundaryMessage, setBoundaryMessage] = useState<string>(DEFAULT_BOUNDARY_MESSAGE);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState<boolean>(true);
  const [requireEditingForBusiness, setRequireEditingForBusiness] = useState<boolean>(true);
  const [weeklyReportsEnabled, setWeeklyReportsEnabled] = useState<boolean>(false);
  const [previewMessage, setPreviewMessage] = useState<string>('');
  const [creatorName, setCreatorName] = useState<string>('');
  const [faqUrl] = useState<string>(''); // TODO: Load from user settings when links feature is implemented
  const [communityUrl] = useState<string>(''); // TODO: Load from user settings when links feature is implemented

  const boundaryInputRef = useRef<TextInput>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Story 6.5: Update preview when boundary message or user data changes
  useEffect(() => {
    const rendered = renderBoundaryTemplate(boundaryMessage, {
      creatorName,
      faqUrl,
      communityUrl,
    });
    setPreviewMessage(rendered);
  }, [boundaryMessage, creatorName, faqUrl, communityUrl]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser) {
        return;
      }

      try {
        // Load current capacity settings
        const settings = await getCapacitySettings(currentUser.uid);
        const currentCapacity = settings?.dailyLimit ?? DEFAULT_CAPACITY;
        setCapacity(currentCapacity);

        // Story 6.5: Load advanced settings
        if (settings) {
          setBoundaryMessage(settings.boundaryMessage || DEFAULT_BOUNDARY_MESSAGE);
          setAutoArchiveEnabled(settings.autoArchiveEnabled ?? true);
          setRequireEditingForBusiness(settings.requireEditingForBusiness ?? true);
          setWeeklyReportsEnabled(settings.weeklyReportsEnabled ?? false);
        }

        // Load user profile for template variables
        const userProfile = await getUserProfile(currentUser.uid);
        if (userProfile) {
          setCreatorName(userProfile.displayName || '');
          // Note: links would come from settings.links if implemented
        }

        // Fetch average daily messages
        const avgMessages = await getAverageDailyMessages(currentUser.uid);
        setAvgDailyMessages(avgMessages);

        // Calculate suggested capacity
        const suggested = suggestCapacity(avgMessages);
        setSuggestedCapacity(suggested);

        // Calculate distribution preview
        const dist = previewDistribution(currentCapacity, avgMessages);
        setDistribution(dist);
      } catch (error) {
        console.error('Error loading capacity settings:', error);
        Alert.alert('Error', 'Failed to load capacity settings. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, [currentUser]);

  /**
   * Handles capacity slider changes with debounced save
   * @param newCapacity - The new capacity value
   */
  const handleCapacityChange = async (newCapacity: number) => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Round to nearest integer
    const roundedCapacity = Math.round(newCapacity);

    // Optimistic update
    const previousCapacity = capacity;
    setCapacity(roundedCapacity);

    // Update distribution preview immediately
    const newDistribution = previewDistribution(roundedCapacity, avgDailyMessages);
    setDistribution(newDistribution);

    // Save to Firestore
    setIsSaving(true);
    try {
      await updateCapacitySettings(currentUser.uid, roundedCapacity);
    } catch (error) {
      console.error('Error updating capacity settings:', error);
      // Revert on error
      setCapacity(previousCapacity);
      const revertedDistribution = previewDistribution(previousCapacity, avgDailyMessages);
      setDistribution(revertedDistribution);
      Alert.alert('Error', 'Failed to update capacity settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Story 6.5: Handles saving advanced capacity settings
   */
  const handleSaveAdvancedSettings = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to change settings.');
      return;
    }

    // Validate boundary message
    const validation = validateBoundaryMessage(boundaryMessage);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.error);
      return;
    }

    setIsSaving(true);
    try {
      await updateAdvancedCapacitySettings(currentUser.uid, {
        boundaryMessage,
        autoArchiveEnabled,
        requireEditingForBusiness,
        weeklyReportsEnabled,
      });
      Alert.alert('Success', 'Advanced settings saved successfully.');
    } catch (error) {
      console.error('Error saving advanced settings:', error);
      Alert.alert('Error', 'Failed to save advanced settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Story 6.5: Inserts a template variable at cursor position
   */
  const insertVariable = (variable: string) => {
    const input = boundaryInputRef.current;
    if (!input) {
      // Fallback: append to end
      setBoundaryMessage(boundaryMessage + variable);
      return;
    }

    // For React Native TextInput, we'll just append for simplicity
    // (cursor position handling is complex in RN)
    setBoundaryMessage(boundaryMessage + ' ' + variable);
  };

  /**
   * Story 6.5: Resets boundary message to default
   */
  const handleResetBoundaryMessage = () => {
    Alert.alert(
      'Reset to Default',
      'Are you sure you want to reset your boundary message to the default template?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => setBoundaryMessage(DEFAULT_BOUNDARY_MESSAGE),
        },
      ]
    );
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
      fontWeight: theme.typography.fontWeight.bold as any,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
      lineHeight: 24,
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
    sliderContainer: {
      paddingVertical: 20,
      paddingHorizontal: 10,
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.sm,
      ...theme.shadows.sm,
    },
    capacityValue: {
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.accent,
      textAlign: 'center',
      marginTop: theme.spacing.sm,
    },
    rangeLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      fontWeight: theme.typography.fontWeight.medium,
    },
    sectionTitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    infoItem: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    helpText: {
      flex: 1,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    savingText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    label: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    templateInput: {
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textPrimary,
      backgroundColor: theme.colors.surface,
      minHeight: 120,
      textAlignVertical: 'top',
    },
    charCount: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      marginTop: theme.spacing.sm,
    },
    resetButtonText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.error,
      textAlign: 'center',
    },
    previewBox: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.base,
    },
    previewText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.base,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    toggleLabel: {
      fontSize: 15,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    toggleDescription: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      paddingVertical: 14,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.borderRadius.md,
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    saveButtonText: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: '#FFFFFF',
    },
    suggestionBox: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    suggestionText: {
      color: theme.colors.textPrimary,
    },
    suggestionHint: {
      color: theme.colors.textSecondary,
    },
    divider: {
      backgroundColor: theme.colors.borderLight,
    },
    variableButton: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
    },
    variableButtonText: {
      color: theme.colors.accent,
    },
  });

  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  const timeCommitment = calculateTimeCommitment(capacity);

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Daily Capacity"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => router.back(),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={dynamicStyles.title}>Daily Capacity</Text>
          <Text style={dynamicStyles.subtitle}>
            How many messages can you meaningfully respond to each day?
          </Text>
        </View>

        {/* Capacity Slider */}
        <Text style={dynamicStyles.sectionHeader}>CAPACITY SETTINGS</Text>
        <View style={styles.sliderSection}>
          <View style={dynamicStyles.sliderContainer}>
            <Slider
              style={styles.slider}
              value={capacity}
              onValueChange={setCapacity}
              onSlidingComplete={handleCapacityChange}
              minimumValue={MIN_CAPACITY}
              maximumValue={MAX_CAPACITY}
              step={1}
              minimumTrackTintColor={theme.colors.accent}
              maximumTrackTintColor={theme.colors.borderLight}
              thumbTintColor={theme.colors.accent}
            />
            <Text style={dynamicStyles.capacityValue}>
              {capacity} meaningful responses/day
            </Text>
          </View>

          {/* Range Labels */}
          <View style={styles.rangeLabels}>
            <Text style={dynamicStyles.rangeLabel}>{MIN_CAPACITY}</Text>
            <Text style={dynamicStyles.rangeLabel}>{MAX_CAPACITY}</Text>
          </View>
        </View>

        {/* Suggested Capacity */}
        {avgDailyMessages > 0 && (
          <View style={[styles.suggestionBox, dynamicStyles.suggestionBox]}>
            <Text style={[styles.suggestionText, dynamicStyles.suggestionText]}>
              Based on your message volume ({avgDailyMessages}/day), we recommend {suggestedCapacity}.
            </Text>
            <Text style={[styles.suggestionHint, dynamicStyles.suggestionHint]}>
              Most creators choose 8-12 for sustainable engagement.
            </Text>
          </View>
        )}

        {/* Time Commitment */}
        <View style={styles.infoSection}>
          <Text style={dynamicStyles.sectionTitle}>Your commitment:</Text>
          <View style={styles.infoList}>
            <Text style={dynamicStyles.infoItem}>
              • Deep engagement: ~{capacity} people/day ({timeCommitment} min)
            </Text>
            <Text style={dynamicStyles.infoItem}>
              • FAQ auto-responses: Unlimited
            </Text>
            <Text style={dynamicStyles.infoItem}>
              • Kind boundary messages: Remaining messages
            </Text>
          </View>
        </View>

        {/* Distribution Preview */}
        {avgDailyMessages > 0 && (
          <View style={styles.infoSection}>
            <Text style={dynamicStyles.sectionTitle}>Message distribution:</Text>
            <View style={styles.infoList}>
              <Text style={dynamicStyles.infoItem}>
                • {distribution.deep} deep conversations (personalized responses)
              </Text>
              <Text style={dynamicStyles.infoItem}>
                • {distribution.faq} FAQ auto-responses
              </Text>
              <Text style={dynamicStyles.infoItem}>
                • {distribution.archived} kindly archived with boundary message
              </Text>
            </View>
          </View>
        )}

        {/* Story 6.5: Divider */}
        <View style={[styles.divider, dynamicStyles.divider]} />

        {/* Story 6.5: Advanced Settings Title */}
        <View style={styles.header}>
          <Text style={dynamicStyles.sectionTitle}>Advanced Settings</Text>
          <Text style={dynamicStyles.subtitle}>
            Customize boundary messages and automation preferences
          </Text>
        </View>

        {/* Story 6.5: Boundary Message Editor */}
        <Text style={dynamicStyles.sectionHeader}>BOUNDARY MESSAGE</Text>
        <View style={styles.boundaryEditor}>
          <Text style={dynamicStyles.label}>Boundary Message Template</Text>
          <TextInput
            ref={boundaryInputRef}
            value={boundaryMessage}
            onChangeText={setBoundaryMessage}
            multiline
            numberOfLines={8}
            maxLength={MAX_BOUNDARY_MESSAGE_LENGTH}
            style={dynamicStyles.templateInput}
            placeholder="Write your custom boundary message..."
            placeholderTextColor={theme.colors.textTertiary}
          />

          {/* Variable Insertion Buttons */}
          <View style={styles.variableButtons}>
            <TouchableOpacity
              onPress={() => insertVariable('{{creatorName}}')}
              style={[styles.variableButton, dynamicStyles.variableButton]}
            >
              <Text style={[styles.variableButtonText, dynamicStyles.variableButtonText]}>+ Your Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => insertVariable('{{faqUrl}}')}
              style={[styles.variableButton, dynamicStyles.variableButton]}
            >
              <Text style={[styles.variableButtonText, dynamicStyles.variableButtonText]}>+ FAQ Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => insertVariable('{{communityUrl}}')}
              style={[styles.variableButton, dynamicStyles.variableButton]}
            >
              <Text style={[styles.variableButtonText, dynamicStyles.variableButtonText]}>+ Community</Text>
            </TouchableOpacity>
          </View>

          <Text style={dynamicStyles.charCount}>
            {boundaryMessage.length} / {MAX_BOUNDARY_MESSAGE_LENGTH} characters
          </Text>

          <TouchableOpacity onPress={handleResetBoundaryMessage} style={styles.resetButton}>
            <Text style={dynamicStyles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

        {/* Story 6.5: Preview Section */}
        <Text style={dynamicStyles.sectionHeader}>MESSAGE PREVIEW</Text>
        <View style={styles.previewSection}>
          <Text style={dynamicStyles.label}>Preview (How fans will see it)</Text>
          <View style={dynamicStyles.previewBox}>
            <Text style={dynamicStyles.previewText}>{previewMessage}</Text>
          </View>
        </View>

        {/* Story 6.5: Advanced Toggles */}
        <Text style={dynamicStyles.sectionHeader}>AUTOMATION PREFERENCES</Text>
        <View style={styles.togglesSection}>
          <View style={dynamicStyles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={dynamicStyles.toggleLabel}>Auto-Archive Low Priority</Text>
              <Text style={dynamicStyles.toggleDescription}>
                Automatically send boundary messages to messages beyond your daily capacity
              </Text>
            </View>
            <Switch
              value={autoArchiveEnabled}
              onValueChange={setAutoArchiveEnabled}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>

          <View style={dynamicStyles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={dynamicStyles.toggleLabel}>Require Editing for Business</Text>
              <Text style={dynamicStyles.toggleDescription}>
                Block sending AI drafts without personalization for business inquiries
              </Text>
            </View>
            <Switch
              value={requireEditingForBusiness}
              onValueChange={setRequireEditingForBusiness}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>

          <View style={dynamicStyles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={dynamicStyles.toggleLabel}>Weekly Capacity Reports</Text>
              <Text style={dynamicStyles.toggleDescription}>
                Receive weekly summaries and suggested capacity adjustments
              </Text>
            </View>
            <Switch
              value={weeklyReportsEnabled}
              onValueChange={setWeeklyReportsEnabled}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>
        </View>

        {/* Story 6.5: Save Button */}
        <TouchableOpacity
          onPress={handleSaveAdvancedSettings}
          style={dynamicStyles.saveButton}
          disabled={isSaving}
        >
          <Text style={dynamicStyles.saveButtonText}>Save Advanced Settings</Text>
        </TouchableOpacity>

        {/* Help Text */}
        <View style={styles.helpBox}>
          <Text style={styles.helpIcon}>💡</Text>
          <Text style={dynamicStyles.helpText}>
            Your capacity helps us prioritize the most important messages.
            You can adjust this anytime based on your availability.
          </Text>
        </View>

        {/* Saving Indicator */}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  sliderSection: {
    marginBottom: 24,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  rangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  suggestionBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  suggestionHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  helpBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  helpIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  divider: {
    height: 1,
    marginVertical: 32,
  },
  boundaryEditor: {
    marginBottom: 24,
  },
  variableButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  variableButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  variableButtonText: {
    fontSize: 13,
  },
  resetButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  previewSection: {
    marginBottom: 24,
  },
  togglesSection: {
    marginBottom: 24,
    gap: 16,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
});
