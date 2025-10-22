/**
 * Authentication types for yipyap
 * @remarks
 * This module defines all authentication-related TypeScript types and interfaces
 * used throughout the application for Email/Password and Firebase Auth
 */

import { User as FirebaseUser } from 'firebase/auth';

/**
 * Extended user credential type from Firebase User
 * @remarks
 * Includes all Firebase User properties plus additional metadata
 */
export type UserCredential = FirebaseUser;

/**
 * Authentication state for the application
 * @remarks
 * Tracks the current user, loading state, and authentication status
 * Used by the useAuth hook to manage global auth state
 */
export interface AuthState {
  /** Current authenticated user, null if not authenticated */
  user: FirebaseUser | null;

  /** Whether user is currently authenticated */
  isAuthenticated: boolean;

  /** Loading state during authentication operations */
  isLoading: boolean;

  /** Current authentication error, null if no error */
  error: AuthError | null;
}

/**
 * Firebase authentication error with user-friendly message
 * @remarks
 * Wraps Firebase auth errors and provides user-friendly messages
 * for display in the UI
 */
export interface AuthError {
  /** Firebase error code (e.g., 'auth/network-request-failed') */
  code: string;

  /** Technical error message from Firebase */
  message: string;

  /** User-friendly error message for display in UI */
  userMessage: string;
}

/**
 * Registration form data
 * @remarks
 * Data collected during user registration with email/password
 */
export interface RegistrationFormData {
  /** User's email address */
  email: string;

  /** User's chosen password */
  password: string;

  /** Password confirmation for validation */
  confirmPassword: string;

  /** Optional display name */
  displayName?: string;
}

/**
 * Login form data
 * @remarks
 * Data required for email/password login
 */
export interface LoginFormData {
  /** User's email address */
  email: string;

  /** User's password */
  password: string;
}

/**
 * Password validation result
 * @remarks
 * Used to validate password strength requirements
 */
export interface PasswordValidation {
  /** Whether password meets all requirements */
  isValid: boolean;

  /** Has minimum 8 characters */
  hasMinLength: boolean;

  /** Contains uppercase letter */
  hasUpperCase: boolean;

  /** Contains lowercase letter */
  hasLowerCase: boolean;

  /** Contains number */
  hasNumber: boolean;
}
