/**
 * Tests for Capacity Settings Screen - Story 6.3
 */

// Mock Timestamp class
class MockTimestamp {
  private date: Date;

  constructor(seconds: number, nanoseconds: number) {
    this.date = new Date(seconds * 1000 + nanoseconds / 1000000);
  }

  toDate(): Date {
    return this.date;
  }

  toMillis(): number {
    return this.date.getTime();
  }

  static fromDate(date: Date): MockTimestamp {
    const seconds = Math.floor(date.getTime() / 1000);
    const nanoseconds = (date.getTime() % 1000) * 1000000;
    return new MockTimestamp(seconds, nanoseconds);
  }

  static now(): MockTimestamp {
    return MockTimestamp.fromDate(new Date());
  }
}

// Mock firebase/firestore
const mockGetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn();
const mockCollection = jest.fn();
const mockQuery = jest.fn();
const mockWhere = jest.fn();

jest.mock('firebase/firestore', () => ({
  Timestamp: MockTimestamp,
  doc: mockDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CapacitySettingsScreen from '@/app/(tabs)/profile/capacity-settings';
import { DEFAULT_CAPACITY, MIN_CAPACITY, MAX_CAPACITY } from '@/types/user';

const Timestamp = MockTimestamp as any;

// Mock expo-router
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => {
    const { View } = require('react-native');
    return <View testID={`icon-${name}`} />;
  },
}));

// Mock @react-native-community/slider
jest.mock('@react-native-community/slider', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onValueChange, onSlidingComplete, testID }: any) => (
      <View
        testID={testID || 'slider'}
        onTouchEnd={() => {
          if (onSlidingComplete) onSlidingComplete(value);
        }}
        accessible={true}
        accessibilityValue={{ now: value }}
      />
    ),
  };
});

// Mock firebase service
const mockFirestore = {};
const mockAuth = {
  currentUser: {
    uid: 'test-user-123',
    email: 'test@example.com',
  },
};

jest.mock('@/services/firebase', () => ({
  getFirebaseDb: () => mockFirestore,
  getFirebaseAuth: () => mockAuth,
}));

// Mock NavigationHeader
jest.mock('@/app/_components/NavigationHeader', () => ({
  NavigationHeader: ({ title, leftAction }: any) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return (
      <View testID="nav-header">
        <Text>{title}</Text>
        {leftAction && (
          <TouchableOpacity testID="nav-back-button" onPress={leftAction.onPress}>
            <Text>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
}));

describe('CapacitySettingsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    // Default mock setup
    mockDoc.mockReturnValue({ id: 'test-user-123' });
    mockCollection.mockReturnValue({ id: 'messages' });
    mockQuery.mockReturnValue({ id: 'query' });
    mockWhere.mockReturnValue({ id: 'where' });

    // Mock default user settings
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        uid: 'test-user-123',
        email: 'test@example.com',
        settings: {
          capacity: {
            dailyLimit: DEFAULT_CAPACITY,
          },
        },
      }),
    });

    // Mock empty messages query (new user)
    mockGetDocs.mockResolvedValue({
      size: 0,
      forEach: jest.fn(),
    });

    mockUpdateDoc.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render capacity settings screen', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(/How many messages can you meaningfully respond to/)).toBeTruthy();
      });
    });

    it('should show default capacity of 10 for new users', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(`${DEFAULT_CAPACITY} meaningful responses/day`)).toBeTruthy();
      });
    });

    it('should display loading state initially', () => {
      const { getByTestId } = render(<CapacitySettingsScreen />);

      // Should show loading indicator
      expect(() => getByTestId('nav-header')).toThrow();
    });

    it('should show time commitment estimate', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        const timeCommitment = DEFAULT_CAPACITY * 2; // 2 min per message
        expect(getByText(new RegExp(`${timeCommitment} min`))).toBeTruthy();
      });
    });
  });

  describe('Capacity Adjustment', () => {
    it('should render slider component', async () => {
      const { getByTestId } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('slider')).toBeTruthy();
      });
    });
  });

  describe('Suggested Capacity', () => {
    it('should not show suggestion when user has no message history', async () => {
      mockGetDocs.mockResolvedValue({
        size: 0,
        forEach: jest.fn(),
      });

      const { queryByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(queryByText(/Based on your message volume/)).toBeNull();
      });
    });
  });

  describe('Distribution Preview', () => {
    it('should not show distribution preview when user has no message history', async () => {
      mockGetDocs.mockResolvedValue({
        size: 0, // No messages
        forEach: jest.fn(),
      });

      const { queryByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(queryByText(/Message distribution/)).toBeNull();
      });
    });
  });

  describe('Help Text', () => {
    it('should display help text explaining capacity impact', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(/helps us prioritize the most important messages/)).toBeTruthy();
        expect(getByText(/You can adjust this anytime/)).toBeTruthy();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate back when back button is pressed', async () => {
      const { getByTestId } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('nav-back-button')).toBeTruthy();
      });

      fireEvent.press(getByTestId('nav-back-button'));
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when loading settings fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore error'));

      render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to load capacity settings. Please try again.'
        );
      });
    });

    it('should show error alert and revert when save fails', async () => {
      mockUpdateDoc.mockRejectedValue(new Error('Save failed'));

      const { getByText, getByTestId } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(/How many messages/)).toBeTruthy();
      });

      // Simulate slider change
      const slider = getByTestId('slider');
      fireEvent(slider, 'touchEnd');

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Failed to update capacity settings. Please try again.'
        );
      });
    });
  });

  describe('Range Constraints', () => {
    it('should display min capacity label', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(MIN_CAPACITY.toString())).toBeTruthy();
      });
    });

    it('should display max capacity label', async () => {
      const { getByText } = render(<CapacitySettingsScreen />);

      await waitFor(() => {
        expect(getByText(MAX_CAPACITY.toString())).toBeTruthy();
      });
    });
  });
});
