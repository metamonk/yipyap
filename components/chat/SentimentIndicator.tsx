/**
 * SentimentIndicator Component
 * Displays detailed sentiment information with score bar and emotional tones
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Pressable } from 'react-native';

/**
 * Props for SentimentIndicator component
 */
export interface SentimentIndicatorProps {
  /** Sentiment classification */
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';

  /** Sentiment score (-1 to 1) */
  sentimentScore: number;

  /** Array of emotional tones */
  emotionalTone: string[];

  /** Whether to display inline (compact) or expanded */
  inline?: boolean;
}

/**
 * SentimentIndicator Component
 *
 * Displays sentiment with score bar and emotional tone tags.
 * Shows detailed sentiment info on tap. Includes full accessibility support.
 *
 * @component
 * @example
 * ```tsx
 * <SentimentIndicator
 *   sentiment="negative"
 *   sentimentScore={-0.65}
 *   emotionalTone={['frustrated', 'disappointed']}
 *   inline={true}
 * />
 * ```
 */
export const SentimentIndicator: React.FC<SentimentIndicatorProps> = ({
  sentiment,
  sentimentScore,
  emotionalTone,
  inline = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Get color for sentiment score
   */
  const getScoreColor = (): string => {
    if (sentimentScore >= 0.5) return '#22C55E'; // Green (positive)
    if (sentimentScore >= -0.5) return '#6B7280'; // Gray (neutral)
    return '#EF4444'; // Red (negative)
  };

  /**
   * Get sentiment label
   */
  const getSentimentLabel = (): string => {
    return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
  };

  /**
   * Get accessibility label
   */
  const getAccessibilityLabel = (): string => {
    const tones = emotionalTone.length > 0 ? emotionalTone.join(', ') : 'none detected';
    return `Message sentiment: ${getSentimentLabel()}. Score: ${sentimentScore.toFixed(2)}. Emotional tone: ${tones}`;
  };

  /**
   * Announce crisis detection
   */
  const announceIfCrisis = () => {
    if (sentimentScore < -0.7) {
      // Announce to screen readers with high priority
      return 'Crisis detected: Very negative sentiment requiring immediate attention.';
    }
    return '';
  };

  const scoreColor = getScoreColor();
  const crisisAnnouncement = announceIfCrisis();

  return (
    <>
      <TouchableOpacity
        style={[styles.container, inline && styles.inline]}
        onPress={() => setShowDetails(true)}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel={getAccessibilityLabel()}
        accessibilityHint="Double tap for detailed sentiment information"
        accessibilityLiveRegion={crisisAnnouncement ? 'assertive' : 'none'}
        accessibilityValue={{ text: crisisAnnouncement }}
        // Minimum touch target: 44x44 (iOS HIG / Material Design)
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {/* Sentiment Label */}
        <Text style={[styles.sentimentLabel, { color: scoreColor }]}>
          {getSentimentLabel()}
        </Text>

        {/* Score Bar with pattern for color-blind accessibility */}
        <View style={styles.scoreBarContainer}>
          <View style={styles.scoreBarBackground}>
            {/* Background pattern for color-blind users */}
            <View style={[styles.scoreBarPattern, { opacity: 0.1 }]} />

            {/* Colored fill bar */}
            <View
              style={[
                styles.scoreBarFill,
                {
                  width: `${Math.abs(sentimentScore) * 100}%`,
                  backgroundColor: scoreColor,
                  [sentimentScore >= 0 ? 'left' : 'right']: '50%',
                },
              ]}
            />

            {/* Center marker */}
            <View style={styles.scoreBarCenter} />
          </View>

          {/* Score text */}
          <Text style={styles.scoreText}>{sentimentScore.toFixed(2)}</Text>
        </View>

        {/* Emotional Tone Tags */}
        {!inline && emotionalTone.length > 0 && (
          <View
            style={styles.tonesContainer}
            accessible={true}
            accessibilityRole="text"
            accessibilityLabel={`Emotional tones: ${emotionalTone.join(', ')}`}
          >
            {emotionalTone.slice(0, 3).map((tone, index) => (
              <View key={index} style={[styles.toneTag, { borderColor: scoreColor }]}>
                <Text style={[styles.toneText, { color: scoreColor }]}>
                  {tone}
                </Text>
              </View>
            ))}
            {emotionalTone.length > 3 && (
              <Text style={styles.moreText}>+{emotionalTone.length - 3} more</Text>
            )}
          </View>
        )}
      </TouchableOpacity>

      {/* Details Modal */}
      <Modal
        visible={showDetails}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDetails(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowDetails(false)}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Close sentiment details"
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Sentiment Analysis</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Classification:</Text>
              <Text style={[styles.modalValue, { color: scoreColor }]}>
                {getSentimentLabel()}
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Score:</Text>
              <Text style={styles.modalValue}>
                {sentimentScore.toFixed(2)} / 1.00
              </Text>
            </View>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>Scale:</Text>
              <Text style={styles.modalValueSmall}>
                -1 (very negative) to +1 (very positive)
              </Text>
            </View>

            {emotionalTone.length > 0 && (
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Emotional Tones:</Text>
                <View style={styles.modalTonesContainer}>
                  {emotionalTone.map((tone, index) => (
                    <Text key={index} style={styles.modalTone}>
                      • {tone}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {sentimentScore < -0.7 && (
              <View style={styles.crisisWarning}>
                <Text style={styles.crisisText}>
                  ⚠️ Crisis Detected - Immediate attention recommended
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowDetails(false)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    minWidth: 120,
  },
  inline: {
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  sentimentLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  scoreBarPattern: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
  scoreBarFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
  },
  scoreBarCenter: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: '100%',
    backgroundColor: '#1F2937',
    marginLeft: -1,
  },
  scoreText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4B5563',
    minWidth: 36,
    textAlign: 'right',
  },
  tonesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  toneTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
  },
  toneText: {
    fontSize: 10,
    fontWeight: '500',
  },
  moreText: {
    fontSize: 10,
    color: '#6B7280',
    alignSelf: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1F2937',
  },
  modalRow: {
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  modalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalValueSmall: {
    fontSize: 13,
    color: '#4B5563',
  },
  modalTonesContainer: {
    gap: 4,
  },
  modalTone: {
    fontSize: 14,
    color: '#4B5563',
  },
  crisisWarning: {
    backgroundColor: '#FEE2E2',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  crisisText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    // Minimum touch target
    minHeight: 44,
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
