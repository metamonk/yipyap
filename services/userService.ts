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
  where,
  getDocs,
  limit,
  orderBy,
  startAfter,
  QueryDocumentSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from './firebase';
import {
  User,
  UserProfileFormData,
  UsernameDocument,
  validateUsername,
  validateDisplayName,
  NotificationPreferences,
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
      const newUser: Omit<User, 'createdAt' | 'updatedAt'> & {
        photoURL?: string;
        displayNameLower?: string;
      } = {
        uid,
        email,
        username: normalizedUsername,
        displayName: displayName.trim(),
        displayNameLower: displayName.trim().toLowerCase(), // Add for search optimization
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

    const userData = userDoc.data() as User;

    return userData;
  } catch (error) {
    console.error('[getUserProfile] Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile. Please try again.');
  }
}

/**
 * Fetches multiple user profiles by their UIDs
 * @param uids - Array of user IDs to fetch
 * @returns Promise resolving to array of user profiles (null for non-existent users)
 * @throws {Error} When Firestore query fails
 * @example
 * ```typescript
 * const profiles = await getUserProfiles(['uid1', 'uid2', 'uid3']);
 * ```
 */
export async function getUserProfiles(uids: string[]): Promise<User[]> {
  try {
    if (uids.length === 0) {
      return [];
    }

    const db = getFirebaseDb();
    const profiles: User[] = [];

    // Fetch all profiles in parallel for performance
    const promises = uids.map(async (uid) => {
      const userDocRef = doc(db, 'users', uid);
      const userDoc: DocumentSnapshot = await getDoc(userDocRef);

      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      // Return a placeholder for missing users
      return {
        uid: uid,
        username: `user_${uid}`,
        displayName: 'Unknown User',
        email: '',
        photoURL: undefined,
        presence: {
          status: 'offline' as const,
          lastSeen: Timestamp.now(),
        },
        settings: {
          sendReadReceipts: true,
          notificationsEnabled: true,
          notifications: {
            enabled: true,
            sound: true,
            showPreview: true,
            vibration: true,
            directMessages: true,
            groupMessages: true,
            systemMessages: false,
          },
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      } satisfies User;
    });

    const results = await Promise.all(promises);
    profiles.push(...results);

    return profiles;
  } catch (error) {
    console.error('[getUserProfiles] Error fetching user profiles:', error);
    throw new Error('Failed to fetch user profiles. Please try again.');
  }
}

/**
 * Updates user profile fields in Firestore
 * @param uid - Firebase Auth user ID
 * @param updates - Partial user data to update (displayName, photoURL, settings)
 * @returns Promise resolving when update is complete
 * @throws {Error} When validation fails or Firestore update fails
 * @remarks
 * Username cannot be updated after creation
 * This function allows updating displayName, photoURL, and settings
 * @example
 * ```typescript
 * await updateUserProfile('uid123', {
 *   displayName: 'John Smith',
 *   photoURL: 'https://...',
 *   settings: { sendReadReceipts: false }
 * });
 * ```
 */
export async function updateUserProfile(
  uid: string,
  updates: { displayName?: string; photoURL?: string; settings?: { sendReadReceipts: boolean } }
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
      updateData.displayNameLower = updates.displayName.trim().toLowerCase(); // Add for search optimization
    }

    if (updates.photoURL !== undefined) {
      updateData.photoURL = updates.photoURL;
    }

    if (updates.settings !== undefined) {
      updateData['settings.sendReadReceipts'] = updates.settings.sendReadReceipts;
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
 * Updates user settings with flexible dot notation support
 * @param uid - User ID
 * @param settings - Settings object with dot notation keys (e.g., {'voiceMatching.enabled': true})
 * @returns Promise that resolves when settings are updated
 * @throws {Error} If update fails
 * @example
 * ```typescript
 * await updateUserSettings('user123', {
 *   'voiceMatching.enabled': true,
 *   'voiceMatching.suggestionCount': 2
 * });
 * ```
 */
export async function updateUserSettings(
  uid: string,
  settings: Record<string, any>
): Promise<void> {
  const db = getFirebaseDb();
  const userDocRef = doc(db, 'users', uid);

  try {
    // Build update object with dot notation for nested fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      updatedAt: serverTimestamp(),
    };

    // Add each setting with dot notation
    Object.entries(settings).forEach(([key, value]) => {
      updateData[`settings.${key}`] = value;
    });

    await updateDoc(userDocRef, updateData);
  } catch (error) {
    console.error('Error updating user settings:', error);

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('User profile not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You can only update your own settings.');
    }

    throw new Error('Failed to update user settings. Please try again.');
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
    // Require at least 2 characters for search to prevent excessive queries
    if (!searchQuery || searchQuery.trim().length < 2) {
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

    // Strategy 2: Try prefix matching on username
    // This allows searching for users by typing the beginning of their username
    const endQuery = normalizedQuery + '\uf8ff'; // Unicode character after 'z'

    const usernameQuery = query(
      usersRef,
      where('username', '>=', normalizedQuery),
      where('username', '<=', endQuery),
      orderBy('username'),
      limit(20)
    );

    const usernameSnapshot = await getDocs(usernameQuery);
    const results: User[] = [];
    const seenUids = new Set<string>();

    usernameSnapshot.forEach((doc) => {
      const userData = doc.data() as User;
      results.push(userData);
      seenUids.add(userData.uid);
    });

    // Strategy 3: If we have less than 10 results, also try email search
    // This is more targeted than fetching all users
    if (results.length < 10 && normalizedQuery.includes('@')) {
      const emailQuery = query(usersRef, where('email', '==', normalizedQuery), limit(1));

      const emailSnapshot = await getDocs(emailQuery);

      emailSnapshot.forEach((doc) => {
        const userData = doc.data() as User;

        // Skip if we already have this user
        if (!seenUids.has(userData.uid)) {
          results.push(userData);
          seenUids.add(userData.uid);
        }
      });
    }

    // Return up to 20 results
    // Note: For browsing all users, use getPaginatedUsers() instead
    return results.slice(0, 20);
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

/**
 * Updates notification preferences for a user
 * @param uid - Firebase Auth user ID
 * @param preferences - Notification preferences to update
 * @returns Promise resolving when update is complete
 * @throws {Error} When Firestore update fails
 * @remarks
 * This function updates the nested settings.notifications field
 * @example
 * ```typescript
 * await updateNotificationPreferences('uid123', {
 *   enabled: true,
 *   showPreview: false,
 *   sound: true,
 *   vibration: true,
 *   directMessages: true,
 *   groupMessages: true,
 *   systemMessages: false,
 * });
 * ```
 */
export async function updateNotificationPreferences(
  uid: string,
  preferences: NotificationPreferences
): Promise<void> {
  const db = getFirebaseDb();
  const userDocRef = doc(db, 'users', uid);

  try {
    await updateDoc(userDocRef, {
      'settings.notifications': preferences,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('User profile not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You can only update your own preferences.');
    }

    throw new Error('Failed to update notification preferences. Please try again.');
  }
}

/**
 * Gets notification preferences for a user
 * @param uid - Firebase Auth user ID
 * @returns Promise resolving to notification preferences or null if not found
 * @throws {Error} When Firestore operation fails
 * @example
 * ```typescript
 * const preferences = await getNotificationPreferences('uid123');
 * if (preferences) {
 *   console.log('Notifications enabled:', preferences.enabled);
 * }
 * ```
 */
export async function getNotificationPreferences(
  uid: string
): Promise<NotificationPreferences | null> {
  try {
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as User;
    return (userData.settings?.notifications as NotificationPreferences) || null;
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    throw new Error('Failed to fetch notification preferences. Please try again.');
  }
}

/**
 * Gets opportunity notification settings for a user (Story 5.6 - Task 9)
 * @param uid - Firebase Auth user ID
 * @returns Opportunity notification settings or null if not found
 * @throws Error if fetching fails
 * @example
 * ```typescript
 * const settings = await getOpportunityNotificationSettings('uid123');
 * if (settings) {
 *   console.log('Min score:', settings.minimumScore);
 * }
 * ```
 */
export async function getOpportunityNotificationSettings(
  uid: string
): Promise<User['settings']['opportunityNotifications'] | null> {
  try {
    const db = getFirebaseDb();
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data() as User;
    return userData.settings?.opportunityNotifications || null;
  } catch (error) {
    console.error('Error fetching opportunity notification settings:', error);
    throw new Error('Failed to fetch opportunity notification settings. Please try again.');
  }
}

/**
 * Updates opportunity notification settings for a user (Story 5.6 - Task 9)
 * @param uid - Firebase Auth user ID
 * @param settings - Opportunity notification settings to save
 * @throws Error if update fails or user not found
 * @example
 * ```typescript
 * await updateOpportunityNotificationSettings('uid123', {
 *   enabled: true,
 *   minimumScore: 75,
 *   notifyByType: {
 *     sponsorship: true,
 *     collaboration: true,
 *     partnership: true,
 *     sale: false,
 *   },
 *   quietHours: {
 *     enabled: true,
 *     start: '22:00',
 *     end: '08:00',
 *   },
 * });
 * ```
 */
export async function updateOpportunityNotificationSettings(
  uid: string,
  settings: NonNullable<User['settings']['opportunityNotifications']>
): Promise<void> {
  const db = getFirebaseDb();
  const userDocRef = doc(db, 'users', uid);

  try {
    await updateDoc(userDocRef, {
      'settings.opportunityNotifications': settings,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating opportunity notification settings:', error);

    const firestoreError = error as FirestoreError;
    if (firestoreError.code === 'not-found') {
      throw new Error('User profile not found.');
    }

    if (firestoreError.code === 'permission-denied') {
      throw new Error('Permission denied. You can only update your own settings.');
    }

    throw new Error('Failed to update opportunity notification settings. Please try again.');
  }
}

/**
 * Result of paginated user query
 * @interface PaginatedUsersResult
 *
 * @remarks
 * Contains users for current page and cursor for fetching next page.
 * lastDoc is used with startAfter() for cursor-based pagination.
 */
export interface PaginatedUsersResult {
  /** Array of users for the current page */
  users: User[];

  /** Last document snapshot for pagination cursor (null if no more pages) */
  lastDoc: QueryDocumentSnapshot | null;

  /** Whether there are more users to fetch */
  hasMore: boolean;
}

/**
 * Fetches users with cursor-based pagination
 *
 * @param pageSize - Number of users to fetch per page (default: 20)
 * @param lastDoc - Last document from previous page (for pagination)
 * @returns Promise resolving to paginated users result
 * @throws {Error} When Firestore operation fails
 *
 * @remarks
 * Uses cursor-based pagination with orderBy displayName for consistent results.
 * Pass the lastDoc from previous result to fetch the next page.
 * Performance remains constant regardless of total user count.
 *
 * @example
 * ```typescript
 * // Fetch first page
 * const page1 = await getPaginatedUsers(20);
 * setUsers(page1.users);
 *
 * // Fetch next page
 * if (page1.hasMore) {
 *   const page2 = await getPaginatedUsers(20, page1.lastDoc);
 *   setUsers([...users, ...page2.users]);
 * }
 * ```
 */
export async function getPaginatedUsers(
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<PaginatedUsersResult> {
  try {
    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');

    // Build query with pagination
    let q;
    if (lastDoc) {
      q = query(usersRef, orderBy('displayName'), startAfter(lastDoc), limit(pageSize + 1));
    } else {
      q = query(usersRef, orderBy('displayName'), limit(pageSize + 1));
    }

    const snapshot = await getDocs(q);
    const users: User[] = [];
    const docs: QueryDocumentSnapshot[] = [];

    snapshot.forEach((doc) => {
      users.push(doc.data() as User);
      docs.push(doc as QueryDocumentSnapshot);
    });

    // Check if there are more pages
    const hasMore = users.length > pageSize;
    if (hasMore) {
      // Remove the extra user we fetched to check for more pages
      users.pop();
      docs.pop();
    }

    return {
      users,
      lastDoc: docs.length > 0 ? docs[docs.length - 1] : null,
      hasMore,
    };
  } catch (error) {
    console.error('Error fetching paginated users:', error);
    throw new Error('Failed to fetch users. Please try again.');
  }
}

/**
 * Searches users with pagination support
 *
 * @param searchQuery - Search query string (searches username and displayName)
 * @param pageSize - Number of results per page (default: 20)
 * @param lastDoc - Last document from previous page (for pagination)
 * @returns Promise resolving to paginated search results
 * @throws {Error} When Firestore operation fails
 *
 * @remarks
 * Due to Firestore limitations, this performs client-side filtering on a larger set.
 * For production-scale search, consider integrating Algolia or Elasticsearch.
 * Searches are case-insensitive and match partial strings.
 *
 * @example
 * ```typescript
 * // Search first page
 * const results = await searchUsersPaginated('john', 20);
 * setUsers(results.users);
 *
 * // Load more results
 * if (results.hasMore) {
 *   const more = await searchUsersPaginated('john', 20, results.lastDoc);
 *   setUsers([...users, ...more.users]);
 * }
 * ```
 */
export async function searchUsersPaginated(
  searchQuery: string,
  pageSize: number = 20,
  lastDoc: QueryDocumentSnapshot | null = null
): Promise<PaginatedUsersResult> {
  try {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return { users: [], lastDoc: null, hasMore: false };
    }

    const db = getFirebaseDb();
    const usersRef = collection(db, 'users');
    const normalizedQuery = searchQuery.toLowerCase().trim();

    // Strategy: Fetch users and filter client-side
    // This is a limitation of Firestore - production should use Algolia/Elasticsearch
    let q;
    if (lastDoc) {
      q = query(usersRef, orderBy('displayName'), startAfter(lastDoc), limit(100));
    } else {
      q = query(usersRef, orderBy('displayName'), limit(100));
    }

    const snapshot = await getDocs(q);
    const matchedUsers: User[] = [];
    const allDocs: QueryDocumentSnapshot[] = [];

    snapshot.forEach((doc) => {
      const userData = doc.data() as User;

      // Filter by display name or username (case-insensitive partial match)
      if (
        userData.displayName.toLowerCase().includes(normalizedQuery) ||
        userData.username.toLowerCase().includes(normalizedQuery)
      ) {
        matchedUsers.push(userData);
      }
      allDocs.push(doc as QueryDocumentSnapshot);
    });

    // Apply pagination to matched results
    const hasMore = matchedUsers.length > pageSize;
    const paginatedUsers = matchedUsers.slice(0, pageSize);

    // Find the lastDoc corresponding to the last user in paginatedUsers
    const lastUser = paginatedUsers[paginatedUsers.length - 1];
    const lastDocIndex = allDocs.findIndex((d) => (d.data() as User).uid === lastUser?.uid);
    const newLastDoc = lastDocIndex >= 0 ? allDocs[lastDocIndex] : null;

    return {
      users: paginatedUsers,
      lastDoc: newLastDoc,
      hasMore,
    };
  } catch (error) {
    console.error('Error searching users with pagination:', error);
    throw new Error('Failed to search users. Please try again.');
  }
}
