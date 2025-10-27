/**
 * Profile Stack Layout
 * @component
 * @remarks
 * Manages navigation for profile-related screens
 */

import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="edit"
        options={{
          presentation: 'modal',
        }}
      />
      <Stack.Screen name="settings" />
      <Stack.Screen name="daily-agent-settings" />
      <Stack.Screen name="voice-settings" />
      <Stack.Screen name="faq-library" />
      <Stack.Screen name="faq-analytics" />
      <Stack.Screen name="ai-cost-dashboard" />
      <Stack.Screen name="ai-performance-dashboard" />
      <Stack.Screen name="dashboard-settings" />
      <Stack.Screen name="test-daily-agent" />
      <Stack.Screen name="agent-execution-logs" />
    </Stack>
  );
}
