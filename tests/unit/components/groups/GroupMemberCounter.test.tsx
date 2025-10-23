/**
 * Unit tests for GroupMemberCounter component
 * @module tests/unit/components/groups/GroupMemberCounter.test
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupMemberCounter } from '@/components/groups/GroupMemberCounter';
import { GROUP_SIZE_LIMIT } from '@/constants/groupLimits';

describe('GroupMemberCounter', () => {
  describe('rendering', () => {
    it('should render with success severity', () => {
      const { getByText, getByTestId } = render(
        <GroupMemberCounter count={5} severity="success" />
      );

      expect(getByText(`5 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
      expect(getByTestId('group-member-counter')).toBeTruthy();
    });

    it('should render with warning severity', () => {
      const { getByText, getByTestId } = render(
        <GroupMemberCounter count={8} severity="warning" />
      );

      expect(getByText(`8 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
      expect(getByTestId('group-member-counter')).toBeTruthy();
    });

    it('should render with error severity', () => {
      const { getByText, getByTestId } = render(
        <GroupMemberCounter count={11} severity="error" />
      );

      expect(getByText(`11 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
      expect(getByTestId('group-member-counter')).toBeTruthy();
    });

    it('should render progress bar by default', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      expect(getByTestId('group-member-counter-progress-container')).toBeTruthy();
      expect(getByTestId('group-member-counter-progress-fill')).toBeTruthy();
    });

    it('should hide progress bar when showProgressBar is false', () => {
      const { queryByTestId } = render(
        <GroupMemberCounter count={5} severity="success" showProgressBar={false} />
      );

      expect(queryByTestId('group-member-counter-progress-container')).toBeNull();
      expect(queryByTestId('group-member-counter-progress-fill')).toBeNull();
    });

    it('should use custom testID when provided', () => {
      const { getByTestId } = render(
        <GroupMemberCounter count={5} severity="success" testID="custom-counter" />
      );

      expect(getByTestId('custom-counter')).toBeTruthy();
      expect(getByTestId('custom-counter-text')).toBeTruthy();
      expect(getByTestId('custom-counter-progress-container')).toBeTruthy();
    });
  });

  describe('counter text', () => {
    it('should display correct count format', () => {
      const { getByText } = render(<GroupMemberCounter count={3} severity="success" />);

      expect(getByText(`3 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
    });

    it('should update when count changes', () => {
      const { getByText, rerender } = render(
        <GroupMemberCounter count={5} severity="success" />
      );

      expect(getByText(`5 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();

      rerender(<GroupMemberCounter count={8} severity="warning" />);

      expect(getByText(`8 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
    });
  });

  describe('color coding', () => {
    it('should apply green color for success severity', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#4CAF50' });

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#4CAF50' })
      );
    });

    it('should apply orange color for warning severity', () => {
      const { getByTestId } = render(<GroupMemberCounter count={8} severity="warning" />);

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#FF9800' });

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#FF9800' })
      );
    });

    it('should apply red color for error severity', () => {
      const { getByTestId } = render(<GroupMemberCounter count={11} severity="error" />);

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.style).toContainEqual({ color: '#F44336' });

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ backgroundColor: '#F44336' })
      );
    });
  });

  describe('progress bar', () => {
    it('should show 50% progress for half the limit', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ width: '50%' })
      );
    });

    it('should show 80% progress for 8 members', () => {
      const { getByTestId } = render(<GroupMemberCounter count={8} severity="warning" />);

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ width: '80%' })
      );
    });

    it('should show 100% progress for limit reached', () => {
      const { getByTestId } = render(<GroupMemberCounter count={10} severity="warning" />);

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ width: '100%' })
      );
    });

    it('should cap progress at 100% for over limit', () => {
      const { getByTestId } = render(<GroupMemberCounter count={15} severity="error" />);

      const progressFill = getByTestId('group-member-counter-progress-fill');
      expect(progressFill.props.style).toContainEqual(
        expect.objectContaining({ width: '100%' })
      );
    });
  });

  describe('accessibility', () => {
    it('should have accessible text role', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      const counterText = getByTestId('group-member-counter-text');
      expect(counterText.props.accessibilityRole).toBe('text');
    });

    it('should have accessible progressbar role', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      const progressContainer = getByTestId('group-member-counter-progress-container');
      expect(progressContainer.props.accessibilityRole).toBe('progressbar');
    });

    it('should provide accessibility values for progress bar', () => {
      const { getByTestId } = render(<GroupMemberCounter count={7} severity="success" />);

      const progressContainer = getByTestId('group-member-counter-progress-container');
      expect(progressContainer.props.accessibilityValue).toEqual({
        min: 0,
        max: GROUP_SIZE_LIMIT,
        now: 7,
      });
    });

    it('should have descriptive accessibility label when not at limit', () => {
      const { getByTestId } = render(<GroupMemberCounter count={5} severity="success" />);

      const container = getByTestId('group-member-counter');
      expect(container.props.accessibilityLabel).toContain('5 of 10 members selected');
      expect(container.props.accessibilityLabel).toContain('5 slots remaining');
    });

    it('should have limit warning in accessibility label when limit reached', () => {
      const { getByTestId } = render(<GroupMemberCounter count={10} severity="warning" />);

      const container = getByTestId('group-member-counter');
      expect(container.props.accessibilityLabel).toContain('Group member limit reached');
    });
  });

  describe('edge cases', () => {
    it('should handle 0 members', () => {
      const { getByText } = render(<GroupMemberCounter count={0} severity="success" />);

      expect(getByText(`0 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
    });

    it('should handle 1 member', () => {
      const { getByText } = render(<GroupMemberCounter count={1} severity="success" />);

      expect(getByText(`1 of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
    });

    it('should handle exactly at limit', () => {
      const { getByText } = render(
        <GroupMemberCounter count={GROUP_SIZE_LIMIT} severity="warning" />
      );

      expect(getByText(`${GROUP_SIZE_LIMIT} of ${GROUP_SIZE_LIMIT} members`)).toBeTruthy();
    });
  });
});
