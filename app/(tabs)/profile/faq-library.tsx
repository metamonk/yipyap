/**
 * FAQ Library Screen
 *
 * @remarks
 * Screen for viewing and managing FAQ templates.
 * Accessible from the Profile tab.
 *
 * @module app/(tabs)/profile/faq-library
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { FAQLibraryManager } from '@/components/faq/FAQLibraryManager';
import { FAQEditor } from '@/components/faq/FAQEditor';
import type { FAQTemplate } from '@/types/faq';

/**
 * FAQ Library Screen Component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Displays all user's FAQ templates
 * - Search, filter, and sort functionality
 * - Create new FAQ template
 * - Edit existing FAQ template
 * - Toggle FAQ active/inactive status
 */
export default function FAQLibraryScreen() {
  const router = useRouter();

  const [showEditor, setShowEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FAQTemplate | undefined>(undefined);

  /**
   * Handles creating a new FAQ template
   */
  const handleCreateFAQ = () => {
    setSelectedTemplate(undefined);
    setShowEditor(true);
  };

  /**
   * Handles editing an existing FAQ template
   */
  const handleEditFAQ = (template: FAQTemplate) => {
    setSelectedTemplate(template);
    setShowEditor(true);
  };

  /**
   * Handles closing the FAQ editor
   */
  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedTemplate(undefined);
  };

  /**
   * Handles successful save from FAQ editor
   */
  const handleSaveFAQ = (template: FAQTemplate) => {
    // Template will be updated via real-time subscription in FAQLibraryManager
    setShowEditor(false);
    setSelectedTemplate(undefined);
  };

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="FAQ Library"
        leftAction={{
          icon: 'chevron-back',
          onPress: () => router.back(),
        }}
        rightAction={{
          icon: 'stats-chart',
          onPress: () => router.push('/profile/faq-analytics'),
        }}
      />

      <FAQLibraryManager onCreateFAQ={handleCreateFAQ} onEditFAQ={handleEditFAQ} />

      <FAQEditor
        isVisible={showEditor}
        onClose={handleCloseEditor}
        onSave={handleSaveFAQ}
        template={selectedTemplate}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
});
