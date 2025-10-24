/**
 * ResponseSuggestions component displays AI-generated response suggestions
 * with swipeable gesture controls
 *
 * @component
 * @remarks
 * Provides a swipeable carousel of voice-matched response suggestions.
 * Swipe right to accept, swipe left to reject, or tap to edit.
 * Uses react-native-gesture-handler for smooth swipe interactions.
 *
 * @example
 * ```tsx
 * <ResponseSuggestions
 *   conversationId="conv123"
 *   incomingMessageId="msg456"
 *   onAccept={(text) => setInputText(text)}
 *   onReject={(text) => trackRejection(text)}
 *   onEdit={(text) => setInputText(text)}
 * />
 * ```
 */

import React, { FC, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { ResponseCard } from './ResponseCard';
import {
  voiceMatchingService,
  VoiceMatchingErrorType,
  ResponseSuggestion,
} from '@/services/voiceMatchingService';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;
const SWIPE_THRESHOLD = 100; // Pixels required to trigger accept/reject

/**
 * Props for the ResponseSuggestions component
 */
export interface ResponseSuggestionsProps {
  /** ID of the conversation */
  conversationId: string;

  /** ID of the incoming message to respond to */
  incomingMessageId: string;

  /** Callback fired when user accepts a suggestion (swipe right) */
  onAccept: (text: string) => void;

  /** Callback fired when user rejects a suggestion (swipe left) */
  onReject: (suggestion: string) => void;

  /** Callback fired when user taps edit button */
  onEdit: (suggestion: string) => void;

  /** Number of suggestions to generate (1-3, default: 2) */
  suggestionCount?: number;

  /** Whether to show the component (default: true) */
  visible?: boolean;

  /** Callback fired when all suggestions are processed */
  onComplete?: () => void;
}

/**
 * Swipeable carousel of AI-generated response suggestions
 *
 * @component
 * @remarks
 * - Loads suggestions from voice matching service
 * - Swipe right (>100px) → accept suggestion
 * - Swipe left (<-100px) → reject suggestion
 * - Tap edit → populate input for manual editing
 * - Spring animations for smooth transitions
 * - Loading state during generation (2s timeout)
 * - Error states for all failure scenarios
 * - Auto-hides when all suggestions processed
 */
export const ResponseSuggestions: FC<ResponseSuggestionsProps> = ({
  conversationId,
  incomingMessageId,
  onAccept,
  onReject,
  onEdit,
  suggestionCount = 2,
  visible = true,
  onComplete,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  /**
   * Loads response suggestions from voice matching service
   */
  useEffect(() => {
    loadSuggestions();
  }, [conversationId, incomingMessageId]);

  /**
   * Fetches suggestions using voice matching service
   */
  const loadSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await voiceMatchingService.generateSuggestions(
        conversationId,
        incomingMessageId,
        suggestionCount
      );

      // Extract text from ResponseSuggestion objects
      const suggestionTexts = result.suggestions?.map((s) => s.text) || [];
      setSuggestions(suggestionTexts);
    } catch (err: any) {
      console.error('Failed to load suggestions:', err);

      // Handle specific error types
      const errorType = err.type as VoiceMatchingErrorType;
      switch (errorType) {
        case VoiceMatchingErrorType.PROFILE_NOT_FOUND:
          setError('Voice profile not trained. Train your profile in settings to use this feature.');
          break;
        case VoiceMatchingErrorType.INSUFFICIENT_DATA:
          setError('Not enough messages to generate suggestions. Keep chatting!');
          break;
        case VoiceMatchingErrorType.TIMEOUT:
          setError('Suggestion generation timed out. Please try again.');
          break;
        case VoiceMatchingErrorType.UNAUTHENTICATED:
          setError('Please sign in to use AI suggestions.');
          break;
        default:
          setError('Failed to load suggestions. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handles swipe gesture for accept/reject actions
   */
  const gestureHandler = {
    onStart: (_: any, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event: any, ctx: any) => {
      translateX.value = ctx.startX + event.translationX;
    },
    onEnd: (event: any) => {
      const currentSuggestion = suggestions[currentIndex];

      if (event.translationX > SWIPE_THRESHOLD) {
        // Swipe right: Accept
        translateX.value = withSpring(CARD_WIDTH, { damping: 15 });
        opacity.value = withSpring(0);

        runOnJS(handleAccept)(currentSuggestion);
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        // Swipe left: Reject
        translateX.value = withSpring(-CARD_WIDTH, { damping: 15 });
        opacity.value = withSpring(0);

        runOnJS(handleReject)(currentSuggestion);
      } else {
        // Return to center
        translateX.value = withSpring(0);
      }
    },
  };

  /**
   * Handles suggestion acceptance
   */
  const handleAccept = (suggestion: string) => {
    onAccept(suggestion);

    // Move to next suggestion after animation
    setTimeout(() => {
      moveToNext();
    }, 300);
  };

  /**
   * Handles suggestion rejection
   */
  const handleReject = (suggestion: string) => {
    onReject(suggestion);

    // Move to next suggestion after animation
    setTimeout(() => {
      moveToNext();
    }, 300);
  };

  /**
   * Handles edit button press
   */
  const handleEdit = (suggestion: string) => {
    onEdit(suggestion);
  };

  /**
   * Moves to the next suggestion in the carousel
   */
  const moveToNext = () => {
    if (currentIndex >= suggestions.length - 1) {
      // All suggestions processed
      onComplete?.();
      return;
    }

    setCurrentIndex((prev) => prev + 1);
    translateX.value = 0;
    opacity.value = 1;
  };

  /**
   * Handles retry after error
   */
  const handleRetry = () => {
    loadSuggestions();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  // Don't render if not visible
  if (!visible) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer} testID="loading-indicator">
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={styles.loadingText}>Generating suggestions...</Text>
        </View>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#FF3B30" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry} testID="retry-button">
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // All suggestions processed
  if (currentIndex >= suggestions.length || suggestions.length === 0) {
    return null;
  }

  // Render current suggestion card
  return (
    <GestureHandlerRootView style={styles.container}>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.cardContainer, animatedStyle]}>
          <ResponseCard
            text={suggestions[currentIndex]}
            index={currentIndex}
            total={suggestions.length}
            onEdit={() => handleEdit(suggestions[currentIndex])}
            showHints={true}
          />
        </Animated.View>
      </PanGestureHandler>

      {/* Swipe direction indicators */}
      <View style={styles.indicators}>
        <View style={styles.indicatorLeft}>
          <Ionicons name="close-circle" size={20} color="#FF3B30" />
        </View>
        <View style={styles.indicatorRight}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
        </View>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 160,
    marginVertical: 8,
    marginHorizontal: 20,
  },
  cardContainer: {
    width: CARD_WIDTH,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5FF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6C63FF',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#FFE5E5',
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  indicators: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    pointerEvents: 'none',
  },
  indicatorLeft: {
    opacity: 0.3,
  },
  indicatorRight: {
    opacity: 0.3,
  },
});
