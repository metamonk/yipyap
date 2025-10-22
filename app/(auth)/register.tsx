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
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { validatePassword, isValidEmail } from '@/services/authService';
import { PasswordValidation } from '@/types/auth';

/**
 * Registration screen with Email/Password authentication
 */
const RegisterScreen = memo(function RegisterScreen() {
  const router = useRouter();
  const { user, isLoading, signUpWithEmailPassword, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join yipyap today</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Display Name (optional)"
              placeholderTextColor="#999"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              editable={!formLoading}
            />
          </View>

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
              editable={!formLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              editable={!formLoading}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              disabled={formLoading}
            >
              <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {password && (
            <View style={styles.passwordRequirements}>
              <Text
                style={[
                  styles.requirementText,
                  passwordValidation.hasMinLength && styles.requirementMet,
                ]}
              >
                {passwordValidation.hasMinLength ? '✓' : '○'} 8+ characters
              </Text>
              <Text
                style={[
                  styles.requirementText,
                  passwordValidation.hasUpperCase && styles.requirementMet,
                ]}
              >
                {passwordValidation.hasUpperCase ? '✓' : '○'} Uppercase letter
              </Text>
              <Text
                style={[
                  styles.requirementText,
                  passwordValidation.hasLowerCase && styles.requirementMet,
                ]}
              >
                {passwordValidation.hasLowerCase ? '✓' : '○'} Lowercase letter
              </Text>
              <Text
                style={[
                  styles.requirementText,
                  passwordValidation.hasNumber && styles.requirementMet,
                ]}
              >
                {passwordValidation.hasNumber ? '✓' : '○'} Number
              </Text>
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                password && confirmPassword && password !== confirmPassword && styles.inputError,
              ]}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              editable={!formLoading}
            />
            <Pressable
              style={styles.passwordToggle}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={formLoading}
            >
              <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          {password && confirmPassword && password !== confirmPassword && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          <Pressable
            style={[styles.registerButton, isButtonDisabled && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isButtonDisabled}
          >
            {formLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable style={styles.signInButton} onPress={handleSignIn} disabled={formLoading}>
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>Creating account...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

export default RegisterScreen;

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
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 48,
  },
  inputContainer: {
    marginBottom: 16,
    position: 'relative',
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
  inputError: {
    borderColor: '#f44336',
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  passwordToggleText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: '600',
  },
  passwordRequirements: {
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  requirementMet: {
    color: '#4CAF50',
    fontWeight: '500',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  registerButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  signInButton: {
    alignItems: 'center',
  },
  signInText: {
    color: '#666',
    fontSize: 14,
  },
  signInLink: {
    color: '#4285F4',
    fontWeight: '600',
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
