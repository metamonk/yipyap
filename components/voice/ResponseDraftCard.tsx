/**
 * Response Draft Card Component (Story 6.2)
 *
 * @remarks
 * Displays AI-generated response drafts in always-editable mode with personalization guidance.
 * Replaces the previous approval-based interface with draft-first editing workflow.
 *
 * Key features:
 * - Always-editable TextInput (not read-only)
 * - Personalization suggestions (3 hints)
 * - Confidence scoring and warnings
 * - "Requires editing" enforcement
 * - Auto-save integration
 * - Draft regeneration
 * - Undo/history support
 */

import React, { FC, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import type { ResponseDraft, PersonalizationSuggestion } from '@/types/ai';
import { draftManagementService } from '@/services/draftManagementService';
import { draftAnalyticsService } from '@/services/draftAnalyticsService';

/**
 * Props for the ResponseDraftCard component
 */
export interface ResponseDraftCardProps {
  /** The AI-generated draft response */
  draft: ResponseDraft;

  /** Conversation ID */
  conversationId: string;

  /** Message category for tracking */
  messageCategory?: string;

  /** Callback fired when user sends the response */
  onSend: (text: string, metadata: {
    wasEdited: boolean;
    editCount: number;
    timeToEdit: number;
    overrideApplied: boolean;
  }) => Promise<void>;

  /** Callback fired when user discards the draft */
  onDiscard: () => void;

  /** Callback fired when user wants to populate input field with draft text */
  onPopulateInput?: (text: string) => void;

  /** Callback fired when user requests a new draft */
  onRegenerateDraft: () => Promise<void>;

  /** Whether draft regeneration is in progress */
  isRegenerating?: boolean;

  /** Whether the modal is visible */
  visible: boolean;

  /** Callback fired when modal is closed */
  onClose: () => void;
}

/**
 * Displays an AI-generated response draft with editing interface
 *
 * @component
 *
 * @remarks
 * - TextInput is always editable (not read-only)
 * - Send button enforces editing for high-priority messages
 * - Low-confidence drafts (<70%) show warning banner
 * - Auto-saves every 5 seconds while editing
 * - Tracks all edit metrics for analytics
 *
 * @example
 * ```tsx
 * <ResponseDraftCard
 *   draft={draftData}
 *   conversationId="conv123"
 *   messageCategory="business_opportunity"
 *   onSend={handleSend}
 *   onDiscard={handleDiscard}
 *   onRegenerateDraft={handleRegenerate}
 * />
 * ```
 */
export const ResponseDraftCard: FC<ResponseDraftCardProps> = ({
  draft,
  conversationId,
  messageCategory,
  onSend,
  onDiscard,
  onPopulateInput,
  onRegenerateDraft,
  isRegenerating = false,
  visible,
  onClose,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Draft state
  const [draftText, setDraftText] = useState(draft.text);
  const [originalDraftText] = useState(draft.text);
  const [hasEdited, setHasEdited] = useState(false);
  const [editCount, setEditCount] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Draft history state
  const [draftHistory, setDraftHistory] = useState<Array<{
    version: number;
    text: string;
    confidence: number;
    createdAt: Date;
  }>>([]);
  const [selectedVersion, setSelectedVersion] = useState(draft.version);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs for tracking
  const editStartTime = useRef(Date.now());
  const lastSavedText = useRef(draft.text);

  // Sync local state when draft prop changes (e.g., after regeneration)
  // Also loads draft history when modal is visible
  useEffect(() => {
    setDraftText(draft.text);
    setHasEdited(false);
    setEditCount(0);
    setSelectedVersion(draft.version);
    editStartTime.current = Date.now();
    lastSavedText.current = draft.text;

    // Reload draft history when draft changes (new version generated) or modal opens
    if (visible && draft.messageId) {
      loadDraftHistory();
    }
  }, [draft.text, draft.version, visible, draft.messageId, loadDraftHistory]);

  // Load draft history from Firestore
  const loadDraftHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const result = await draftManagementService.getDraftHistory(
        conversationId,
        draft.messageId
      );

      // Check if the operation was successful
      if (!result.success || !result.drafts) {
        console.warn('No draft history available:', result.error);
        // Just show current draft
        setDraftHistory([{
          version: draft.version,
          text: draft.text,
          confidence: draft.confidence,
          createdAt: new Date(),
        }]);
        return;
      }

      // Convert to display format with current draft
      const historyItems = result.drafts.map((h) => ({
        version: h.version,
        text: h.draftText,
        confidence: h.confidence,
        createdAt: h.createdAt?.toDate ? h.createdAt.toDate() : new Date(),
      }));

      // Add current draft if not in history
      const currentDraftInHistory = historyItems.find(h => h.version === draft.version);
      if (!currentDraftInHistory) {
        historyItems.push({
          version: draft.version,
          text: draft.text,
          confidence: draft.confidence,
          createdAt: new Date(),
        });
      }

      // Sort by version (newest first)
      historyItems.sort((a, b) => b.version - a.version);

      setDraftHistory(historyItems);
    } catch (error) {
      console.error('Error loading draft history:', error);
      // On error, show at least the current draft
      setDraftHistory([{
        version: draft.version,
        text: draft.text,
        confidence: draft.confidence,
        createdAt: new Date(),
      }]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [conversationId, draft]);

  // Handle version selection from history
  const handleSelectVersion = useCallback((version: number) => {
    const selectedDraft = draftHistory.find(h => h.version === version);
    if (selectedDraft) {
      setDraftText(selectedDraft.text);
      setSelectedVersion(version);
      setHasEdited(false);
      setEditCount(0);
      editStartTime.current = Date.now();
    }
  }, [draftHistory]);

  // Auto-save draft on text change (5-second debounce)
  useEffect(() => {
    // Only auto-save if text has changed and is different from last saved
    if (draftText !== lastSavedText.current) {
      draftManagementService.saveDraft(
        conversationId,
        draft.messageId,
        draftText,
        draft.confidence,
        draft.version,
        5000 // 5-second debounce
      );

      lastSavedText.current = draftText;
    }
  }, [draftText, conversationId, draft.messageId, draft.confidence, draft.version]);

  // Handle text change
  const handleTextChange = useCallback((text: string) => {
    setDraftText(text);

    if (!hasEdited) {
      setHasEdited(true);
    }

    setEditCount((count) => count + 1);
  }, [hasEdited]);

  // Handle send
  const handleSend = useCallback(async () => {
    // Check if editing is required but not done
    if (draft.requiresEditing && !hasEdited) {
      Alert.alert(
        'Edit Required',
        'This is a high-priority message that requires personalization before sending. Please edit the draft or use "Send Anyway" if you trust this draft.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    setIsSending(true);

    try {
      const timeToEdit = Date.now() - editStartTime.current;

      // Track analytics
      await draftAnalyticsService.trackEditEvent({
        messageId: draft.messageId,
        conversationId,
        wasEdited: hasEdited,
        editCount,
        timeToEdit,
        requiresEditing: draft.requiresEditing,
        overrideApplied: false,
        confidence: draft.confidence,
        draftVersion: selectedVersion,
      });

      // Send message
      await onSend(draftText, {
        wasEdited: hasEdited,
        editCount,
        timeToEdit,
        overrideApplied: false,
      });

      // Clear drafts after successful send
      await draftManagementService.clearDrafts(conversationId, draft.messageId);
    } catch (error) {
      console.error('Error sending draft:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [
    draft,
    conversationId,
    draftText,
    hasEdited,
    editCount,
    selectedVersion,
    onSend,
  ]);

  // Handle override (send without editing when requiresEditing is true)
  const handleOverride = useCallback(() => {
    // Simply populate the input field with the draft text
    if (onPopulateInput) {
      onPopulateInput(draftText);
      onClose(); // Close the modal after populating
    }
  }, [draftText, onPopulateInput, onClose]);

  // Handle undo (revert to original draft)
  const handleUndo = useCallback(() => {
    Alert.alert(
      'Revert to Original Draft?',
      'This will discard your edits and restore the original AI-generated draft.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: () => {
            setDraftText(originalDraftText);
            setHasEdited(false);
            setEditCount(0);
          },
        },
      ]
    );
  }, [originalDraftText]);

  // Handle discard
  const handleDiscard = useCallback(() => {
    Alert.alert(
      'Discard Draft?',
      'This will permanently delete the draft. You can always generate a new one.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            // Clear drafts
            await draftManagementService.clearDrafts(conversationId, draft.messageId);
            onDiscard();
          },
        },
      ]
    );
  }, [conversationId, draft.messageId, onDiscard]);

  // Confidence badge color
  const getConfidenceBadgeColor = () => {
    if (draft.confidence >= 85) return '#10B981'; // Green - high confidence
    if (draft.confidence >= 70) return '#F59E0B'; // Amber - standard
    return '#EF4444'; // Red - low confidence
  };

  // Format timestamp for draft history
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Character count
  const characterCount = draftText.length;
  const maxCharacters = 1000; // Example limit

  const screenHeight = Dimensions.get('window').height;

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    modalContainer: {
      backgroundColor: theme.colors.background,
    },
    modalContent: {
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    modalHeaderTitle: {
      color: theme.colors.textPrimary,
    },
    warningBanner: {
      backgroundColor: theme.colors.error + '15', // 15% opacity
    },
    warningText: {
      color: theme.colors.error,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
    },
    textInput: {
      backgroundColor: theme.colors.backgroundSecondary,
      borderColor: theme.colors.borderLight,
      color: theme.colors.textPrimary,
    },
    characterCount: {
      color: theme.colors.textSecondary,
    },
    characterCountError: {
      color: theme.colors.error,
    },
    suggestionsContainer: {
      backgroundColor: theme.colors.accent + '10', // 10% opacity
    },
    suggestionsTitle: {
      color: theme.colors.accent,
    },
    suggestionText: {
      color: theme.colors.textPrimary,
    },
    metricText: {
      color: theme.colors.textSecondary,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
    },
    secondaryButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    secondaryButtonText: {
      color: theme.colors.accent,
    },
    discardText: {
      color: theme.colors.error,
    },
    overrideText: {
      color: theme.colors.accent,
    },
    historyTitle: {
      color: theme.colors.textSecondary,
    },
    historyCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    historyCardActive: {
      borderColor: theme.colors.accent,
      backgroundColor: theme.colors.accent + '10', // 10% opacity
    },
    historyVersion: {
      color: theme.colors.textSecondary,
    },
    historyVersionActive: {
      color: theme.colors.accent,
    },
    historyConfidence: {
      color: theme.colors.textTertiary,
    },
    historyConfidenceActive: {
      color: theme.colors.accent,
    },
    historyPreview: {
      color: theme.colors.textSecondary,
    },
    historyPreviewActive: {
      color: theme.colors.accent,
    },
    historyTimestamp: {
      color: theme.colors.textTertiary,
    },
    historyTimestampActive: {
      color: theme.colors.accent,
    },
    undoButton: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    undoText: {
      color: theme.colors.textSecondary,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.modalContainer, dynamicStyles.modalContainer]}
      >
        <View style={[styles.modalContent, dynamicStyles.modalContent]}>
          {/* Header with close button */}
          <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.accent} />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, dynamicStyles.modalHeaderTitle]}>AI Draft Response</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(40, insets.bottom + 20) }
            ]}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
      {/* Low confidence warning */}
      {draft.confidence < 70 && (
        <View style={[styles.warningBanner, dynamicStyles.warningBanner]}>
          <Ionicons name="alert-circle" size={20} color={theme.colors.error} />
          <Text style={[styles.warningText, dynamicStyles.warningText]}>
            Low confidence draft - consider regenerating or writing from scratch
          </Text>
        </View>
      )}

      {/* Confidence badge */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="sparkles" size={20} color={theme.colors.accent} />
          <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>AI Draft</Text>
        </View>
        <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceBadgeColor() }]}>
          <Text style={styles.confidenceText}>{draft.confidence}%</Text>
        </View>
      </View>

      {/* Draft History Carousel */}
      {draftHistory.length > 1 && (
        <View style={styles.historyContainer}>
          <Text style={[styles.historyTitle, dynamicStyles.historyTitle]}>
            <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} /> DRAFT HISTORY ({draftHistory.length})
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.historyScroll}
            contentContainerStyle={styles.historyScrollContent}
          >
            {draftHistory.map((item, index) => (
              <TouchableOpacity
                key={`${item.version}-${item.createdAt.getTime()}`}
                style={[
                  styles.historyCard,
                  dynamicStyles.historyCard,
                  selectedVersion === item.version && [styles.historyCardActive, dynamicStyles.historyCardActive],
                ]}
                onPress={() => handleSelectVersion(item.version)}
                disabled={isLoadingHistory || isSending}
              >
                <View style={styles.historyCardHeader}>
                  <Text style={[
                    styles.historyVersion,
                    dynamicStyles.historyVersion,
                    selectedVersion === item.version && dynamicStyles.historyVersionActive,
                  ]}>
                    Version {item.version}
                  </Text>
                  <Text style={[
                    styles.historyConfidence,
                    dynamicStyles.historyConfidence,
                    selectedVersion === item.version && dynamicStyles.historyConfidenceActive,
                  ]}>
                    {item.confidence}%
                  </Text>
                </View>
                <Text
                  style={[
                    styles.historyPreview,
                    dynamicStyles.historyPreview,
                    selectedVersion === item.version && dynamicStyles.historyPreviewActive,
                  ]}
                  numberOfLines={2}
                >
                  {item.text}
                </Text>
                <Text style={[
                  styles.historyTimestamp,
                  dynamicStyles.historyTimestamp,
                  selectedVersion === item.version && dynamicStyles.historyTimestampActive,
                ]}>
                  {formatTimestamp(item.createdAt)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Editable draft text */}
      <View style={styles.textInputContainer}>
        <TextInput
          style={[styles.textInput, dynamicStyles.textInput]}
          value={draftText}
          onChangeText={handleTextChange}
          multiline
          placeholder="Personalize this response..."
          placeholderTextColor={theme.colors.textTertiary}
          editable={!isSending && !isRegenerating}
          textAlignVertical="top"
        />
        {hasEdited && (
          <TouchableOpacity style={[styles.undoButton, dynamicStyles.undoButton]} onPress={handleUndo}>
            <Ionicons name="arrow-undo" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.undoText, dynamicStyles.undoText]}>Undo</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Character count */}
      <Text
        style={[
          styles.characterCount,
          dynamicStyles.characterCount,
          characterCount > maxCharacters && [styles.characterCountError, dynamicStyles.characterCountError],
        ]}
      >
        {characterCount} / {maxCharacters} characters
      </Text>

      {/* Personalization suggestions */}
      <View style={[styles.suggestionsContainer, dynamicStyles.suggestionsContainer]}>
        <Text style={[styles.suggestionsTitle, dynamicStyles.suggestionsTitle]}>💡 PERSONALIZATION SUGGESTIONS:</Text>
        {draft.personalizationSuggestions.map((suggestion, index) => (
          <View key={index} style={styles.suggestionItem}>
            <Text style={styles.suggestionBullet}>•</Text>
            <Text style={[styles.suggestionText, dynamicStyles.suggestionText]}>{suggestion.text}</Text>
          </View>
        ))}
      </View>

      {/* Metrics */}
      <View style={styles.metricsContainer}>
        <View style={styles.metricItem}>
          <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.metricText, dynamicStyles.metricText]}>~{draft.timeSaved} min saved</Text>
        </View>
        <View style={styles.metricItem}>
          <Ionicons name="create-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.metricText, dynamicStyles.metricText]}>{editCount} edits</Text>
        </View>
        <View style={styles.metricItem}>
          <Ionicons name="layers-outline" size={16} color={theme.colors.textSecondary} />
          <Text style={[styles.metricText, dynamicStyles.metricText]}>Version {selectedVersion}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          testID="send-button"
          style={[
            styles.primaryButton,
            dynamicStyles.primaryButton,
            (!hasEdited && draft.requiresEditing) && styles.disabledButton,
            isSending && styles.disabledButton,
          ]}
          onPress={handleSend}
          disabled={(!hasEdited && draft.requiresEditing) || isSending || characterCount > maxCharacters}
        >
          {isSending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="send" size={18} color="#FFF" />
              <Text style={styles.primaryButtonText}>Send Personalized Response</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity
            testID="regenerate-button"
            style={[styles.secondaryButton, dynamicStyles.secondaryButton]}
            onPress={onRegenerateDraft}
            disabled={isRegenerating || isSending}
          >
            {isRegenerating ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : (
              <>
                <Ionicons name="refresh" size={18} color={theme.colors.accent} />
                <Text style={[styles.secondaryButtonText, dynamicStyles.secondaryButtonText]}>New Draft</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            testID="discard-button"
            style={[styles.secondaryButton, dynamicStyles.secondaryButton]}
            onPress={handleDiscard}
            disabled={isSending || isRegenerating}
          >
            <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
            <Text style={[styles.secondaryButtonText, dynamicStyles.discardText]}>Discard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Override option for "requires editing" */}
      {draft.requiresEditing && !hasEdited && !isSending && (
        <TouchableOpacity style={styles.overrideButton} onPress={handleOverride}>
          <Text style={[styles.overrideText, dynamicStyles.overrideText]}>Use this draft</Text>
        </TouchableOpacity>
      )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  // Modal styles matching Robinhood minimal aesthetic
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    padding: 4,
    width: 44,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44, // Same as closeButton to center title
  },
  modalScrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    // paddingBottom set dynamically with safe area insets
  },
  // Legacy container style (not used in modal mode but kept for compatibility)
  container: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  textInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 150,
  },
  undoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '500',
  },
  characterCount: {
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 20,
  },
  characterCountError: {
    fontWeight: '600',
  },
  suggestionsContainer: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  suggestionsTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  suggestionBullet: {
    fontSize: 15,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontSize: 13,
  },
  actionsContainer: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  discardText: {
    // Color set via dynamicStyles
  },
  overrideButton: {
    marginTop: 16,
    alignItems: 'center',
    padding: 12,
  },
  overrideText: {
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  // Draft History styles
  historyContainer: {
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  historyScroll: {
    marginLeft: -20, // Offset container padding
    paddingLeft: 20,
  },
  historyScrollContent: {
    gap: 12,
    paddingRight: 20,
  },
  historyCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    width: 220,
  },
  historyCardActive: {
    // Border and background colors set via dynamicStyles
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyVersion: {
    fontSize: 13,
    fontWeight: '600',
  },
  historyVersionActive: {
    // Color set via dynamicStyles
  },
  historyConfidence: {
    fontSize: 12,
    fontWeight: '500',
  },
  historyConfidenceActive: {
    // Color set via dynamicStyles
  },
  historyPreview: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  historyPreviewActive: {
    // Color set via dynamicStyles
  },
  historyTimestamp: {
    fontSize: 11,
  },
  historyTimestampActive: {
    // Color set via dynamicStyles
  },
});
