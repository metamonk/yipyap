/**
 * CompositeAvatar Component
 *
 * @remarks
 * Displays multiple user avatars for group conversations.
 * Fixes the issue where group chats show only a single avatar instead of a composite.
 * Part of the unified conversation refactor recovery.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Avatar } from './Avatar';

interface Participant {
  photoURL?: string | null;
  displayName: string;
}

interface CompositeAvatarProps {
  participants: Participant[];
  size?: number;
  maxDisplay?: number;
}

/**
 * CompositeAvatar displays multiple user avatars in an overlapping layout
 *
 * @component
 * @example
 * ```tsx
 * <CompositeAvatar
 *   participants={groupParticipants}
 *   size={48}
 *   maxDisplay={3}
 * />
 * ```
 */
export const CompositeAvatar: React.FC<CompositeAvatarProps> = memo(({
  participants,
  size = 48,
  maxDisplay = 3,
}) => {
  const displayParticipants = participants.slice(0, maxDisplay);
  const avatarSize = size * 0.6; // Smaller individual avatars
  const overlap = avatarSize * 0.3; // 30% overlap

  if (participants.length === 0) {
    return <Avatar photoURL={null} displayName="Group" size={size} />;
  }

  if (participants.length === 1) {
    return (
      <Avatar
        photoURL={participants[0].photoURL || null}
        displayName={participants[0].displayName}
        size={size}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {displayParticipants.map((participant, index) => (
        <View
          key={index}
          style={[
            styles.avatarWrapper,
            {
              position: 'absolute',
              left: index * (avatarSize - overlap),
              top: index % 2 === 0 ? 0 : avatarSize * 0.2,
              zIndex: maxDisplay - index,
            },
          ]}
        >
          <Avatar
            photoURL={participant.photoURL || null}
            displayName={participant.displayName}
            size={avatarSize}
          />
        </View>
      ))}
    </View>
  );
});

CompositeAvatar.displayName = 'CompositeAvatar';

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarWrapper: {
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
});