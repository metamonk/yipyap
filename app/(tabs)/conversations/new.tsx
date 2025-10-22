/**
 * New Conversation Screen
 *
 * @remarks
 * Screen for searching users and starting new conversations.
 * Includes user search by username and display name.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { searchUsers } from '@/services/userService';
import {
  generateConversationId,
  checkConversationExists,
  createConversation,
} from '@/services/conversationService';
import { Avatar } from '@/components/common/Avatar';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/user';

/**
 * New Conversation Screen component
 *
 * @component
 *
 * @remarks
 * - Search input for username/display name
 * - Real-time search results
 * - User selection creates or opens existing 1:1 conversation
 * - Navigation to chat screen after selection
 *
 * @example
 * Route: /conversations/new
 */
export default function NewConversationScreen() {
  // Get current authenticated user
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingConversation, setCreatingConversation] = useState(false);

  /**
   * Handle search query change with debouncing
   */
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setError(null);

    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    try {
      const results = await searchUsers(query);
      // Filter out current user from results
      const filteredResults = results.filter((user) => user.uid !== currentUserId);
      setSearchResults(filteredResults);
    } catch (err) {
      console.error('Error searching users:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  /**
   * Handle user selection - create or open conversation
   */
  const handleUserSelect = async (selectedUser: User) => {
    if (!currentUserId) {
      setError('Please log in to start a conversation');
      return;
    }

    setCreatingConversation(true);
    setError(null);

    try {
      // Generate deterministic conversation ID for 1:1 chat
      const conversationId = generateConversationId([currentUserId, selectedUser.uid]);

      // Check if conversation already exists
      const exists = await checkConversationExists(conversationId);

      if (!exists) {
        // Create new conversation
        await createConversation({
          type: 'direct',
          participantIds: [currentUserId, selectedUser.uid],
        });
      }

      // Navigate to chat screen
      router.push(`/(tabs)/conversations/${conversationId}`);
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  /**
   * Render a single user search result
   */
  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleUserSelect(item)}
      disabled={creatingConversation}
    >
      <Avatar photoURL={item.photoURL || null} displayName={item.displayName} size={48} />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        <Text style={styles.username}>@{item.username}</Text>
      </View>
    </TouchableOpacity>
  );

  /**
   * Render empty state
   */
  const renderEmptyState = () => {
    if (searching) {
      return null;
    }

    if (searchQuery.trim().length < 2) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Search for users by username or name</Text>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try searching with a different username or name</Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="New Message"
        variant="modal"
        leftAction={{
          label: 'Cancel',
          onPress: () => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)/conversations');
            }
          },
        }}
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={true}
          returnKeyType="search"
        />
        {searching && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.searchSpinner} />
        )}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Search Results */}
      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.uid}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={searchResults.length === 0 && styles.emptyListContent}
      />

      {/* Creating Conversation Overlay */}
      {creatingConversation && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Starting conversation...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#000000',
  },
  searchSpinner: {
    marginLeft: 8,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    textAlign: 'center',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    marginTop: 8,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 12,
  },
});
