/**
 * FAQ Editor Component
 *
 * @remarks
 * Modal component for creating and editing FAQ templates.
 * Features:
 * - Question and answer inputs with character limits
 * - Keywords input (comma-separated)
 * - Category picker
 * - Form validation
 * - Preview mode
 * - Save functionality (create or update)
 *
 * @module components/faq/FAQEditor
 */

import React, { FC, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { createFAQTemplate, updateFAQTemplate } from '@/services/faqService';
import type { FAQTemplate, CreateFAQTemplateInput, UpdateFAQTemplateInput } from '@/types/faq';
import { FAQ_CATEGORIES, type FAQCategory } from '@/types/faq';

/**
 * Props for the FAQEditor component
 */
export interface FAQEditorProps {
  /** Whether the modal is visible */
  isVisible: boolean;

  /** Callback fired when the modal should close */
  onClose: () => void;

  /** Callback fired when an FAQ is successfully saved */
  onSave?: (template: FAQTemplate) => void;

  /** Existing template to edit (omit for create mode) */
  template?: FAQTemplate;
}

/**
 * Tab type for switching between edit and preview modes
 */
type EditorTab = 'edit' | 'preview';

/**
 * FAQ Editor modal component for creating and editing FAQ templates
 *
 * @component
 *
 * @remarks
 * Features:
 * - Create new FAQ templates or edit existing ones
 * - Question input with 500 character limit
 * - Answer input with 2000 character limit
 * - Keywords input (comma-separated tags)
 * - Category selection from predefined categories
 * - Preview mode to see how FAQ will appear
 * - Form validation with error messages
 * - Save with loading state
 *
 * @example
 * ```tsx
 * <FAQEditor
 *   isVisible={showEditor}
 *   onClose={() => setShowEditor(false)}
 *   onSave={(template) => console.log('Saved:', template)}
 *   template={existingTemplate} // Omit for create mode
 * />
 * ```
 */
export const FAQEditor: FC<FAQEditorProps> = ({
  isVisible,
  onClose,
  onSave,
  template,
}) => {
  const { theme } = useTheme();
  const isEditMode = !!template;

  const [activeTab, setActiveTab] = useState<EditorTab>('edit');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [keywords, setKeywords] = useState('');
  const [category, setCategory] = useState<FAQCategory>('general');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    closeIcon: {
      color: theme.colors.accent,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    saveButtonText: {
      color: theme.colors.accent,
    },
    tabContainer: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    tabActive: {
      borderBottomColor: theme.colors.accent,
    },
    tabIconActive: {
      color: theme.colors.accent,
    },
    tabIconInactive: {
      color: theme.colors.textSecondary,
    },
    tabText: {
      color: theme.colors.textSecondary,
    },
    tabTextActive: {
      color: theme.colors.accent,
    },
    label: {
      color: theme.colors.textPrimary,
    },
    hint: {
      color: theme.colors.textSecondary,
    },
    input: {
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      borderColor: theme.colors.borderLight,
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    errorText: {
      color: theme.colors.error,
    },
    charCount: {
      color: theme.colors.textSecondary,
    },
    categoryChip: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    categoryChipActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    categoryChipText: {
      color: theme.colors.accent,
    },
    categoryChipTextActive: {
      color: '#FFFFFF',
    },
    toggle: {
      backgroundColor: theme.colors.borderLight,
    },
    toggleActive: {
      backgroundColor: theme.colors.success || '#34C759',
    },
    previewCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      ...theme.shadows.sm,
    },
    previewCategoryBadge: {
      backgroundColor: theme.colors.accent,
    },
    activeText: {
      color: theme.colors.success || '#34C759',
    },
    inactiveText: {
      color: theme.colors.textSecondary,
    },
    previewQuestion: {
      color: theme.colors.textPrimary,
    },
    previewAnswer: {
      color: theme.colors.textSecondary,
    },
    previewKeywordsBorder: {
      borderTopColor: theme.colors.borderLight,
    },
    previewKeywordsLabel: {
      color: theme.colors.textSecondary,
    },
    previewKeywordsText: {
      color: theme.colors.accent,
    },
    previewInfo: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    previewInfoIcon: {
      color: theme.colors.textSecondary,
    },
    previewInfoText: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Load template data when editing
   */
  useEffect(() => {
    if (template) {
      setQuestion(template.question);
      setAnswer(template.answer);
      setKeywords(template.keywords.join(', '));
      setCategory(template.category as FAQCategory);
      setIsActive(template.isActive);
    } else {
      // Reset form for create mode
      setQuestion('');
      setAnswer('');
      setKeywords('');
      setCategory('general');
      setIsActive(true);
    }
    setErrors({});
    setActiveTab('edit');
  }, [template, isVisible]);

  /**
   * Validates form inputs and returns errors
   */
  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!question.trim()) {
      newErrors.question = 'Question is required';
    } else if (question.length > 500) {
      newErrors.question = 'Question must be 500 characters or less';
    }

    if (!answer.trim()) {
      newErrors.answer = 'Answer is required';
    } else if (answer.length > 2000) {
      newErrors.answer = 'Answer must be 2000 characters or less';
    }

    if (!category) {
      newErrors.category = 'Category is required';
    }

    return newErrors;
  };

  /**
   * Handles saving the FAQ template
   */
  const handleSave = async () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSaving(true);
    try {
      const keywordsArray = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      if (isEditMode && template) {
        // Update existing template
        const updates: UpdateFAQTemplateInput = {
          question: question.trim(),
          answer: answer.trim(),
          keywords: keywordsArray,
          category,
          isActive,
        };

        const result = await updateFAQTemplate(template.id, updates);

        if (onSave) {
          onSave(result.template);
        }

        Alert.alert('Success', 'FAQ template updated successfully');
      } else {
        // Create new template
        const input: CreateFAQTemplateInput = {
          question: question.trim(),
          answer: answer.trim(),
          keywords: keywordsArray,
          category,
          isActive,
        };

        const result = await createFAQTemplate(input);

        if (onSave) {
          onSave(result.template);
        }

        Alert.alert('Success', 'FAQ template created successfully');
      }

      onClose();
    } catch (error) {
      console.error('Error saving FAQ template:', error);
      Alert.alert(
        'Error',
        `Failed to ${isEditMode ? 'update' : 'create'} FAQ template. Please try again.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Renders the header with tabs
   */
  const renderHeader = () => (
    <View style={[styles.header, dynamicStyles.header]}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={28} color={dynamicStyles.closeIcon.color} />
      </TouchableOpacity>

      <Text style={[styles.title, dynamicStyles.title]}>
        {isEditMode ? 'Edit FAQ' : 'New FAQ'}
      </Text>

      <TouchableOpacity
        onPress={handleSave}
        disabled={isSaving}
        style={styles.saveButton}
      >
        {isSaving ? (
          <ActivityIndicator size="small" color={theme.colors.accent} />
        ) : (
          <Text style={[styles.saveButtonText, dynamicStyles.saveButtonText]}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders the tab selector
   */
  const renderTabs = () => (
    <View style={[styles.tabContainer, dynamicStyles.tabContainer]}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'edit' && dynamicStyles.tabActive]}
        onPress={() => setActiveTab('edit')}
      >
        <Ionicons
          name="create-outline"
          size={20}
          color={activeTab === 'edit' ? dynamicStyles.tabIconActive.color : dynamicStyles.tabIconInactive.color}
        />
        <Text
          style={[styles.tabText, dynamicStyles.tabText, activeTab === 'edit' && dynamicStyles.tabTextActive]}
        >
          Edit
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'preview' && dynamicStyles.tabActive]}
        onPress={() => setActiveTab('preview')}
      >
        <Ionicons
          name="eye-outline"
          size={20}
          color={activeTab === 'preview' ? dynamicStyles.tabIconActive.color : dynamicStyles.tabIconInactive.color}
        />
        <Text
          style={[
            styles.tabText,
            dynamicStyles.tabText,
            activeTab === 'preview' && dynamicStyles.tabTextActive,
          ]}
        >
          Preview
        </Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders the edit form
   */
  const renderEditForm = () => (
    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
      {/* Question Input */}
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Question *</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input, styles.textArea, errors.question && dynamicStyles.inputError]}
          placeholder="What question do your fans frequently ask?"
          placeholderTextColor={theme.colors.disabled || '#C7C7CC'}
          value={question}
          onChangeText={(text) => {
            setQuestion(text);
            if (errors.question) {
              setErrors({ ...errors, question: '' });
            }
          }}
          multiline
          numberOfLines={3}
          maxLength={500}
        />
        <View style={styles.fieldFooter}>
          {errors.question && (
            <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.question}</Text>
          )}
          <Text style={[styles.charCount, dynamicStyles.charCount]}>
            {question.length}/500
          </Text>
        </View>
      </View>

      {/* Answer Input */}
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Answer *</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input, styles.textArea, styles.answerInput, errors.answer && dynamicStyles.inputError]}
          placeholder="Write the response you want to automatically send..."
          placeholderTextColor={theme.colors.disabled || '#C7C7CC'}
          value={answer}
          onChangeText={(text) => {
            setAnswer(text);
            if (errors.answer) {
              setErrors({ ...errors, answer: '' });
            }
          }}
          multiline
          numberOfLines={6}
          maxLength={2000}
        />
        <View style={styles.fieldFooter}>
          {errors.answer && (
            <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.answer}</Text>
          )}
          <Text style={[styles.charCount, dynamicStyles.charCount]}>
            {answer.length}/2000
          </Text>
        </View>
      </View>

      {/* Keywords Input */}
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Keywords (Optional)</Text>
        <Text style={[styles.hint, dynamicStyles.hint]}>Comma-separated keywords for better matching</Text>
        <TextInput
          style={[styles.input, dynamicStyles.input]}
          placeholder="e.g. pricing, rates, cost, fees"
          placeholderTextColor={theme.colors.disabled || '#C7C7CC'}
          value={keywords}
          onChangeText={setKeywords}
        />
      </View>

      {/* Category Picker */}
      <View style={styles.fieldContainer}>
        <Text style={[styles.label, dynamicStyles.label]}>Category *</Text>
        <View style={styles.categoryGrid}>
          {FAQ_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                dynamicStyles.categoryChip,
                category === cat && dynamicStyles.categoryChipActive,
              ]}
              onPress={() => setCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  dynamicStyles.categoryChipText,
                  category === cat && dynamicStyles.categoryChipTextActive,
                ]}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.category && (
          <Text style={[styles.errorText, dynamicStyles.errorText]}>{errors.category}</Text>
        )}
      </View>

      {/* Active Toggle */}
      <View style={styles.fieldContainer}>
        <View style={styles.toggleRow}>
          <View>
            <Text style={[styles.label, dynamicStyles.label]}>Active</Text>
            <Text style={[styles.hint, dynamicStyles.hint]}>
              Enable this FAQ for automatic responses
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.toggle, dynamicStyles.toggle, isActive && dynamicStyles.toggleActive]}
            onPress={() => setIsActive(!isActive)}
          >
            <View
              style={[
                styles.toggleThumb,
                isActive && styles.toggleThumbActive,
              ]}
            />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  /**
   * Renders the preview mode
   */
  const renderPreview = () => (
    <ScrollView style={styles.previewContainer} showsVerticalScrollIndicator={false}>
      <View style={[styles.previewCard, dynamicStyles.previewCard]}>
        <View style={styles.previewHeader}>
          <View style={[styles.previewCategoryBadge, dynamicStyles.previewCategoryBadge]}>
            <Text style={styles.previewCategoryText}>
              {category.toUpperCase()}
            </Text>
          </View>
          {isActive ? (
            <View style={styles.activeIndicator}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success || '#34C759'} />
              <Text style={[styles.activeText, dynamicStyles.activeText]}>Active</Text>
            </View>
          ) : (
            <View style={styles.inactiveIndicator}>
              <Ionicons name="pause-circle-outline" size={20} color={dynamicStyles.inactiveText.color} />
              <Text style={[styles.inactiveText, dynamicStyles.inactiveText]}>Inactive</Text>
            </View>
          )}
        </View>

        <Text style={[styles.previewQuestion, dynamicStyles.previewQuestion]}>{question || 'Your question will appear here...'}</Text>
        <Text style={[styles.previewAnswer, dynamicStyles.previewAnswer]}>{answer || 'Your answer will appear here...'}</Text>

        {keywords.trim() && (
          <View style={[styles.previewKeywords, dynamicStyles.previewKeywordsBorder]}>
            <Text style={[styles.previewKeywordsLabel, dynamicStyles.previewKeywordsLabel]}>Keywords:</Text>
            <Text style={[styles.previewKeywordsText, dynamicStyles.previewKeywordsText]}>{keywords}</Text>
          </View>
        )}
      </View>

      <View style={[styles.previewInfo, dynamicStyles.previewInfo]}>
        <Ionicons name="information-circle-outline" size={20} color={dynamicStyles.previewInfoIcon.color} />
        <Text style={[styles.previewInfoText, dynamicStyles.previewInfoText]}>
          This is how your FAQ template will appear in the library. Fans will receive the answer automatically when their message matches with high confidence.
        </Text>
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {renderHeader()}
          {renderTabs()}
          {activeTab === 'edit' ? renderEditForm() : renderPreview()}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    // borderBottomColor in dynamicStyles
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 6,
  },
  tabTextActive: {
    // color in dynamicStyles
  },
  formContainer: {
    flex: 1,
    padding: 24,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  inputError: {
    // borderColor in dynamicStyles
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  answerInput: {
    minHeight: 120,
  },
  fieldFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
  },
  charCount: {
    fontSize: 13,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryChipActive: {
    // backgroundColor and borderColor in dynamicStyles
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryChipTextActive: {
    // color in dynamicStyles
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    // backgroundColor in dynamicStyles
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 2,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  previewContainer: {
    flex: 1,
    padding: 24,
  },
  previewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewCategoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  activeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  inactiveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inactiveText: {
    fontSize: 14,
    marginLeft: 4,
    fontWeight: '500',
  },
  previewQuestion: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewAnswer: {
    fontSize: 15,
    lineHeight: 20,
  },
  previewKeywords: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  previewKeywordsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewKeywordsText: {
    fontSize: 14,
  },
  previewInfo: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  previewInfoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
});
