/**
 * Profile Edit Screen
 * @remarks
 * Allows users to edit their display name and profile photo.
 * Username is read-only after initial setup.
 * Implements optimistic UI updates for better user experience.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebaseAuth } from '@/services/firebase';
import { getUserProfile, updateUserProfile } from '@/services/userService';
import { uploadProfilePhoto } from '@/services/storageService';
import { User, validateDisplayName } from '@/types/user';
import { useUserStore } from '@/stores/userStore';

/**
 * Profile Edit Screen Component
 * @component
 */
export default function ProfileEditScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;
  const { updateCurrentUser } = useUserStore();

  // Profile state
  const [originalProfile, setOriginalProfile] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>();
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | undefined>();
  const [sendReadReceipts, setSendReadReceipts] = useState(true);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | undefined>();

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) {
        Alert.alert('Error', 'You must be logged in to edit your profile.');
        router.replace('/(auth)/login');
        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          setOriginalProfile(profile);
          setDisplayName(profile.displayName);
          setCurrentPhotoURL(profile.photoURL);
          setSendReadReceipts(profile.settings?.sendReadReceipts ?? true);
        } else {
          Alert.alert('Error', 'Profile not found.');
          router.replace('/(tabs)/profile');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
        Alert.alert('Error', 'Failed to load profile. Please try again.');
        router.replace('/(tabs)/profile');
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [currentUser, router]);

  /**
   * Handles profile photo selection from device gallery
   */
  const handlePickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant photo library access to upload a profile picture.'
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5, // Compress to reduce upload size
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  /**
   * Handles profile save with optimistic updates
   */
  const handleSave = async () => {
    if (!currentUser || !originalProfile) {
      return;
    }

    // Validate display name
    const validation = validateDisplayName(displayName);
    if (!validation.isValid) {
      setDisplayNameError(validation.error);
      return;
    }

    setDisplayNameError(undefined);
    setIsSaving(true);

    // Optimistic update - show changes immediately
    const optimisticDisplayName = displayName.trim();

    try {
      let newPhotoURL = currentPhotoURL;

      // Upload new photo if selected
      if (photoUri) {
        try {
          newPhotoURL = await uploadProfilePhoto(currentUser.uid, photoUri);
          setCurrentPhotoURL(newPhotoURL);
          setPhotoUri(undefined); // Clear local URI after successful upload
        } catch (error) {
          console.error('Error uploading photo:', error);
          throw new Error('Failed to upload photo. Please try again.');
        }
      }

      // Update profile in Firestore
      const updates: {
        displayName?: string;
        photoURL?: string;
        settings?: { sendReadReceipts: boolean };
      } = {};

      if (optimisticDisplayName !== originalProfile.displayName) {
        updates.displayName = optimisticDisplayName;
      }

      if (newPhotoURL !== originalProfile.photoURL) {
        updates.photoURL = newPhotoURL;
      }

      // Update read receipts setting if changed
      if (sendReadReceipts !== (originalProfile.settings?.sendReadReceipts ?? true)) {
        updates.settings = { sendReadReceipts };
      }

      // Only update if there are changes
      if (Object.keys(updates).length > 0) {
        await updateUserProfile(currentUser.uid, updates);

        // Update original profile to reflect saved changes
        const updatedProfile = {
          ...originalProfile,
          ...updates,
          settings: {
            ...originalProfile.settings,
            ...updates.settings,
          },
        };
        setOriginalProfile(updatedProfile);

        // Update the user store so other screens see the changes immediately
        // Merge settings properly to avoid type errors
        const storeUpdates: Partial<User> = {};
        if (updates.displayName) storeUpdates.displayName = updates.displayName;
        if (updates.photoURL !== undefined) storeUpdates.photoURL = updates.photoURL;
        if (updates.settings) {
          storeUpdates.settings = {
            ...originalProfile.settings,
            ...updates.settings,
          };
        }
        updateCurrentUser(storeUpdates);
      }

      // Show success message
      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving profile:', error);

      // Revert optimistic changes on error
      setDisplayName(originalProfile.displayName);
      setCurrentPhotoURL(originalProfile.photoURL);
      setPhotoUri(undefined);
      setSendReadReceipts(originalProfile.settings?.sendReadReceipts ?? true);

      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges =
    displayName.trim() !== originalProfile?.displayName ||
    photoUri !== undefined ||
    sendReadReceipts !== (originalProfile?.settings?.sendReadReceipts ?? true);

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
    photoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    required: {
      color: theme.colors.error,
    },
    input: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.base,
      fontSize: theme.typography.fontSize.base,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    readOnlyInput: {
      height: 48,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.base,
      justifyContent: 'center',
      backgroundColor: theme.colors.backgroundSecondary,
    },
    readOnlyText: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
    },
    hint: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: 4,
    },
    errorText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.error,
      marginTop: 4,
    },
    settingsSection: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing['2xl'],
      marginTop: theme.spacing.xl,
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderLight,
    },
    sectionHeader: {
      fontSize: 18,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.base,
    },
    settingLabel: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    settingHint: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
  });

  if (isLoading) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  if (!originalProfile) {
    return (
      <View style={dynamicStyles.centerContainer}>
        <Text style={dynamicStyles.errorText}>Profile not found</Text>
      </View>
    );
  }

  const displayPhotoUri = photoUri || currentPhotoURL;

  return (
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Edit Profile"
        variant="modal"
        leftAction={{
          label: 'Cancel',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/profile');
            }
          },
          disabled: isSaving,
        }}
        rightAction={{
          label: isSaving ? 'Saving...' : 'Save',
          onPress: handleSave,
          disabled: !hasChanges || isSaving,
        }}
      />
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Profile Photo */}
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoButton}
                onPress={handlePickImage}
                disabled={isSaving}
              >
                {displayPhotoUri ? (
                  <Image source={{ uri: displayPhotoUri }} style={styles.photoImage} />
                ) : (
                  <View style={dynamicStyles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>
                      {originalProfile.displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoOverlayText}>Change Photo</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Username (Read-Only) */}
            <View style={styles.inputGroup}>
              <Text style={dynamicStyles.label}>Username</Text>
              <View style={dynamicStyles.readOnlyInput}>
                <Text style={dynamicStyles.readOnlyText}>@{originalProfile.username}</Text>
              </View>
              <Text style={dynamicStyles.hint}>Username cannot be changed</Text>
            </View>

            {/* Display Name Input */}
            <View style={styles.inputGroup}>
              <Text style={dynamicStyles.label}>
                Display Name <Text style={dynamicStyles.required}>*</Text>
              </Text>
              <TextInput
                style={[dynamicStyles.input, displayNameError && dynamicStyles.inputError]}
                placeholder="Enter display name"
                placeholderTextColor={theme.colors.textTertiary}
                value={displayName}
                onChangeText={(text) => {
                  setDisplayName(text);
                  setDisplayNameError(undefined);
                }}
                autoCapitalize="words"
                editable={!isSaving}
                maxLength={50}
              />
              {displayNameError && <Text style={dynamicStyles.errorText}>{displayNameError}</Text>}
            </View>

            {/* Email (Read-Only) */}
            <View style={styles.inputGroup}>
              <Text style={dynamicStyles.label}>Email</Text>
              <View style={dynamicStyles.readOnlyInput}>
                <Text style={dynamicStyles.readOnlyText}>{originalProfile.email}</Text>
              </View>
            </View>

            {/* Privacy Settings Section */}
            <View style={dynamicStyles.settingsSection}>
              <Text style={dynamicStyles.sectionHeader}>Privacy</Text>

              {/* Read Receipts Toggle */}
              <View style={styles.settingRow}>
                <View style={styles.settingTextContainer}>
                  <Text style={dynamicStyles.settingLabel}>Send Read Receipts</Text>
                  <Text style={dynamicStyles.settingHint}>
                    When disabled, others won't see when you've read their messages
                  </Text>
                </View>
                <Switch
                  value={sendReadReceipts}
                  onValueChange={setSendReadReceipts}
                  disabled={isSaving}
                  trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={theme.colors.borderLight}
                  testID="read-receipts-toggle"
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingTop: 20,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholderText: {
    fontSize: 48,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    alignItems: 'center',
  },
  photoOverlayText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputGroup: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
});
