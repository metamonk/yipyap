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

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text>Group not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Members</Text>
          <Text style={styles.headerSubtitle}>
            {participants.length} {participants.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Group Info */}
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{conversation.groupName}</Text>
        {isCreator && (
          <Text style={styles.creatorHint}>
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
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  placeholder: {
    width: 36,
  },
  groupInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  creatorHint: {
    fontSize: 13,
    color: '#8E8E93',
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
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
});
