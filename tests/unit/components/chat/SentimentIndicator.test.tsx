/**
 * SentimentIndicator Component Unit Tests
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SentimentIndicator } from '@/components/chat/SentimentIndicator';

describe('SentimentIndicator Component', () => {
  const defaultProps = {
    sentiment: 'negative' as const,
    sentimentScore: -0.65,
    emotionalTone: ['frustrated', 'disappointed'],
  };

  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator {...defaultProps} />
      );

      expect(getByAccessibilityHint(/detailed sentiment information/)).toBeTruthy();
    });

    it('should display sentiment label', () => {
      const { getByText } = render(
        <SentimentIndicator {...defaultProps} />
      );

      expect(getByText('Negative')).toBeTruthy();
    });

    it('should display sentiment score', () => {
      const { getByText } = render(
        <SentimentIndicator {...defaultProps} />
      );

      expect(getByText('-0.65')).toBeTruthy();
    });

    it('should display emotional tone tags when not inline', () => {
      const { getByText } = render(
        <SentimentIndicator {...defaultProps} inline={false} />
      );

      expect(getByText('frustrated')).toBeTruthy();
      expect(getByText('disappointed')).toBeTruthy();
    });

    it('should hide emotional tone tags when inline', () => {
      const { queryByText } = render(
        <SentimentIndicator {...defaultProps} inline={true} />
      );

      expect(queryByText('frustrated')).toBeNull();
      expect(queryByText('disappointed')).toBeNull();
    });

    it('should limit displayed tone tags to 3', () => {
      const { getByText, queryByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.6}
          emotionalTone={['angry', 'frustrated', 'sad', 'disappointed', 'hurt']}
        />
      );

      expect(getByText('angry')).toBeTruthy();
      expect(getByText('frustrated')).toBeTruthy();
      expect(getByText('sad')).toBeTruthy();
      expect(queryByText('disappointed')).toBeNull();
      expect(getByText('+2 more')).toBeTruthy();
    });

    it('should handle empty emotional tones array', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentIndicator
          sentiment="neutral"
          sentimentScore={0.1}
          emotionalTone={[]}
        />
      );

      expect(getByAccessibilityLabel(/none detected/)).toBeTruthy();
    });
  });

  describe('Sentiment Types', () => {
    it('should render positive sentiment correctly', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="positive"
          sentimentScore={0.85}
          emotionalTone={['happy', 'excited']}
        />
      );

      expect(getByText('Positive')).toBeTruthy();
      expect(getByText('0.85')).toBeTruthy();
    });

    it('should render negative sentiment correctly', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.75}
          emotionalTone={['angry', 'frustrated']}
        />
      );

      expect(getByText('Negative')).toBeTruthy();
      expect(getByText('-0.75')).toBeTruthy();
    });

    it('should render neutral sentiment correctly', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="neutral"
          sentimentScore={0.05}
          emotionalTone={[]}
        />
      );

      expect(getByText('Neutral')).toBeTruthy();
      expect(getByText('0.05')).toBeTruthy();
    });

    it('should render mixed sentiment correctly', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="mixed"
          sentimentScore={0.2}
          emotionalTone={['hopeful', 'uncertain']}
        />
      );

      expect(getByText('Mixed')).toBeTruthy();
      expect(getByText('0.20')).toBeTruthy();
    });
  });

  describe('Color Coding', () => {
    it('should use green color for positive sentiment (score >= 0.5)', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="positive"
          sentimentScore={0.8}
          emotionalTone={['happy']}
        />
      );

      const label = getByText('Positive');
      expect(label.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#22C55E' }),
        ])
      );
    });

    it('should use red color for negative sentiment (score < -0.5)', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.8}
          emotionalTone={['angry']}
        />
      );

      const label = getByText('Negative');
      expect(label.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#EF4444' }),
        ])
      );
    });

    it('should use gray color for neutral range (-0.5 to 0.5)', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="neutral"
          sentimentScore={0.2}
          emotionalTone={[]}
        />
      );

      const label = getByText('Neutral');
      expect(label.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#6B7280' }),
        ])
      );
    });
  });

  describe('Modal Interaction', () => {
    it('should show details modal when pressed', () => {
      const { getByAccessibilityHint, getByText } = render(
        <SentimentIndicator {...defaultProps} />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(button);

      expect(getByText('Sentiment Analysis')).toBeTruthy();
    });

    it('should display modal with all details', () => {
      const { getByAccessibilityHint, getByText } = render(
        <SentimentIndicator {...defaultProps} />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(button);

      expect(getByText('Sentiment Analysis')).toBeTruthy();
      expect(getByText('Classification:')).toBeTruthy();
      expect(getByText('Score:')).toBeTruthy();
      expect(getByText('Scale:')).toBeTruthy();
      expect(getByText('Emotional Tones:')).toBeTruthy();
      expect(getByText('-0.65 / 1.00')).toBeTruthy();
      expect(getByText('-1 (very negative) to +1 (very positive)')).toBeTruthy();
    });

    it('should display all emotional tones in modal', () => {
      const { getByAccessibilityHint, getByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.6}
          emotionalTone={['angry', 'frustrated', 'sad', 'disappointed']}
        />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(button);

      expect(getByText('• angry')).toBeTruthy();
      expect(getByText('• frustrated')).toBeTruthy();
      expect(getByText('• sad')).toBeTruthy();
      expect(getByText('• disappointed')).toBeTruthy();
    });

    it('should close modal when close button pressed', () => {
      const { getByAccessibilityHint, getByText, queryByText } = render(
        <SentimentIndicator {...defaultProps} />
      );

      // Open modal
      const openButton = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(openButton);
      expect(getByText('Sentiment Analysis')).toBeTruthy();

      // Close modal
      const closeButton = getByText('Close');
      fireEvent.press(closeButton);

      // Modal should be closed
      expect(queryByText('Sentiment Analysis')).toBeNull();
    });

    it('should close modal when overlay pressed', () => {
      const { getByAccessibilityHint, getByText, queryByText, getByAccessibilityLabel } = render(
        <SentimentIndicator {...defaultProps} />
      );

      // Open modal
      const openButton = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(openButton);
      expect(getByText('Sentiment Analysis')).toBeTruthy();

      // Close via overlay
      const overlay = getByAccessibilityLabel('Close sentiment details');
      fireEvent.press(overlay);

      // Modal should be closed
      expect(queryByText('Sentiment Analysis')).toBeNull();
    });
  });

  describe('Crisis Detection', () => {
    it('should show crisis warning in modal when score < -0.7', () => {
      const { getByAccessibilityHint, getByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.85}
          emotionalTone={['desperate', 'hopeless']}
        />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(button);

      expect(getByText(/Crisis Detected/)).toBeTruthy();
      expect(getByText(/Immediate attention recommended/)).toBeTruthy();
    });

    it('should not show crisis warning when score >= -0.7', () => {
      const { getByAccessibilityHint, queryByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.6}
          emotionalTone={['disappointed']}
        />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      fireEvent.press(button);

      expect(queryByText(/Crisis Detected/)).toBeNull();
    });

    it('should have assertive accessibility for crisis situations', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.85}
          emotionalTone={['desperate']}
        />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      expect(button.props.accessibilityLiveRegion).toBe('assertive');
      expect(button.props.accessibilityValue.text).toContain('Crisis detected');
    });

    it('should not have assertive accessibility for non-crisis', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.5}
          emotionalTone={['disappointed']}
        />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      expect(button.props.accessibilityLiveRegion).toBe('none');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible role as button', () => {
      const { getByA11yRole } = render(
        <SentimentIndicator {...defaultProps} />
      );

      expect(getByA11yRole('button')).toBeTruthy();
    });

    it('should provide comprehensive accessibility label', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentIndicator {...defaultProps} />
      );

      const element = getByAccessibilityLabel(
        /Message sentiment: Negative. Score: -0.65. Emotional tone: frustrated, disappointed/
      );
      expect(element).toBeTruthy();
    });

    it('should provide accessibility hint for interaction', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator {...defaultProps} />
      );

      expect(getByAccessibilityHint('Double tap for detailed sentiment information')).toBeTruthy();
    });

    it('should have appropriate hit slop for touch targets', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator {...defaultProps} />
      );

      const button = getByAccessibilityHint(/detailed sentiment information/);
      expect(button.props.hitSlop).toEqual({
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      });
    });
  });

  describe('Score Bar Visualization', () => {
    it('should position fill bar correctly for positive scores', () => {
      const { UNSAFE_getByProps } = render(
        <SentimentIndicator
          sentiment="positive"
          sentimentScore={0.8}
          emotionalTone={['happy']}
        />
      );

      // The fill bar should be positioned from center (left: 50%)
      const fillBar = UNSAFE_getByProps({
        style: expect.arrayContaining([
          expect.objectContaining({
            width: '80%', // 0.8 * 100%
            left: '50%',
          }),
        ]),
      });

      expect(fillBar).toBeTruthy();
    });

    it('should position fill bar correctly for negative scores', () => {
      const { UNSAFE_getByProps } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-0.6}
          emotionalTone={['frustrated']}
        />
      );

      // The fill bar should be positioned from center (right: 50%)
      const fillBar = UNSAFE_getByProps({
        style: expect.arrayContaining([
          expect.objectContaining({
            width: '60%', // abs(-0.6) * 100%
            right: '50%',
          }),
        ]),
      });

      expect(fillBar).toBeTruthy();
    });
  });

  describe('Inline Mode', () => {
    it('should apply inline styles when inline=true', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator {...defaultProps} inline={true} />
      );

      const container = getByAccessibilityHint(/detailed sentiment information/);
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            paddingVertical: 4,
            paddingHorizontal: 6,
          }),
        ])
      );
    });

    it('should use default styles when inline=false', () => {
      const { getByAccessibilityHint } = render(
        <SentimentIndicator {...defaultProps} inline={false} />
      );

      const container = getByAccessibilityHint(/detailed sentiment information/);
      expect(container.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            paddingVertical: 6,
            paddingHorizontal: 8,
          }),
        ])
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero score', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="neutral"
          sentimentScore={0}
          emotionalTone={[]}
        />
      );

      expect(getByText('0.00')).toBeTruthy();
    });

    it('should handle extreme positive score', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="positive"
          sentimentScore={1}
          emotionalTone={['ecstatic']}
        />
      );

      expect(getByText('1.00')).toBeTruthy();
    });

    it('should handle extreme negative score', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="negative"
          sentimentScore={-1}
          emotionalTone={['devastated']}
        />
      );

      expect(getByText('-1.00')).toBeTruthy();
    });

    it('should handle single emotional tone', () => {
      const { getByText } = render(
        <SentimentIndicator
          sentiment="positive"
          sentimentScore={0.7}
          emotionalTone={['happy']}
        />
      );

      expect(getByText('happy')).toBeTruthy();
    });

    it('should handle many emotional tones', () => {
      const tones = Array.from({ length: 10 }, (_, i) => `tone${i}`);
      const { getByText } = render(
        <SentimentIndicator
          sentiment="mixed"
          sentimentScore={0.1}
          emotionalTone={tones}
        />
      );

      expect(getByText('tone0')).toBeTruthy();
      expect(getByText('tone1')).toBeTruthy();
      expect(getByText('tone2')).toBeTruthy();
      expect(getByText('+7 more')).toBeTruthy();
    });
  });

  describe('Score Formatting', () => {
    it('should format scores to 2 decimal places', () => {
      const scores = [0.123456, -0.987654, 0.5, -0.33333];

      scores.forEach((score) => {
        const { getByText } = render(
          <SentimentIndicator
            sentiment="neutral"
            sentimentScore={score}
            emotionalTone={[]}
          />
        );

        expect(getByText(score.toFixed(2))).toBeTruthy();
      });
    });
  });
});
