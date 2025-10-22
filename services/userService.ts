/**
 * User profile service for managing user data in Firestore
 * @remarks
 * This service handles all user profile CRUD operations and username uniqueness checks.
 * Never access Firestore directly from components - always use this service layer.
 */

import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  DocumentSnapshot,
  FirestoreError,
  collection,
  query,
  getDocs,
  limit,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import {
  User,
  UserProfileFormData,
  UsernameDocument,
  validateUsername,
  validateDisplayName,
} from '@/types/user';

/**
 * Checks if a username is available for registration
 * @param username - The username to check (will be converted to lowercase)
 * @returns Promise resolving to true if available, false if taken
 * @throws {FirestoreError} When Firestore operation fails
 * @example
 * ```typescript
 * const available = await checkUsernameAvailability('johndoe');
 * if (!available) {
 *   console.log('Username is already taken');
 * }
 * ```
 */
export async function checkUsernameAvailability(username: string): Promise<boolean> {
  try {
    const db = getFirebaseDb();
    const normalizedUsername = username.toLowerCase();

    const usernameDoc = await getDoc(doc(db, 'usernames', normalizedUsername));
    return !usernameDoc.exists();
  } catch (error) {
    console.error('Error checking username availability:', error);
    throw new Error('Failed to check username availability. Please try again.');
  }
}

/**
 * Creates a new user profile in Firestore with username uniqueness enforcement
 * @param uid - Firebase Auth user ID
 * @param email - User's email from Firebase Auth
 * @param profileData - Profile form data (username, displayName, photoURL)
 * @returns Promise resolving to the created user profile
 * @throws {Error} When username is invalid, already taken, or Firestore write fails
 * @example
 * ```typescript
 * const profile = await createUserProfile('uid123', 'john@example.com', {
 *   username: 'johndoe',
 *   displayName: 'John Doe',
 *   photoUri: 'https://...'
 * });
 * ```
 */
export async function createUserProfile(
  uid: string,
  email: string,
  profileData: UserProfileFormData
): Promise<User> {
  const { username, displayName, photoUri } = profileData;

  // Validate username format
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.isValid) {
    throw new Error(usernameValidation.error);
  }

  // Validate display name
  const displayNameValidation = validateDisplayName(displayName);
  if (!displayNameValidation.isValid) {
    throw new Error(displayNameValidation.error);
  }

  const db = getFirebaseDb();
  const normalizedUsername = username.toLowerCase();

  try {
    // Use transaction to atomically create both user profile and username claim
    const userProfile = await runTransaction(db, async (transaction) => {
      const usernameDocRef = doc(db, 'usernames', normalizedUsername);
      const userDocRef = doc(db, 'users', uid);

      // Check if username is already taken
      const usernameDoc = await transaction.get(usernameDocRef);
      if (usernameDoc.exists()) {
        throw new Error('Username is already taken. Please choose another.');
      }

      // Check if user profile already exists
      const userDoc = await transaction.get(userDocRef);
      if (userDoc.exists()) {
        throw new Error('User profile already exists.');
      }

      // Create user profile document
      // Note: Only include photoURL if it has a value (Firestore doesn't accept undefined)
      const newUser: Omit<User, 'createdAt' | 'updatedAt'> & { photoURL?: string } = {
        uid,
        email,
        username: normalizedUsername,
        displayName: displayName.trim(),
        ...(photoUri && { photoURL: photoUri }),
        presence: {
          status: 'offline',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          lastSeen: serverTimestamp() as any,
        },
        settings: {
          sendReadReceipts: true,
          notificationsEnabled: true,
        },
      };

      // Set user document with server timestamps
      transaction.set(userDocRef, {
        ...newUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create username claim document
      const usernameData: UsernameDocument = { uid };
      transaction.set(usernameDocRef, usernameData);

      // Return user profile (timestamps will be set by server)
      return {
        ...newUser,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: serverTimestamp() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: serverTimestamp() as any,
      } as User;
    });

    return userProfile;
  } catch (error) {
    console.error('Error creating user profile:', error);

    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }

    // Handle Firestore errors
    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. Please ensure you are logged in.');
    }

    throw new Error('Failed to create user profile. Please try again.');
  }
}

/**
 * Fetches a user profile from Firestore
 * @param uid - Firebase Auth user ID
 * @returns Promise resolving to user profile or null if not found
 * @throws {FirestoreError} When Firestore operation fails
 * @example
 * ```typescript
 * const profile = await getUserProfile('uid123');
 * if (profile) {
 *   console.log(profile.displayName);
 * }
 * ```
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  try {
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', uid);
    const userDoc: DocumentSnapshot = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as User;
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile. Please try again.');
  }
}

/**
 * Updates user profile fields in Firestore
 * @param uid - Firebase Auth user ID
 * @param updates - Partial user data to update (displayName, photoURL)
 * @returns Promise resolving when update is complete
 * @throws {Error} When validation fails or Firestore update fails
 * @remarks
 * Username cannot be updated after creation
 * This function only allows updating displayName and photoURL
 * @example
 * ```typescript
 * await updateUserProfile('uid123', {
 *   displayName: 'John Smith',
 *   photoURL: 'https://...'
 * });
 * ```
 */
export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string; photoURL?: string }
): Promise<void> {
  // Validate display name if provided
  if (updates.displayName !== undefined) {
    const validation = validateDisplayName(updates.displayName);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }
  }

  const db = getFirebaseDb();
  const userDocRef = doc(db, 'users', uid);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    if (updates.displayName !== undefined) {
      updateData.displayName = updates.displayName.trim();
    }

    if (updates.photoURL !== undefined) {
      updateData.photoURL = updates.photoURL;
    }

    await updateDoc(userDocRef, updateData);
  } catch (error) {
    console.error('Error updating user profile:', error);

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('User profile not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You can only update your own profile.');
    }

    throw new Error('Failed to update user profile. Please try again.');
  }
}

/**
 * Fetches a user profile by username
 * @param username - Username to look up
 * @returns Promise resolving to user profile or null if not found
 * @throws {FirestoreError} When Firestore operation fails
 * @example
 * ```typescript
 * const profile = await getUserByUsername('johndoe');
 * if (profile) {
 *   console.log(profile.displayName);
 * }
 * ```
 */
export async function getUserByUsername(username: string): Promise<User | null> {
  try {
    const db = getFirebaseDb();
    const normalizedUsername = username.toLowerCase();

    // First, get the UID from the username document
    const usernameDocRef = doc(db, 'usernames', normalizedUsername);
    const usernameDoc = await getDoc(usernameDocRef);

    if (!usernameDoc.exists()) {
      return null;
    }

    const usernameData = usernameDoc.data() as UsernameDocument;

    // Then fetch the user profile using the UID
    return await getUserProfile(usernameData.uid);
  } catch (error) {
    console.error('Error fetching user by username:', error);
    throw new Error('Failed to fetch user profile. Please try again.');
  }
}

/**
 * Searches for users by username or display name
 *
 * @param searchQuery - The search term entered by user
 * @returns Promise resolving to array of matching users
 * @throws {Error} When Firestore operation fails
 *
 * @remarks
 * IMPORTANT: Firestore does not support full-text search.
 * - Username search: Exact match via Firestore query (efficient)
 * - Display name search: Client-side filtering after fetching users (acceptable for MVP)
 * - For better search experience in Phase 2, consider Algolia or Elasticsearch integration
 *
 * Returns up to 20 matching users.
 *
 * @example
 * ```typescript
 * const users = await searchUsers('john');
 * users.forEach(user => {
 *   console.log(`${user.username} - ${user.displayName}`);
 * });
 * ```
 */
export async function searchUsers(searchQuery: string): Promise<User[]> {
  try {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return [];
    }

    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');
    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Strategy 1: Try exact username match first
    const user = await getUserByUsername(normalizedQuery);
    if (user) {
      return [user];
    }

    // Strategy 2: Fetch recent users and filter client-side by display name
    // NOTE: This is a limitation of Firestore. For production-scale search,
    // consider integrating Algolia or Elasticsearch in Phase 2.
    const recentUsersQuery = query(
      usersRef,
      limit(100) // Limit to prevent excessive reads
    );

    const snapshot = await getDocs(recentUsersQuery);
    const users: User[] = [];

    snapshot.forEach((doc) => {
      const userData = doc.data() as User;

      // Filter by display name (case-insensitive partial match)
      if (
        userData.displayName.toLowerCase().includes(normalizedQuery) ||
        userData.username.toLowerCase().includes(normalizedQuery)
      ) {
        users.push(userData);
      }
    });

    // Limit results to 20
    return users.slice(0, 20);
  } catch (error) {
    console.error('Error searching users:', error);
    throw new Error('Failed to search users. Please try again.');
  }
}

/**
 * Gets all users for group chat selection
 * @returns Promise resolving to array of all users
 * @throws {Error} When Firestore operation fails
 * @example
 * ```typescript
 * const users = await getAllUsers();
 * console.log(`Found ${users.length} users`);
 * ```
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');

    // Get all users, ordered by display name
    const q = query(usersRef);
    const snapshot = await getDocs(q);

    const users: User[] = [];
    snapshot.forEach((doc) => {
      users.push(doc.data() as User);
    });

    // Sort by display name
    users.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return users;
  } catch (error) {
    console.error('Error fetching all users:', error);
    throw new Error('Failed to fetch users. Please try again.');
  }
}
