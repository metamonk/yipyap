/**
 * Firebase Storage service for managing file uploads
 * @remarks
 * This service handles profile photo uploads to Firebase Storage.
 * Never access Firebase Storage directly from components - always use this service layer.
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, StorageError } from 'firebase/storage';
import { getFirebaseStorage } from './firebase';

/**
 * Uploads a profile photo to Firebase Storage
 * @param userId - Firebase Auth user ID (used in storage path)
 * @param imageUri - Local file URI from image picker
 * @returns Promise resolving to the public download URL
 * @throws {Error} When upload fails or image URI is invalid
 * @example
 * ```typescript
 * const photoURL = await uploadProfilePhoto('uid123', 'file:///path/to/image.jpg');
 * console.log('Photo uploaded:', photoURL);
 * ```
 */
export async function uploadProfilePhoto(userId: string, imageUri: string): Promise<string> {
  if (!imageUri) {
    throw new Error('Image URI is required');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const storage = getFirebaseStorage();

    // Convert image URI to blob
    const response = await globalThis.fetch(imageUri);
    if (!response.ok) {
      throw new Error('Failed to fetch image from local URI');
    }

    const blob = await response.blob();

    // Create storage reference with user-specific path
    const storageRef = ref(storage, `users/${userId}/profile.jpg`);

    // Upload the blob to Firebase Storage
    await uploadBytes(storageRef, blob);

    // Get the public download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
  } catch (error) {
    console.error('Error uploading profile photo:', error);

    // Handle specific Storage errors
    const storageError = error as StorageError;
    if (storageError.code === 'storage/unauthorized') {
      throw new Error('Permission denied. You can only upload your own profile photo.');
    }

    if (storageError.code === 'storage/canceled') {
      throw new Error('Upload was canceled.');
    }

    if (storageError.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please contact support.');
    }

    throw new Error('Failed to upload profile photo. Please check your connection and try again.');
  }
}

/**
 * Deletes a user's profile photo from Firebase Storage
 * @param userId - Firebase Auth user ID
 * @returns Promise resolving when deletion is complete
 * @throws {Error} When deletion fails
 * @remarks
 * This is a utility function for future use (e.g., removing profile photo)
 * @example
 * ```typescript
 * await deleteProfilePhoto('uid123');
 * ```
 */
export async function deleteProfilePhoto(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, `users/${userId}/profile.jpg`);

    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting profile photo:', error);

    const storageError = error as StorageError;

    // Ignore 'not-found' errors (photo doesn't exist)
    if (storageError.code === 'storage/object-not-found') {
      return;
    }

    if (storageError.code === 'storage/unauthorized') {
      throw new Error('Permission denied. You can only delete your own profile photo.');
    }

    throw new Error('Failed to delete profile photo. Please try again.');
  }
}

/**
 * Gets the download URL for a user's profile photo
 * @param userId - Firebase Auth user ID
 * @returns Promise resolving to the download URL or null if photo doesn't exist
 * @throws {Error} When fetching URL fails (except for not-found)
 * @example
 * ```typescript
 * const photoURL = await getProfilePhotoURL('uid123');
 * if (photoURL) {
 *   console.log('Photo URL:', photoURL);
 * }
 * ```
 */
export async function getProfilePhotoURL(userId: string): Promise<string | null> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, `users/${userId}/profile.jpg`);

    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error) {
    const storageError = error as StorageError;

    // Return null if photo doesn't exist
    if (storageError.code === 'storage/object-not-found') {
      return null;
    }

    console.error('Error getting profile photo URL:', error);
    throw new Error('Failed to get profile photo URL. Please try again.');
  }
}
