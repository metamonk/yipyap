/**
 * Group Settings screen for managing group properties
 *
 * @remarks
 * Allows group admins to edit group name and photo.
 * Shows member list and admin controls.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { useGroupAdmin } from '@/hooks/useGroupAdmin';
import {
  getConversation,
  updateGroupSettings,
  leaveGroup,
  addParticipants,
  uploadGroupPhoto,
} from '@/services/conversationService';
import { getUserProfile } from '@/services/userService';
import { AddParticipantsModal } from '@/components/conversation/AddParticipantsModal';
import type { Conversation } from '@/types/models';
import type { User } from '@/types/user';

/**
 * Group Settings screen component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Edit group name (admin only)
 * - Upload/change group photo (admin only)
 * - Leave group functionality
 * - View and manage members (via separate component)
 *
 * Route: `/(tabs)/conversations/group-settings?id={conversationId}`
 */
export default function GroupSettingsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const conversationId = params.id;
  const { user } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);

  const isAdmin = useGroupAdmin(conversation);
  const isCreator = user && conversation && conversation.creatorId === user.uid;

  /**
   * Load conversation data
   */
  const loadConversation = useCallback(async () => {
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
      setGroupName(conv.groupName || '');
      setGroupPhotoURL(conv.groupPhotoURL || null);

      // Load creator profile if available
      if (conv.creatorId) {
        try {
          const creatorProfile = await getUserProfile(conv.creatorId);
          setCreator(creatorProfile);
        } catch (error) {
          console.error('Error loading creator profile:', error);
          // Non-critical error, continue without creator info
        }
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      Alert.alert('Error', 'Failed to load group settings');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    loadConversation();
  }, [loadConversation]);

  /**
   * Handle group name change
   */
  const handleGroupNameChange = (text: string) => {
    setGroupName(text);
    setHasChanges(true);
  };

  /**
   * Handle photo selection
   */
  const handleSelectPhoto = async () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can change group photo');
      return;
    }

    try {
      // Request media library permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSaving(true);
        try {
          // Upload to Firebase Storage
          const photoURL = await uploadGroupPhoto(result.assets[0].uri, conversationId);
          setGroupPhotoURL(photoURL);
          setHasChanges(true);
        } catch (uploadError) {
          console.error('Error uploading photo:', uploadError);
          Alert.alert(
            'Error',
            uploadError instanceof Error ? uploadError.message : 'Failed to upload photo'
          );
        } finally {
          setSaving(false);
        }
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  /**
   * Handle photo removal
   */
  const handleRemovePhoto = () => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can remove group photo');
      return;
    }

    Alert.alert('Remove Photo', 'Are you sure you want to remove the group photo?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setGroupPhotoURL(null);
          setHasChanges(true);
        },
      },
    ]);
  };

  /**
   * Save changes
   */
  const handleSave = async () => {
    if (!user || !conversation) return;

    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only admins can edit group settings');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Validation Error', 'Group name cannot be empty');
      return;
    }

    try {
      setSaving(true);

      await updateGroupSettings(
        conversationId,
        {
          groupName: groupName.trim(),
          groupPhotoURL,
        },
        user.uid
      );

      Alert.alert('Success', 'Group settings updated');
      setHasChanges(false);

      // Refresh conversation data
      await loadConversation();
    } catch (error) {
      console.error('Error saving group settings:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle leave group
   */
  const handleLeaveGroup = () => {
    if (!user) return;

    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? You will no longer receive messages.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(conversationId, user.uid);
              Alert.alert('Left Group', 'You have left the group');
              router.replace('/(tabs)/conversations');
            } catch (error) {
              console.error('Error leaving group:', error);
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to leave group'
              );
            }
          },
        },
      ]
    );
  };

  /**
   * Navigate to members management
   */
  const handleManageMembers = () => {
    router.push({
      pathname: '/(tabs)/conversations/group-members',
      params: { id: conversationId },
    });
  };

  /**
   * Handle adding participants
   */
  const handleAddParticipants = async (newParticipantIds: string[]) => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      await addParticipants(conversationId, newParticipantIds, user.uid);
      // Reload conversation to update participant count
      await loadConversation();
    } catch (error) {
      console.error('Error adding participants:', error);
      throw error;
    }
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
        <Text style={styles.headerTitle}>Group Settings</Text>
        {hasChanges && isAdmin && (
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
        {!hasChanges && <View style={styles.placeholder} />}
      </View>

      <ScrollView style={styles.content}>
        {/* Group Photo */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Photo</Text>
          <View style={styles.photoContainer}>
            {groupPhotoURL ? (
              <Image source={{ uri: groupPhotoURL }} style={styles.groupPhoto} />
            ) : (
              <View style={styles.placeholderPhoto}>
                <Ionicons name="people" size={50} color="#999" />
              </View>
            )}
            {isAdmin && (
              <View style={styles.photoButtons}>
                <TouchableOpacity onPress={handleSelectPhoto} style={styles.photoButton}>
                  <Ionicons name="camera" size={20} color="#007AFF" />
                  <Text style={styles.photoButtonText}>
                    {groupPhotoURL ? 'Change' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
                {groupPhotoURL && (
                  <TouchableOpacity onPress={handleRemovePhoto} style={styles.photoButton}>
                    <Ionicons name="trash" size={20} color="#FF3B30" />
                    <Text style={[styles.photoButtonText, styles.removeText]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Group Creator */}
        {creator && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Created By</Text>
            <View style={styles.creatorContainer}>
              {creator.photoURL ? (
                <Image source={{ uri: creator.photoURL }} style={styles.creatorPhoto} />
              ) : (
                <View style={styles.creatorPhotoPlaceholder}>
                  <Ionicons name="person" size={24} color="#999" />
                </View>
              )}
              <View style={styles.creatorInfo}>
                <Text style={styles.creatorName}>{creator.displayName}</Text>
                {creator.username && (
                  <Text style={styles.creatorUsername}>@{creator.username}</Text>
                )}
              </View>
              {isCreator && (
                <View style={styles.creatorBadge}>
                  <Text style={styles.creatorBadgeText}>You</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Group Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Group Name</Text>
          <TextInput
            style={[styles.input, !isAdmin && styles.inputDisabled]}
            value={groupName}
            onChangeText={handleGroupNameChange}
            placeholder="Enter group name"
            editable={isAdmin}
          />
          {!isAdmin && <Text style={styles.helperText}>Only admins can edit group name</Text>}
        </View>

        {/* Members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.memberCount}>{conversation.participantIds.length}</Text>
          </View>
          {isCreator && (
            <TouchableOpacity
              onPress={() => setShowAddParticipantsModal(true)}
              style={styles.addMembersButton}
            >
              <Ionicons name="person-add" size={20} color="#007AFF" />
              <Text style={styles.addMembersButtonText}>Add Members</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleManageMembers} style={styles.manageButton}>
            <Text style={styles.manageButtonText}>View & Manage Members</Text>
            <Ionicons name="chevron-forward" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity onPress={handleLeaveGroup} style={styles.leaveButton}>
            <Ionicons name="exit-outline" size={20} color="#FF3B30" />
            <Text style={styles.leaveButtonText}>Leave Group</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Participants Modal */}
      {conversation && (
        <AddParticipantsModal
          visible={showAddParticipantsModal}
          onClose={() => setShowAddParticipantsModal(false)}
          conversation={conversation}
          onParticipantsAdded={handleAddParticipants}
        />
      )}
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  memberCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  photoContainer: {
    alignItems: 'center',
  },
  groupPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  placeholderPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    gap: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  removeText: {
    color: '#FF3B30',
  },
  input: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: '#FFF',
  },
  inputDisabled: {
    backgroundColor: '#F8F9FA',
    color: '#8E8E93',
  },
  helperText: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 6,
  },
  addMembersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  addMembersButtonText: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
  manageButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  manageButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    gap: 8,
  },
  leaveButtonText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  creatorPhotoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatorInfo: {
    flex: 1,
  },
  creatorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  creatorUsername: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  creatorBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  creatorBadgeText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
});
