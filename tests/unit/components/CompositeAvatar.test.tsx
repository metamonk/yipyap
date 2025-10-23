/**
 * Tests for CompositeAvatar component
 *
 * @remarks
 * Tests the composite avatar display for group conversations,
 * fixing the issue where groups showed only a single avatar.
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { CompositeAvatar } from '@/components/common/CompositeAvatar';

// Mock the Avatar component
jest.mock('@/components/common/Avatar', () => ({
  Avatar: jest.fn(({ displayName, size, photoURL }) => {
    const MockAvatar = require('react-native').View;
    return (
      <MockAvatar
        testID={`avatar-${displayName}`}
        accessibilityLabel={`Avatar for ${displayName}`}
        style={{ width: size, height: size }}
      >
        {photoURL && <MockAvatar testID={`avatar-photo-${displayName}`} />}
      </MockAvatar>
    );
  }),
}));

describe('CompositeAvatar', () => {
  const mockParticipants = [
    { photoURL: 'https://example.com/user1.jpg', displayName: 'User One' },
    { photoURL: 'https://example.com/user2.jpg', displayName: 'User Two' },
    { photoURL: null, displayName: 'User Three' },
    { photoURL: 'https://example.com/user4.jpg', displayName: 'User Four' },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering behavior', () => {
    it('should render default avatar when no participants', () => {
      const { getByTestId } = render(<CompositeAvatar participants={[]} size={48} />);

      expect(getByTestId('avatar-Group')).toBeTruthy();
    });

    it('should render single avatar for one participant', () => {
      const singleParticipant = [mockParticipants[0]];
      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={singleParticipant} size={48} />
      );

      expect(getByTestId('avatar-User One')).toBeTruthy();
      expect(queryByTestId('avatar-User Two')).toBeNull();
    });

    it('should render multiple avatars for group', () => {
      const { getByTestId } = render(
        <CompositeAvatar participants={mockParticipants.slice(0, 3)} size={48} />
      );

      expect(getByTestId('avatar-User One')).toBeTruthy();
      expect(getByTestId('avatar-User Two')).toBeTruthy();
      expect(getByTestId('avatar-User Three')).toBeTruthy();
    });

    it('should respect maxDisplay parameter', () => {
      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={mockParticipants} size={48} maxDisplay={2} />
      );

      // Should only show first 2
      expect(getByTestId('avatar-User One')).toBeTruthy();
      expect(getByTestId('avatar-User Two')).toBeTruthy();
      expect(queryByTestId('avatar-User Three')).toBeNull();
      expect(queryByTestId('avatar-User Four')).toBeNull();
    });

    it('should use default maxDisplay of 3', () => {
      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={mockParticipants} size={48} />
      );

      // Should show first 3 by default
      expect(getByTestId('avatar-User One')).toBeTruthy();
      expect(getByTestId('avatar-User Two')).toBeTruthy();
      expect(getByTestId('avatar-User Three')).toBeTruthy();
      expect(queryByTestId('avatar-User Four')).toBeNull();
    });
  });

  describe('Size calculations', () => {
    it('should calculate correct avatar sizes', () => {
      const size = 60;
      const expectedAvatarSize = size * 0.6; // 36

      const { getByTestId } = render(
        <CompositeAvatar participants={mockParticipants.slice(0, 2)} size={size} />
      );

      const avatar1 = getByTestId('avatar-User One');
      const avatar2 = getByTestId('avatar-User Two');

      expect(avatar1.props.style.width).toBe(expectedAvatarSize);
      expect(avatar1.props.style.height).toBe(expectedAvatarSize);
      expect(avatar2.props.style.width).toBe(expectedAvatarSize);
      expect(avatar2.props.style.height).toBe(expectedAvatarSize);
    });

    it('should use default size of 48', () => {
      const { getByTestId } = render(<CompositeAvatar participants={[mockParticipants[0]]} />);

      const avatar = getByTestId('avatar-User One');
      expect(avatar.props.style.width).toBe(48);
      expect(avatar.props.style.height).toBe(48);
    });

    it('should use full size for single participant', () => {
      const size = 60;
      const { getByTestId } = render(
        <CompositeAvatar participants={[mockParticipants[0]]} size={size} />
      );

      const avatar = getByTestId('avatar-User One');
      expect(avatar.props.style.width).toBe(size);
      expect(avatar.props.style.height).toBe(size);
    });
  });

  describe('Photo URL handling', () => {
    it('should handle participants with photos', () => {
      const participantsWithPhotos = mockParticipants.filter((p) => p.photoURL);
      const { getByTestId } = render(
        <CompositeAvatar participants={participantsWithPhotos} size={48} />
      );

      expect(getByTestId('avatar-photo-User One')).toBeTruthy();
      expect(getByTestId('avatar-photo-User Two')).toBeTruthy();
    });

    it('should handle participants without photos', () => {
      const participantsWithoutPhotos = [
        { photoURL: null, displayName: 'No Photo User' },
        { photoURL: undefined, displayName: 'Undefined Photo User' },
      ];

      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={participantsWithoutPhotos} size={48} />
      );

      expect(getByTestId('avatar-No Photo User')).toBeTruthy();
      expect(queryByTestId('avatar-photo-No Photo User')).toBeNull();
      expect(getByTestId('avatar-Undefined Photo User')).toBeTruthy();
      expect(queryByTestId('avatar-photo-Undefined Photo User')).toBeNull();
    });

    it('should handle mixed photo availability', () => {
      const mixedParticipants = [
        { photoURL: 'https://example.com/user.jpg', displayName: 'With Photo' },
        { photoURL: null, displayName: 'Without Photo' },
      ];

      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={mixedParticipants} size={48} />
      );

      expect(getByTestId('avatar-photo-With Photo')).toBeTruthy();
      expect(queryByTestId('avatar-photo-Without Photo')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string display names', () => {
      const emptyNameParticipants = [{ photoURL: null, displayName: '' }];

      const { getByTestId } = render(
        <CompositeAvatar participants={emptyNameParticipants} size={48} />
      );

      expect(getByTestId('avatar-')).toBeTruthy();
    });

    it('should handle very long participant lists', () => {
      const manyParticipants = Array.from({ length: 20 }, (_, i) => ({
        photoURL: null,
        displayName: `User ${i + 1}`,
      }));

      const { getByTestId, queryByTestId } = render(
        <CompositeAvatar participants={manyParticipants} size={48} />
      );

      // Should only show maxDisplay (default 3)
      expect(getByTestId('avatar-User 1')).toBeTruthy();
      expect(getByTestId('avatar-User 2')).toBeTruthy();
      expect(getByTestId('avatar-User 3')).toBeTruthy();
      expect(queryByTestId('avatar-User 4')).toBeNull();
      expect(queryByTestId('avatar-User 20')).toBeNull();
    });

    it('should handle duplicate display names', () => {
      const duplicateParticipants = [
        { photoURL: 'https://example.com/1.jpg', displayName: 'John' },
        { photoURL: 'https://example.com/2.jpg', displayName: 'John' },
        { photoURL: null, displayName: 'John' },
      ];

      const { getAllByTestId } = render(
        <CompositeAvatar participants={duplicateParticipants} size={48} />
      );

      // All three Johns should be rendered
      const johnAvatars = getAllByTestId('avatar-John');
      expect(johnAvatars).toHaveLength(3);
    });

    it('should handle special characters in display names', () => {
      const specialCharParticipants = [
        { photoURL: null, displayName: 'User @123' },
        { photoURL: null, displayName: 'User #$%' },
        { photoURL: null, displayName: '用户' },
      ];

      const { getByTestId } = render(
        <CompositeAvatar participants={specialCharParticipants} size={48} />
      );

      expect(getByTestId('avatar-User @123')).toBeTruthy();
      expect(getByTestId('avatar-User #$%')).toBeTruthy();
      expect(getByTestId('avatar-用户')).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should be memoized', () => {
      const participants = mockParticipants.slice(0, 2);
      const { rerender } = render(<CompositeAvatar participants={participants} size={48} />);

      // Get the Avatar mock to check call count
      const AvatarMock = require('@/components/common/Avatar').Avatar;
      const initialCallCount = AvatarMock.mock.calls.length;

      // Re-render with same props
      rerender(<CompositeAvatar participants={participants} size={48} />);

      // Should not re-render Avatar components
      expect(AvatarMock.mock.calls.length).toBe(initialCallCount);
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for avatars', () => {
      const { getByLabelText } = render(
        <CompositeAvatar participants={mockParticipants.slice(0, 2)} size={48} />
      );

      expect(getByLabelText('Avatar for User One')).toBeTruthy();
      expect(getByLabelText('Avatar for User Two')).toBeTruthy();
    });
  });
});
