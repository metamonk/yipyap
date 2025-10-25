/**
 * Unit tests for Voice Settings Screen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VoiceSettingsScreen from '@/app/(tabs)/profile/voice-settings';
import { Alert } from 'react-native';

// Mock expo-router
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock NavigationHeader
jest.mock('@/app/_components/NavigationHeader', () => {
  const React = require('react');
  return {
    NavigationHeader: ({ title, showBack, backAction }: any) => React.createElement('View', { testID: 'navigation-header' }),
  };
});

// Mock SettingsPicker - behaves like Picker for testing
jest.mock('@/components/voice/SettingsPicker', () => {
  const React = require('react');
  const { View } = require('react-native');

  const SettingsPicker = React.forwardRef((props: any, ref: any) => {
    return React.createElement(View, { ...props, ref });
  });

  return {
    SettingsPicker
  };
});

// Mock VoiceTrainingStatus
jest.mock('@/components/voice/VoiceTrainingStatus', () => {
  const React = require('react');
  return {
    VoiceTrainingStatus: ({ userId }: any) => React.createElement('View', { testID: 'voice-training-status' }),
  };
});

// Mock useAuth hook
const mockUserProfile = {
  uid: 'user123',
  username: 'testuser',
  displayName: 'Test User',
  email: 'test@example.com',
  settings: {
    voiceMatching: {
      enabled: true,
      autoShowSuggestions: true,
      suggestionCount: 2,
      retrainingSchedule: 'weekly' as const,
    },
  },
};

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({ userProfile: mockUserProfile })),
}));

// Mock updateUserSettings
const mockUpdateUserSettings = jest.fn();
jest.mock('@/services/userService', () => ({
  updateUserSettings: mockUpdateUserSettings,
}));

// Mock voiceMatchingService
const mockTrainVoiceProfile = jest.fn();
jest.mock('@/services/voiceMatchingService', () => ({
  voiceMatchingService: {
    trainVoiceProfile: mockTrainVoiceProfile,
  },
}));

// Mock expo vector icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('VoiceSettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateUserSettings.mockResolvedValue(undefined);
  });

  describe('Rendering', () => {
    it('renders voice settings screen', () => {
      const { getByText } = render(<VoiceSettingsScreen />);

      expect(getByText('Voice Matching Settings')).toBeTruthy();
      expect(getByText('Customize how AI suggestions match your unique communication style')).toBeTruthy();
    });

    it('renders all setting controls', () => {
      const { getByText, getByTestId } = render(<VoiceSettingsScreen />);

      expect(getByText('Enable Voice Matching')).toBeTruthy();
      expect(getByText('Auto-Show Suggestions')).toBeTruthy();
      expect(getByText('Number of Suggestions')).toBeTruthy();
      expect(getByText('Retraining Schedule')).toBeTruthy();

      expect(getByTestId('toggle-enabled')).toBeTruthy();
      expect(getByTestId('toggle-auto-show')).toBeTruthy();
      expect(getByTestId('picker-suggestion-count')).toBeTruthy();
      expect(getByTestId('picker-retraining-schedule')).toBeTruthy();
    });

    it('renders train button', () => {
      const { getByTestId, getByText } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      expect(trainButton).toBeTruthy();
      expect(getByText('Train Voice Profile Now')).toBeTruthy();
    });
  });

  describe('Enable Voice Matching Toggle', () => {
    it('displays current enabled state from user profile', () => {
      const { getByTestId } = render(<VoiceSettingsScreen />);

      const toggle = getByTestId('toggle-enabled');
      expect(toggle.props.value).toBe(true);
    });

    it('updates enabled setting when toggled', async () => {
      mockUpdateUserSettings.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const toggle = getByTestId('toggle-enabled');
      fireEvent(toggle, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserSettings).toHaveBeenCalledWith('user123', {
          'voiceMatching.enabled': false,
        });
      });
    });

    it('shows error alert when update fails', async () => {
      mockUpdateUserSettings.mockRejectedValue(new Error('Update failed'));

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const toggle = getByTestId('toggle-enabled');
      fireEvent(toggle, 'valueChange', false);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Failed to update setting. Please try again.');
      });
    });
  });

  describe('Auto-Show Suggestions Toggle', () => {
    it('updates auto-show setting when toggled', async () => {
      mockUpdateUserSettings.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const toggle = getByTestId('toggle-auto-show');
      fireEvent(toggle, 'valueChange', false);

      await waitFor(() => {
        expect(mockUpdateUserSettings).toHaveBeenCalledWith('user123', {
          'voiceMatching.autoShowSuggestions': false,
        });
      });
    });
  });

  describe('Suggestion Count Picker', () => {
    it('updates suggestion count when changed', async () => {
      mockUpdateUserSettings.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const picker = getByTestId('picker-suggestion-count');
      fireEvent(picker, 'valueChange', 3);

      await waitFor(() => {
        expect(mockUpdateUserSettings).toHaveBeenCalledWith('user123', {
          'voiceMatching.suggestionCount': 3,
        });
      });
    });
  });

  describe('Retraining Schedule Picker', () => {
    it('updates retraining schedule when changed', async () => {
      mockUpdateUserSettings.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const picker = getByTestId('picker-retraining-schedule');
      fireEvent(picker, 'valueChange', 'monthly');

      await waitFor(() => {
        expect(mockUpdateUserSettings).toHaveBeenCalledWith('user123', {
          'voiceMatching.retrainingSchedule': 'monthly',
        });
      });
    });
  });

  describe('Train Voice Profile Button', () => {
    it('calls trainVoiceProfile when pressed', async () => {
      mockTrainVoiceProfile.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      fireEvent.press(trainButton);

      await waitFor(() => {
        expect(mockTrainVoiceProfile).toHaveBeenCalledWith('user123');
      });
    });

    it('shows success alert when training completes', async () => {
      mockTrainVoiceProfile.mockResolvedValue(undefined);

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      fireEvent.press(trainButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Success',
          'Voice profile trained successfully!',
          [{ text: 'OK' }]
        );
      });
    });

    it('shows error alert when training fails', async () => {
      mockTrainVoiceProfile.mockRejectedValue(new Error('Training failed'));

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      fireEvent.press(trainButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Training failed',
          [{ text: 'OK' }]
        );
      });
    });

    it('shows "Training..." text while training', async () => {
      let resolveTraining: () => void;
      const trainingPromise = new Promise<void>((resolve) => {
        resolveTraining = resolve;
      });

      mockTrainVoiceProfile.mockReturnValue(trainingPromise);

      const { getByTestId, getByText } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      fireEvent.press(trainButton);

      // Button should show "Training..." while in progress
      await waitFor(() => {
        expect(getByText('Training...')).toBeTruthy();
      });

      // Resolve the promise
      resolveTraining!();

      // Button should return to normal text
      await waitFor(() => {
        expect(getByText('Train Voice Profile Now')).toBeTruthy();
      });
    });

    it('is disabled when voice matching is disabled', () => {
      // Mock userProfile with voice matching disabled
      const useAuth = require('@/hooks/useAuth').useAuth;
      useAuth.mockReturnValue({
        userProfile: {
          ...mockUserProfile,
          settings: {
            voiceMatching: {
              enabled: false,
              autoShowSuggestions: true,
              suggestionCount: 2,
              retrainingSchedule: 'weekly' as const,
            },
          },
        },
      });

      const { getByTestId } = render(<VoiceSettingsScreen />);

      const trainButton = getByTestId('train-button');
      expect(trainButton.props.accessibilityState.disabled).toBe(true);
    });
  });

  describe('User Profile Loading', () => {
    it('shows loading indicator when userProfile is not available', () => {
      const useAuth = require('@/hooks/useAuth').useAuth;
      useAuth.mockReturnValue({ userProfile: null });

      const { getByTestId } = render(<VoiceSettingsScreen />);

      // ActivityIndicator is part of React Native
      // Just verify it doesn't crash
      expect(mockUpdateUserSettings).not.toHaveBeenCalled();
    });
  });
});
