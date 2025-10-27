/**
 * Tabs layout component
 * @component
 * @remarks
 * This layout manages tab navigation for the main app with real-time opportunity badge (Story 5.6 - Task 13)
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { opportunityService } from '@/services/opportunityService';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Layout for main app tabs
 * Story 5.6 - Task 13: Adds real-time badge for new opportunities on Home tab
 */
export default function TabsLayout() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [newOpportunityCount, setNewOpportunityCount] = useState<number>(0);

  /**
   * Subscribe to new opportunities and show badge
   * Story 5.6 - Task 13.3: Notification badge on dashboard tab
   */
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = opportunityService.subscribeToOpportunities(
      user.uid,
      70, // High-value threshold
      (_newOpportunity) => {
        // Increment badge count for new high-value opportunities
        setNewOpportunityCount((prev) => prev + 1);
      }
    );

    return unsubscribe;
  }, [user?.uid]);

  /**
   * Clear badge when user navigates to home tab
   * This will be called by the home screen component
   */
  useEffect(() => {
    // Badge is cleared when home screen mounts (see index.tsx)
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarShowLabel: false, // Robinhood-style: No labels, icons only
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: theme.colors.borderLight,
          backgroundColor: theme.colors.surface,
          height: 60 + insets.bottom, // Add safe area inset to height
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8, // Use safe area or default padding
          paddingTop: 8,
        },
      }}
      screenListeners={{
        state: (e) => {
          // Clear badge when Dashboard tab is focused
          const state = e.data.state;
          const currentRoute = state?.routes[state.index];
          if (currentRoute?.name === 'index') {
            setNewOpportunityCount(0);
          }
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={26} color={color} />
          ),
          tabBarBadge: newOpportunityCount > 0 ? newOpportunityCount : undefined,
        }}
      />
      <Tabs.Screen
        name="daily-digest"
        options={{
          title: 'Daily',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={26} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'chatbubble' : 'chatbubble-outline'} size={26} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={26} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
