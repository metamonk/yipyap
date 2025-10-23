/**
 * List item component for displaying group participants with remove functionality
 *
 * @remarks
 * Displays participant information with a remove button (visible only to group creator).
 * Includes confirmation dialog before removing a participant from the group.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import { PresenceIndicator } from '@/components/PresenceIndicator';
import type { User } from '@/types/user';

/**
 * Props for ParticipantListItem component
 */
export interface ParticipantListItemProps {
  /** The participant user to display */
  participant: User;

  /** Whether the current user is the group creator */
  isCreator: boolean;

  /** Whether this participant is the group creator */
  isParticipantCreator: boolean;

  /** Whether this participant is the current user */
  isCurrentUser: boolean;

  /** Callback when remove button is pressed */
  onRemove: (userId: string) => Promise<void>;

  /** Whether a remove operation is in progress */
  removing?: boolean;
}

/**
 * List item component for group participants
 *
 * @component
 * @example
 * ```tsx
 * <ParticipantListItem
 *   participant={user}
 *   isCreator={true}
 *   isParticipantCreator={false}
 *   isCurrentUser={false}
 *   onRemove={handleRemoveParticipant}
 * />
 * ```
 */
export const ParticipantListItem: React.FC<ParticipantListItemProps> = ({
  participant,
  isCreator,
  isParticipantCreator,
  isCurrentUser,
  onRemove,
  removing = false,
}) => {
  /**
   * Handle remove button press with confirmation
   */
  const handleRemove = () => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${participant.displayName} from this group?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await onRemove(participant.uid);
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert(
                'Error',
                error instanceof Error
                  ? error.message
                  : 'Failed to remove participant. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  // Determine if remove button should be shown
  const canRemove = isCreator && !isParticipantCreator && !isCurrentUser;

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Avatar
          photoURL={participant.photoURL || null}
          displayName={participant.displayName}
          size={40}
        />
        <View style={styles.presenceIndicator}>
          <PresenceIndicator userId={participant.uid} size="small" hideWhenOffline={false} />
        </View>
      </View>
      <View style={styles.info}>
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{participant.displayName}</Text>
          {isParticipantCreator && (
            <View style={styles.creatorBadge}>
              <Text style={styles.creatorBadgeText}>Creator</Text>
            </View>
          )}
          {isCurrentUser && !isParticipantCreator && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>You</Text>
            </View>
          )}
        </View>
        {participant.username && <Text style={styles.username}>@{participant.username}</Text>}
      </View>
      {canRemove && (
        <TouchableOpacity
          onPress={handleRemove}
          disabled={removing}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${participant.displayName}`}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={24} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  avatarContainer: {
    position: 'relative',
  },
  presenceIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  creatorBadge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  creatorBadgeText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  youBadge: {
    backgroundColor: '#8E8E93',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  youBadgeText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
});
