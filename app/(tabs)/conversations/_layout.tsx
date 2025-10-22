/**
 * Conversations Stack Layout
 * @component
 * @remarks
 * Manages navigation for conversations and related screens
 */

import { Stack } from 'expo-router';

export default function ConversationsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen
        name="new"
        options={{
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
