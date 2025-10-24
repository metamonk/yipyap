/**
 * Tests for OpportunityBadge component - Story 5.6
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { OpportunityBadge } from '@/components/conversation/OpportunityBadge';

describe('OpportunityBadge', () => {
  describe('Rendering', () => {
    it('should render with score', () => {
      const { getByText } = render(<OpportunityBadge score={85} />);
      expect(getByText('85')).toBeDefined();
    });

    it('should show icon by default', () => {
      const { UNSAFE_getByType } = render(<OpportunityBadge score={90} />);
      // Icon should be present by default
      expect(() => UNSAFE_getByType(require('@expo/vector-icons').Ionicons)).not.toThrow();
    });

    it('should hide icon when showIcon is false', () => {
      const { queryByTestId } = render(<OpportunityBadge score={75} showIcon={false} />);
      // When icon is hidden, there should be no icon component
      const { getByText } = render(<OpportunityBadge score={75} showIcon={false} />);
      expect(getByText('75')).toBeDefined();
    });
  });

  describe('Color Coding', () => {
    it('should use green colors for exceptional scores (>= 90)', () => {
      const { getByLabelText } = render(<OpportunityBadge score={95} />);
      const badge = getByLabelText('Business opportunity score: 95 out of 100');

      // Check that background is light green (DCFCE7)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#DCFCE7',
        })
      );
    });

    it('should use yellow/orange colors for high-value scores (80-89)', () => {
      const { getByLabelText } = render(<OpportunityBadge score={85} />);
      const badge = getByLabelText('Business opportunity score: 85 out of 100');

      // Check that background is light yellow (FEF3C7)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#FEF3C7',
        })
      );
    });

    it('should use blue colors for good scores (70-79)', () => {
      const { getByLabelText } = render(<OpportunityBadge score={75} />);
      const badge = getByLabelText('Business opportunity score: 75 out of 100');

      // Check that background is light blue (DBEAFE)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#DBEAFE',
        })
      );
    });
  });

  describe('Sizes', () => {
    it('should render small size by default', () => {
      const { getByText } = render(<OpportunityBadge score={80} />);
      const scoreText = getByText('80');

      // Small size should have fontSize: 10
      expect(scoreText.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fontSize: 10,
          }),
        ])
      );
    });

    it('should render medium size correctly', () => {
      const { getByText } = render(<OpportunityBadge score={80} size="medium" />);
      const scoreText = getByText('80');

      // Medium size should have fontSize: 12
      expect(scoreText.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fontSize: 12,
          }),
        ])
      );
    });

    it('should render large size correctly', () => {
      const { getByText } = render(<OpportunityBadge score={80} size="large" />);
      const scoreText = getByText('80');

      // Large size should have fontSize: 14
      expect(scoreText.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fontSize: 14,
          }),
        ])
      );
    });
  });

  describe('Accessibility', () => {
    it('should have accessibility label with score', () => {
      const { getByLabelText } = render(<OpportunityBadge score={90} />);
      expect(getByLabelText('Business opportunity score: 90 out of 100')).toBeDefined();
    });

    it('should have accessibilityRole set to text', () => {
      const { getByLabelText } = render(<OpportunityBadge score={85} />);
      const badge = getByLabelText('Business opportunity score: 85 out of 100');
      expect(badge.props.accessibilityRole).toBe('text');
    });
  });

  describe('Edge Cases', () => {
    it('should handle minimum score (0)', () => {
      const { getByText } = render(<OpportunityBadge score={0} />);
      expect(getByText('0')).toBeDefined();
    });

    it('should handle maximum score (100)', () => {
      const { getByText } = render(<OpportunityBadge score={100} />);
      expect(getByText('100')).toBeDefined();
    });

    it('should handle boundary score at 70', () => {
      const { getByLabelText } = render(<OpportunityBadge score={70} />);
      const badge = getByLabelText('Business opportunity score: 70 out of 100');

      // Score 70 should use blue color (good range)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#DBEAFE',
        })
      );
    });

    it('should handle boundary score at 80', () => {
      const { getByLabelText } = render(<OpportunityBadge score={80} />);
      const badge = getByLabelText('Business opportunity score: 80 out of 100');

      // Score 80 should use yellow color (high-value range)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#FEF3C7',
        })
      );
    });

    it('should handle boundary score at 90', () => {
      const { getByLabelText } = render(<OpportunityBadge score={90} />);
      const badge = getByLabelText('Business opportunity score: 90 out of 100');

      // Score 90 should use green color (exceptional range)
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#DCFCE7',
        })
      );
    });
  });
});
