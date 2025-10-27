/**
 * Unified New Conversation Screen
 *
 * @remarks
 * Single screen for creating both direct messages and group conversations.
 * Uses a tokenized recipient field that automatically adapts based on the
 * number of selected recipients.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { RecipientTokenField } from '@/components/conversation/RecipientTokenField';
import { UserSearchDropdown } from '@/components/conversation/UserSearchDropdown';
import { ContactPickerModal } from '@/components/conversation/ContactPickerModal';
import { GroupNameInput } from '@/components/conversation/GroupNameInput';
import { GroupPhotoUpload } from '@/components/conversation/GroupPhotoUpload';
import { useTheme } from '@/contexts/ThemeContext';
import { userCacheService } from '@/services/userCacheService';
import {
  createConversationWithFirstMessage,
  uploadGroupPhoto,
} from '@/services/conversationService';
import { useAuth } from '@/hooks/useAuth';
import {
  useConversationCreation,
  ConversationCreationProvider,
} from '@/contexts/ConversationCreationContext';
import type { User } from '@/types/user';

/**
 * Unified New Conversation Screen component
 *
 * @component
 *
 * @remarks
 * - Tokenized recipient field for selecting multiple users
 * - Automatic detection of direct vs group conversation
 * - Inline search with dropdown results
 * - Contact picker modal for browsing all contacts
 * - Conditional group name input
 * - Creates conversation atomically with first message
 *
 * @example
 * Route: /conversations/new
 */
function NewConversationScreenContent() {
  // Get current authenticated user
  const { user } = useAuth();
  const { theme } = useTheme();
  const currentUserId = user?.uid;

  // Use global conversation creation context
  const {
    recipients,
    setRecipients,
    addRecipient,
    searchQuery,
    setSearchQuery,
    groupName,
    setGroupName,
    messageText,
    setMessageText,
    isCreating,
    setIsCreating,
    resetState,
  } = useConversationCreation();

  // Local UI state (only for UI-specific concerns)
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, setIsPending] = useState(false); // Track debounce state
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupPhotoUri, setGroupPhotoUri] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Debounce timer ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if this is a group conversation
  const isGroupConversation = recipients.length >= 2;
  const conversationType = isGroupConversation ? 'group' : 'direct';

  /**
   * Handle search query changes with debouncing
   */
  const handleSearchQueryChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setError(null);

      // Clear previous timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }

      if (query.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        setIsPending(false); // Clear pending state
        return;
      }

      // Set pending state immediately (shows loading during debounce)
      setIsPending(true);

      // Debounce the actual search
      searchTimerRef.current = setTimeout(async () => {
        setIsPending(false); // Clear pending
        setIsSearching(true); // Start actual search

        try {
          // Use cached search for better performance
          const results = await userCacheService.searchUsers(query);
          // Filter out current user from results
          const filteredResults = results.filter((user) => user.uid !== currentUserId);
          setSearchResults(filteredResults);
        } catch (err) {
          console.error('Error searching users:', err);
          setError('Search failed. Please try again.');
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      }, 300); // 300ms debounce
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUserId]
  );

  /**
   * Handle selecting a user from search or contact picker
   */
  const handleSelectUser = useCallback(
    (user: User) => {
      // Check if already selected
      if (recipients.some((r) => r.uid === user.uid)) {
        return;
      }

      // Check max recipients (49 + creator = 50 total)
      if (recipients.length >= 49) {
        setError('Maximum 50 participants allowed (including you)');
        return;
      }

      // Add to recipients using context
      addRecipient(user);

      // Clear any pending search timer
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }

      // Clear search
      setSearchQuery('');
      setSearchResults([]);
      setIsSearching(false); // Ensure search indicator is cleared
      setError(null);
    },
    [recipients, addRecipient, setSearchQuery]
  );

  /**
   * Handle selecting multiple users from contact picker
   */
  const handleSelectMultipleUsers = useCallback(
    (users: User[]) => {
      // Filter out already selected and respect max limit
      const newRecipients = [...recipients];

      for (const user of users) {
        if (newRecipients.length >= 49) break; // 49 + creator = 50 total
        if (!newRecipients.some((r) => r.uid === user.uid)) {
          newRecipients.push(user);
        }
      }

      setRecipients(newRecipients);
      setShowContactPicker(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [recipients]
  );

  /**
   * Handle creating the conversation and navigating to chat
   */
  const handleCreateConversation = async () => {
    // Validation
    if (recipients.length === 0) {
      setError('Please add at least one recipient');
      return;
    }

    // For group conversations, validate minimum participants (3 total including creator)
    if (isGroupConversation && recipients.length < 2) {
      setError('Groups require at least 2 other participants (3 total including you)');
      return;
    }

    // Validate maximum participants (50 total)
    if (recipients.length > 49) {
      setError('Maximum 50 participants allowed (including you)');
      return;
    }

    if (!messageText.trim()) {
      setError('Please type a message to start the conversation');
      return;
    }

    if (isGroupConversation && !groupName.trim()) {
      setError('Please enter a group name');
      return;
    }

    if (!currentUserId) {
      setError('Please log in to start a conversation');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // Prepare participant IDs
      const participantIds = [currentUserId, ...recipients.map((r) => r.uid)];

      // Upload group photo if selected
      let groupPhotoURL: string | undefined;
      if (isGroupConversation && groupPhotoUri) {
        try {
          setIsUploadingPhoto(true);
          // Generate temporary group ID for photo upload
          const tempGroupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          groupPhotoURL = await uploadGroupPhoto(groupPhotoUri, tempGroupId);
        } catch (photoError) {
          console.error('Failed to upload group photo:', photoError);
          // Show alert to user about photo upload failure
          Alert.alert(
            'Photo Upload Failed',
            'Unable to upload the group photo. The group will be created without a photo. You can add one later in group settings.',
            [{ text: 'OK' }]
          );
          // Continue without photo if upload fails
        } finally {
          setIsUploadingPhoto(false);
        }
      }

      // Create conversation with first message
      const result = await createConversationWithFirstMessage({
        type: conversationType,
        participantIds,
        messageText: messageText.trim(),
        senderId: currentUserId,
        ...(isGroupConversation && { groupName: groupName.trim() }),
        ...(isGroupConversation && groupPhotoURL && { groupPhotoURL }),
      });

      // Clear all state before navigation using context
      resetState(); // Reset context state
      setSearchResults([]); // Clear local search results
      setIsSearching(false); // Clear local search state
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }

      // Navigate to the newly created conversation
      router.replace(`/(tabs)/conversations/${result.conversationId}`);
    } catch (err) {
      console.error('Error creating conversation:', err);
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  };

  /**
   * Handle typing the first message
   */
  const handleMessageChange = useCallback(
    (text: string) => {
      setMessageText(text);
      setError(null);
    },
    [setMessageText]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      // Reset all state when component unmounts
      resetState();
      setIsSearching(false);
      setIsPending(false);
      setSearchResults([]);
    };
  }, [resetState]);

  // Selected user IDs for filtering
  const selectedUserIds = recipients.map((r) => r.uid);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    messageLabel: {
      fontSize: theme.typography.fontSize.xs,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
    },
    messageInputContainer: {
      flex: 1,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      minHeight: 120,
    },
    messageInput: {
      fontSize: theme.typography.fontSize.base,
      color: theme.colors.textPrimary,
      lineHeight: 22,
    },
    messageHelp: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.sm,
      textAlign: 'center',
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
      fontSize: theme.typography.fontSize.base,
      marginTop: theme.spacing.md,
    },
  });

  return (
    <KeyboardAvoidingView
      style={dynamicStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
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
        rightAction={{
          label: isCreating ? 'Creating...' : 'Create',
          onPress: handleCreateConversation,
          disabled:
            isCreating ||
            recipients.length === 0 ||
            !messageText.trim() ||
            (isGroupConversation && !groupName.trim()),
        }}
      />

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Recipient Token Field */}
        <RecipientTokenField
          recipients={recipients}
          onRecipientsChange={setRecipients}
          onSearchQueryChange={handleSearchQueryChange}
          onAddPress={() => setShowContactPicker(true)}
          searchQuery={searchQuery}
          maxRecipients={49}
          placeholder="Search users..."
          isDisabled={isCreating}
          error={error || undefined}
          autoFocus={true}
          testID="recipient-field"
        />

        {/* Group Name Input (conditional) */}
        <GroupNameInput
          value={groupName}
          onChange={setGroupName}
          isVisible={isGroupConversation}
          maxLength={50}
          placeholder="Group name (required)"
          testID="group-name"
        />

        {/* Group Photo Upload (conditional) */}
        {isGroupConversation && (
          <GroupPhotoUpload
            photoUri={groupPhotoUri}
            onPhotoSelect={setGroupPhotoUri}
            onPhotoRemove={() => setGroupPhotoUri(null)}
            isDisabled={isCreating}
            isUploading={isUploadingPhoto}
            testID="group-photo"
          />
        )}

        {/* User Search Dropdown */}
        {searchQuery.trim().length >= 2 && (
          <UserSearchDropdown
            searchQuery={searchQuery}
            searchResults={searchResults}
            onUserSelect={handleSelectUser}
            selectedUserIds={selectedUserIds}
            isLoading={isSearching || isPending} // Show loading during debounce AND search
            maxHeight={200}
            testID="search-dropdown"
          />
        )}

        {/* Message Input Area */}
        <View style={styles.messageContainer}>
          <Text style={dynamicStyles.messageLabel}>FIRST MESSAGE</Text>
          <View style={dynamicStyles.messageInputContainer}>
            <TextInput
              style={dynamicStyles.messageInput}
              placeholder="Type your message..."
              placeholderTextColor={theme.colors.textTertiary}
              value={messageText}
              onChangeText={handleMessageChange}
              multiline={true}
              maxLength={1000}
              editable={!isCreating}
              textAlignVertical="top"
              testID="message-input"
            />
          </View>
          <Text style={dynamicStyles.messageHelp}>
            {recipients.length === 0
              ? 'Add recipients above, then type your first message'
              : isGroupConversation
                ? `Starting group chat with ${recipients.length} people`
                : `Starting chat with ${recipients[0].displayName}`}
          </Text>
        </View>
      </ScrollView>

      {/* Contact Picker Modal */}
      <ContactPickerModal
        isVisible={showContactPicker}
        onClose={() => setShowContactPicker(false)}
        onSelectUsers={handleSelectMultipleUsers}
        selectedUserIds={selectedUserIds}
        maxSelection={49 - recipients.length}
        testID="contact-picker"
      />

      {/* Creating Overlay */}
      {isCreating && (
        <View style={dynamicStyles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={dynamicStyles.loadingText}>Creating conversation...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  messageContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
});

/**
 * Wrapped component with ConversationCreationProvider
 * This ensures the context is only available for this screen
 */
export default function NewConversationScreen() {
  return (
    <ConversationCreationProvider>
      <NewConversationScreenContent />
    </ConversationCreationProvider>
  );
}
