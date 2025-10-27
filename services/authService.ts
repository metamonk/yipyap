/**
 * Authentication service for managing user authentication operations
 * @remarks
 * This service handles Email/Password authentication via Firebase Auth
 * All authentication operations should use this service layer
 * Never access Firebase Auth directly from components
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  UserCredential as FirebaseUserCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from './firebase';
import { AuthError, UserCredential, PasswordValidation } from '@/types/auth';

/**
 * Error code mappings for user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':
    'This email is already registered. Please sign in or use a different email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password':
    'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
  'auth/user-not-found': 'No account found with this email. Please register first.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/operation-not-allowed':
    'Email/password authentication is not enabled. Please contact support.',
};

/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns PasswordValidation object with detailed validation results
 */
export function validatePassword(password: string): PasswordValidation {
  return {
    hasMinLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    isValid:
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /\d/.test(password),
  };
}

/**
 * Sign up user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @param displayName - Optional display name
 * @returns Promise resolving to Firebase UserCredential with user data
 * @throws {AuthError} When registration fails or validation fails
 * @example
 * ```typescript
 * try {
 *   const userCredential = await signUpWithEmailPassword(
 *     'user@example.com',
 *     'SecurePass123',
 *     'John Doe'
 *   );
 *   console.log('Registered user:', userCredential.user.email);
 * } catch (error) {
 *   console.error('Registration failed:', error.userMessage);
 * }
 * ```
 */
export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  try {
    // Validate email format
    if (!isValidEmail(email)) {
      throw createAuthError('auth/invalid-email', 'Invalid email format');
    }

    // Validate password strength
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.isValid) {
      throw createAuthError('auth/weak-password', 'Password does not meet security requirements');
    }

    // Create user account
    const auth = getFirebaseAuth();
    const userCredential: FirebaseUserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update display name if provided
    if (displayName && userCredential.user) {
      await updateProfile(userCredential.user, { displayName });
    }

    return userCredential.user;
  } catch (error: unknown) {
    // Handle Firebase Auth errors
    if (isFirebaseError(error)) {
      throw createAuthError(error.code, error.message);
    }

    // Re-throw if already an AuthError
    if (isAuthError(error)) {
      throw error;
    }

    // Generic error
    throw createAuthError(
      'auth/unknown',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Sign in user with email and password
 * @param email - User's email address
 * @param password - User's password
 * @returns Promise resolving to Firebase UserCredential with user data
 * @throws {AuthError} When sign-in fails or credentials are invalid
 * @example
 * ```typescript
 * try {
 *   const userCredential = await signInWithEmailPassword(
 *     'user@example.com',
 *     'SecurePass123'
 *   );
 *   console.log('Signed in user:', userCredential.user.email);
 * } catch (error) {
 *   console.error('Sign-in failed:', error.userMessage);
 * }
 * ```
 */
export async function signInWithEmailPassword(
  email: string,
  password: string
): Promise<UserCredential> {
  try {
    // Validate email format
    if (!isValidEmail(email)) {
      throw createAuthError('auth/invalid-email', 'Invalid email format');
    }

    // Sign in with email and password
    const auth = getFirebaseAuth();
    const userCredential: FirebaseUserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    return userCredential.user;
  } catch (error: unknown) {
    // Handle Firebase Auth errors
    if (isFirebaseError(error)) {
      throw createAuthError(error.code, error.message);
    }

    // Re-throw if already an AuthError
    if (isAuthError(error)) {
      throw error;
    }

    // Generic error
    throw createAuthError(
      'auth/unknown',
      error instanceof Error ? error.message : 'Unknown error occurred'
    );
  }
}

/**
 * Send password reset email
 * @param email - User's email address
 * @returns Promise that resolves when email is sent
 * @throws {AuthError} When email sending fails or user not found
 * @example
 * ```typescript
 * try {
 *   await sendPasswordResetEmail('user@example.com');
 *   console.log('Password reset email sent');
 * } catch (error) {
 *   console.error('Failed to send reset email:', error.userMessage);
 * }
 * ```
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    // Validate email format
    if (!isValidEmail(email)) {
      throw createAuthError('auth/invalid-email', 'Invalid email format');
    }

    // Send password reset email
    const auth = getFirebaseAuth();

    if (__DEV__) {
      console.log('[AuthService] Sending password reset email to:', email);
      console.log('[AuthService] Firebase Auth Domain:', auth.config.authDomain);
    }

    await firebaseSendPasswordResetEmail(auth, email);

    if (__DEV__) {
      console.log('[AuthService] Password reset email sent successfully');
      console.log('[AuthService] NOTE: Firebase Auth will silently succeed even if user does not exist (security feature)');
      console.log('[AuthService] Check spam folder if email not received');
    }
  } catch (error: unknown) {
    if (__DEV__) {
      console.error('[AuthService] Password reset email failed:', error);
    }

    // Handle Firebase Auth errors
    if (isFirebaseError(error)) {
      throw createAuthError(error.code, error.message);
    }

    // Re-throw if already an AuthError
    if (isAuthError(error)) {
      throw error;
    }

    // Generic error
    throw createAuthError(
      'auth/unknown',
      error instanceof Error ? error.message : 'Failed to send password reset email'
    );
  }
}

/**
 * Sign out the current user
 * @returns Promise that resolves when sign-out is complete
 * @throws {AuthError} When sign-out fails
 * @example
 * ```typescript
 * try {
 *   await signOut();
 *   console.log('User signed out');
 * } catch (error) {
 *   console.error('Sign-out failed:', error.userMessage);
 * }
 * ```
 */
export async function signOut(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
  } catch (error) {
    if (isFirebaseError(error)) {
      throw createAuthError(error.code, error.message);
    }
    throw createAuthError(
      'auth/sign-out-failed',
      error instanceof Error ? error.message : 'Failed to sign out'
    );
  }
}

/**
 * Creates an AuthError object with user-friendly message
 * @param code - Firebase error code
 * @param message - Technical error message
 * @returns AuthError with mapped user-friendly message
 */
function createAuthError(code: string, message: string): AuthError {
  const userMessage = ERROR_MESSAGES[code] || 'An error occurred. Please try again.';

  return {
    code,
    message,
    userMessage,
  };
}

/**
 * Type guard to check if error is a Firebase error
 * @param error - The error to check
 * @returns True if error is a Firebase error
 */
function isFirebaseError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string'
  );
}

/**
 * Type guard to check if error is an AuthError
 * @param error - The error to check
 * @returns True if error is an AuthError
 */
function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'userMessage' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    typeof (error as { message: unknown }).message === 'string' &&
    typeof (error as { userMessage: unknown }).userMessage === 'string'
  );
}
