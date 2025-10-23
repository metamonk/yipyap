/**
 * GroupPhotoUpload Component
 *
 * @remarks
 * Allows users to upload a group photo during group creation.
 * Features image selection, preview, compression, and removal.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface GroupPhotoUploadProps {
  /** Current photo URI (local or remote) */
  photoUri: string | null;
  /** Callback when photo is selected */
  onPhotoSelect: (uri: string) => void;
  /** Callback when photo is removed */
  onPhotoRemove: () => void;
  /** Whether the component is disabled */
  isDisabled?: boolean;
  /** Whether the upload is in progress */
  isUploading?: boolean;
  /** Test ID for testing */
  testID?: string;
}

/**
 * GroupPhotoUpload provides photo selection and preview for group conversations
 *
 * @component
 * @example
 * ```tsx
 * <GroupPhotoUpload
 *   photoUri={groupPhotoUri}
 *   onPhotoSelect={setGroupPhotoUri}
 *   onPhotoRemove={() => setGroupPhotoUri(null)}
 *   isDisabled={isCreating}
 * />
 * ```
 */
export const GroupPhotoUpload: React.FC<GroupPhotoUploadProps> = ({
  photoUri,
  onPhotoSelect,
  onPhotoRemove,
  isDisabled = false,
  isUploading = false,
  testID,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  /**
   * Request camera roll permissions and pick image
   */
  const handlePickImage = async () => {
    if (isDisabled || isProcessing || isUploading) return;

    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to select a group photo.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio for group photos
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setIsProcessing(true);

        try {
          // Compress image to 512x512 with 0.7 quality as per requirements
          const manipulatedImage = await ImageManipulator.manipulateAsync(
            result.assets[0].uri,
            [{ resize: { width: 512, height: 512 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );

          onPhotoSelect(manipulatedImage.uri);
        } catch (error) {
          console.error('Error processing image:', error);
          Alert.alert('Error', 'Failed to process the image. Please try again.', [{ text: 'OK' }]);
        } finally {
          setIsProcessing(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.', [{ text: 'OK' }]);
    }
  };

  /**
   * Handle removing the selected photo
   */
  const handleRemovePhoto = () => {
    if (isDisabled || isUploading) return;

    Alert.alert('Remove Photo', 'Are you sure you want to remove the group photo?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onPhotoRemove },
    ]);
  };

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.label}>GROUP PHOTO (OPTIONAL)</Text>

      <View style={styles.photoRow}>
        {photoUri ? (
          <>
            <View style={styles.photoContainer}>
              <Image source={{ uri: photoUri }} style={styles.photo} />
              {(isProcessing || isUploading) && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="#FFFFFF" />
                </View>
              )}
            </View>

            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.actionButton, isDisabled && styles.actionButtonDisabled]}
                onPress={handlePickImage}
                disabled={isDisabled || isProcessing || isUploading}
                testID={`${testID}-change`}
              >
                <Ionicons name="camera" size={20} color="#007AFF" />
                <Text style={styles.actionButtonText}>Change</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, isDisabled && styles.actionButtonDisabled]}
                onPress={handleRemovePhoto}
                disabled={isDisabled || isProcessing || isUploading}
                testID={`${testID}-remove`}
              >
                <Ionicons name="trash" size={20} color="#FF3B30" />
                <Text style={[styles.actionButtonText, styles.removeText]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, isDisabled && styles.uploadButtonDisabled]}
            onPress={handlePickImage}
            disabled={isDisabled || isProcessing}
            testID={`${testID}-upload`}
          >
            {isProcessing ? (
              <ActivityIndicator color="#8E8E93" />
            ) : (
              <>
                <Ionicons name="camera" size={32} color="#8E8E93" />
                <Text style={styles.uploadText}>Add Group Photo</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.helperText}>Add a photo to help members identify the group</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 12,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F2F2F7',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    gap: 6,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  removeText: {
    color: '#FF3B30',
  },
  uploadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    gap: 12,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
  },
});
