/**
 * Login screen component with Email/Password authentication
 * @component
 * @remarks
 * Displays email/password login form for user authentication
 * Uses Firebase Auth with Email/Password provider
 * @example
 * ```tsx
 * // Used in app router at app/(auth)/login.tsx
 * <LoginScreen />
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

/**
 * Login screen with Email/Password authentication
 */
const LoginScreen = memo(function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user, isLoading, signInWithEmailPassword, error, clearError } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);

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
      Alert.alert('Sign-In Failed', error.userMessage, [
        {
          text: 'OK',
          onPress: clearError,
        },
      ]);
    }
  }, [error, clearError]);

  const handleSignIn = async () => {
    // Basic validation
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation Error', 'Please enter both email and password.');
      return;
    }

    try {
      setFormLoading(true);
      await signInWithEmailPassword(email.trim(), password);
      // Navigation handled by useEffect when user state changes
    } catch (err) {
      // Error handled by useAuth hook
      console.error('Sign-in error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleCreateAccount = () => {
    router.push('/register');
  };

  const isButtonDisabled = isLoading || formLoading || !email || !password;

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
    dividerText: {
      marginHorizontal: theme.spacing.base,
      color: theme.colors.textTertiary,
      fontSize: theme.typography.fontSize.sm,
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
          <Text style={dynamicStyles.title}>Welcome to yipyap</Text>
          <Text style={dynamicStyles.subtitle}>Your encrypted messaging app</Text>

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
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            disabled={formLoading}
          />

          <Button
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSignIn}
            disabled={isButtonDisabled}
            loading={formLoading}
          >
            Sign In
          </Button>

          <Button
            variant="ghost"
            size="md"
            fullWidth
            onPress={handleForgotPassword}
            disabled={formLoading}
            style={{ marginTop: theme.spacing.base }}
          >
            Forgot Password?
          </Button>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.divider }]} />
            <Text style={dynamicStyles.dividerText}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.divider }]} />
          </View>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            onPress={handleCreateAccount}
            disabled={formLoading}
          >
            Create Account
          </Button>
        </View>
      </ScrollView>

      {isLoading && (
        <View style={dynamicStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={dynamicStyles.loadingText}>Loading...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
});

export default LoginScreen;

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
