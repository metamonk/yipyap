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
import { useTheme } from '@/contexts/ThemeContext';
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
  const { theme } = useTheme();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [templates, setTemplates] = useState<FAQTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortOption, setSortOption] = useState<SortOption>('recent');
  const [showFilters, setShowFilters] = useState(false);

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    centerContainer: {
      backgroundColor: theme.colors.background,
    },
    loadingText: {
      color: theme.colors.textSecondary,
    },
    searchContainer: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    searchInputContainer: {
      backgroundColor: theme.colors.backgroundSecondary || '#F2F2F7',
    },
    searchIcon: {
      color: theme.colors.textSecondary,
    },
    searchInput: {
      color: theme.colors.textPrimary,
    },
    filterButtonIcon: {
      color: theme.colors.accent,
    },
    filtersContainer: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    filterLabel: {
      color: theme.colors.textSecondary,
    },
    categoryChip: {
      backgroundColor: theme.colors.backgroundSecondary || '#F2F2F7',
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
    sortOption: {
      backgroundColor: theme.colors.backgroundSecondary || '#F2F2F7',
      borderColor: theme.colors.borderLight,
    },
    sortOptionActive: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    sortOptionText: {
      color: theme.colors.accent,
    },
    sortOptionTextActive: {
      color: '#FFFFFF',
    },
    resultsHeader: {
      backgroundColor: theme.colors.background,
    },
    resultsCount: {
      color: theme.colors.textSecondary,
    },
    createButtonSmall: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.accent,
    },
    createButtonSmallText: {
      color: theme.colors.accent,
    },
    emptyContainer: {
      backgroundColor: theme.colors.background,
    },
    emptyIcon: {
      color: theme.colors.disabled || '#C7C7CC',
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    createButton: {
      backgroundColor: theme.colors.accent,
    },
    noResultsIcon: {
      color: theme.colors.disabled || '#C7C7CC',
    },
    noResultsText: {
      color: theme.colors.textSecondary,
    },
  });

  /**
   * Subscribe to FAQ templates on mount
   */
  useEffect(() => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view FAQ templates.');
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    <View style={[styles.searchContainer, dynamicStyles.searchContainer]}>
      <View style={[styles.searchInputContainer, dynamicStyles.searchInputContainer]}>
        <Ionicons name="search" size={20} color={dynamicStyles.searchIcon.color} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, dynamicStyles.searchInput]}
          placeholder="Search FAQs..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={theme.colors.disabled || '#C7C7CC'}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={dynamicStyles.searchIcon.color} />
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
          color={dynamicStyles.filterButtonIcon.color}
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
      <View style={[styles.filtersContainer, dynamicStyles.filtersContainer]}>
        {/* Category Filter */}
        <View style={styles.filterSection}>
          <Text style={[styles.filterLabel, dynamicStyles.filterLabel]}>Category</Text>
          <View style={styles.categoryChips}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                dynamicStyles.categoryChip,
                selectedCategory === 'all' && dynamicStyles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  dynamicStyles.categoryChipText,
                  selectedCategory === 'all' && dynamicStyles.categoryChipTextActive,
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
                  dynamicStyles.categoryChip,
                  selectedCategory === category && dynamicStyles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    dynamicStyles.categoryChipText,
                    selectedCategory === category && dynamicStyles.categoryChipTextActive,
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
          <Text style={[styles.filterLabel, dynamicStyles.filterLabel]}>Sort By</Text>
          <View style={styles.sortOptions}>
            <TouchableOpacity
              style={[
                styles.sortOption,
                dynamicStyles.sortOption,
                sortOption === 'recent' && dynamicStyles.sortOptionActive,
              ]}
              onPress={() => setSortOption('recent')}
            >
              <Ionicons
                name="time-outline"
                size={18}
                color={sortOption === 'recent' ? '#FFFFFF' : dynamicStyles.sortOptionText.color}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  dynamicStyles.sortOptionText,
                  sortOption === 'recent' && dynamicStyles.sortOptionTextActive,
                ]}
              >
                Recent
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortOption,
                dynamicStyles.sortOption,
                sortOption === 'usage' && dynamicStyles.sortOptionActive,
              ]}
              onPress={() => setSortOption('usage')}
            >
              <Ionicons
                name="repeat-outline"
                size={18}
                color={sortOption === 'usage' ? '#FFFFFF' : dynamicStyles.sortOptionText.color}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  dynamicStyles.sortOptionText,
                  sortOption === 'usage' && dynamicStyles.sortOptionTextActive,
                ]}
              >
                Most Used
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.sortOption,
                dynamicStyles.sortOption,
                sortOption === 'alphabetical' && dynamicStyles.sortOptionActive,
              ]}
              onPress={() => setSortOption('alphabetical')}
            >
              <Ionicons
                name="text-outline"
                size={18}
                color={sortOption === 'alphabetical' ? '#FFFFFF' : dynamicStyles.sortOptionText.color}
              />
              <Text
                style={[
                  styles.sortOptionText,
                  dynamicStyles.sortOptionText,
                  sortOption === 'alphabetical' && dynamicStyles.sortOptionTextActive,
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
    <View style={[styles.emptyContainer, dynamicStyles.emptyContainer]}>
      <Ionicons name="chatbubble-ellipses-outline" size={64} color={dynamicStyles.emptyIcon.color} />
      <Text style={[styles.emptyTitle, dynamicStyles.emptyTitle]}>No FAQ Templates Yet</Text>
      <Text style={[styles.emptyText, dynamicStyles.emptyText]}>
        Create your first FAQ template to start automatically responding to common questions.
      </Text>
      <TouchableOpacity style={[styles.createButton, dynamicStyles.createButton]} onPress={onCreateFAQ}>
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
      <View style={[styles.centerContainer, dynamicStyles.centerContainer]}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading FAQs...</Text>
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
    <View style={[styles.container, dynamicStyles.container]}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={[styles.title, dynamicStyles.title]}>FAQ Library</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          Manage and organize frequently asked questions with automatic responses
        </Text>
      </View>

      {/* Search Bar */}
      {renderSearchBar()}

      {/* Filters */}
      {renderFilters()}

      {/* Results Count */}
      <View style={[styles.resultsHeader, dynamicStyles.resultsHeader]}>
        <Text style={[styles.resultsCount, dynamicStyles.resultsCount]}>
          {filteredTemplates.length} {filteredTemplates.length === 1 ? 'FAQ' : 'FAQs'}
        </Text>
        <TouchableOpacity style={[styles.createButtonSmall, dynamicStyles.createButtonSmall]} onPress={onCreateFAQ}>
          <Ionicons name="add-circle" size={20} color={dynamicStyles.createButtonSmallText.color} />
          <Text style={[styles.createButtonSmallText, dynamicStyles.createButtonSmallText]}>New FAQ</Text>
        </TouchableOpacity>
      </View>

      {/* FAQ List */}
      {filteredTemplates.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={48} color={dynamicStyles.noResultsIcon.color} />
          <Text style={[styles.noResultsText, dynamicStyles.noResultsText]}>No FAQs match your search</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTemplates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FAQTemplateCard
              template={item}
              onPress={onEditFAQ}
              onUpdate={(_updated) => {
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

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
  },
  filterButton: {
    padding: 8,
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
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
    marginRight: 8,
    borderWidth: 1,
  },
  sortOptionActive: {
    // backgroundColor and borderColor in dynamicStyles
  },
  sortOptionText: {
    fontSize: 14,
    marginLeft: 6,
    fontWeight: '500',
  },
  sortOptionTextActive: {
    // color in dynamicStyles
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  createButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  createButtonSmallText: {
    fontSize: 14,
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
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
    marginTop: 16,
  },
});
