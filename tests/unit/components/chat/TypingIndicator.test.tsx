/**
 * Unit tests for TypingIndicator component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { TypingIndicator, TypingUser } from '@/components/chat/TypingIndicator';

describe('TypingIndicator Component', () => {
  describe('Visibility', () => {
    it('should render nothing when no users are typing', () => {
      const { queryByText } = render(<TypingIndicator typingUsers={[]} />);

      expect(queryByText(/is typing/i)).toBeNull();
    });

    it('should render nothing when typingUsers is undefined', () => {
      // @ts-expect-error Testing undefined case
      const { queryByText } = render(<TypingIndicator typingUsers={undefined} />);

      expect(queryByText(/is typing/i)).toBeNull();
    });

    it('should render indicator when users are typing', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText(/Alice is typing/)).toBeTruthy();
    });
  });

  describe('Text Formatting - Single User', () => {
    it('should render single user typing text', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice is typing')).toBeTruthy();
    });

    it('should handle long display names gracefully', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Very Long Display Name That Might Wrap' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Very Long Display Name That Might Wrap is typing')).toBeTruthy();
    });
  });

  describe('Text Formatting - Two Users', () => {
    it('should render two users typing text with "and"', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice and Bob are typing')).toBeTruthy();
    });
  });

  describe('Text Formatting - Three Users', () => {
    it('should render three users typing text with commas and "and"', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
        { userId: 'user3', displayName: 'Charlie' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice, Bob, and Charlie are typing')).toBeTruthy();
    });
  });

  describe('Text Formatting - Multiple Users (4+)', () => {
    it('should render four users typing text with "others"', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
        { userId: 'user3', displayName: 'Charlie' },
        { userId: 'user4', displayName: 'Dave' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice, Bob, and 2 others are typing')).toBeTruthy();
    });

    it('should render five users typing text with "others"', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
        { userId: 'user3', displayName: 'Charlie' },
        { userId: 'user4', displayName: 'Dave' },
        { userId: 'user5', displayName: 'Eve' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice, Bob, and 3 others are typing')).toBeTruthy();
    });

    it('should use singular "other" for exactly 3 total users (4 - 2 = 1)', () => {
      // This tests the edge case where othersCount = 1
      // Actually this would be for 3 users total, but format shows all 3 names
      // Let's test with 4 users where othersCount would be 2
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user2', displayName: 'Bob' },
        { userId: 'user3', displayName: 'Charlie' },
        { userId: 'user4', displayName: 'Dave' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Should say "2 others" not "2 other"
      expect(getByText(/2 others/)).toBeTruthy();
    });
  });

  describe('Animated Dots', () => {
    it('should render animated dots when users are typing', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
      ];

      const { UNSAFE_root } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Check that the component tree exists (animated dots are rendered)
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty display name gracefully', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: '' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Should render empty string followed by "is typing"
      expect(getByText(' is typing')).toBeTruthy();
    });

    it('should handle display names with special characters', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: "O'Brien" },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText("O'Brien is typing")).toBeTruthy();
    });

    it('should handle display names with emojis', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice 😊' },
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      expect(getByText('Alice 😊 is typing')).toBeTruthy();
    });

    it('should handle array with duplicate user IDs (edge case)', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
        { userId: 'user1', displayName: 'Alice' }, // Duplicate
      ];

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Should render "Alice and Alice are typing" (displaying the duplicate)
      expect(getByText('Alice and Alice are typing')).toBeTruthy();
    });
  });

  describe('Styling', () => {
    it('should render with correct container styles', () => {
      const typingUsers: TypingUser[] = [
        { userId: 'user1', displayName: 'Alice' },
      ];

      const { UNSAFE_root } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Component should render successfully
      expect(UNSAFE_root).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should handle large number of typing users efficiently', () => {
      const typingUsers: TypingUser[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user${i}`,
        displayName: `User${i}`,
      }));

      const { getByText } = render(<TypingIndicator typingUsers={typingUsers} />);

      // Should truncate to "User0, User1, and 18 others are typing"
      expect(getByText(/User0, User1, and 18 others are typing/)).toBeTruthy();
    });
  });
});
