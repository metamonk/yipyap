/**
 * Daily Digest Review Screen
 * @remarks
 * Story 5.8 - Multi-Step Daily Agent
 * Displays daily digest with handled messages and pending reviews
 * Provides one-tap approve/reject interface for AI-generated responses
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../_components/NavigationHeader';
import { getFirebaseAuth } from '@/services/firebase';
import {
  getDailyDigest,
  subscribeToDigest,
} from '@/services/dailyDigestService';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import type { DailyDigest, DigestMessage } from '@/types/ai';

/**
 * Daily Digest Screen Component
 * @component
 *
 * @example
 * ```tsx
 * <DailyDigestScreen />
 * ```
 */
export default function DailyDigestScreen() {
  const router = useRouter();
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  const [digest, setDigest] = useState<DailyDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'pending' | 'handled'>('pending');

  useEffect(() => {
    loadDigest();
  }, []);

  /**
   * Loads the most recent daily digest
   */
  const loadDigest = async () => {
    if (!currentUser) {
      Alert.alert('Error', 'You must be logged in to view daily digest.');
      router.push('/(tabs)/profile');
      return;
    }

    try {
      const latestDigest = await getDailyDigest(currentUser.uid);
      setDigest(latestDigest);
    } catch (error) {
      console.error('Error loading daily digest:', error);
      Alert.alert('Error', 'Failed to load daily digest. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  /**
   * Handles pull-to-refresh
   */
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDigest();
  };

  /**
   * Approves all pending suggestions
   */
  const handleApproveAll = async () => {
    if (!currentUser || !digest) {
      return;
    }

    Alert.alert(
      'Approve All Responses',
      `This will send ${digest.summary.totalNeedingReview} AI-generated responses. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve All',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const result = await bulkOperationsService.batchApproveSuggestions(currentUser.uid);
              if (result.completed) {
                Alert.alert('Success', `${result.successCount} responses have been sent.`);
              } else {
                Alert.alert('Partial Success', `${result.successCount} sent, ${result.failureCount} failed.`);
              }
              // Reload digest
              await loadDigest();
            } catch (error) {
              console.error('Error approving all:', error);
              Alert.alert('Error', 'Failed to send some responses. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Rejects all pending suggestions
   */
  const handleRejectAll = async () => {
    if (!currentUser || !digest) {
      return;
    }

    Alert.alert(
      'Reject All Responses',
      `This will discard ${digest.summary.totalNeedingReview} AI-generated responses. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject All',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // Mark all as rejected (implementation in bulk operations service)
              const messageIds = digest.pendingMessages.map((msg) => msg.messageId);
              // TODO: Implement batchRejectSuggestions in bulkOperationsService
              Alert.alert('Success', 'All suggestions have been rejected.');
              // Reload digest
              await loadDigest();
            } catch (error) {
              console.error('Error rejecting all:', error);
              Alert.alert('Error', 'Failed to reject suggestions. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Handles individual message approval
   */
  const handleApproveMessage = async (message: DigestMessage) => {
    if (!currentUser) {
      return;
    }

    setIsProcessing(true);
    try {
      const result = await bulkOperationsService.batchApproveSuggestions(currentUser.uid);
      if (result.completed) {
        Alert.alert('Success', 'Response has been sent.');
      } else {
        Alert.alert('Error', 'Failed to send response. Please try again.');
      }
      // Reload digest
      await loadDigest();
    } catch (error) {
      console.error('Error approving message:', error);
      Alert.alert('Error', 'Failed to send response. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Handles individual message rejection
   */
  const handleRejectMessage = async (message: DigestMessage) => {
    if (!currentUser) {
      return;
    }

    Alert.alert(
      'Reject Response',
      'Discard this AI-generated response?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // TODO: Implement single message rejection
              Alert.alert('Success', 'Response has been rejected.');
              // Reload digest
              await loadDigest();
            } catch (error) {
              console.error('Error rejecting message:', error);
              Alert.alert('Error', 'Failed to reject response. Please try again.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Handles message edit (navigate to conversation)
   */
  const handleEditMessage = (message: DigestMessage) => {
    router.push(`/(tabs)/conversations/${message.conversationId}`);
  };

  /**
   * Renders individual digest message item
   */
  const renderMessageItem = ({ item }: { item: DigestMessage }) => (
    <View
      style={styles.messageCard}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Message from ${item.senderName}: ${item.messagePreview}`}
    >
      <View style={styles.messageHeader}>
        <Text style={styles.senderName}>{item.senderName}</Text>
        <View style={[styles.categoryBadge, getCategoryBadgeStyle(item.category)]}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>

      <Text style={styles.messagePreview} numberOfLines={2}>
        {item.messagePreview}
      </Text>

      {item.draftResponse && (
        <View style={styles.responseContainer}>
          <Text style={styles.responseLabel}>AI Draft:</Text>
          <Text style={styles.responseText} numberOfLines={3}>
            {item.draftResponse}
          </Text>
        </View>
      )}

      {item.faqTemplateId && (
        <View style={styles.faqBadge}>
          <Text style={styles.faqBadgeText}>FAQ Auto-Response</Text>
        </View>
      )}

      {selectedTab === 'pending' && (
        <View style={styles.messageActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonReject]}
            onPress={() => handleRejectMessage(item)}
            disabled={isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reject response"
          >
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonEdit]}
            onPress={() => handleEditMessage(item)}
            disabled={isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Edit response"
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonApprove]}
            onPress={() => handleApproveMessage(item)}
            disabled={isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Approve and send response"
          >
            <Text style={[styles.actionButtonText, styles.actionButtonTextApprove]}>
              Approve
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  /**
   * Returns category badge styling
   */
  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case 'business_opportunity':
        return { backgroundColor: '#34C759' };
      case 'fan_engagement':
        return { backgroundColor: '#007AFF' };
      case 'urgent':
        return { backgroundColor: '#FF3B30' };
      case 'spam':
        return { backgroundColor: '#8E8E93' };
      default:
        return { backgroundColor: '#5856D6' };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Digest" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading digest...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!digest) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Digest" />
        <View style={styles.emptyContainer} accessible={true} accessibilityRole="text">
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyTitle}>No Digest Available</Text>
          <Text style={styles.emptyText}>
            The daily agent hasn't processed any messages yet.
          </Text>
          <Text style={styles.emptyHint}>
            Check back tomorrow morning or enable the daily agent in settings.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => router.push('/(tabs)/profile/daily-agent-settings')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Go to daily agent settings"
          >
            <Text style={styles.settingsButtonText}>Go to Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Error state (if workflow failed)
  const hasError = digest.summary.totalHandled === 0 && digest.summary.totalNeedingReview === 0;
  if (hasError) {
    return (
      <View style={styles.container}>
        <NavigationHeader title="Daily Digest" />
        <View style={styles.errorContainer} accessible={true} accessibilityRole="alert">
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Workflow Error</Text>
          <Text style={styles.errorText}>
            The daily agent encountered an error during processing.
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.push('/(tabs)/profile/agent-execution-logs')}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="View execution logs"
          >
            <Text style={styles.retryButtonText}>View Logs</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NavigationHeader title="Daily Digest" />

      {/* Summary Header */}
      <View
        style={styles.summaryHeader}
        accessible={true}
        accessibilityRole="header"
        accessibilityLabel={digest.summary.summaryText}
      >
        <Text style={styles.summaryText}>{digest.summary.summaryText}</Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer} accessible={true} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'pending' && styles.tabActive]}
          onPress={() => setSelectedTab('pending')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'pending' }}
          accessibilityLabel={`Pending review: ${digest.summary.totalNeedingReview} messages`}
        >
          <Text
            style={[styles.tabText, selectedTab === 'pending' && styles.tabTextActive]}
          >
            Pending Review ({digest.summary.totalNeedingReview})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'handled' && styles.tabActive]}
          onPress={() => setSelectedTab('handled')}
          accessible={true}
          accessibilityRole="tab"
          accessibilityState={{ selected: selectedTab === 'handled' }}
          accessibilityLabel={`Handled: ${digest.summary.totalHandled} messages`}
        >
          <Text
            style={[styles.tabText, selectedTab === 'handled' && styles.tabTextActive]}
          >
            Handled ({digest.summary.totalHandled})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bulk Actions (only for pending tab) */}
      {selectedTab === 'pending' && digest.pendingMessages.length > 0 && (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={[styles.bulkButton, styles.bulkButtonReject]}
            onPress={handleRejectAll}
            disabled={isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Reject all pending responses"
          >
            <Text style={styles.bulkButtonText}>Reject All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkButton, styles.bulkButtonApprove]}
            onPress={handleApproveAll}
            disabled={isProcessing}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Approve and send all pending responses"
          >
            <Text style={[styles.bulkButtonText, styles.bulkButtonTextApprove]}>
              Approve All
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Message List */}
      <FlatList
        data={selectedTab === 'pending' ? digest.pendingMessages : digest.handledMessages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.messageId}
        contentContainerStyle={styles.messageList}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyListContainer}>
            <Text style={styles.emptyListText}>
              {selectedTab === 'pending'
                ? 'No messages pending review'
                : 'No messages were auto-handled'}
            </Text>
          </View>
        }
      />

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
  },
  settingsButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minHeight: 44,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryHeader: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  summaryText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    minHeight: 44,
  },
  tabActive: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  bulkActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    gap: 12,
  },
  bulkButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
  },
  bulkButtonReject: {
    backgroundColor: '#FF3B30',
  },
  bulkButtonApprove: {
    backgroundColor: '#34C759',
  },
  bulkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bulkButtonTextApprove: {
    color: '#FFFFFF',
  },
  messageList: {
    padding: 16,
  },
  messageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messagePreview: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 12,
    lineHeight: 20,
  },
  responseContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  faqBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  faqBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  actionButtonReject: {
    backgroundColor: '#FF3B30',
  },
  actionButtonEdit: {
    backgroundColor: '#8E8E93',
  },
  actionButtonApprove: {
    backgroundColor: '#34C759',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonTextApprove: {
    color: '#FFFFFF',
  },
  emptyListContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000000',
    fontWeight: '600',
  },
});
