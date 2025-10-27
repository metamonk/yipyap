/**
 * ConversationSettings component for managing conversation-level settings
 *
 * @remarks
 * Modal component for configuring conversation settings including:
 * - FAQ auto-response toggle (Story 5.4 - Task 13)
 * - Future settings can be added here
 *
 * Works for both direct and group conversations.
 * For group conversations, only the creator can change auto-response settings.
 * For direct conversations, any participant can toggle.
 *
 * @module components/conversation/ConversationSettings
 */

import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { updateConversationAutoResponse } from '@/services/conversationService';
import type { Conversation } from '@/types/models';

/**
 * Props for the ConversationSettings component
 */
export interface ConversationSettingsProps {
  /** Whether the modal is visible */
  visible: boolean;

  /** Function to close the modal */
  onClose: () => void;

  /** The conversation to configure */
  conversation: Conversation;

  /** The current user's ID */
  userId: string;
}

/**
 * Modal component for managing conversation settings
 *
 * @component
 *
 * @remarks
 * Features:
 * - FAQ auto-response toggle with confirmation dialog
 * - Permission-based access control
 * - Loading states and error handling
 * - User-friendly success/error messages
 *
 * Design:
 * - Modal presentation with header and close button
 * - Settings organized in sections
 * - Switch components for toggles
 * - Description text for each setting
 *
 * @example
 * ```tsx
 * <ConversationSettings
 *   visible={showSettings}
 *   onClose={() => setShowSettings(false)}
 *   conversation={conversation}
 *   userId={currentUser.uid}
 * />
 * ```
 *
 * @param props - Component props
 * @returns ConversationSettings component
 */
export const ConversationSettings: FC<ConversationSettingsProps> = ({
  visible,
  onClose,
  conversation,
  userId,
}) => {
  const { theme } = useTheme();
  const [autoResponseEnabled, setAutoResponseEnabled] = useState(true);
  const [isTogglingAutoResponse, setIsTogglingAutoResponse] = useState(false);

  // Determine if current user can change settings
  const isCreator =
    conversation.type === 'group' ? conversation.creatorId === userId : true;

  // Update state when conversation changes
  useEffect(() => {
    setAutoResponseEnabled(conversation.autoResponseEnabled !== false);
  }, [conversation]);

  /**
   * Handle toggling FAQ auto-response setting
   */
  const handleToggleAutoResponse = async (enabled: boolean) => {
    if (!isCreator && conversation.type === 'group') {
      Alert.alert(
        'Permission Denied',
        'Only the group creator can change auto-response settings'
      );
      return;
    }

    // Show confirmation dialog when disabling auto-response
    if (!enabled) {
      Alert.alert(
        'Disable Auto-Response',
        'FAQ auto-responses will no longer be sent in this conversation. You can re-enable this anytime.',
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
    try {
      setIsTogglingAutoResponse(true);
      await updateConversationAutoResponse(conversation.id, enabled, userId);
      setAutoResponseEnabled(enabled);

      // Update the conversation object in parent component
      conversation.autoResponseEnabled = enabled;

      Alert.alert(
        'Success',
        enabled
          ? 'FAQ auto-responses are now enabled'
          : 'FAQ auto-responses have been disabled'
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

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderLight,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.colors.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    section: {
      backgroundColor: theme.colors.surface,
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      marginBottom: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    settingLabel: {
      fontSize: 17,
      fontWeight: '400',
      color: theme.colors.textPrimary,
    },
    settingDescription: {
      fontSize: 15,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    helperText: {
      fontSize: 13,
      color: theme.colors.textTertiary,
      marginTop: 8,
      fontStyle: 'italic',
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={dynamicStyles.container}>
        {/* Header */}
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.headerTitle}>Conversation Settings</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} testID="close-button">
            <Ionicons name="close" size={28} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {/* FAQ Auto-Response Section */}
          <View style={dynamicStyles.section}>
            <Text style={dynamicStyles.sectionTitle}>FAQ Auto-Response</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingHeader}>
                  <Ionicons
                    name="chatbubbles"
                    size={20}
                    color={theme.colors.accent}
                    style={styles.settingIcon}
                  />
                  <Text style={dynamicStyles.settingLabel}>Auto-respond to FAQs</Text>
                </View>
                <Text style={dynamicStyles.settingDescription}>
                  Automatically respond to frequently asked questions with saved templates
                </Text>
              </View>
              <Switch
                value={autoResponseEnabled}
                onValueChange={handleToggleAutoResponse}
                disabled={(!isCreator && conversation.type === 'group') || isTogglingAutoResponse}
                trackColor={{ false: theme.colors.borderLight, true: theme.colors.accent }}
                thumbColor="#FFF"
                ios_backgroundColor={theme.colors.borderLight}
              />
            </View>
            {!isCreator && conversation.type === 'group' && (
              <Text style={dynamicStyles.helperText}>
                Only the group creator can change this setting
              </Text>
            )}
          </View>

          {/* Future settings sections can be added here */}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 4,
  },
  content: {
    flex: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  settingIcon: {
    marginRight: 8,
  },
});
