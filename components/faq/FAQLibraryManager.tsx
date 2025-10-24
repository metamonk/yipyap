/**
 * FAQ Library Manager Component
 *
 * @remarks
 * Main component for managing FAQ templates. Displays a list of FAQs with:
 * - Search functionality
 * - Filter by category
 * - Sort options (usage count, creation date)
 * - Create new FAQ button
 * - Real-time updates via Firestore subscription
 *
 * @module components/faq/FAQLibraryManager
 */

import React, { FC, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FAQTemplateCard } from './FAQTemplateCard';
import { subscribeFAQTemplates } from '@/services/faqService';
import { getFirebaseAuth } from '@/services/firebase';
import type { FAQTemplate } from '@/types/faq';
import { FAQ_CATEGORIES } from '@/types/faq';

/**
 * Props for the FAQLibraryManager component
 */
export interface FAQLibraryManagerProps {
  /** Callback fired when user wants to create a new FAQ */
  onCreateFAQ: () => void;

  /** Callback fired when user wants to edit an existing FAQ */
  onEditFAQ: (template: FAQTemplate) => void;
}

/**
 * Sort option type
 */
type SortOption = 'recent' | 'usage' | 'alphabetical';

/**
 * Main FAQ Library Manager component
 *
 * @component
 *
 * @remarks
 * Features:
 * - Real-time FAQ list updates via Firestore subscription
 * - Search by question text
 * - Filter by category
 * - Sort by usage count, creation date, or alphabetically
 * - Empty state when no FAQs exist
 * - Loading state while fetching data
 *
 * @example
 * ```tsx
 * <FAQLibraryManager
 *   onCreateFAQ={() => openCreateModal()}
 *   onEditFAQ={(template) => openEditModal(template)}
 * />
 * ```
 */
export const FAQLibraryManager: FC<FAQLibraryManagerProps> = ({
  onCreateFAQ,
  onEditFAQ,
}) => {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [templates, setTemplates] = useState<FAQTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [showFilters, setShowFilters] = useState(false);

  /**
   * Subscribe to FAQ templates on mount
   */
  useEffect(() => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view FAQ templates.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = subscribeFAQTemplates(
      currentUser.uid,
      (updatedTemplates) => {
        setTemplates(updatedTemplates);
        setIsLoading(false);
      },
      (error) => {
        console.error('FAQ subscription error:', error);
        Alert.alert('Error', 'Failed to load FAQ templates. Please try again.');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  /**
   * Filtered and sorted FAQ templates
   */
  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.question.toLowerCase().includes(query) ||
          template.answer.toLowerCase().includes(query) ||
          template.keywords.some((keyword) => keyword.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(
        (template) => template.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Sort templates
    const sorted = [...filtered];
    switch (sortOption) {
      case 'usage':
        sorted.sort((a, b) => b.useCount - a.useCount);
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.question.localeCompare(b.question));
        break;
      case 'recent':
      default:
        sorted.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || 0;
          const bTime = b.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });
        break;
    }

    return sorted;
  }, [templates, searchQuery, selectedCategory, sortOption]);

  /**
   * Renders the search bar
   */
  const renderSearchBar = () => (
    <View style={styles.searchContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search FAQs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#C7C7CC"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Ionicons
          name={showFilters ? 'filter' : 'filter-outline'}
          size={22}
          color="#007AFF"
        />
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders filter and sort options
   */
  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        {/* Category Filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Category</Text>
          <View style={styles.categoryChips}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === 'all' && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  selectedCategory === 'all' && styles.categoryChipTextActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {FAQ_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  selectedCategory === category && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category && styles.categoryChipTextActive,
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Sort Options */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Sort By</Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[
                styles.sortOption,
                sortOption === 'recent' && styles.sortOptionActive,
              ]}
              onPress={() => setSortOption('recent')}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={sortOption === 'recent' ? '#FFFFFF' : '#007AFF'}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'recent' && styles.sortOptionTextActive,
                ]}
              >
                Recent
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortOption,
                sortOption === 'usage' && styles.sortOptionActive,
              ]}
              onPress={() => setSortOption('usage')}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={sortOption === 'usage' ? '#FFFFFF' : '#007AFF'}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'usage' && styles.sortOptionTextActive,
                ]}
              >
                Most Used
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortOption,
                sortOption === 'alphabetical' && styles.sortOptionActive,
              ]}
              onPress={() => setSortOption('alphabetical')}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color={sortOption === 'alphabetical' ? '#FFFFFF' : '#007AFF'}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  sortOption === 'alphabetical' && styles.sortOptionTextActive,
                ]}
              >
                A-Z
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  /**
   * Renders empty state
   */
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubble-ellipses-outline" size={64} color="#C7C7CC" />
      <Text style={styles.emptyTitle}>No FAQ Templates Yet</Text>
      <Text style={styles.emptyText}>
        Create your first FAQ template to start automatically responding to common questions.
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={onCreateFAQ}>
        <Ionicons name="add-circle" size={24} color="#FFFFFF" />
        <Text style={styles.createButtonText}>Create FAQ</Text>
      </TouchableOpacity>
    </View>
  );

  /**
   * Renders loading state
   */
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading FAQs...</Text>
      </View>
    );
  }

  /**
   * Renders empty state if no templates
   */
  if (templates.length === 0) {
    return renderEmptyState();
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {renderSearchBar()}

      {/* Filters */}
      {renderFilters()}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {filteredTemplates.length} {filteredTemplates.length === 1 ? 'FAQ' : 'FAQs'}
        </Text>
        <TouchableOpacity style={styles.createButtonSmall} onPress={onCreateFAQ}>
          <Ionicons name="add-circle" size={20} color="#007AFF" />
          <Text style={styles.createButtonSmallText}>New FAQ</Text>
        </TouchableOpacity>
      </View>

      {/* FAQ List */}
      {filteredTemplates.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={48} color="#C7C7CC" />
          <Text style={styles.noResultsText}>No FAQs match your search</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FAQTemplateCard
              template={item}
              onPress={onEditFAQ}
              onUpdate={(updated) => {
                // Update handled by Firestore subscription
              }}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
  },
  filterButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  sortOptions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  sortOptionActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortOptionText: {
    fontSize: 14,
    color: '#007AFF',
    marginLeft: 6,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    color: '#FFFFFF',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  createButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  createButtonSmallText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#F2F2F7',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 64,
  },
  noResultsText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
});
