/**
 * RecipientChip Component
 *
 * @remarks
 * A chip/token component that displays a selected recipient with their avatar,
 * name, and a remove button. Used in the unified conversation creation flow.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/common/Avatar';
import type { User } from '@/types/user';

interface RecipientChipProps {
  user: User;
  onRemove: (user: User) => void;
  index: number;
  testID?: string;
}

/**
 * RecipientChip displays a selected user as a removable chip
 *
 * @component
 * @example
 * ```tsx
 * <RecipientChip
 *   user={selectedUser}
 *   onRemove={handleRemoveRecipient}
 *   index={0}
 * />
 * ```
 */
export const RecipientChip: React.FC<RecipientChipProps> = React.memo(
  ({ user, onRemove, index: _index, testID }) => {
    const [scaleAnim] = React.useState(() => new Animated.Value(0));
    const [opacityAnim] = React.useState(() => new Animated.Value(0));

    useEffect(() => {
      // Entry animation
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }, [scaleAnim, opacityAnim]);

    const handleRemove = () => {
      // Announce removal for accessibility
      AccessibilityInfo.announceForAccessibility(`Removed ${user.displayName} from recipients`);

      // Exit animation
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onRemove(user);
      });
    };

    // Truncate long names
    const displayName =
      user.displayName.length > 15 ? `${user.displayName.substring(0, 12)}...` : user.displayName;

    return (
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
        ]}
        testID={testID}
      >
        <View style={styles.chipContent}>
          <Avatar photoURL={user.photoURL || null} displayName={user.displayName} size={24} />
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          <TouchableOpacity
            onPress={handleRemove}
            style={styles.removeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Remove ${user.displayName}`}
            accessibilityRole="button"
            accessibilityHint="Double tap to remove this recipient"
            testID={`${testID}-remove`}
          >
            <Ionicons name="close-circle" size={18} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }
);

RecipientChip.displayName = 'RecipientChip';

const styles = StyleSheet.create({
  container: {
    marginRight: 4,
    marginBottom: 4,
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E5EA',
    borderRadius: 16,
    paddingLeft: 4,
    paddingRight: 4,
    paddingVertical: 4,
    minHeight: 32,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000000',
    marginLeft: 6,
    marginRight: 4,
    maxWidth: 120,
  },
  removeButton: {
    padding: 2,
  },
});
