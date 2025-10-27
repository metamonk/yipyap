/**
 * ContactPickerModal Component
 *
 * @remarks
 * A full-screen modal for browsing and selecting multiple contacts.
 * Shows recent conversations and all contacts with search functionality.
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { getPaginatedUsers } from '@/services/userService';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/types/user';

interface ContactPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelectUsers: (users: User[]) => void;
  selectedUserIds: string[];
  maxSelection?: number;
  testID?: string;
}

interface SectionData {
  title: string;
  data: User[];
}

/**
 * ContactPickerModal provides a comprehensive interface for selecting multiple contacts
 *
 * @component
 * @example
 * ```tsx
 * <ContactPickerModal
 *   isVisible={showPicker}
 *   onClose={() => setShowPicker(false)}
 *   onSelectUsers={handleSelectUsers}
 *   selectedUserIds={selectedIds}
 *   maxSelection={10}
 * />
 * ```
 */
export const ContactPickerModal: React.FC<ContactPickerModalProps> = memo(({
  isVisible,
  onClose,
  onSelectUsers,
  selectedUserIds: initialSelectedIds,
  maxSelection = 10,
  testID,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const currentUserId = user?.uid;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all users on mount
  useEffect(() => {
    if (isVisible) {
      loadAllUsers();
    }
  }, [isVisible]);

  const loadAllUsers = async () => {
    setLoading(true);
    try {
      // Use paginated approach instead of empty search
      const result = await getPaginatedUsers(20);
      const filteredUsers = result.users.filter((u) => u.uid !== currentUserId);
      setAllUsers(filteredUsers);

      // Load more if needed
      if (result.hasMore && filteredUsers.length < 20) {
        const moreResult = await getPaginatedUsers(20, result.lastDoc);
        const moreFiltered = moreResult.users.filter((u) => u.uid !== currentUserId);
        setAllUsers([...filteredUsers, ...moreFiltered]);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return allUsers;
    }

    const query = searchQuery.toLowerCase();
    return allUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query)
    );
  }, [allUsers, searchQuery]);

  // Group users into sections
  const sections = useMemo((): SectionData[] => {
    // For now, just show all contacts in one section
    // In a real app, you might have "Recent", "Favorites", etc.
    if (filteredUsers.length === 0) {
      return [];
    }

    // Sort alphabetically
    const sorted = [...filteredUsers].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );

    // Group by first letter
    const grouped = sorted.reduce((acc, user) => {
      const firstLetter = user.displayName[0].toUpperCase();
      if (!acc[firstLetter]) {
        acc[firstLetter] = [];
      }
      acc[firstLetter].push(user);
      return acc;
    }, {} as Record<string, User[]>);

    return Object.entries(grouped).map(([letter, users]) => ({
      title: letter,
      data: users,
    }));
  }, [filteredUsers]);

  const toggleUserSelection = useCallback((user: User) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(user.uid)) {
        newSet.delete(user.uid);
      } else {
        if (newSet.size >= maxSelection) {
          // Max selection reached
          return prev;
        }
        newSet.add(user.uid);
      }
      return newSet;
    });
  }, [maxSelection]);

  const handleDone = () => {
    const selectedUsers = allUsers.filter((u) => selectedUserIds.has(u.uid));
    onSelectUsers(selectedUsers);
    onClose();
  };

  const handleCancel = () => {
    // Reset selection to initial state
    setSelectedUserIds(new Set(initialSelectedIds));
    setSearchQuery('');
    onClose();
  };

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    headerTitle: {
      color: theme.colors.textPrimary,
    },
    badge: {
      backgroundColor: theme.colors.accent,
    },
    cancelText: {
      color: theme.colors.accent,
    },
    doneText: {
      color: theme.colors.accent,
    },
    doneTextDisabled: {
      color: theme.colors.textTertiary,
    },
    searchContainer: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: theme.colors.borderLight,
    },
    searchInput: {
      color: theme.colors.textPrimary,
    },
    maxSelectionBanner: {
      backgroundColor: theme.colors.warningBackground || '#FFF3CD',
    },
    maxSelectionText: {
      color: theme.colors.warning || '#856404',
    },
    userItem: {
      backgroundColor: theme.colors.surface,
    },
    displayName: {
      color: theme.colors.textPrimary,
    },
    username: {
      color: theme.colors.textSecondary,
    },
    textDisabled: {
      color: theme.colors.textTertiary,
    },
    sectionHeader: {
      backgroundColor: theme.colors.background,
    },
    sectionTitle: {
      color: theme.colors.textSecondary,
    },
    separator: {
      backgroundColor: theme.colors.borderLight,
    },
    loadingText: {
      color: theme.colors.textSecondary,
    },
    emptyText: {
      color: theme.colors.textSecondary,
    },
    emptySubtext: {
      color: theme.colors.textTertiary,
    },
  });

  const renderUserItem = ({ item }: { item: User }) => {
    const isSelected = selectedUserIds.has(item.uid);
    const isDisabled = !isSelected && selectedUserIds.size >= maxSelection;

    return (
      <TouchableOpacity
        style={[styles.userItem, dynamicStyles.userItem, isDisabled && styles.userItemDisabled]}
        onPress={() => !isDisabled && toggleUserSelection(item)}
        disabled={isDisabled}
        testID={`${testID}-user-${item.uid}`}
      >
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
          ) : (
            <Ionicons
              name="ellipse-outline"
              size={24}
              color={isDisabled ? theme.colors.disabled : theme.colors.textSecondary}
            />
          )}
        </View>

        <Avatar
          photoURL={item.photoURL || null}
          displayName={item.displayName}
          size={40}
        />

        <View style={styles.userInfo}>
          <Text style={[styles.displayName, dynamicStyles.displayName, isDisabled && dynamicStyles.textDisabled]}>
            {item.displayName}
          </Text>
          <Text style={[styles.username, dynamicStyles.username, isDisabled && dynamicStyles.textDisabled]}>
            @{item.username}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: SectionData }) => (
    <View style={[styles.sectionHeader, dynamicStyles.sectionHeader]}>
      <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>{section.title}</Text>
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.loadingText, dynamicStyles.loadingText]}>Loading contacts...</Text>
        </View>
      );
    }

    if (searchQuery && filteredUsers.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No contacts found</Text>
          <Text style={[styles.emptySubtext, dynamicStyles.emptySubtext]}>
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={[styles.emptyText, dynamicStyles.emptyText]}>No contacts available</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
      testID={testID}
    >
      <SafeAreaView style={[styles.container, dynamicStyles.container]}>
        {/* Header */}
        <View style={[styles.header, dynamicStyles.header]}>
          <TouchableOpacity
            onPress={handleCancel}
            style={styles.headerButton}
            testID={`${testID}-cancel`}
          >
            <Text style={[styles.cancelText, dynamicStyles.cancelText]}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, dynamicStyles.headerTitle]}>Select Contacts</Text>
            {selectedUserIds.size > 0 && (
              <View style={[styles.badge, dynamicStyles.badge]}>
                <Text style={styles.badgeText}>{selectedUserIds.size}</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={handleDone}
            style={styles.headerButton}
            disabled={selectedUserIds.size === 0}
            testID={`${testID}-done`}
          >
            <Text
              style={[
                styles.doneText,
                dynamicStyles.doneText,
                selectedUserIds.size === 0 && dynamicStyles.doneTextDisabled,
              ]}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, dynamicStyles.searchContainer]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, dynamicStyles.searchInput]}
            placeholder="Search contacts..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            testID={`${testID}-search`}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selection Info */}
        {selectedUserIds.size >= maxSelection && (
          <View style={[styles.maxSelectionBanner, dynamicStyles.maxSelectionBanner]}>
            <Text style={[styles.maxSelectionText, dynamicStyles.maxSelectionText]}>
              Maximum {maxSelection} contacts can be selected
            </Text>
          </View>
        )}

        {/* Contacts List */}
        <SectionList
          sections={sections}
          renderItem={renderUserItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => item.uid}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={sections.length === 0 && styles.emptyListContent}
          stickySectionHeadersEnabled={true}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={[styles.separator, dynamicStyles.separator]} />}
        />
      </SafeAreaView>
    </Modal>
  );
});

ContactPickerModal.displayName = 'ContactPickerModal';

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    padding: 4,
    minWidth: 60,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  badge: {
    marginLeft: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelText: {
    fontSize: 17,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  doneTextDisabled: {
    color: '#C7C7CC',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    marginRight: 8,
    color: '#000000',
  },
  maxSelectionBanner: {
    backgroundColor: '#FFF3CD',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  maxSelectionText: {
    fontSize: 14,
    color: '#856404',
    textAlign: 'center',
  },
  sectionHeader: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  userItemDisabled: {
    opacity: 0.5,
  },
  checkbox: {
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  textDisabled: {
    color: '#C7C7CC',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5',
    marginLeft: 68,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#C7C7CC',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyListContent: {
    flexGrow: 1,
  },
});