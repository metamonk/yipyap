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
import { useAuth } from '@/hooks/useAuth';
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Set up your username and profile information</Text>

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
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>+</Text>
                  <Text style={styles.photoLabel}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity
                style={styles.changePhotoButton}
                onPress={handlePickImage}
                disabled={isSubmitting}
              >
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Username <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={[
                  styles.input,
                  usernameError && styles.inputError,
                  isUsernameAvailable && styles.inputSuccess,
                ]}
                placeholder="Enter username"
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase())}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting}
                maxLength={20}
              />
              {isCheckingUsername && (
                <ActivityIndicator size="small" color="#007AFF" style={styles.inputIcon} />
              )}
              {!isCheckingUsername && isUsernameAvailable && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.hint}>
              3-20 characters, lowercase letters, numbers, and underscores
            </Text>
            {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
          </View>

          {/* Display Name Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Display Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, displayNameError && styles.inputError]}
              placeholder="Enter display name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              editable={!isSubmitting}
              maxLength={50}
            />
            {displayNameError && <Text style={styles.errorText}>{displayNameError}</Text>}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>Complete Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
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
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  photoPlaceholderText: {
    fontSize: 48,
    color: '#CCCCCC',
    marginBottom: 8,
  },
  photoLabel: {
    fontSize: 14,
    color: '#999999',
  },
  changePhotoButton: {
    marginTop: 12,
  },
  changePhotoText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputSuccess: {
    borderColor: '#34C759',
  },
  inputIcon: {
    position: 'absolute',
    right: 16,
    top: 12,
  },
  checkmark: {
    position: 'absolute',
    right: 16,
    top: 10,
    fontSize: 24,
    color: '#34C759',
  },
  hint: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: 4,
  },
  submitButton: {
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
