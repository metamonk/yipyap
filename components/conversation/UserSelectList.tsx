/**
 * User selection list for group chat creation
 * @module components/conversation/UserSelectList
 */

import React, { FC, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import { OnlineIndicator } from '@/components/common/OnlineIndicator';
import { getAllUsers } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/user';

/**
 * Props for UserSelectList component
 */
export interface UserSelectListProps {
  /** Callback when users are selected */
  onSelectionChange: (selectedUsers: User[]) => void;
  /** Maximum number of users that can be selected (default: 9) */
  maxSelection?: number;
  /** Whether to show online status indicators */
  showOnlineStatus?: boolean;
  /** Optional group name for context (used in new group screen) */
  groupName?: string;
}

/**
 * Displays a searchable list of users for group chat creation
 * @component
 * @example
 * ```tsx
 * <UserSelectList
 *   onSelectionChange={(users) => setSelectedUsers(users)}
 *   maxSelection={9}
 *   showOnlineStatus={true}
 * />
 * ```
 */
export const UserSelectList: FC<UserSelectListProps> = ({
  onSelectionChange,
  maxSelection = 9,
  showOnlineStatus = true,
  groupName: _groupName,
}) => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Filter users based on search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = users.filter(
        (user) =>
          user.displayName.toLowerCase().includes(query) ||
          user.username.toLowerCase().includes(query)
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  // Notify parent of selection changes
  useEffect(() => {
    const selectedUsers = users.filter((user) => selectedUserIds.has(user.uid));
    onSelectionChange(selectedUsers);
  }, [selectedUserIds, users, onSelectionChange]);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const allUsers = await getAllUsers();
      // Exclude current user from list
      const otherUsers = allUsers.filter((u) => u.uid !== currentUser?.uid);
      setUsers(otherUsers);
      setFilteredUsers(otherUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUserIds);

    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      if (newSelection.size >= maxSelection) {
        Alert.alert(
          'Maximum Selection',
          `You can only select up to ${maxSelection} users for a group chat.`
        );
        return;
      }
      newSelection.add(userId);
    }

    setSelectedUserIds(newSelection);
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUserIds.has(item.uid);
    const isOnline = item.presence?.status === 'online';

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => toggleUserSelection(item.uid)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <Avatar photoURL={item.photoURL || null} displayName={item.displayName} size={40} />
          {showOnlineStatus && (
            <OnlineIndicator isOnline={isOnline} size={10} style={styles.onlineIndicator} />
          )}
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>

        <View style={styles.checkboxContainer}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
          ) : (
            <Ionicons name="ellipse-outline" size={24} color="#C7C7CC" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const ListHeader = () => (
    <>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
    </>
  );

  return (
    <FlatList
      style={styles.container}
      data={filteredUsers}
      keyExtractor={(item) => item.uid}
      renderItem={renderUserItem}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={ListHeader}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          {searchQuery ? 'No users found' : 'No users available'}
        </Text>
      }
      keyboardShouldPersistTaps="handled"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  selectionCounter: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  counterText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  listContent: {
    paddingBottom: 20,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  userItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  checkboxContainer: {
    marginLeft: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
    color: '#8E8E93',
  },
});
