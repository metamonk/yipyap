/**
 * Unit tests for authService with Email/Password authentication
 */

import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  sendPasswordResetEmail,
  signOut,
  isValidEmail,
  validatePassword,
} from '@/services/authService';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/services/firebase';

// Mock dependencies
jest.mock('firebase/auth');
jest.mock('@/services/firebase');

describe('authService', () => {
  const mockAuth = { name: 'mockAuth' };
  const mockUser = {
    uid: 'test-uid',
    email: 'test@example.com',
    displayName: 'Test User',
  };
  const mockUserCredential = {
    user: mockUser,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('Validation Functions', () => {
    describe('isValidEmail', () => {
      it('should return true for valid email addresses', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
        expect(isValidEmail('user+tag@example.org')).toBe(true);
      });

      it('should return false for invalid email addresses', () => {
        expect(isValidEmail('')).toBe(false);
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('user@')).toBe(false);
        expect(isValidEmail('user@.com')).toBe(false);
        expect(isValidEmail('user name@example.com')).toBe(false);
      });
    });

    describe('validatePassword', () => {
      it('should return valid for strong passwords', () => {
        const result = validatePassword('SecurePass123');
        expect(result.isValid).toBe(true);
        expect(result.hasMinLength).toBe(true);
        expect(result.hasUpperCase).toBe(true);
        expect(result.hasLowerCase).toBe(true);
        expect(result.hasNumber).toBe(true);
      });

      it('should return invalid for weak passwords', () => {
        expect(validatePassword('').isValid).toBe(false);
        expect(validatePassword('short').isValid).toBe(false);
        expect(validatePassword('nouppercase123').isValid).toBe(false);
        expect(validatePassword('NOLOWERCASE123').isValid).toBe(false);
        expect(validatePassword('NoNumbers').isValid).toBe(false);
        expect(validatePassword('12345678').isValid).toBe(false);
      });

      it('should correctly identify individual requirements', () => {
        const result = validatePassword('aBc');
        expect(result.hasMinLength).toBe(false);
        expect(result.hasUpperCase).toBe(true);
        expect(result.hasLowerCase).toBe(true);
        expect(result.hasNumber).toBe(false);
        expect(result.isValid).toBe(false);
      });
    });
  });

  describe('signUpWithEmailPassword', () => {
    it('should successfully sign up user with email and password', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);
      (updateProfile as jest.Mock).mockResolvedValue(undefined);

      const result = await signUpWithEmailPassword(
        'test@example.com',
        'SecurePass123',
        'Test User'
      );

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'SecurePass123'
      );
      expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Test User' });
      expect(result).toEqual(mockUser);
    });

    it('should sign up without display name', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signUpWithEmailPassword('test@example.com', 'SecurePass123');

      expect(createUserWithEmailAndPassword).toHaveBeenCalled();
      expect(updateProfile).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid email format', async () => {
      await expect(signUpWithEmailPassword('invalid-email', 'SecurePass123')).rejects.toMatchObject(
        {
          code: 'auth/invalid-email',
          userMessage: 'Please enter a valid email address.',
        }
      );

      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should throw error for weak password', async () => {
      await expect(signUpWithEmailPassword('test@example.com', 'weak')).rejects.toMatchObject({
        code: 'auth/weak-password',
        userMessage:
          'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
      });

      expect(createUserWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should handle email already in use error', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use',
      });

      await expect(
        signUpWithEmailPassword('test@example.com', 'SecurePass123')
      ).rejects.toMatchObject({
        code: 'auth/email-already-in-use',
        userMessage: 'This email is already registered. Please sign in or use a different email.',
      });
    });

    it('should handle network errors', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error',
      });

      await expect(
        signUpWithEmailPassword('test@example.com', 'SecurePass123')
      ).rejects.toMatchObject({
        code: 'auth/network-request-failed',
        userMessage: 'Network error. Please check your connection and try again.',
      });
    });

    it('should handle unknown errors', async () => {
      (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue(new Error('Unknown error'));

      await expect(
        signUpWithEmailPassword('test@example.com', 'SecurePass123')
      ).rejects.toMatchObject({
        code: 'auth/unknown',
        userMessage: 'An error occurred. Please try again.',
      });
    });
  });

  describe('signInWithEmailPassword', () => {
    it('should successfully sign in user with email and password', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockResolvedValue(mockUserCredential);

      const result = await signInWithEmailPassword('test@example.com', 'SecurePass123');

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'SecurePass123'
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid email format', async () => {
      await expect(signInWithEmailPassword('invalid-email', 'SecurePass123')).rejects.toMatchObject(
        {
          code: 'auth/invalid-email',
          userMessage: 'Please enter a valid email address.',
        }
      );

      expect(signInWithEmailAndPassword).not.toHaveBeenCalled();
    });

    it('should handle wrong password error', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password',
      });

      await expect(
        signInWithEmailPassword('test@example.com', 'WrongPassword')
      ).rejects.toMatchObject({
        code: 'auth/wrong-password',
        userMessage: 'Incorrect password. Please try again.',
      });
    });

    it('should handle user not found error', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'User not found',
      });

      await expect(
        signInWithEmailPassword('notfound@example.com', 'Password123')
      ).rejects.toMatchObject({
        code: 'auth/user-not-found',
        userMessage: 'No account found with this email. Please register first.',
      });
    });

    it('should handle too many requests error', async () => {
      (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({
        code: 'auth/too-many-requests',
        message: 'Too many requests',
      });

      await expect(
        signInWithEmailPassword('test@example.com', 'Password123')
      ).rejects.toMatchObject({
        code: 'auth/too-many-requests',
        userMessage: 'Too many failed attempts. Please try again later.',
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should successfully send password reset email', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      await sendPasswordResetEmail('test@example.com');

      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, 'test@example.com');
    });

    it('should throw error for invalid email format', async () => {
      await expect(sendPasswordResetEmail('invalid-email')).rejects.toMatchObject({
        code: 'auth/invalid-email',
        userMessage: 'Please enter a valid email address.',
      });

      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'User not found',
      });

      await expect(sendPasswordResetEmail('notfound@example.com')).rejects.toMatchObject({
        code: 'auth/user-not-found',
        userMessage: 'No account found with this email. Please register first.',
      });
    });

    it('should handle network errors', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error',
      });

      await expect(sendPasswordResetEmail('test@example.com')).rejects.toMatchObject({
        code: 'auth/network-request-failed',
        userMessage: 'Network error. Please check your connection and try again.',
      });
    });

    it('should handle too many requests error', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue({
        code: 'auth/too-many-requests',
        message: 'Too many requests',
      });

      await expect(sendPasswordResetEmail('test@example.com')).rejects.toMatchObject({
        code: 'auth/too-many-requests',
        userMessage: 'Too many failed attempts. Please try again later.',
      });
    });

    it('should handle unknown errors', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue(new Error('Unknown error'));

      await expect(sendPasswordResetEmail('test@example.com')).rejects.toMatchObject({
        code: 'auth/unknown',
      });
    });
  });

  describe('signOut', () => {
    it('should successfully sign out user', async () => {
      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(firebaseSignOut).toHaveBeenCalledWith(mockAuth);
    });

    it('should handle sign-out errors', async () => {
      (firebaseSignOut as jest.Mock).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error',
      });

      await expect(signOut()).rejects.toMatchObject({
        code: 'auth/network-request-failed',
        userMessage: 'Network error. Please check your connection and try again.',
      });
    });

    it('should handle unknown sign-out errors', async () => {
      (firebaseSignOut as jest.Mock).mockRejectedValue(new Error('Unknown error'));

      await expect(signOut()).rejects.toMatchObject({
        code: 'auth/sign-out-failed',
        userMessage: 'An error occurred. Please try again.',
      });
    });
  });
});
