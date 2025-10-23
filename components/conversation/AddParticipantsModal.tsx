/**
 * Modal for adding new participants to a group conversation
 *
 * @remarks
 * Provides a user-friendly interface for group creators to add new members
 * to existing group conversations. Validates against the 50-member limit
 * and filters out existing participants from search results.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import { RecipientChip } from '@/components/conversation/RecipientChip';
import { getAllUsers } from '@/services/userService';
import { GROUP_SIZE_LIMIT } from '@/constants/groupLimits';
import type { User } from '@/types/user';
import type { Conversation } from '@/types/models';

/**
 * Props for AddParticipantsModal component
 */
export interface AddParticipantsModalProps {
  /** Whether the modal is visible */
  visible: boolean;

  /** Callback to close the modal */
  onClose: () => void;

  /** The conversation to add participants to */
  conversation: Conversation;

  /** Callback when participants are added successfully */
  onParticipantsAdded: (newParticipantIds: string[]) => Promise<void>;
}

/**
 * Modal component for adding new participants to a group conversation
 *
 * @component
 * @example
 * ```tsx
 * <AddParticipantsModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   conversation={conversation}
 *   onParticipantsAdded={handleAddParticipants}
 * />
 * ```
 */
export const AddParticipantsModal: React.FC<AddParticipantsModalProps> = ({
  visible,
  onClose,
  conversation,
  onParticipantsAdded,
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const existingParticipantIds = useMemo(
    () => conversation.participantIds || [],
    [conversation.participantIds]
  );
  const currentCount = existingParticipantIds.length;
  const remainingSlots = GROUP_SIZE_LIMIT - currentCount;
  const canAddMore = selectedUsers.length < remainingSlots;

  /**
   * Load all users and filter out existing participants
   */
  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();

      // Filter out existing participants
      const availableUsers = allUsers.filter((user) => !existingParticipantIds.includes(user.uid));

      setUsers(availableUsers);
      setFilteredUsers(availableUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [existingParticipantIds]);

  /**
   * Filter users based on search query
   */
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.displayName.toLowerCase().includes(query) ||
          (user.username && user.username.toLowerCase().includes(query))
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  /**
   * Load users when modal becomes visible
   */
  useEffect(() => {
    if (visible) {
      loadUsers();
      setSelectedUsers([]);
      setSearchQuery('');
    }
  }, [visible, loadUsers]);

  /**
   * Handle user selection
   */
  const handleSelectUser = useCallback(
    (user: User) => {
      if (selectedUsers.find((u) => u.uid === user.uid)) {
        // Deselect user
        setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
      } else {
        // Check if we can add more
        if (currentCount + selectedUsers.length >= GROUP_SIZE_LIMIT) {
          Alert.alert(
            'Limit Reached',
            `Groups are limited to ${GROUP_SIZE_LIMIT} members. You can add ${remainingSlots} more member(s).`
          );
          return;
        }
        // Select user
        setSelectedUsers([...selectedUsers, user]);
      }
    },
    [selectedUsers, currentCount, remainingSlots]
  );

  /**
   * Remove selected user
   */
  const handleRemoveUser = useCallback(
    (user: User) => {
      setSelectedUsers(selectedUsers.filter((u) => u.uid !== user.uid));
    },
    [selectedUsers]
  );

  /**
   * Handle adding participants
   */
  const handleAdd = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No Selection', 'Please select at least one user to add.');
      return;
    }

    try {
      setSaving(true);
      const newParticipantIds = selectedUsers.map((u) => u.uid);
      await onParticipantsAdded(newParticipantIds);
      Alert.alert('Success', `Added ${selectedUsers.length} member(s) to the group.`);
      onClose();
    } catch (error) {
      console.error('Error adding participants:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add participants. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Render user item
   */
  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUsers.some((u) => u.uid === item.uid);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
        disabled={!isSelected && !canAddMore}
      >
        <Avatar photoURL={item.photoURL || null} displayName={item.displayName} size={40} />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.displayName}</Text>
          {item.username && <Text style={styles.userUsername}>@{item.username}</Text>}
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={18} color="#FFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Members</Text>
          <TouchableOpacity
            onPress={handleAdd}
            disabled={selectedUsers.length === 0 || saving}
            style={styles.addButton}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text
                style={[
                  styles.addButtonText,
                  selectedUsers.length === 0 && styles.addButtonTextDisabled,
                ]}
              >
                Add
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Group Info */}
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{conversation.groupName}</Text>
          <Text style={styles.memberCount}>
            {currentCount} of {GROUP_SIZE_LIMIT} members • {remainingSlots} slots available
          </Text>
        </View>

        {/* Selected Users */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedContainer}>
            <Text style={styles.selectedLabel}>Selected ({selectedUsers.length})</Text>
            <View style={styles.chipsContainer}>
              {selectedUsers.map((user) => (
                <RecipientChip key={user.uid} user={user} onRemove={handleRemoveUser} index={0} />
              ))}
            </View>
          </View>
        )}

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="#8E8E93"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        {/* User List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#C7C7CC" />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'No users available to add'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.uid}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  cancelButton: {
    paddingVertical: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  addButton: {
    paddingVertical: 4,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  addButtonTextDisabled: {
    color: '#C7C7CC',
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
  memberCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  selectedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
  listContent: {
    paddingVertical: 8,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  userUsername: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
    textAlign: 'center',
  },
});
