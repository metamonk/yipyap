/**
 * Integration test for password reset flow
 * @remarks
 * Tests the complete workflow: login screen → forgot-password screen → send email → return to login
 */

import { sendPasswordResetEmail } from '@/services/authService';
import { sendPasswordResetEmail as firebaseSendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth } from '@/services/firebase';

// Mock Firebase
jest.mock('@/services/firebase');
jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

describe('Password Reset Integration Flow', () => {
  const mockAuth = { name: 'mockAuth' };
  const validEmail = 'test@example.com';
  const invalidEmail = 'invalid-email';
  const unknownEmail = 'unknown@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
  });

  describe('Complete password reset workflow', () => {
    it('should complete full password reset flow successfully', async () => {
      // Mock successful password reset email
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // Step 1: User navigates to forgot-password screen (navigation tested in component tests)
      // Step 2: User enters valid email
      // Step 3: Service sends password reset email
      await sendPasswordResetEmail(validEmail);

      // Verify Firebase Auth was called with correct parameters
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should handle invalid email in workflow', async () => {
      // User enters invalid email format
      // Service should throw validation error before calling Firebase

      await expect(sendPasswordResetEmail(invalidEmail)).rejects.toMatchObject({
        code: 'auth/invalid-email',
        userMessage: 'Please enter a valid email address.',
      });

      // Firebase should not be called for invalid email
      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should handle user not found error in workflow', async () => {
      // Mock Firebase error for user not found
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'User not found',
      });

      // User enters email that doesn't exist
      await expect(sendPasswordResetEmail(unknownEmail)).rejects.toMatchObject({
        code: 'auth/user-not-found',
        userMessage: 'No account found with this email. Please register first.',
      });

      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, unknownEmail);
    });

    it('should handle network failure and allow retry', async () => {
      // Mock network failure
      (firebaseSendPasswordResetEmail as jest.Mock)
        .mockRejectedValueOnce({
          code: 'auth/network-request-failed',
          message: 'Network error',
        })
        .mockResolvedValueOnce(undefined); // Success on retry

      // First attempt fails with network error
      await expect(sendPasswordResetEmail(validEmail)).rejects.toMatchObject({
        code: 'auth/network-request-failed',
        userMessage: 'Network error. Please check your connection and try again.',
      });

      // User retries after network is restored
      await sendPasswordResetEmail(validEmail);

      // Verify both calls were made
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(2);
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
    });

    it('should handle too many requests error', async () => {
      // Mock too many requests error
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue({
        code: 'auth/too-many-requests',
        message: 'Too many requests',
      });

      // User tries to reset password too many times
      await expect(sendPasswordResetEmail(validEmail)).rejects.toMatchObject({
        code: 'auth/too-many-requests',
        userMessage: 'Too many failed attempts. Please try again later.',
      });

      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
    });
  });

  describe('Error recovery scenarios', () => {
    it('should allow user to correct invalid email and retry', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // User enters invalid email
      await expect(sendPasswordResetEmail(invalidEmail)).rejects.toMatchObject({
        code: 'auth/invalid-email',
      });

      // Firebase not called for invalid email
      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();

      // User corrects email and retries
      await sendPasswordResetEmail(validEmail);

      // Second attempt succeeds
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple validation errors before success', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // Attempt 1: Empty email
      await expect(sendPasswordResetEmail('')).rejects.toMatchObject({
        code: 'auth/invalid-email',
      });

      // Attempt 2: Invalid format
      await expect(sendPasswordResetEmail('not-an-email')).rejects.toMatchObject({
        code: 'auth/invalid-email',
      });

      // Attempt 3: Valid email
      await sendPasswordResetEmail(validEmail);

      // Only valid email reaches Firebase
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
    });

    it('should handle Firebase error followed by successful retry', async () => {
      // Mock Firebase error then success
      (firebaseSendPasswordResetEmail as jest.Mock)
        .mockRejectedValueOnce({
          code: 'auth/user-not-found',
          message: 'User not found',
        })
        .mockResolvedValueOnce(undefined);

      // First attempt: user enters wrong email
      await expect(sendPasswordResetEmail('wrong@example.com')).rejects.toMatchObject({
        code: 'auth/user-not-found',
      });

      // Second attempt: user enters correct email
      await sendPasswordResetEmail(validEmail);

      // Both attempts reach Firebase
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('Email validation edge cases', () => {
    it('should reject email with leading/trailing whitespace', async () => {
      // Note: Trimming happens at component level, not service level
      // Service validates the email as-is
      const emailWithSpaces = `  ${validEmail}  `;

      await expect(sendPasswordResetEmail(emailWithSpaces)).rejects.toMatchObject({
        code: 'auth/invalid-email',
      });

      // Firebase should not be called for email with spaces
      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject email with only whitespace', async () => {
      await expect(sendPasswordResetEmail('   ')).rejects.toMatchObject({
        code: 'auth/invalid-email',
      });

      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should accept various valid email formats', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      const validEmails = [
        'simple@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@subdomain.example.org',
      ];

      for (const email of validEmails) {
        await sendPasswordResetEmail(email);
      }

      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(validEmails.length);
    });

    it('should reject various invalid email formats', async () => {
      const invalidEmails = [
        'invalid',
        '@example.com',
        'user@',
        'user@.com',
        'user name@example.com',
        'user@@example.com',
      ];

      for (const email of invalidEmails) {
        await expect(sendPasswordResetEmail(email)).rejects.toMatchObject({
          code: 'auth/invalid-email',
        });
      }

      // Firebase should never be called for invalid emails
      expect(firebaseSendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe('State management across workflow', () => {
    it('should maintain correct error states through workflow', async () => {
      // Simulate workflow with multiple error states
      (firebaseSendPasswordResetEmail as jest.Mock)
        .mockRejectedValueOnce({
          code: 'auth/network-request-failed',
          message: 'Network error',
        })
        .mockRejectedValueOnce({
          code: 'auth/user-not-found',
          message: 'User not found',
        })
        .mockResolvedValueOnce(undefined);

      // Error 1: Network failure
      const error1 = await sendPasswordResetEmail(validEmail).catch((e) => e);
      expect(error1.code).toBe('auth/network-request-failed');

      // Error 2: User not found
      const error2 = await sendPasswordResetEmail(validEmail).catch((e) => e);
      expect(error2.code).toBe('auth/user-not-found');

      // Success
      await sendPasswordResetEmail(validEmail);

      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(3);
    });

    it('should handle rapid consecutive requests', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      // User clicks button multiple times rapidly
      const requests = [
        sendPasswordResetEmail(validEmail),
        sendPasswordResetEmail(validEmail),
        sendPasswordResetEmail(validEmail),
      ];

      await Promise.all(requests);

      // All requests should be processed
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledTimes(3);
    });
  });

  describe('Integration with Firebase Auth', () => {
    it('should pass correct parameters to Firebase Auth', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      await sendPasswordResetEmail(validEmail);

      // Verify correct auth instance and email are passed
      expect(firebaseSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, validEmail);
      expect(getFirebaseAuth).toHaveBeenCalled();
    });

    it('should use the same auth instance across multiple calls', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockResolvedValue(undefined);

      await sendPasswordResetEmail('user1@example.com');
      await sendPasswordResetEmail('user2@example.com');
      await sendPasswordResetEmail('user3@example.com');

      // Verify auth instance is reused
      const authCalls = (firebaseSendPasswordResetEmail as jest.Mock).mock.calls;
      expect(authCalls[0][0]).toBe(mockAuth);
      expect(authCalls[1][0]).toBe(mockAuth);
      expect(authCalls[2][0]).toBe(mockAuth);
    });

    it('should handle unknown Firebase errors gracefully', async () => {
      (firebaseSendPasswordResetEmail as jest.Mock).mockRejectedValue(
        new Error('Unknown Firebase error')
      );

      await expect(sendPasswordResetEmail(validEmail)).rejects.toMatchObject({
        code: 'auth/unknown',
      });
    });
  });
});
