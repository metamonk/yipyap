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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();

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

  // Dynamic styles based on theme (Robinhood minimal aesthetic)
  const dynamicStyles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderLight,
    },
    name: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    creatorBadge: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    creatorBadgeText: {
      fontSize: 12,
      color: '#FFF',
      fontWeight: '600',
    },
    youBadge: {
      backgroundColor: theme.colors.textSecondary,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    youBadgeText: {
      fontSize: 12,
      color: '#FFF',
      fontWeight: '600',
    },
    username: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      marginTop: 2,
    },
  });

  return (
    <View style={dynamicStyles.container}>
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
          <Text style={dynamicStyles.name}>{participant.displayName}</Text>
          {isParticipantCreator && (
            <View style={dynamicStyles.creatorBadge}>
              <Text style={dynamicStyles.creatorBadgeText}>Creator</Text>
            </View>
          )}
          {isCurrentUser && !isParticipantCreator && (
            <View style={dynamicStyles.youBadge}>
              <Text style={dynamicStyles.youBadgeText}>You</Text>
            </View>
          )}
        </View>
        {participant.username && <Text style={dynamicStyles.username}>@{participant.username}</Text>}
      </View>
      {canRemove && (
        <TouchableOpacity
          onPress={handleRemove}
          disabled={removing}
          style={styles.removeButton}
          accessibilityLabel={`Remove ${participant.displayName}`}
          accessibilityRole="button"
        >
          <Ionicons name="close-circle" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
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
  removeButton: {
    padding: 8,
  },
});
