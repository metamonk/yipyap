/**
 * Auth screens layout component
 * @component
 * @remarks
 * This layout manages authentication-related screens (login, register, etc.)
 */

import { Stack } from 'expo-router';

/**
 * Layout for authentication screens
 */
export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="login" options={{ title: 'Login' }} />
    </Stack>
  );
}
