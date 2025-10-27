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
  Switch,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useGroupAdmin } from '@/hooks/useGroupAdmin';
import {
  getConversation,
  updateGroupSettings,
  updateConversationAutoResponse,
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
  const { theme } = useTheme();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [creator, setCreator] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPhotoURL, setGroupPhotoURL] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false);
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(true);
  const [isTogglingAutoResponse, setIsTogglingAutoResponse] = useState(false);

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
      setAutoResponseEnabled(conv.autoResponseEnabled !== false); // Default to true if undefined

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

  /**
   * Handle toggling FAQ auto-response setting
   */
  const handleToggleAutoResponse = async (enabled: boolean) => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to change settings');
      return;
    }

    if (!isCreator) {
      Alert.alert('Permission Denied', 'Only the group creator can change auto-response settings');
      return;
    }

    // Show confirmation dialog when disabling auto-response (AC: 13.5)
    if (!enabled) {
      Alert.alert(
        'Disable Auto-Response',
        'FAQ auto-responses will no longer be sent in this group. You can re-enable this anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: () => performToggle(enabled),
          },
        ]
      );
    } else {
      // No confirmation needed when enabling
      await performToggle(enabled);
    }
  };

  /**
   * Perform the actual toggle operation
   */
  const performToggle = async (enabled: boolean) => {
    if (!user) return;

    try {
      setIsTogglingAutoResponse(true);
      await updateConversationAutoResponse(conversationId, enabled, user.uid);
      setAutoResponseEnabled(enabled);
      Alert.alert(
        'Success',
        enabled
          ? 'FAQ auto-responses are now enabled for this group'
          : 'FAQ auto-responses have been disabled for this group'
      );
    } catch (error) {
      console.error('Error toggling auto-response:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update settings');
      // Revert the switch to previous state
      setAutoResponseEnabled(!enabled);
    } finally {
      setIsTogglingAutoResponse(false);
    }
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
      flex: 1,
      textAlign: 'center',
    },
    saveButtonText: {
      color: theme.colors.accent,
      fontSize: 17,
      fontWeight: '600',
    },
    section: {
      backgroundColor: theme.colors.surface,
      marginBottom: StyleSheet.hairlineWidth,
      paddingHorizontal: 20,
      paddingVertical: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 16,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    memberCount: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.textSecondary,
    },
    placeholderPhoto: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    photoButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.base,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.backgroundSecondary,
      gap: theme.spacing.sm,
    },
    photoButtonText: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.accent,
      fontWeight: theme.typography.fontWeight.medium,
    },
    removeText: {
      color: theme.colors.error,
    },
    input: {
      fontSize: 17,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.borderLight,
      borderRadius: 12,
      backgroundColor: theme.colors.backgroundSecondary,
      color: theme.colors.textPrimary,
    },
    inputDisabled: {
      backgroundColor: theme.colors.backgroundSecondary,
      color: theme.colors.textTertiary,
      opacity: 0.6,
    },
    helperText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginTop: 8,
      lineHeight: 18,
    },
    addMembersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.accent,
      borderRadius: 12,
      marginBottom: 12,
      gap: 8,
    },
    addMembersButtonText: {
      fontSize: 17,
      color: '#FFF',
      fontWeight: '600',
    },
    manageButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.backgroundSecondary,
      borderRadius: 12,
    },
    manageButtonText: {
      fontSize: 17,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    leaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      backgroundColor: theme.colors.surface,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.error,
      gap: 8,
    },
    leaveButtonText: {
      fontSize: 17,
      color: theme.colors.error,
      fontWeight: '600',
    },
    creatorPhotoPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.backgroundSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    creatorName: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    creatorUsername: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
    creatorBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    creatorBadgeText: {
      fontSize: 12,
      color: '#FFF',
      fontWeight: '600',
    },
    settingDescription: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginTop: 4,
    },
    settingTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
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
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.colors.accent} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Group Settings</Text>
        {hasChanges && isAdmin && (
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <Text style={dynamicStyles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
        {!hasChanges && <View style={styles.placeholder} />}
      </View>

      <ScrollView style={styles.content}>
        {/* Group Photo */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Group Photo</Text>
          <View style={styles.photoContainer}>
            {groupPhotoURL ? (
              <Image source={{ uri: groupPhotoURL }} style={styles.groupPhoto} />
            ) : (
              <View style={dynamicStyles.placeholderPhoto}>
                <Ionicons name="people" size={50} color={theme.colors.textSecondary} />
              </View>
            )}
            {isAdmin && (
              <View style={styles.photoButtons}>
                <TouchableOpacity onPress={handleSelectPhoto} style={dynamicStyles.photoButton}>
                  <Ionicons name="camera" size={20} color={theme.colors.accent} />
                  <Text style={dynamicStyles.photoButtonText}>
                    {groupPhotoURL ? 'Change' : 'Add Photo'}
                  </Text>
                </TouchableOpacity>
                {groupPhotoURL && (
                  <TouchableOpacity onPress={handleRemovePhoto} style={dynamicStyles.photoButton}>
                    <Ionicons name="trash" size={20} color={theme.colors.error} />
                    <Text style={[dynamicStyles.photoButtonText, dynamicStyles.removeText]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Group Creator */}
        {creator && (
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>Created By</Text>
            <View style={styles.creatorContainer}>
              {creator.photoURL ? (
                <Image source={{ uri: creator.photoURL }} style={styles.creatorPhoto} />
              ) : (
                <View style={dynamicStyles.creatorPhotoPlaceholder}>
                  <Ionicons name="person" size={24} color={theme.colors.textSecondary} />
                </View>
              )}
              <View style={styles.creatorInfo}>
                <Text style={dynamicStyles.creatorName}>{creator.displayName}</Text>
                {creator.username && (
                  <Text style={dynamicStyles.creatorUsername}>@{creator.username}</Text>
                )}
              </View>
              {isCreator && (
                <View style={dynamicStyles.creatorBadge}>
                  <Text style={dynamicStyles.creatorBadgeText}>You</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Group Name */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>Group Name</Text>
          <TextInput
            style={[dynamicStyles.input, !isAdmin && dynamicStyles.inputDisabled]}
            value={groupName}
            onChangeText={handleGroupNameChange}
            placeholder="Enter group name"
            placeholderTextColor={theme.colors.textTertiary}
            editable={isAdmin}
          />
          {!isAdmin && <Text style={dynamicStyles.helperText}>Only admins can edit group name</Text>}
        </View>

        {/* FAQ Auto-Response Settings (Story 5.4 - Task 13) */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>FAQ Auto-Response</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingHeader}>
                <Ionicons name="chatbubbles" size={24} color={theme.colors.accent} style={styles.settingIcon} />
                <Text style={dynamicStyles.settingTitle}>Auto-respond to FAQs</Text>
              </View>
              <Text style={dynamicStyles.settingDescription}>
                Automatically respond to frequently asked questions with saved templates
              </Text>
            </View>
            <Switch
              value={autoResponseEnabled}
              onValueChange={handleToggleAutoResponse}
              disabled={!isCreator || isTogglingAutoResponse}
              trackColor={{ false: theme.colors.borderLight, true: theme.colors.success || '#34C759' }}
              thumbColor={autoResponseEnabled ? '#FFF' : '#F4F3F4'}
              ios_backgroundColor={theme.colors.borderLight}
            />
          </View>
          {!isCreator && (
            <Text style={dynamicStyles.helperText}>Only the group creator can change this setting</Text>
          )}
        </View>

        {/* Members */}
        <View style={dynamicStyles.section}>
          <View style={styles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>Members</Text>
            <Text style={dynamicStyles.memberCount}>{conversation.participantIds.length}</Text>
          </View>
          {isCreator && (
            <TouchableOpacity
              onPress={() => setShowAddParticipantsModal(true)}
              style={dynamicStyles.addMembersButton}
            >
              <Ionicons name="person-add" size={20} color="#FFF" />
              <Text style={dynamicStyles.addMembersButtonText}>Add Members</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleManageMembers} style={dynamicStyles.manageButton}>
            <Text style={dynamicStyles.manageButtonText}>View & Manage Members</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>

        {/* Actions */}
        <View style={dynamicStyles.section}>
          <TouchableOpacity onPress={handleLeaveGroup} style={dynamicStyles.leaveButton}>
            <Ionicons name="exit-outline" size={20} color={theme.colors.error} />
            <Text style={dynamicStyles.leaveButtonText}>Leave Group</Text>
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

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  backButton: {
    padding: 4,
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  placeholder: {
    width: 60,
  },
  content: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoContainer: {
    alignItems: 'center',
  },
  groupPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 16,
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
  creatorInfo: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  settingIcon: {
    marginRight: 12,
  },
});
