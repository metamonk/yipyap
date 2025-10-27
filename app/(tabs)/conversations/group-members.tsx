/**
 * Group Members screen for viewing and managing group participants
 *
 * @remarks
 * Displays the full list of group participants with remove functionality
 * (available only to the group creator). Fetches participant profiles and
 * displays them with ParticipantListItem components.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { getConversation, removeParticipant } from '@/services/conversationService';
import { getUserProfiles } from '@/services/userService';
import { ParticipantListItem } from '@/components/conversation/ParticipantListItem';
import type { Conversation } from '@/types/models';
import type { User } from '@/types/user';

/**
 * Group Members screen component
 *
 * @component
 *
 * @remarks
 * Features:
 * - View all group participants
 * - Remove participants (creator only)
 * - Real-time participant count
 * - Automatic refresh after participant removal
 *
 * Route: `/(tabs)/conversations/group-members?id={conversationId}`
 */
export default function GroupMembersScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = params.id;
  const { user } = useAuth();
  const { theme } = useTheme();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const isCreator = user && conversation && conversation.creatorId === user.uid;

  /**
   * Load conversation and participant data
   */
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const conv = await getConversation(conversationId);

      if (!conv) {
        Alert.alert('Error', 'Conversation not found');
        router.back();
        return;
      }

      if (conv.type !== 'group') {
        Alert.alert('Error', 'This is not a group conversation');
        router.back();
        return;
      }

      setConversation(conv);

      // Load participant profiles
      const participantProfiles = await getUserProfiles(conv.participantIds);
      setParticipants(participantProfiles);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load group members');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle removing a participant
   */
  const handleRemoveParticipant = async (participantId: string) => {
    if (!user) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setRemovingUserId(participantId);
      await removeParticipant(conversationId, participantId, user.uid);

      // Reload data to update the list
      await loadData();

      Alert.alert('Success', 'Member removed from group');
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    } finally {
      setRemovingUserId(null);
    }
  };

  /**
   * Render participant item
   */
  const renderParticipant = ({ item }: { item: User }) => {
    const isParticipantCreator = conversation?.creatorId === item.uid;
    const isCurrentUser = user?.uid === item.uid;

    return (
      <ParticipantListItem
        participant={item}
        isCreator={isCreator || false}
        isParticipantCreator={isParticipantCreator}
        isCurrentUser={isCurrentUser}
        onRemove={handleRemoveParticipant}
        removing={removingUserId === item.uid}
      />
    );
  };

  // Dynamic styles based on theme (Robinhood minimal aesthetic)
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderLight,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    headerSubtitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 2,
      textAlign: 'center',
    },
    groupInfo: {
      paddingHorizontal: 20,
      paddingVertical: 20,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderLight,
    },
    groupName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      marginBottom: 8,
    },
    creatorHint: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    emptyText: {
      fontSize: 17,
      color: theme.colors.textSecondary,
      marginTop: 16,
      textAlign: 'center',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={dynamicStyles.loadingContainer}>
        <Text style={{ color: theme.colors.textPrimary }}>Group not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* Header */}
      <View>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={theme.colors.accent} />
          </TouchableOpacity>
          <View style={styles.placeholder} />
        </View>
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Members</Text>
          <Text style={dynamicStyles.headerSubtitle}>
            {participants.length} {participants.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
      </View>

      {/* Group Info */}
      <View style={dynamicStyles.groupInfo}>
        <Text style={dynamicStyles.groupName}>{conversation.groupName}</Text>
        {isCreator && (
          <Text style={dynamicStyles.creatorHint}>
            Tap the remove button to remove members from this group
          </Text>
        )}
      </View>

      {/* Participants List */}
      <FlatList
        data={participants}
        renderItem={renderParticipant}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color={theme.colors.textTertiary} />
            <Text style={dynamicStyles.emptyText}>No members found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    padding: 4,
  },
  placeholder: {
    width: 36,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
});
