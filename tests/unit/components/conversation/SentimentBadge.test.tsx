/**
 * SentimentBadge Component Unit Tests
 * Story 5.3 - Sentiment Analysis & Crisis Detection
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { SentimentBadge } from '@/components/conversation/SentimentBadge';

describe('SentimentBadge Component', () => {
  describe('Rendering', () => {
    it('should render without crashing', () => {
      const { getByAccessibilityHint } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      expect(getByAccessibilityHint(/Sentiment score ranges/)).toBeTruthy();
    });

    it('should render positive sentiment badge', () => {
      const { getByAccessibilityLabel, UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} size="medium" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      expect(texts.length).toBe(2); // Emoji + Symbol
      expect(getByAccessibilityLabel(/Positive sentiment/)).toBeTruthy();
    });

    it('should render negative sentiment badge', () => {
      const { getByAccessibilityLabel, UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="negative" sentimentScore={-0.6} size="medium" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      expect(texts.length).toBe(2); // Emoji + Symbol
      expect(getByAccessibilityLabel(/Negative sentiment/)).toBeTruthy();
    });

    it('should render neutral sentiment badge', () => {
      const { getByAccessibilityLabel, UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="neutral" sentimentScore={0.1} size="medium" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      expect(texts.length).toBe(2); // Emoji + Symbol
      expect(getByAccessibilityLabel(/Neutral sentiment/)).toBeTruthy();
    });

    it('should render mixed sentiment badge', () => {
      const { getByAccessibilityLabel, UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="mixed" sentimentScore={0.2} size="medium" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      expect(texts.length).toBe(2); // Emoji + Symbol
      expect(getByAccessibilityLabel(/Mixed sentiment/)).toBeTruthy();
    });
  });

  describe('Sizing', () => {
    it('should render small size by default', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const emoji = texts[0]; // First text is emoji
      expect(emoji.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 14 }),
        ])
      );
    });

    it('should render medium size when specified', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} size="medium" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const emoji = texts[0]; // First text is emoji
      expect(emoji.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 18 }),
        ])
      );
    });

    it('should render large size when specified', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} size="large" />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const emoji = texts[0]; // First text is emoji
      expect(emoji.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fontSize: 24 }),
        ])
      );
    });
  });

  describe('Accessibility', () => {
    it('should have accessible role', () => {
      const { getByA11yRole } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      expect(getByA11yRole('text')).toBeTruthy();
    });

    it('should provide descriptive accessibility label for positive sentiment', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.85} />
      );

      const element = getByAccessibilityLabel(/Positive sentiment/);
      expect(element.props.accessibilityLabel).toContain('Score: 0.85 positive');
    });

    it('should provide descriptive accessibility label for negative sentiment', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="negative" sentimentScore={-0.75} />
      );

      const element = getByAccessibilityLabel(/Negative sentiment/);
      expect(element.props.accessibilityLabel).toContain('Score: 0.75 negative');
    });

    it('should include accessibility hint explaining score range', () => {
      const { getByAccessibilityHint } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      const element = getByAccessibilityHint(/Sentiment score ranges from -1/);
      expect(element.props.accessibilityHint).toContain('very negative');
      expect(element.props.accessibilityHint).toContain('very positive');
    });

    it('should hide emoji and symbol from screen readers', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const emoji = texts[0];
      const symbol = texts[1];

      expect(emoji.props.accessibilityElementsHidden).toBe(true);
      expect(emoji.props.importantForAccessibility).toBe('no');
      expect(symbol.props.accessibilityElementsHidden).toBe(true);
      expect(symbol.props.importantForAccessibility).toBe('no');
    });
  });

  describe('Color Coding', () => {
    it('should use green color for positive sentiment', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.8} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const symbol = texts[1]; // Second text is symbol
      expect(symbol.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#22C55E' }),
        ])
      );
    });

    it('should use red color for negative sentiment', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="negative" sentimentScore={-0.6} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const symbol = texts[1]; // Second text is symbol
      expect(symbol.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#EF4444' }),
        ])
      );
    });

    it('should use gray color for neutral sentiment', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="neutral" sentimentScore={0.1} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const symbol = texts[1]; // Second text is symbol
      expect(symbol.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#6B7280' }),
        ])
      );
    });

    it('should use amber color for mixed sentiment', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment="mixed" sentimentScore={0.2} />
      );

      const texts = UNSAFE_getAllByType('Text' as any);
      const symbol = texts[1]; // Second text is symbol
      expect(symbol.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ color: '#F59E0B' }),
        ])
      );
    });
  });

  describe('Score Display', () => {
    it('should handle positive sentiment score', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="positive" sentimentScore={0.92} />
      );

      expect(getByAccessibilityLabel(/Score: 0.92 positive/)).toBeTruthy();
    });

    it('should handle negative sentiment score', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="negative" sentimentScore={-0.85} />
      );

      expect(getByAccessibilityLabel(/Score: 0.85 negative/)).toBeTruthy();
    });

    it('should handle zero score', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="neutral" sentimentScore={0} />
      );

      expect(getByAccessibilityLabel(/Score: 0.00 positive/)).toBeTruthy();
    });

    it('should handle extreme scores', () => {
      const positiveRender = render(
        <SentimentBadge sentiment="positive" sentimentScore={1} />
      );
      expect(positiveRender.getByAccessibilityLabel(/Score: 1.00 positive/)).toBeTruthy();

      const negativeRender = render(
        <SentimentBadge sentiment="negative" sentimentScore={-1} />
      );
      expect(negativeRender.getByAccessibilityLabel(/Score: 1.00 negative/)).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid sentiment type gracefully', () => {
      const { UNSAFE_getAllByType } = render(
        <SentimentBadge sentiment={'invalid' as any} sentimentScore={0.5} />
      );

      // Should default to neutral (2 text elements: emoji + symbol)
      const texts = UNSAFE_getAllByType('Text' as any);
      expect(texts.length).toBe(2);
    });

    it('should render with very small score', () => {
      const { getByAccessibilityHint } = render(
        <SentimentBadge sentiment="neutral" sentimentScore={0.001} />
      );

      expect(getByAccessibilityHint(/Current score: 0.00/)).toBeTruthy();
    });

    it('should render with crisis-level score', () => {
      const { getByAccessibilityLabel } = render(
        <SentimentBadge sentiment="negative" sentimentScore={-0.95} />
      );

      const element = getByAccessibilityLabel(/Negative sentiment/);
      expect(element).toBeTruthy();
      expect(element.props.accessibilityLabel).toContain('Score: 0.95 negative');
    });
  });

  describe('Visual Consistency', () => {
    it('should always show both emoji and symbol', () => {
      const sentiments: Array<'positive' | 'negative' | 'neutral' | 'mixed'> = [
        'positive',
        'negative',
        'neutral',
        'mixed',
      ];

      sentiments.forEach((sentiment) => {
        const { UNSAFE_getAllByType } = render(
          <SentimentBadge sentiment={sentiment} sentimentScore={0.5} />
        );

        const textElements = UNSAFE_getAllByType('Text' as any);
        expect(textElements.length).toBe(2); // Emoji + Symbol
      });
    });

    it('should maintain aspect ratio across sizes', () => {
      const sizes: Array<'small' | 'medium' | 'large'> = ['small', 'medium', 'large'];
      const expectedFontSizes = [14, 18, 24];

      sizes.forEach((size, index) => {
        const { UNSAFE_getAllByType } = render(
          <SentimentBadge sentiment="positive" sentimentScore={0.8} size={size} />
        );

        const texts = UNSAFE_getAllByType('Text' as any);
        const emoji = texts[0];
        expect(emoji.props.style).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ fontSize: expectedFontSizes[index] }),
          ])
        );
      });
    });
  });
});
