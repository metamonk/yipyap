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
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { isValidEmail } from '@/services/authService';
import { useRouter } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Password reset screen
 */
const ForgotPasswordScreen = memo(function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    formContainer: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing['3xl'],
    },
    title: {
      fontSize: 32,
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
      lineHeight: 20,
    },
    successMessage: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.successBackground || '#E8F5E9',
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.base,
    },
    successIcon: {
      fontSize: 20,
      color: theme.colors.success || '#4CAF50',
      marginRight: theme.spacing.sm,
    },
    successText: {
      flex: 1,
      color: theme.colors.success || '#2E7D32',
      fontSize: theme.typography.fontSize.sm,
    },
    helpContainer: {
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.base,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
      marginTop: theme.spacing.xl,
    },
    helpTitle: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
    },
    helpText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.xs,
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
      gap: theme.spacing.base,
    },
    loadingText: {
      color: '#fff',
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={dynamicStyles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.formContainer}>
          {/* Icon for visual appeal - Robinhood style */}
          <View style={styles.iconContainer}>
            <Ionicons name="lock-closed-outline" size={64} color={theme.colors.accent} />
          </View>

          <Text style={dynamicStyles.title}>Reset Password</Text>
          <Text style={dynamicStyles.subtitle}>
            Enter your email address and we'll send you instructions to reset your password.
          </Text>

          {/* Using Input component instead of TextInput */}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isLoading && !emailSent}
            placeholder="your.email@example.com"
          />

          {emailSent && (
            <View style={dynamicStyles.successMessage}>
              <Text style={dynamicStyles.successIcon}>✓</Text>
              <Text style={dynamicStyles.successText}>Password reset email sent successfully!</Text>
            </View>
          )}

          {/* Using Button component instead of Pressable */}
          <Button
            variant="primary"
            onPress={handleSendResetEmail}
            disabled={isButtonDisabled}
            loading={isLoading}
            style={styles.resetButton}
          >
            {emailSent ? 'Email Sent' : 'Send Reset Email'}
          </Button>

          <View style={styles.divider} />

          {/* Back button using Button component with ghost variant */}
          <Button
            variant="ghost"
            onPress={handleBackToLogin}
            disabled={isLoading}
            style={styles.backButton}
          >
            ← Back to Sign In
          </Button>

          {/* Help section with theme colors */}
          <View style={dynamicStyles.helpContainer}>
            <Text style={dynamicStyles.helpTitle}>Didn't receive the email?</Text>
            <Text style={dynamicStyles.helpText}>• Check your spam or junk folder</Text>
            <Text style={dynamicStyles.helpText}>• Verify you entered the correct email</Text>
            <Text style={dynamicStyles.helpText}>• Wait a few minutes and try again</Text>
          </View>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={dynamicStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={dynamicStyles.loadingText}>Sending email...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

export default ForgotPasswordScreen;

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resetButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  divider: {
    marginBottom: 24,
  },
  backButton: {
    marginBottom: 32,
  },
});
