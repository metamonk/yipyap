/**
 * UserSearchDropdown Component
 *
 * @remarks
 * An inline dropdown that displays search results below the recipient field.
 * Shows user avatars, names, usernames, and online status.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Avatar } from '@/components/common/Avatar';
import type { User } from '@/types/user';

interface UserSearchDropdownProps {
  searchQuery: string;
  searchResults: User[];
  onUserSelect: (user: User) => void;
  selectedUserIds: string[];
  isLoading?: boolean;
  maxHeight?: number;
  testID?: string;
}

/**
 * UserSearchDropdown displays search results in an inline dropdown
 *
 * @component
 * @example
 * ```tsx
 * <UserSearchDropdown
 *   searchQuery={query}
 *   searchResults={results}
 *   onUserSelect={handleSelectUser}
 *   selectedUserIds={selectedIds}
 *   isLoading={searching}
 * />
 * ```
 */
export const UserSearchDropdown: React.FC<UserSearchDropdownProps> = ({
  searchQuery,
  searchResults,
  onUserSelect,
  selectedUserIds,
  isLoading = false,
  maxHeight = 200,
  testID,
}) => {
  // Filter out already selected users
  const availableResults = useMemo(() => {
    return searchResults.filter(user => !selectedUserIds.includes(user.uid));
  }, [searchResults, selectedUserIds]);

  const renderUserItem = useCallback(({ item }: { item: User }) => {
    const isSelected = selectedUserIds.includes(item.uid);
    const isOnline = item.presence?.status === 'online';

    return (
      <TouchableOpacity
        style={[styles.userItem, isSelected && styles.userItemSelected]}
        onPress={() => !isSelected && onUserSelect(item)}
        disabled={isSelected}
        accessibilityLabel={`${item.displayName}, ${isOnline ? 'online' : 'offline'}${
          isSelected ? ', already selected' : ''
        }`}
        accessibilityRole="button"
        testID={`${testID}-item-${item.uid}`}
      >
        <Avatar
          photoURL={item.photoURL || null}
          displayName={item.displayName}
          size={40}
        />

        <View style={styles.userInfo}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.displayName, isSelected && styles.textSelected]}
              numberOfLines={1}
            >
              {item.displayName}
            </Text>
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <Text
            style={[styles.username, isSelected && styles.textSelected]}
            numberOfLines={1}
          >
            @{item.username}
          </Text>
        </View>

        {isSelected && (
          <Text style={styles.selectedBadge}>Selected</Text>
        )}
      </TouchableOpacity>
    );
  }, [selectedUserIds, onUserSelect, testID]);

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Searching users...</Text>
        </View>
      );
    }

    if (searchQuery.trim().length < 2) {
      return null;
    }

    if (availableResults.length === 0 && searchResults.length > 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>All matching users already selected</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No users found</Text>
        <Text style={styles.emptySubtext}>
          Try a different name or username
        </Text>
      </View>
    );
  };

  // Don't show dropdown if query is too short (even if loading)
  if (searchQuery.trim().length < 2) {
    // If still showing loading for empty query, hide it
    return null;
  }

  // Don't show if no results and not loading
  if (!isLoading && availableResults.length === 0 && searchResults.length === 0) {
    return renderEmpty();
  }

  return (
    <View
      style={[
        styles.container,
        { maxHeight },
        Platform.OS === 'ios' && styles.containerIOS,
      ]}
      testID={testID}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
        contentContainerStyle={
          availableResults.length === 0 ? styles.emptyListContent : undefined
        }
        accessibilityLabel={`Search results, ${availableResults.length} users found`}
      >
        {availableResults.length === 0 ? (
          renderEmpty()
        ) : (
          availableResults.map((item, index) => (
            <React.Fragment key={item.uid}>
              {renderUserItem({ item })}
              {index < availableResults.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: -4,
    overflow: 'hidden',
  },
  containerIOS: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  userItemSelected: {
    backgroundColor: '#F2F2F7',
    opacity: 0.7,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  textSelected: {
    color: '#8E8E93',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginLeft: 6,
  },
  selectedBadge: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 10,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
  },
  centerContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});