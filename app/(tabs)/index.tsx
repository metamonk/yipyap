/**
 * Home screen component
 * @component
 * @remarks
 * Placeholder home screen for the main app
 */

import { View, Text, StyleSheet } from 'react-native';
import { NavigationHeader } from '../_components/NavigationHeader';
import { useAuth } from '@/hooks/useAuth';

/**
 * Main home screen
 */
export default function HomeScreen() {
  const { signOut, isLoading } = useAuth();

  const handleLogout = async () => {
    try {
      // Call signOut from auth service
      // Root layout will handle redirect to login after auth state changes
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Home"
        rightAction={{
          icon: 'log-out-outline',
          onPress: handleLogout,
          disabled: isLoading,
        }}
      />

      <View style={styles.content}>
        <Text style={styles.text}>Welcome to YipYap!</Text>
        <Text style={styles.subtext}>Start a conversation or explore the app</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
