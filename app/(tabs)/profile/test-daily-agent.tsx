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
import { useTheme } from '@/contexts/ThemeContext';
import { NavigationHeader } from '../../_components/NavigationHeader';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseAuth } from '@/services/firebase';

/**
 * Test Daily Agent Screen Component
 * @component
 */
export default function TestDailyAgentScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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

  // Dynamic styles based on theme
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    title: {
      color: theme.colors.textPrimary,
    },
    subtitle: {
      color: theme.colors.textSecondary,
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginTop: 8,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      ...theme.shadows.sm,
    },
    infoTitle: {
      color: theme.colors.textPrimary,
    },
    infoText: {
      color: theme.colors.textSecondary,
    },
    button: {
      backgroundColor: theme.colors.accent,
    },
    buttonDisabled: {
      backgroundColor: theme.colors.disabled || '#CCCCCC',
    },
    userInfoLabel: {
      color: theme.colors.textSecondary,
    },
    userInfoValue: {
      color: theme.colors.textPrimary,
    },
    errorCard: {
      backgroundColor: theme.colors.surface,
      borderLeftColor: theme.colors.error,
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    errorTitle: {
      color: theme.colors.error,
    },
    errorText: {
      color: theme.colors.textSecondary,
    },
    resultCard: {
      backgroundColor: theme.colors.surface,
      borderLeftColor: theme.colors.success || '#34C759',
      borderWidth: 1,
      borderColor: theme.colors.borderLight,
    },
    resultTitle: {
      color: theme.colors.success || '#34C759',
    },
    resultSectionTitle: {
      color: theme.colors.textPrimary,
    },
    resultLabel: {
      color: theme.colors.textSecondary,
    },
    resultValue: {
      color: theme.colors.textPrimary,
    },
    resultValueSmall: {
      color: theme.colors.textSecondary,
    },
    firestoreInfo: {
      borderTopColor: theme.colors.borderLight,
    },
    firestoreTitle: {
      color: theme.colors.textPrimary,
    },
    firestoreText: {
      color: theme.colors.textSecondary,
    },
    dataStatusCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.borderLight,
    },
    dataStatusSuccess: {
      borderLeftColor: theme.colors.success || '#34C759',
    },
    dataStatusWarning: {
      borderLeftColor: theme.colors.warning || '#FFC107',
    },
    dataStatusTitle: {
      color: theme.colors.textPrimary,
    },
    dataStatusText: {
      color: theme.colors.textSecondary,
    },
    dataStatusWarningText: {
      color: theme.colors.warning || '#FFC107',
    },
  });

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
      console.log('Triggering daily agent workflow V3 (Gen2 cache workaround #2)...');

      // Using V3 function as workaround for Firebase Gen2 caching bug (hit twice!)
      // V2 deployment succeeded but continued serving cached code
      const trigger = httpsCallable(functions, 'triggerDailyAgentManualV3');
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
    <View style={dynamicStyles.container}>
      <NavigationHeader
        title="Test Daily Agent"
        leftAction={{
          icon: 'arrow-back',
          onPress: () => router.back(),
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, dynamicStyles.title]}>Daily Agent Workflow Tester</Text>
        <Text style={[styles.subtitle, dynamicStyles.subtitle]}>
          This will manually trigger the daily agent workflow for your account.
        </Text>

        {/* WORKFLOW INFO CARD */}
        <Text style={dynamicStyles.sectionHeader}>WORKFLOW</Text>
        <View style={dynamicStyles.card}>
          <Text style={[styles.infoTitle, dynamicStyles.infoTitle]}>What it does:</Text>
          <Text style={[styles.infoText, dynamicStyles.infoText]}>• Fetches unprocessed messages</Text>
          <Text style={[styles.infoText, dynamicStyles.infoText]}>• Categorizes messages with AI</Text>
          <Text style={[styles.infoText, dynamicStyles.infoText]}>• Detects FAQs and auto-responds</Text>
          <Text style={[styles.infoText, dynamicStyles.infoText]}>• Drafts voice-matched responses</Text>
          <Text style={[styles.infoText, dynamicStyles.infoText]}>• Generates daily digest</Text>
        </View>

        {/* DATA STATUS CARD */}
        <Text style={dynamicStyles.sectionHeader}>YOUR DATA</Text>
        {checkingData ? (
          <View style={[dynamicStyles.card, styles.loadingCard]}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={[styles.dataStatusText, dynamicStyles.dataStatusText]}>Checking your data...</Text>
          </View>
        ) : dataStatus ? (
          <View
            style={[
              dynamicStyles.card,
              styles.dataStatusCard,
              !dataStatus.hasConversations || !dataStatus.hasMessages
                ? dynamicStyles.dataStatusWarning
                : dynamicStyles.dataStatusSuccess,
            ]}
          >
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, dynamicStyles.dataStatusText]}>Conversations</Text>
              <Text style={[styles.dataValue, dynamicStyles.dataStatusTitle]}>{dataStatus.conversationCount}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={[styles.dataLabel, dynamicStyles.dataStatusText]}>Messages</Text>
              <Text style={[styles.dataValue, dynamicStyles.dataStatusTitle]}>{dataStatus.messageCount}</Text>
            </View>
            {(!dataStatus.hasConversations || !dataStatus.hasMessages) && (
              <View style={styles.warningRow}>
                <Text style={[styles.dataStatusWarningText, dynamicStyles.dataStatusWarningText]}>
                  ⚠️ No data to process. The workflow will complete with empty results.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {/* TRIGGER BUTTON */}
        <TouchableOpacity
          style={[styles.button, dynamicStyles.button, (isLoading || checkingData) && dynamicStyles.buttonDisabled]}
          onPress={handleTriggerWorkflow}
          disabled={isLoading || checkingData}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Trigger Workflow</Text>
          )}
        </TouchableOpacity>

        {/* USER INFO */}
        {auth.currentUser && (
          <View style={[dynamicStyles.card, styles.userInfoCard]}>
            <Text style={[styles.userInfoLabel, dynamicStyles.userInfoLabel]}>User ID</Text>
            <Text style={[styles.userInfoValue, dynamicStyles.userInfoValue]}>{auth.currentUser.uid}</Text>
          </View>
        )}

        {/* ERROR CARD */}
        {error && (
          <View>
            <Text style={dynamicStyles.sectionHeader}>ERROR</Text>
            <View style={[dynamicStyles.card, dynamicStyles.errorCard, styles.errorCard]}>
              <Text style={[styles.errorTitle, dynamicStyles.errorTitle]}>❌ Error</Text>
              <Text style={[styles.errorText, dynamicStyles.errorText]}>{error}</Text>
            </View>
          </View>
        )}

        {/* RESULTS CARD */}
        {result && (
          <View>
            <Text style={dynamicStyles.sectionHeader}>RESULTS</Text>
            <View style={[dynamicStyles.card, dynamicStyles.resultCard, styles.resultCard]}>
              <Text style={[styles.resultTitle, dynamicStyles.resultTitle]}>✅ Success</Text>

            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Status:</Text>
              <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                {result.success ? 'Success' : 'Failed'}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Execution ID:</Text>
              <Text style={[styles.resultValueSmall, dynamicStyles.resultValueSmall]}>{result.executionId}</Text>
            </View>

            <Text style={[styles.resultSectionTitle, dynamicStyles.resultSectionTitle]}>📊 Statistics</Text>
            {result.results ? (
              <>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Messages Fetched:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>{result.results.messagesFetched || 0}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Messages Categorized:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                    {result.results.messagesCategorized || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>FAQs Detected:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>{result.results.faqsDetected || 0}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Auto-Responses Sent:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                    {result.results.autoResponsesSent || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Responses Drafted:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                    {result.results.responsesDrafted || 0}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Needing Review:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                    {result.results.messagesNeedingReview || 0}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Raw Response:</Text>
                <Text style={[styles.resultValueSmall, dynamicStyles.resultValueSmall]}>
                  {JSON.stringify(result, null, 2)}
                </Text>
              </View>
            )}

            {result.metrics && (
              <>
                <Text style={[styles.resultSectionTitle, dynamicStyles.resultSectionTitle]}>⏱️ Performance</Text>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Duration:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>{result.metrics.duration}ms</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultLabel, dynamicStyles.resultLabel]}>Cost:</Text>
                  <Text style={[styles.resultValue, dynamicStyles.resultValue]}>
                    ${result.metrics.costIncurred?.toFixed(4) || '0.0000'}
                  </Text>
                </View>
              </>
            )}

            <View style={[styles.firestoreInfo, dynamicStyles.firestoreInfo]}>
              <Text style={[styles.firestoreTitle, dynamicStyles.firestoreTitle]}>📍 View in Firestore:</Text>
              <Text style={[styles.firestoreText, dynamicStyles.firestoreText]}>
                /users/{'{'}your-id{'}'}/daily_executions
              </Text>
              <Text style={[styles.firestoreText, dynamicStyles.firestoreText]}>
                /users/{'{'}your-id{'}'}/daily_digests
              </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Static layout styles (theme-aware colors are in dynamicStyles)
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
    lineHeight: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  userInfoCard: {
    marginTop: 0,
  },
  userInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  userInfoValue: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  errorCard: {
    borderLeftWidth: 4,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  resultCard: {
    borderLeftWidth: 4,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  resultLabel: {
    fontSize: 14,
  },
  resultValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  resultValueSmall: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'monospace',
    maxWidth: '60%',
  },
  firestoreInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  firestoreTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  firestoreText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  dataStatusCard: {
    borderLeftWidth: 4,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dataLabel: {
    fontSize: 14,
  },
  dataValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  warningRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 193, 7, 0.2)',
  },
  dataStatusText: {
    fontSize: 14,
    marginTop: 8,
  },
  dataStatusWarningText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
  },
});
