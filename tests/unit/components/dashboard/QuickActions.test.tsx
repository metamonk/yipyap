/**
 * Unit tests for QuickActions component (Story 5.7 - Task 6)
 *
 * @remarks
 * Tests the Quick Actions Panel with bulk operations
 * (archive all read, mark all as read, batch approve suggestions).
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import type { BulkOperationResult } from '@/services/bulkOperationsService';

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock bulkOperationsService
jest.mock('@/services/bulkOperationsService', () => ({
  bulkOperationsService: {
    archiveAllRead: jest.fn(),
    markAllAsRead: jest.fn(),
  },
}));

/**
 * Mock successful operation result
 */
const mockSuccessResult: BulkOperationResult = {
  totalProcessed: 10,
  successCount: 10,
  failureCount: 0,
  errors: [],
  completed: true,
};

/**
 * Mock partial success result
 */
const mockPartialResult: BulkOperationResult = {
  totalProcessed: 10,
  successCount: 7,
  failureCount: 3,
  errors: ['Batch 2 failed: Network error'],
  completed: false,
};

describe('QuickActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render successfully', () => {
      const { getByText } = render(<QuickActions userId="test-user-123" />);

      expect(getByText('Quick Actions')).toBeTruthy();
    });

    it('should render all action buttons', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      expect(getByLabelText('Archive all read conversations')).toBeTruthy();
      expect(getByLabelText('Mark all messages as read')).toBeTruthy();
      // 'Batch approve AI suggestions' button removed in Story 6.7 (Epic 5 cleanup)
    });

    it('should use custom title when provided', () => {
      const { getByText } = render(
        <QuickActions userId="test-user-123" title="My Actions" />
      );

      expect(getByText('My Actions')).toBeTruthy();
    });

    it('should have accessibility label', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      expect(getByLabelText('Quick actions widget')).toBeTruthy();
    });
  });

  describe('Archive All Read action', () => {
    it('should show confirmation dialog when archive button is pressed', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Archive All Read',
        'Are you sure you want to archive all read conversations? This cannot be undone.',
        expect.any(Array)
      );
    });

    it('should call archiveAllRead when confirmed', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      // Get the confirm button callback from Alert.alert
      const alertCall = Alert.alert.mock.calls[0];
      const confirmButton = alertCall[2][1]; // Second button (Archive)
      await confirmButton.onPress();

      await waitFor(() => {
        expect(bulkOperationsService.archiveAllRead).toHaveBeenCalledWith(
          'test-user-123',
          expect.any(Function)
        );
      });
    });

    it('should show success alert when archiving succeeds', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Archived 10 conversations.'
        );
      });
    });

    it('should show partial success alert when some archives fail', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockResolvedValue(
        mockPartialResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Partial Success',
          expect.stringContaining('Archived 7 conversations, but 3 failed')
        );
      });
    });

    it('should show error alert when archiving fails', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to archive conversations. Please try again.'
        );
      });
    });

    it('should not call service when user cancels', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      expect(bulkOperationsService.archiveAllRead).not.toHaveBeenCalled();
    });
  });

  describe('Mark All as Read action', () => {
    it('should show confirmation dialog when mark read button is pressed', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Mark all messages as read'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Mark All as Read',
        'Are you sure you want to mark all messages as read?',
        expect.any(Array)
      );
    });

    it('should call markAllAsRead when confirmed', async () => {
      (bulkOperationsService.markAllAsRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Mark all messages as read'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(bulkOperationsService.markAllAsRead).toHaveBeenCalledWith(
          'test-user-123',
          expect.any(Function)
        );
      });
    });

    it('should show success alert when marking read succeeds', async () => {
      (bulkOperationsService.markAllAsRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Mark all messages as read'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Marked 10 messages as read.'
        );
      });
    });

    it('should show error alert when marking read fails', async () => {
      (bulkOperationsService.markAllAsRead as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Mark all messages as read'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to mark messages as read. Please try again.'
        );
      });
    });
  });

  describe('Progress tracking', () => {
    it('should show progress bar during operation', async () => {
      let progressCallback: any;
      (bulkOperationsService.archiveAllRead as jest.Mock).mockImplementation(
        (userId, onProgress) => {
          progressCallback = onProgress;
          return new Promise((resolve) => {
            setTimeout(() => {
              if (progressCallback) {
                progressCallback(5, 10, 50);
              }
              setTimeout(() => resolve(mockSuccessResult), 50);
            }, 50);
          });
        }
      );

      const { getByLabelText, getByText } = render(
        <QuickActions userId="test-user-123" />
      );

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(
        () => {
          expect(getByText('5 / 10 (50%)')).toBeTruthy();
        },
        { timeout: 3000 }
      );
    });

    it('should disable buttons during operation', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSuccessResult), 100))
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      confirmButton.onPress();

      await waitFor(() => {
        const archiveButton = getByLabelText('Archive all read conversations');
        expect(archiveButton.props.accessibilityState.disabled).toBe(true);
      });
    });
  });

  describe('Cooldown period', () => {
    it('should enforce 5-second cooldown between actions', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      // First action
      fireEvent.press(getByLabelText('Archive all read conversations'));
      const alertCall1 = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton1 = alertCall1[2][1];
      await confirmButton1.onPress();

      await waitFor(() => {
        expect(bulkOperationsService.archiveAllRead).toHaveBeenCalledTimes(1);
      });

      // Try second action immediately
      jest.clearAllMocks();
      fireEvent.press(getByLabelText('Mark all messages as read'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Please Wait',
        'Please wait a few seconds before performing another action.'
      );
      expect(bulkOperationsService.markAllAsRead).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible button labels', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      expect(getByLabelText('Archive all read conversations')).toBeTruthy();
      expect(getByLabelText('Mark all messages as read')).toBeTruthy();
    });

    it('should have button role', () => {
      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      const archiveButton = getByLabelText('Archive all read conversations');
      expect(archiveButton.props.accessibilityRole).toBe('button');
    });

    it('should indicate disabled state', async () => {
      (bulkOperationsService.archiveAllRead as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockSuccessResult), 100))
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      confirmButton.onPress();

      await waitFor(() => {
        const button = getByLabelText('Archive all read conversations');
        expect(button.props.accessibilityState.disabled).toBe(true);
      });
    });
  });

  describe('Singular vs plural messages', () => {
    it('should use singular for 1 item', async () => {
      const singleResult: BulkOperationResult = {
        ...mockSuccessResult,
        successCount: 1,
      };

      (bulkOperationsService.archiveAllRead as jest.Mock).mockResolvedValue(
        singleResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Archive all read conversations'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Archived 1 conversation.'
        );
      });
    });

    it('should use plural for multiple items', async () => {
      (bulkOperationsService.markAllAsRead as jest.Mock).mockResolvedValue(
        mockSuccessResult
      );

      const { getByLabelText } = render(<QuickActions userId="test-user-123" />);

      fireEvent.press(getByLabelText('Mark all messages as read'));

      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2][1];
      await confirmButton.onPress();

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Marked 10 messages as read.'
        );
      });
    });
  });
});
