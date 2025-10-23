/**
 * Jest test setup file
 * Configures global test environment and mocks
 */

import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage for Firebase Auth persistence
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

// Mock Expo vector icons
 
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  // Mock icon component for testing
  // eslint-disable-next-line react/display-name
  const MockIcon = React.forwardRef((props: any, ref: any) =>
    React.createElement(Text, { ...props, ref }, props.name || '')
  );

  return {
    Ionicons: MockIcon,
    MaterialIcons: MockIcon,
  };
});

// Mock Firebase Timestamp
const mockTimestamp = () => ({
  toMillis: () => Date.now(),
  seconds: Math.floor(Date.now() / 1000),
  nanoseconds: (Date.now() % 1000) * 1000000,
});

jest.mock('firebase/firestore', () => ({
  Timestamp: {
    now: jest.fn(mockTimestamp),
    fromMillis: jest.fn((millis: number) => ({
      toMillis: () => millis,
      seconds: Math.floor(millis / 1000),
      nanoseconds: (millis % 1000) * 1000000,
    })),
  },
}));

// Mock React Native Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    default: {
      View,
       
      createAnimatedComponent: (component: any) => component,
    },
    SlideInUp: {
      duration: jest.fn(() => ({ duration: 300 })),
    },
    SlideOutUp: {
      duration: jest.fn(() => ({ duration: 300 })),
    },
    FadeIn: {
      duration: jest.fn(() => ({ duration: 300 })),
    },
    FadeOut: {
      duration: jest.fn(() => ({ duration: 300 })),
    },
  };
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() =>
    Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })
  ),
}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useSegments: jest.fn(() => []),
  Stack: {
     
    Screen: ({ children }: any) => children,
  },
}));

// Mock hooks that may have issues in tests
jest.mock('@/hooks/usePresence', () => ({
  usePresence: jest.fn(),
}));

jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({
    lastNotification: null,
    clearLastNotification: jest.fn(),
  })),
}));

// Suppress console warnings in tests
 
(globalThis as any).console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
