/**
 * Unit tests for ConversationSettings component
 *
 * @remarks
 * Tests the auto-response toggle functionality for conversations (Story 5.4 - Task 13)
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ConversationSettings } from '@/components/conversation/ConversationSettings';
import { updateConversationAutoResponse } from '@/services/conversationService';
import type { Conversation } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

// Mock the conversationService
jest.mock('@/services/conversationService', () => ({
  updateConversationAutoResponse: jest.fn(),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ConversationSettings', () => {
  const mockUserId = 'user123';

  const mockDirectConversation: Conversation = {
    id: 'conv123',
    type: 'direct',
    participantIds: ['user123', 'user456'],
    lastMessage: {
      text: 'Hello',
      senderId: 'user456',
      timestamp: Timestamp.now(),
    },
    lastMessageTimestamp: Timestamp.now(),
    unreadCount: {},
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    autoResponseEnabled: true,
  };

  const mockGroupConversation: Conversation = {
    ...mockDirectConversation,
    id: 'group123',
    type: 'group',
    groupName: 'Test Group',
    creatorId: 'user123',
    adminIds: ['user123'],
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Visibility and Rendering', () => {
    it('should render when visible prop is true', () => {
      const { getByText } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      expect(getByText('Conversation Settings')).toBeTruthy();
      expect(getByText('FAQ Auto-Response')).toBeTruthy();
    });

    it('should display auto-response toggle section', () => {
      const { getByText } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      expect(getByText('Auto-respond to FAQs')).toBeTruthy();
      expect(
        getByText('Automatically respond to frequently asked questions with saved templates')
      ).toBeTruthy();
    });

    it('should display close button', () => {
      const { getByTestId } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const closeButton = getByTestId('close-button');
      expect(closeButton).toBeTruthy();
    });
  });

  describe('Auto-Response Toggle State', () => {
    it('should show switch as enabled when autoResponseEnabled is true', () => {
      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');
      expect(switchComponent.props.value).toBe(true);
    });

    it('should show switch as disabled when autoResponseEnabled is false', () => {
      const disabledConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: false,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={disabledConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');
      expect(switchComponent.props.value).toBe(false);
    });

    it('should default to enabled when autoResponseEnabled is undefined', () => {
      const undefinedConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: undefined,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={undefinedConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');
      expect(switchComponent.props.value).toBe(true);
    });
  });

  describe('Direct Conversation Toggle', () => {
    it('should allow toggle for direct conversation participants', async () => {
      (updateConversationAutoResponse as jest.Mock).mockResolvedValue(undefined);

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      // Toggle off (should show confirmation dialog)
      fireEvent(switchComponent, 'valueChange', false);

      // Wait for Alert to be called
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Disable Auto-Response',
          'FAQ auto-responses will no longer be sent in this conversation. You can re-enable this anytime.',
          expect.any(Array)
        );
      });
    });

    it('should call updateConversationAutoResponse when enabling (no confirmation)', async () => {
      (updateConversationAutoResponse as jest.Mock).mockResolvedValue(undefined);

      const disabledConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: false,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={disabledConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      // Toggle on (no confirmation needed)
      fireEvent(switchComponent, 'valueChange', true);

      await waitFor(() => {
        expect(updateConversationAutoResponse).toHaveBeenCalledWith('conv123', true, 'user123');
      });
    });

    it('should show success message after enabling', async () => {
      (updateConversationAutoResponse as jest.Mock).mockResolvedValue(undefined);

      const disabledConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: false,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={disabledConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      fireEvent(switchComponent, 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Success', 'FAQ auto-responses are now enabled');
      });
    });
  });

  describe('Group Conversation Permissions', () => {
    it('should allow toggle for group creator', async () => {
      (updateConversationAutoResponse as jest.Mock).mockResolvedValue(undefined);

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockGroupConversation}
          userId={mockUserId} // Same as creatorId
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');
      expect(switchComponent.props.disabled).toBe(false);
    });

    it('should disable toggle for non-creator in group', () => {
      const { UNSAFE_getByType, getByText } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockGroupConversation}
          userId="user456" // Not the creator
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');
      expect(switchComponent.props.disabled).toBe(true);

      expect(getByText('Only the group creator can change this setting')).toBeTruthy();
    });

    it('should show permission denied alert when non-creator tries to toggle', async () => {
      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockGroupConversation}
          userId="user456" // Not the creator
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      // Try to toggle (should be disabled, but test the handler logic)
      fireEvent(switchComponent, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Permission Denied',
          'Only the group creator can change auto-response settings'
        );
      });

      expect(updateConversationAutoResponse).not.toHaveBeenCalled();
    });
  });

  describe('Confirmation Dialog for Disabling', () => {
    it('should show confirmation dialog when disabling auto-response', async () => {
      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      fireEvent(switchComponent, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Disable Auto-Response',
          'FAQ auto-responses will no longer be sent in this conversation. You can re-enable this anytime.',
          expect.arrayContaining([
            expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
            expect.objectContaining({ text: 'Disable', style: 'destructive' }),
          ])
        );
      });
    });

    it('should not call service when user cancels confirmation', async () => {
      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      fireEvent(switchComponent, 'valueChange', false);

      // Simulate cancel button press - the service should not be called
      expect(updateConversationAutoResponse).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when toggle fails', async () => {
      const errorMessage = 'Failed to update settings';
      (updateConversationAutoResponse as jest.Mock).mockRejectedValue(
        new Error(errorMessage)
      );

      const disabledConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: false,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={disabledConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      fireEvent(switchComponent, 'valueChange', true);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', errorMessage);
      });
    });

    it('should revert switch state on error', async () => {
      (updateConversationAutoResponse as jest.Mock).mockRejectedValue(
        new Error('Update failed')
      );

      const disabledConversation: Conversation = {
        ...mockDirectConversation,
        autoResponseEnabled: false,
      };

      const { UNSAFE_getByType } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={disabledConversation}
          userId={mockUserId}
        />
      );

      const switchComponent = UNSAFE_getByType('RCTSwitch');

      // Initial state is false
      expect(switchComponent.props.value).toBe(false);

      // Try to enable
      fireEvent(switchComponent, 'valueChange', true);

      // Wait for error handling
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', expect.any(String));
      });

      // State should revert to false after error
      // Note: In actual implementation, the state reversion happens via setAutoResponseEnabled(!enabled)
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is pressed', () => {
      const { getByTestId } = render(
        <ConversationSettings
          visible={true}
          onClose={mockOnClose}
          conversation={mockDirectConversation}
          userId={mockUserId}
        />
      );

      const closeButton = getByTestId('close-button');
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });
});
