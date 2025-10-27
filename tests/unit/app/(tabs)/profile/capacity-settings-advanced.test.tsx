/**
 * Unit tests for advanced capacity settings (Story 6.5)
 * Tests boundary message editor, toggles, and validation
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CapacitySettingsScreen from '@/app/(tabs)/profile/capacity-settings';
import * as userService from '@/services/userService';
import * as capacityService from '@/services/capacityService';
import { DEFAULT_BOUNDARY_MESSAGE } from '@/types/user';

// Mock dependencies
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({
    currentUser: { uid: 'test-user-123' },
  })),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

jest.mock('@/services/userService');
jest.mock('@/services/capacityService');

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('Advanced Capacity Settings (Story 6.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock default responses
    (userService.getCapacitySettings as jest.Mock).mockResolvedValue({
      dailyLimit: 10,
      boundaryMessage: DEFAULT_BOUNDARY_MESSAGE,
      autoArchiveEnabled: true,
      requireEditingForBusiness: true,
      weeklyReportsEnabled: false,
    });

    (userService.getUserProfile as jest.Mock).mockResolvedValue({
      displayName: 'Test Creator',
    });

    (capacityService.getAverageDailyMessages as jest.Mock).mockResolvedValue(8);
    (capacityService.suggestCapacity as jest.Mock).mockReturnValue(10);
    (capacityService.previewDistribution as jest.Mock).mockReturnValue({
      deep: 8,
      faq: 2,
      archived: 0,
    });
  });

  describe('Boundary Message Editor', () => {
    it('should load and display default boundary message', async () => {
      const { getByPlaceholderText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        expect(input.props.value).toBe(DEFAULT_BOUNDARY_MESSAGE);
      });
    });

    it('should show character count for boundary message', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const charCount = getByText(new RegExp(`${DEFAULT_BOUNDARY_MESSAGE.length} / 500`));
        expect(charCount).toBeTruthy();
      });
    });

    it('should update preview when boundary message changes', async () => {
      const { getByPlaceholderText, getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'Custom message from {{creatorName}}');
      });

      await waitFor(() => {
        // Preview should show rendered message with creator name
        expect(getByText(/Custom message from Test Creator/)).toBeTruthy();
      });
    });

    it('should allow inserting template variables', async () => {
      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const addNameButton = getByText('+ Your Name');
        fireEvent.press(addNameButton);
      });

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        expect(input.props.value).toContain('{{creatorName}}');
      });
    });

    it('should validate boundary message before saving', async () => {
      const { getByPlaceholderText, getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'Too short'); // Less than 50 chars
      });

      const saveButton = getByText('Save Advanced Settings');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          expect.stringContaining('at least 50 characters')
        );
      });
    });

    it('should reset boundary message to default', async () => {
      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      // Change message first
      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'A'.repeat(100));
      });

      // Click reset
      const resetButton = getByText('Reset to Default');
      fireEvent.press(resetButton);

      // Confirm in alert
      expect(Alert.alert).toHaveBeenCalled();
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const confirmButton = alertCall[2].find((btn: any) => btn.text === 'Reset');
      confirmButton.onPress();

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        expect(input.props.value).toBe(DEFAULT_BOUNDARY_MESSAGE);
      });
    });
  });

  describe('Advanced Toggles', () => {
    it('should load toggle states from settings', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        // Toggles should be loaded with default values
        expect(getByText('Auto-Archive Low Priority')).toBeTruthy();
        expect(getByText('Require Editing for Business')).toBeTruthy();
        expect(getByText('Weekly Capacity Reports')).toBeTruthy();
      });
    });

    it('should toggle auto-archive setting', async () => {
      const { getAllByRole } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const switches = getAllByRole('switch');
        const autoArchiveSwitch = switches[0]; // First switch is auto-archive
        fireEvent(autoArchiveSwitch, 'onValueChange', false);
      });

      // State should update
      const { getAllByRole: getUpdatedSwitches } = render(<CapacitySettingsScreen />);
      await waitFor(() => {
        const switches = getUpdatedSwitches('switch');
        expect(switches[0].props.value).toBe(false);
      });
    });

    it('should save all advanced settings', async () => {
      (userService.updateAdvancedCapacitySettings as jest.Mock).mockResolvedValue(undefined);

      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      // Modify boundary message
      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        const validMessage = 'A'.repeat(100); // Valid length
        fireEvent.changeText(input, validMessage);
      });

      // Click save
      const saveButton = getByText('Save Advanced Settings');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(userService.updateAdvancedCapacitySettings).toHaveBeenCalledWith(
          'test-user-123',
          expect.objectContaining({
            boundaryMessage: expect.any(String),
            autoArchiveEnabled: expect.any(Boolean),
            requireEditingForBusiness: expect.any(Boolean),
            weeklyReportsEnabled: expect.any(Boolean),
          })
        );
      });

      // Success alert should be shown
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String));
      });
    });
  });

  describe('Template Variable Preview', () => {
    it('should render preview with creator name', async () => {
      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'Hi {{creatorName}}!');
      });

      await waitFor(() => {
        expect(getByText(/Hi Test Creator!/)).toBeTruthy();
      });
    });

    it('should show placeholders for missing variables', async () => {
      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'Check {{faqUrl}} for more info');
      });

      await waitFor(() => {
        // Since faqUrl is not configured, should show placeholder
        expect(getByText(/FAQ not configured/)).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle save errors gracefully', async () => {
      (userService.updateAdvancedCapacitySettings as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const { getByText, getByPlaceholderText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const input = getByPlaceholderText('Write your custom boundary message...');
        fireEvent.changeText(input, 'A'.repeat(100));
      });

      const saveButton = getByText('Save Advanced Settings');
      fireEvent.press(saveButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          expect.stringContaining('Failed to save')
        );
      });
    });
  });
});
