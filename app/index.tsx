/**
 * Root index screen
 * @component
 * @remarks
 * Initial landing screen - root layout handles auth-based routing
 * This screen shows briefly while the root layout checks auth state
 * and redirects to appropriate route (login or main app)
 */

import { View, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Index screen - minimal loading screen
 * Root layout (_layout.tsx) handles all authentication routing
 */
export default function Index() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4285F4" />
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
});
