/**
 * ReadReceiptModal component for displaying read receipt details
 *
 * @remarks
 * Shows detailed read receipt information for group chat messages:
 * - "Read by" section: Participants who have read the message with timestamps
 * - "Delivered to" section: Participants who haven't read the message yet
 *
 * Uses batch fetching of participant profiles for efficiency.
 */

import React, { FC, useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { getUserProfiles } from '@/services/userService';
import type { Message, User } from '@/types/models';

/**
 * Props for the ReadReceiptModal component
 */
export interface ReadReceiptModalProps {
  /** Whether the modal is visible */
  visible: boolean;

  /** Callback when modal should close */
  onClose: () => void;

  /** The message to show read receipts for */
  message: Message;

  /** All participant IDs in the conversation (to show delivered list) */
  participantIds: string[];
}

/**
 * Participant with read status and profile info
 */
interface ParticipantWithStatus {
  /** User ID */
  uid: string;

  /** Display name */
  displayName: string;

  /** Profile photo URL */
  photoURL?: string;

  /** Whether user has read the message */
  hasRead: boolean;
}

/**
 * Displays detailed read receipt information in a modal
 *
 * @component
 *
 * @remarks
 * - Fetches participant profiles in batch when modal opens
 * - Separates participants into "Read by" and "Delivered to" sections
 * - Shows timestamps for read receipts
 * - Handles loading state and errors gracefully
 * - Respects read receipt privacy (users who disabled read receipts won't appear in "Read by")
 *
 * @example
 * ```tsx
 * <ReadReceiptModal
 *   visible={isModalVisible}
 *   onClose={() => setIsModalVisible(false)}
 *   message={messageData}
 *   participantIds={['user1', 'user2', 'user3']}
 * />
 * ```
 */
export const ReadReceiptModal: FC<ReadReceiptModalProps> = ({
  visible,
  onClose,
  message,
  participantIds,
}) => {
  const { theme } = useTheme();
  const [participants, setParticipants] = useState<ParticipantWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetches participant profiles and combines with read status
   */
  const loadParticipants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all participant profiles in batch
      const profiles = await getUserProfiles(participantIds);

      // Create map for fast lookup
      const profileMap = new Map<string, User>(profiles.map((p) => [p.uid, p]));

      // Combine profiles with read status
      const participantsWithStatus: ParticipantWithStatus[] = participantIds.map((uid) => {
        const profile = profileMap.get(uid);
        const hasRead = message.readBy.includes(uid);

        return {
          uid,
          displayName: profile?.displayName || 'Unknown User',
          photoURL: profile?.photoURL,
          hasRead,
        };
      });

      setParticipants(participantsWithStatus);
    } catch (err) {
      console.error('Error loading participants:', err);
      setError('Failed to load participant information');
    } finally {
      setLoading(false);
    }
  }, [participantIds, message.readBy, message.timestamp]);

  // Load participants when modal opens
  useEffect(() => {
    if (visible) {
      loadParticipants();
    }
  }, [visible, loadParticipants]);

  // Separate participants into read and unread
  const readParticipants = participants.filter((p) => p.hasRead);
  const unreadParticipants = participants.filter((p) => !p.hasRead);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    modalContainer: {
      backgroundColor: theme.colors.background,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
    },
    header: {
      borderBottomColor: theme.colors.borderLight,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
    },
    participantName: {
      color: theme.colors.textPrimary,
    },
    loadingText: {
      color: theme.colors.textSecondary,
    },
    errorText: {
      color: theme.colors.error,
    },
    retryButton: {
      backgroundColor: theme.colors.accent,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Renders a single participant item
   */
  const renderParticipant = ({ item }: { item: ParticipantWithStatus }) => (
    <View style={styles.participantItem}>
      <Avatar photoURL={item.photoURL || null} displayName={item.displayName} size={40} />
      <View style={styles.participantInfo}>
        <Text style={[styles.participantName, dynamicStyles.participantName]}>{item.displayName}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, dynamicStyles.modalContainer]}>
        <View style={[styles.modalContent, dynamicStyles.modalContent]}>
          {/* Header */}
          <View style={[styles.header, dynamicStyles.header]}>
            <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Read Receipts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
              <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading participants...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
              <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
              <TouchableOpacity onPress={loadParticipants} style={[styles.retryButton, dynamicStyles.retryButton]}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.scrollView}>
              {/* Read by section */}
              {readParticipants.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>READ BY {readParticipants.length}</Text>
                  <FlatList
                    data={readParticipants}
                    renderItem={renderParticipant}
                    keyExtractor={(item) => item.uid}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* Delivered to section */}
              {unreadParticipants.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>DELIVERED TO {unreadParticipants.length}</Text>
                  <FlatList
                    data={unreadParticipants}
                    renderItem={renderParticipant}
                    keyExtractor={(item) => item.uid}
                    scrollEnabled={false}
                  />
                </View>
              )}

              {/* No participants message */}
              {participants.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No participants to display</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 20,
    paddingBottom: 12,
    letterSpacing: 0.5,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  participantInfo: {
    marginLeft: 12,
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 17,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 17,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 17,
  },
});
