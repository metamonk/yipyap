/**
 * Unit tests for AddParticipantsModal component
 * @group unit
 */

import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { AddParticipantsModal } from '@/components/conversation/AddParticipantsModal';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/services/userService');
jest.mock('@/components/common/Avatar', () => ({
  Avatar: () => null,
}));
jest.mock('@/components/conversation/RecipientChip', () => ({
  RecipientChip: () => null,
}));

describe('AddParticipantsModal', () => {
  const mockConversation: Conversation = {
    id: 'conv123',
    type: 'group',
    participantIds: ['user1', 'user2', 'user3'],
    groupName: 'Test Group',
    creatorId: 'user1',
    lastMessage: {
      text: 'Hello',
      senderId: 'user1',
      timestamp: Timestamp.now(),
    },
    lastMessageTimestamp: Timestamp.now(),
    unreadCount: {},
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    conversation: mockConversation,
    onParticipantsAdded: jest.fn(),
  };

  it('should render when visible', () => {
    const { getByText } = render(<AddParticipantsModal {...defaultProps} />);
    expect(getByText('Add Members')).toBeTruthy();
  });

  it('should display group name and member count', () => {
    const { getByText } = render(<AddParticipantsModal {...defaultProps} />);
    expect(getByText('Test Group')).toBeTruthy();
    expect(getByText(/3 of 50 members/)).toBeTruthy();
  });

  it('should calculate remaining slots correctly', () => {
    const { getByText } = render(<AddParticipantsModal {...defaultProps} />);
    expect(getByText(/47 slots available/)).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(<AddParticipantsModal {...defaultProps} visible={false} />);
    expect(queryByText('Add Members')).toBeNull();
  });
});
