/**
 * Group chat creation screen
 * @module app/(tabs)/conversations/new-group
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NavigationHeader } from '@/app/_components/NavigationHeader';
import { UserSelectList } from '@/components/conversation/UserSelectList';
import { GroupMemberCounter } from '@/components/groups/GroupMemberCounter';
import { GroupSizeError } from '@/components/groups/GroupSizeError';
import { getFirebaseDb } from '@/services/firebase';
import { collection, doc } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { useGroupValidation } from '@/hooks/useGroupValidation';
import { MAX_SELECTABLE_MEMBERS } from '@/constants/groupLimits';
import type { User } from '@/types/models';

/**
 * Screen for creating a new group conversation
 * @remarks
 * Allows users to:
 * - Enter a group name
 * - Select multiple participants (up to 10 total including creator)
 * - Create the group conversation
 * - View real-time validation feedback for group size limits
 * - Receive warnings when approaching the 10-member limit
 */
export default function NewGroupScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);
  const [showError, setShowError] = useState(false);

  // Calculate total member count (selected users + current user)
  const memberCount = selectedUsers.length + 1;

  // Validate group size in real-time
  const { validationState } = useGroupValidation(memberCount);

  const handleCreateGroup = async () => {
    // Validation: Group name
    if (!groupName.trim()) {
      Alert.alert('Group Name Required', 'Please enter a name for the group.');
      return;
    }

    // Validation: Minimum members (at least 2 other users + current user = 3 total)
    if (selectedUsers.length < 2) {
      Alert.alert(
        'More Participants Required',
        'Please select at least 2 other users for a group chat.'
      );
      return;
    }

    // Validation: Group size limit
    if (!validationState.isValid) {
      setShowError(true);
      Alert.alert('Group Size Limit Exceeded', validationState.errorMessage || '');
      return;
    }

    // Validation: Authentication
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to create a group.');
      return;
    }

    try {
      setCreating(true);

      // Create participant IDs array (including current user)
      const participantIds = [currentUser.uid, ...selectedUsers.map((u) => u.uid)];

      // Generate a conversation ID for navigation (group will be created on first message send)
      const db = getFirebaseDb();
      const conversationId = doc(collection(db, 'conversations')).id;

      // Navigate to chat screen in draft mode (conversation created on first message send)
      router.push({
        pathname: `/(tabs)/conversations/${conversationId}`,
        params: {
          isDraft: 'true',
          type: 'group',
          groupName: groupName.trim(),
          participantIds: participantIds.join(','), // Pass as comma-separated string
        },
      } as never);
    } catch (error) {
      console.error('Failed to navigate to group chat:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Custom Navigation Header */}
      <NavigationHeader
        title="New Group"
        variant="modal"
        leftAction={{
          label: 'Cancel',
          onPress: () => router.back(),
        }}
        rightAction={{
          label: creating ? 'Creating...' : 'Create',
          onPress: handleCreateGroup,
          disabled:
            creating ||
            selectedUsers.length < 2 ||
            !groupName.trim() ||
            !validationState.canSubmit,
        }}
      />

      <View style={styles.contentContainer}>
        {/* Group Name Input */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="people" size={24} color="#8E8E93" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter group name..."
              value={groupName}
              onChangeText={setGroupName}
              maxLength={50}
              autoFocus
            />
          </View>
        </View>

        {/* Participants Section with Counter */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>Add Participants</Text>
          <GroupMemberCounter
            count={memberCount}
            severity={validationState.severity}
            showProgressBar={true}
            testID="new-group-member-counter"
          />
          <Text style={styles.sectionSubtitle}>Select at least 2 people to create a group</Text>
        </View>

        {/* Error/Warning Messages */}
        {showError && validationState.errorMessage && (
          <GroupSizeError
            message={validationState.errorMessage}
            severity="error"
            suggestion="Remove some members to continue"
            dismissible={true}
            onDismiss={() => setShowError(false)}
            testID="new-group-error"
          />
        )}
        {validationState.warningMessage && (
          <GroupSizeError
            message={validationState.warningMessage}
            severity="warning"
            dismissible={false}
            testID="new-group-warning"
          />
        )}

        {/* User Selection List */}
        <View style={styles.userListContainer}>
          <UserSelectList
            onSelectionChange={setSelectedUsers}
            maxSelection={MAX_SELECTABLE_MEMBERS}
            showOnlineStatus={true}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    flex: 1,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  participantsSection: {
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 4,
  },
  userListContainer: {
    flex: 1,
  },
});
