/**
 * Login screen component
 * @component
 * @remarks
 * Displays a welcome message as a canary to verify the app is working
 * Will be enhanced with actual login functionality in Story 1.5
 */

import { View, Text, StyleSheet } from 'react-native';

/**
 * Login screen that displays welcome message
 */
export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to yipyap</Text>
      <Text style={styles.subtitle}>Your encrypted messaging app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
