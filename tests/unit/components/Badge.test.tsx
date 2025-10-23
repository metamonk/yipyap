/**
 * Unit tests for Badge component
 * @module tests/unit/components/Badge
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Badge } from '@/components/common/Badge';

describe('Badge Component', () => {
  describe('rendering', () => {
    it('should render badge with correct count', () => {
      const { getByTestId } = render(<Badge count={5} variant="primary" />);

      expect(getByTestId('badge')).toBeTruthy();
      expect(getByTestId('badge-count')).toHaveTextContent('5');
    });

    it('should not render when count is 0', () => {
      const { queryByTestId } = render(<Badge count={0} variant="primary" />);

      expect(queryByTestId('badge')).toBeNull();
      expect(queryByTestId('badge-count')).toBeNull();
    });

    it('should not render when count is negative', () => {
      const { queryByTestId } = render(<Badge count={-5} variant="primary" />);

      expect(queryByTestId('badge')).toBeNull();
    });

    it('should render with count 1', () => {
      const { getByTestId } = render(<Badge count={1} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('1');
    });
  });

  describe('large counts', () => {
    it('should display "99+" for counts over 99', () => {
      const { getByTestId } = render(<Badge count={100} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('99+');
    });

    it('should display "99+" for count of 150', () => {
      const { getByTestId } = render(<Badge count={150} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('99+');
    });

    it('should display "99+" for count of 999', () => {
      const { getByTestId } = render(<Badge count={999} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('99+');
    });

    it('should display 99 for count of exactly 99', () => {
      const { getByTestId } = render(<Badge count={99} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('99');
    });

    it('should display 98 for count of 98', () => {
      const { getByTestId } = render(<Badge count={98} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('98');
    });
  });

  describe('variants', () => {
    it('should render with primary variant (blue background)', () => {
      const { getByTestId } = render(<Badge count={5} variant="primary" />);

      const badge = getByTestId('badge');
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#007AFF',
        })
      );
    });

    it('should render with danger variant (red background)', () => {
      const { getByTestId } = render(<Badge count={5} variant="danger" />);

      const badge = getByTestId('badge');
      expect(badge.props.style).toContainEqual(
        expect.objectContaining({
          backgroundColor: '#FF3B30',
        })
      );
    });

    it('should use correct color for both variants with different counts', () => {
      const { getByTestId: getByTestIdPrimary } = render(
        <Badge count={10} variant="primary" />
      );
      const { getByTestId: getByTestIdDanger } = render(<Badge count={20} variant="danger" />);

      const primaryBadge = getByTestIdPrimary('badge');
      const dangerBadge = getByTestIdDanger('badge');

      expect(primaryBadge.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#007AFF' })
      );
      expect(dangerBadge.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#FF3B30' })
      );
    });
  });

  describe('edge cases', () => {
    it('should handle very large counts', () => {
      const { getByTestId } = render(<Badge count={1000000} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('99+');
    });

    it('should render correctly for double-digit counts', () => {
      const { getByTestId } = render(<Badge count={42} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('42');
    });

    it('should render correctly for single-digit counts', () => {
      const { getByTestId } = render(<Badge count={7} variant="primary" />);

      expect(getByTestId('badge-count')).toHaveTextContent('7');
    });
  });

  describe('accessibility', () => {
    it('should have testID for badge container', () => {
      const { getByTestId } = render(<Badge count={5} variant="primary" />);

      expect(getByTestId('badge')).toBeTruthy();
    });

    it('should have testID for badge count text', () => {
      const { getByTestId } = render(<Badge count={5} variant="primary" />);

      expect(getByTestId('badge-count')).toBeTruthy();
    });
  });

  describe('styling', () => {
    it('should have consistent styling across different counts', () => {
      const { getByTestId: getByTestId1 } = render(<Badge count={1} variant="primary" />);
      const { getByTestId: getByTestId50 } = render(<Badge count={50} variant="primary" />);
      const { getByTestId: getByTestId100 } = render(<Badge count={100} variant="primary" />);

      // All should have same base styles
      expect(getByTestId1('badge').props.style).toBeDefined();
      expect(getByTestId50('badge').props.style).toBeDefined();
      expect(getByTestId100('badge').props.style).toBeDefined();
    });

    it('should render white text for all variants', () => {
      const { getByTestId: getByTestIdPrimary } = render(
        <Badge count={5} variant="primary" />
      );
      const { getByTestId: getByTestIdDanger } = render(<Badge count={5} variant="danger" />);

      const primaryCount = getByTestIdPrimary('badge-count');
      const dangerCount = getByTestIdDanger('badge-count');

      expect(primaryCount.props.style).toMatchObject({ color: '#FFFFFF' });
      expect(dangerCount.props.style).toMatchObject({ color: '#FFFFFF' });
    });
  });
});
