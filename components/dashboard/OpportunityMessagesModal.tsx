/**
 * OpportunityMessagesModal - Full list of opportunities in a modal sheet
 *
 * @remarks
 * Displays all business opportunities in a scrollable bottom sheet modal.
 * Used when user taps "View All" from the OpportunityFeed preview widget.
 *
 * @example
 * ```tsx
 * <OpportunityMessagesModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   opportunities={opportunities}
 *   onRefresh={fetchOpportunities}
 * />
 * ```
 */

import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { OpportunityFeed } from './OpportunityFeed';
import type { Message } from '@/types/models';

/**
 * Props for OpportunityMessagesModal component
 */
interface OpportunityMessagesModalProps {
  /** Whether modal is visible */
  visible: boolean;

  /** Callback to close modal */
  onClose: () => void;

  /** Array of opportunity messages */
  opportunities: Message[];

  /** Callback when user pulls to refresh */
  onRefresh?: () => Promise<void>;

  /** Set of new opportunity IDs for animation */
  newOpportunityIds?: Set<string>;
}

/**
 * OpportunityMessagesModal Component
 */
export function OpportunityMessagesModal({
  visible,
  onClose,
  opportunities,
  onRefresh,
  newOpportunityIds = new Set(),
}: OpportunityMessagesModalProps) {
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
            <Text style={[styles.title, dynamicStyles.title]}>All Business Opportunities</Text>
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

        {/* Full Opportunity Feed */}
        <View style={styles.feedContainer}>
          <OpportunityFeed
            opportunities={opportunities}
            onRefresh={onRefresh}
            previewMode={false}
            newOpportunityIds={newOpportunityIds}
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
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  feedContainer: {
    flex: 1,
  },
});
