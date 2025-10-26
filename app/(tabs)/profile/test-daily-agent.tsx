/**
 * Daily Agent Test Screen
 * @remarks
 * Development tool for testing daily agent workflow manually
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseAuth } from '@/services/firebase';

/**
 * Test Daily Agent Screen Component
 * @component
 */
export default function TestDailyAgentScreen() {
  const router = useRouter();
  const auth = getFirebaseAuth();
  const functions = getFunctions();

  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingData, setCheckingData] = useState(false);
  const [dataStatus, setDataStatus] = useState<{
    hasConversations: boolean;
    hasMessages: boolean;
    conversationCount: number;
    messageCount: number;
  } | null>(null);

  /**
   * Checks if user has conversations to process
   * Note: We can't check message count directly due to security rules,
   * but we can check if user has conversations
   */
  const checkUserData = async () => {
    if (!auth.currentUser) return;

    setCheckingData(true);
    try {
      const { getFirebaseDb } = await import('@/services/firebase');
      const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
      const db = getFirebaseDb();

      // Check conversations
      const conversationsQuery = query(
        collection(db, 'conversations'),
        where('participantIds', 'array-contains', auth.currentUser.uid)
      );
      const conversationsSnap = await getDocs(conversationsQuery);

      // Check voice profile for message count (if exists)
      const voiceProfileRef = doc(db, 'voice_profiles', auth.currentUser.uid);
      const voiceProfileSnap = await getDoc(voiceProfileRef);
      const messageCount = voiceProfileSnap.exists()
        ? voiceProfileSnap.data().trainingSampleCount || 0
        : 0;

      setDataStatus({
        hasConversations: conversationsSnap.size > 0,
        hasMessages: messageCount > 0,
        conversationCount: conversationsSnap.size,
        messageCount: messageCount,
      });
    } catch (err) {
      console.error('Error checking user data:', err);
      // On error, assume user might have data to avoid blocking legitimate use
      setDataStatus({
        hasConversations: true,
        hasMessages: true,
        conversationCount: 0,
        messageCount: 0,
      });
    } finally {
      setCheckingData(false);
    }
  };

  // Check data on mount
  React.useEffect(() => {
    checkUserData();
  }, []);

  /**
   * Triggers the daily agent workflow manually
   */
  const handleTriggerWorkflow = async () => {
    if (!auth.currentUser) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    // Warn if no data
    if (dataStatus && (!dataStatus.hasConversations || !dataStatus.hasMessages)) {
      Alert.alert(
        'No Data to Process',
        'You have no conversations or messages for the daily agent to process. The workflow will complete with no results.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Run Anyway', onPress: () => executeWorkflow() },
        ]
      );
      return;
    }

    executeWorkflow();
  };

  const executeWorkflow = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Triggering daily agent workflow V2 (Gen2 cache workaround)...');

      // Using V2 function as workaround for Firebase Gen2 caching bug
      const trigger = httpsCallable(functions, 'triggerDailyAgentManualV2');
      const response = await trigger({ userId: auth.currentUser!.uid });

      console.log('Workflow response:', response.data);
      setResult(response.data);

      Alert.alert(
        'Success',
        'Daily agent workflow triggered successfully! Check the results below.'
      );
    } catch (err: any) {
      console.error('Error triggering workflow:', err);

      // Provide more detailed error messaging
      let errorMessage = 'Failed to trigger workflow';
      if (err.code === 'unauthenticated') {
        errorMessage = 'Authentication error. Please log out and log back in.';
      } else if (err.code === 'permission-denied') {
        errorMessage = 'You do not have permission to trigger the workflow.';
      } else if (err.code === 'internal') {
        errorMessage = `Workflow error: ${err.message || 'Internal server error'}`;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <NavigationHeader
        title="Test Daily Agent"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => router.back(),
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.title}>Daily Agent Workflow Tester</Text>
          <Text style={styles.description}>
            This will manually trigger the daily agent workflow for your account.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What it does:</Text>
            <Text style={styles.infoText}>• Fetches unprocessed messages</Text>
            <Text style={styles.infoText}>• Categorizes messages with AI</Text>
            <Text style={styles.infoText}>• Detects FAQs and auto-responds</Text>
            <Text style={styles.infoText}>• Drafts voice-matched responses</Text>
            <Text style={styles.infoText}>• Generates daily digest</Text>
          </View>

          {/* Data Status */}
          {checkingData ? (
            <View style={styles.dataStatusBox}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.dataStatusText}>Checking your data...</Text>
            </View>
          ) : dataStatus ? (
            <View
              style={[
                styles.dataStatusBox,
                !dataStatus.hasConversations || !dataStatus.hasMessages
                  ? styles.dataStatusWarning
                  : styles.dataStatusSuccess,
              ]}
            >
              <Text style={styles.dataStatusTitle}>Your Data Status</Text>
              <Text style={styles.dataStatusText}>
                Conversations: {dataStatus.conversationCount}
              </Text>
              <Text style={styles.dataStatusText}>Messages: {dataStatus.messageCount}</Text>
              {(!dataStatus.hasConversations || !dataStatus.hasMessages) && (
                <Text style={styles.dataStatusWarningText}>
                  ⚠️ You have no data to process. The workflow will complete with empty results.
                </Text>
              )}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.button, (isLoading || checkingData) && styles.buttonDisabled]}
            onPress={handleTriggerWorkflow}
            disabled={isLoading || checkingData}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Trigger Workflow</Text>
            )}
          </TouchableOpacity>

          {auth.currentUser && (
            <View style={styles.userInfo}>
              <Text style={styles.userInfoLabel}>User ID:</Text>
              <Text style={styles.userInfoValue}>{auth.currentUser.uid}</Text>
            </View>
          )}
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>❌ Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>✅ Results</Text>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Status:</Text>
              <Text style={styles.resultValue}>
                {result.success ? 'Success' : 'Failed'}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>Execution ID:</Text>
              <Text style={styles.resultValueSmall}>{result.executionId}</Text>
            </View>

            <Text style={styles.resultSectionTitle}>📊 Statistics</Text>
            {result.results ? (
              <>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Messages Fetched:</Text>
                  <Text style={styles.resultValue}>{result.results.messagesFetched || 0}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Messages Categorized:</Text>
                  <Text style={styles.resultValue}>
                    {result.results.messagesCategorized || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>FAQs Detected:</Text>
                  <Text style={styles.resultValue}>{result.results.faqsDetected || 0}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Auto-Responses Sent:</Text>
                  <Text style={styles.resultValue}>
                    {result.results.autoResponsesSent || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Responses Drafted:</Text>
                  <Text style={styles.resultValue}>
                    {result.results.responsesDrafted || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Needing Review:</Text>
                  <Text style={styles.resultValue}>
                    {result.results.messagesNeedingReview || 0}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Raw Response:</Text>
                <Text style={styles.resultValueSmall}>
                  {JSON.stringify(result, null, 2)}
                </Text>
              </View>
            )}

            {result.metrics && (
              <>
                <Text style={styles.resultSectionTitle}>⏱️ Performance</Text>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Duration:</Text>
                  <Text style={styles.resultValue}>{result.metrics.duration}ms</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Cost:</Text>
                  <Text style={styles.resultValue}>
                    ${result.metrics.costIncurred?.toFixed(4) || '0.0000'}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.firestoreInfo}>
              <Text style={styles.firestoreTitle}>📍 View in Firestore:</Text>
              <Text style={styles.firestoreText}>
                /users/{'{'}your-id{'}'}/daily_executions
              </Text>
              <Text style={styles.firestoreText}>
                /users/{'{'}your-id{'}'}/daily_digests
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 16,
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfo: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F9F9F9',
    borderRadius: 6,
  },
  userInfoLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 4,
  },
  userInfoValue: {
    fontSize: 12,
    color: '#333333',
    fontFamily: 'monospace',
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#666666',
  },
  resultBox: {
    backgroundColor: '#F0FFF4',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginTop: 16,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    fontSize: 14,
    color: '#666666',
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  resultValueSmall: {
    fontSize: 10,
    fontWeight: '500',
    color: '#666666',
    fontFamily: 'monospace',
    maxWidth: '60%',
  },
  firestoreInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  firestoreTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  firestoreText: {
    fontSize: 12,
    color: '#666666',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  dataStatusBox: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  dataStatusSuccess: {
    backgroundColor: '#F0FFF4',
    borderColor: '#34C759',
  },
  dataStatusWarning: {
    backgroundColor: '#FFF3CD',
    borderColor: '#FFC107',
  },
  dataStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  dataStatusText: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  dataStatusWarningText: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'center',
  },
});
