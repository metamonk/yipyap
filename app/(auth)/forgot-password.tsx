/**
 * Password reset screen component
 * @component
 * @remarks
 * Allows users to request a password reset email
 * Uses Firebase Auth password reset functionality
 * @example
 * ```tsx
 * // Used in app router at app/(auth)/forgot-password.tsx
 * <ForgotPasswordScreen />
 * ```
 */

import { useAuth } from '@/hooks/useAuth';
import { isValidEmail } from '@/services/authService';
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Password reset screen
 */
const ForgotPasswordScreen = memo(function ForgotPasswordScreen() {
  const router = useRouter();
  const { user, isLoading, sendPasswordResetEmail, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  // Navigate to main app if user is authenticated
  useEffect(() => {
    if (user) {
      router.replace('/(tabs)');
    }
  }, [user, router]);

  // Display error alerts
  useEffect(() => {
    if (error) {
      Alert.alert('Password Reset Failed', error.userMessage, [
        {
          text: 'OK',
          onPress: clearError,
        },
      ]);
    }
  }, [error, clearError]);

  const handleSendResetEmail = async () => {
    // Validate email
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      await sendPasswordResetEmail(email.trim());
      setEmailSent(true);
      Alert.alert(
        'Email Sent',
        'Password reset instructions have been sent to your email. Please check your inbox.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/login'),
          },
        ]
      );
    } catch (err) {
      // Error handled by useAuth hook
      console.error('Password reset error:', err);
    }
  };

  const handleBackToLogin = () => {
    router.push('/login');
  };

  const isButtonDisabled = isLoading || !email || emailSent;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isLoading && !emailSent}
            />
          </View>

          {emailSent && (
            <View style={styles.successMessage}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successText}>Password reset email sent successfully!</Text>
            </View>
          )}

          <Pressable
            style={[styles.resetButton, isButtonDisabled && styles.buttonDisabled]}
            onPress={handleSendResetEmail}
            disabled={isButtonDisabled}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : emailSent ? (
              <Text style={styles.resetButtonText}>Email Sent</Text>
            ) : (
              <Text style={styles.resetButtonText}>Send Reset Email</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.backButton} onPress={handleBackToLogin} disabled={isLoading}>
            <Text style={styles.backButtonText}>← Back to Sign In</Text>
          </Pressable>

          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>Didn&apos;t receive the email?</Text>
            <Text style={styles.helpText}>• Check your spam or junk folder</Text>
            <Text style={styles.helpText}>• Verify you entered the correct email</Text>
            <Text style={styles.helpText}>• Wait a few minutes and try again</Text>
          </View>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Sending email...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#333',
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 20,
    color: '#4CAF50',
    marginRight: 8,
  },
  successText: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    marginBottom: 24,
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#ddd',
  },
  backButton: {
    alignItems: 'center',
    marginBottom: 32,
  },
  backButtonText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '600',
  },
  helpContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
