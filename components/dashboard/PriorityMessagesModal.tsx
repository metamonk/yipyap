/**
 * PriorityMessagesModal - Full list of priority messages in a modal sheet
 *
 * @remarks
 * Displays all priority messages in a scrollable bottom sheet modal.
 * Used when user taps "View All" from the PriorityFeed preview widget.
 *
 * @example
 * ```tsx
 * <PriorityMessagesModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   userId={currentUser.id}
 *   onMessagePress={(id) => router.push(`/conversations/${id}`)}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { PriorityFeed } from './PriorityFeed';

/**
 * Props for PriorityMessagesModal component
 */
interface PriorityMessagesModalProps {
  /** Whether modal is visible */
  visible: boolean;

  /** Callback to close modal */
  onClose: () => void;

  /** User ID to fetch messages for */
  userId: string;

  /** Callback when a message is pressed */
  onMessagePress: (conversationId: string) => void;

  /** Optional count to display in header badge */
  messageCount?: number;
}

/**
 * PriorityMessagesModal Component
 */
export function PriorityMessagesModal({
  visible,
  onClose,
  userId,
  onMessagePress,
  messageCount,
}: PriorityMessagesModalProps) {
  const { theme } = useTheme();

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    modalContent: {
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    badge: {
      backgroundColor: theme.colors.accent,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContent, dynamicStyles.modalContent]}>
        {/* Header */}
        <View style={[styles.header, dynamicStyles.header]}>
          <View style={styles.dragHandle} />
          <View style={styles.headerContent}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, dynamicStyles.title]}>All Priority Messages</Text>
              {messageCount !== undefined && messageCount > 0 && (
                <View style={[styles.badge, dynamicStyles.badge]}>
                  <Text style={styles.badgeText}>{messageCount}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Full Priority Feed */}
        <View style={styles.feedContainer}>
          <PriorityFeed
            userId={userId}
            onMessagePress={onMessagePress}
            previewMode={false}
            maxResults={100}
          />
        </View>
      </View>
    </Modal>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  modalContent: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingBottom: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  feedContainer: {
    flex: 1,
  },
});
