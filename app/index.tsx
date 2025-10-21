/**
 * Root index screen that redirects to the appropriate screen
 * @component
 * @remarks
 * Redirects to login screen by default
 * Will be enhanced with auth state checking in Story 1.5
 */

import { Redirect } from 'expo-router';

/**
 * Index screen that redirects to login
 */
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
