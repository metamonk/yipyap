/**
 * Registration screen component with Email/Password authentication
 * @component
 * @remarks
 * Displays registration form for new user account creation
 * Uses Firebase Auth with Email/Password provider
 * Includes password strength validation and confirmation
 * @example
 * ```tsx
 * // Used in app router at app/(auth)/register.tsx
 * <RegisterScreen />
 * ```
 */

import { memo, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { validatePassword, isValidEmail } from '@/services/authService';
import { PasswordValidation } from '@/types/auth';

/**
 * Registration screen with Email/Password authentication
 */
const RegisterScreen = memo(function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isLoading, signUpWithEmailPassword, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    isValid: false,
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
  });

  // Navigate to main app when user is authenticated
  useEffect(() => {
    if (user) {
      // Will be updated in Story 1.4 to check for username setup
      router.replace('/(tabs)');
    }
  }, [user, router]);

  // Display error alerts
  useEffect(() => {
    if (error) {
      Alert.alert('Registration Failed', error.userMessage, [
        {
          text: 'OK',
          onPress: clearError,
        },
      ]);
    }
  }, [error, clearError]);

  // Validate password as user types
  useEffect(() => {
    if (password) {
      setPasswordValidation(validatePassword(password));
    } else {
      setPasswordValidation({
        isValid: false,
        hasMinLength: false,
        hasUpperCase: false,
        hasLowerCase: false,
        hasNumber: false,
      });
    }
  }, [password]);

  const handleRegister = async () => {
    // Validate email
    if (!isValidEmail(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    // Validate password strength
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Weak Password',
        'Password must be at least 8 characters with uppercase, lowercase, and numbers.'
      );
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return;
    }

    try {
      setFormLoading(true);
      await signUpWithEmailPassword(email.trim(), password, displayName.trim() || undefined);
      // Navigation handled by useEffect when user state changes
    } catch (err) {
      // Error handled by useAuth hook
      console.error('Registration error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleSignIn = () => {
    router.push('/login');
  };

  const isButtonDisabled =
    isLoading ||
    formLoading ||
    !email ||
    !password ||
    !confirmPassword ||
    !passwordValidation.isValid ||
    password !== confirmPassword;

  // Get confirm password error
  const confirmPasswordError =
    password && confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined;

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      fontSize: theme.typography.fontSize['3xl'],
      fontWeight: theme.typography.fontWeight.bold,
      color: theme.colors.textPrimary,
      textAlign: 'center',
      marginBottom: theme.spacing.md,
    },
    subtitle: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginBottom: theme.spacing['3xl'],
    },
    requirementText: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textTertiary,
      marginBottom: theme.spacing.xs,
    },
    requirementMet: {
      color: theme.colors.success,
      fontWeight: theme.typography.fontWeight.medium,
    },
    dividerText: {
      marginHorizontal: theme.spacing.base,
      color: theme.colors.textTertiary,
      fontSize: theme.typography.fontSize.sm,
    },
    signInText: {
      color: theme.colors.textSecondary,
      fontSize: theme.typography.fontSize.sm,
      textAlign: 'center',
    },
    signInLink: {
      color: theme.colors.accent,
      fontWeight: theme.typography.fontWeight.bold,
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      gap: theme.spacing.base,
    },
    loadingText: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
    },
  });

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={dynamicStyles.title}>Create Account</Text>
          <Text style={dynamicStyles.subtitle}>Join yipyap today</Text>

          <Input
            label="Display Name (optional)"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            disabled={formLoading}
          />

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            disabled={formLoading}
          />

          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            disabled={formLoading}
          />

          {password && (
            <View style={styles.passwordRequirements}>
              <Text
                style={[
                  dynamicStyles.requirementText,
                  passwordValidation.hasMinLength && dynamicStyles.requirementMet,
                ]}
              >
                {passwordValidation.hasMinLength ? '✓' : '○'} 8+ characters
              </Text>
              <Text
                style={[
                  dynamicStyles.requirementText,
                  passwordValidation.hasUpperCase && dynamicStyles.requirementMet,
                ]}
              >
                {passwordValidation.hasUpperCase ? '✓' : '○'} Uppercase letter
              </Text>
              <Text
                style={[
                  dynamicStyles.requirementText,
                  passwordValidation.hasLowerCase && dynamicStyles.requirementMet,
                ]}
              >
                {passwordValidation.hasLowerCase ? '✓' : '○'} Lowercase letter
              </Text>
              <Text
                style={[
                  dynamicStyles.requirementText,
                  passwordValidation.hasNumber && dynamicStyles.requirementMet,
                ]}
              >
                {passwordValidation.hasNumber ? '✓' : '○'} Number
              </Text>
            </View>
          )}

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            disabled={formLoading}
            error={confirmPasswordError}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleRegister}
            disabled={isButtonDisabled}
            loading={formLoading}
          >
            Create Account
          </Button>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.divider }]} />
            <Text style={dynamicStyles.dividerText}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.divider }]} />
          </View>

          <View style={{ alignItems: 'center' }}>
            <Text style={dynamicStyles.signInText}>
              Already have an account?
            </Text>
            <Button
              variant="ghost"
              size="md"
              onPress={handleSignIn}
              disabled={formLoading}
              style={{ marginTop: theme.spacing.sm }}
            >
              Sign In
            </Button>
          </View>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={dynamicStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={dynamicStyles.loadingText}>Creating account...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

export default RegisterScreen;

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formContainer: {
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  passwordRequirements: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
});
