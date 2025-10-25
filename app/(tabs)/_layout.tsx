/**
 * Tabs layout component
 * @component
 * @remarks
 * This layout manages tab navigation for the main app with real-time opportunity badge (Story 5.6 - Task 13)
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { opportunityService } from '@/services/opportunityService';

/**
 * Layout for main app tabs
 * Story 5.6 - Task 13: Adds real-time badge for new opportunities on Home tab
 */
export default function TabsLayout() {
  const { user } = useAuth();
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
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
      screenListeners={{
        state: (e) => {
          // Clear badge when Home tab is focused
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
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          tabBarBadge: newOpportunityCount > 0 ? newOpportunityCount : undefined,
        }}
      />
      <Tabs.Screen
        name="daily-digest"
        options={{
          title: 'Daily',
          tabBarIcon: ({ color, size }) => <Ionicons name="today" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
