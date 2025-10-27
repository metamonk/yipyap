/**
 * Username Setup Screen
 * @remarks
 * This screen appears after registration to collect username and optional profile info.
 * Username must be unique and follows validation rules (3-20 chars, alphanumeric + underscore).
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
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/Button';
import { getFirebaseAuth } from '@/services/firebase';
import { createUserProfile, checkUsernameAvailability } from '@/services/userService';
import { uploadProfilePhoto } from '@/services/storageService';
import { validateUsername, validateDisplayName, UserProfileFormData } from '@/types/user';

/**
 * Username Setup Screen Component
 * @component
 * @example
 * ```tsx
 * // Navigated to automatically after registration
 * <UsernameSetup />
 * ```
 */
export default function UsernameSetup() {
  const router = useRouter();
  const { theme } = useTheme();
  const { refreshProfile } = useAuth();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  // Form state
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [photoUri, setPhotoUri] = useState<string | undefined>();

  // Validation state
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [displayNameError, setDisplayNameError] = useState<string | undefined>();
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounced username availability check
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (username.length === 0) {
        setUsernameError(undefined);
        setIsUsernameAvailable(false);
        return;
      }

      // Validate format first
      const validation = validateUsername(username);
      if (!validation.isValid) {
        setUsernameError(validation.error);
        setIsUsernameAvailable(false);
        return;
      }

      // Check availability
      setIsCheckingUsername(true);
      setUsernameError(undefined);

      try {
        const available = await checkUsernameAvailability(username);
        if (available) {
          setIsUsernameAvailable(true);
          setUsernameError(undefined);
        } else {
          setIsUsernameAvailable(false);
          setUsernameError('Username is already taken');
        }
      } catch (error) {
        console.error('Error checking username:', error);
        setUsernameError('Failed to check username availability');
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delayDebounce);
  }, [username]);

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
   * Handles profile creation submission
   */
  const handleSubmit = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create a profile.');
      return;
    }

    // Validate all fields
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      setUsernameError(usernameValidation.error);
      return;
    }

    if (!isUsernameAvailable) {
      setUsernameError('Username is not available');
      return;
    }

    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.isValid) {
      setDisplayNameError(displayNameValidation.error);
      return;
    }

    setIsSubmitting(true);

    try {
      let photoURL: string | undefined;

      // Upload photo if provided
      if (photoUri) {
        try {
          photoURL = await uploadProfilePhoto(currentUser.uid, photoUri);
        } catch (error) {
          console.error('Error uploading photo:', error);
          // Continue without photo rather than failing completely
          Alert.alert(
            'Photo Upload Failed',
            'Your profile will be created without a photo. You can add one later.'
          );
        }
      }

      // Create user profile
      const profileData: UserProfileFormData = {
        username: username.toLowerCase(),
        displayName: displayName.trim(),
        photoUri: photoURL,
      };

      await createUserProfile(currentUser.uid, currentUser.email || '', profileData);

      // Refresh profile state to update hasProfile before navigation
      await refreshProfile();

      // Navigate to main app
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error creating profile:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create profile';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    username.length > 0 &&
    displayName.length > 0 &&
    isUsernameAvailable &&
    !isCheckingUsername &&
    !isSubmitting;

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      flex: 1,
      padding: theme.spacing.xl,
      paddingTop: 60,
    },
    title: {
      fontSize: 28,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xl,
    },
    photoPlaceholder: {
      width: '100%',
      height: '100%',
      backgroundColor: theme.colors.backgroundSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.colors.borderLight,
      borderStyle: 'dashed',
    },
    photoPlaceholderText: {
      fontSize: 48,
      color: theme.colors.textTertiary,
      marginBottom: theme.spacing.sm,
    },
    photoLabel: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    changePhotoText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.accent,
      fontWeight: theme.typography.fontWeight.semibold,
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
    inputSuccess: {
      borderColor: theme.colors.success || '#34C759',
    },
    checkmark: {
      position: 'absolute',
      right: 16,
      top: 10,
      fontSize: 24,
      color: theme.colors.success || '#34C759',
    },
    hint: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    errorText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.error,
      marginTop: theme.spacing.xs,
    },
  });

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.content}>
          {/* Icon for visual appeal - Robinhood style */}
          <View style={styles.iconContainer}>
            <Ionicons name="person-circle-outline" size={64} color={theme.colors.accent} />
          </View>

          <Text style={dynamicStyles.title}>Complete Your Profile</Text>
          <Text style={dynamicStyles.subtitle}>Set up your username and profile information</Text>

          {/* Profile Photo */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePickImage}
              disabled={isSubmitting}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <View style={dynamicStyles.photoPlaceholder}>
                  <Text style={dynamicStyles.photoPlaceholderText}>+</Text>
                  <Text style={dynamicStyles.photoLabel}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handlePickImage}
                disabled={isSubmitting}
              >
                <Text style={dynamicStyles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={dynamicStyles.label}>
              Username <Text style={dynamicStyles.required}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  dynamicStyles.input,
                  usernameError && dynamicStyles.inputError,
                  isUsernameAvailable && dynamicStyles.inputSuccess,
                ]}
                placeholder="Enter username"
                placeholderTextColor={theme.colors.textTertiary}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                maxLength={20}
              />
              {isCheckingUsername && (
                <ActivityIndicator size="small" color={theme.colors.accent} style={styles.inputIcon} />
              )}
              {!isCheckingUsername && isUsernameAvailable && (
                <Text style={dynamicStyles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={dynamicStyles.hint}>
              3-20 characters, lowercase letters, numbers, and underscores
            </Text>
            {usernameError && <Text style={dynamicStyles.errorText}>{usernameError}</Text>}
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
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!isSubmitting}
              maxLength={50}
            />
            {displayNameError && <Text style={dynamicStyles.errorText}>{displayNameError}</Text>}
          </View>

          {/* Submit Button - Using Button component */}
          <Button
            variant="primary"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            style={styles.submitButton}
          >
            Complete Profile
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  photoButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  changePhotoButton: {
    marginTop: 12,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  submitButton: {
    marginTop: 16,
  },
});
