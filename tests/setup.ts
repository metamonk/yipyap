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

jest.mock('firebase/firestore', () => {
  class FirestoreError extends Error {
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirestoreError';
      this.code = code;
    }
    code: string;
  }

  return {
    Timestamp: {
      now: jest.fn(mockTimestamp),
      fromMillis: jest.fn((millis: number) => ({
        toMillis: () => millis,
        seconds: Math.floor(millis / 1000),
        nanoseconds: (millis % 1000) * 1000000,
      })),
    },
    FirestoreError,
    getFirestore: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    setDoc: jest.fn(),
    updateDoc: jest.fn(),
    deleteDoc: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    limit: jest.fn(),
    onSnapshot: jest.fn(),
    serverTimestamp: jest.fn(() => mockTimestamp()),
    increment: jest.fn((value: number) => ({ _increment: value })),
  };
});

// Mock Firebase Database
jest.mock('firebase/database', () => ({
  getDatabase: jest.fn(),
  ref: jest.fn(),
  set: jest.fn(),
  get: jest.fn(),
  onValue: jest.fn(),
  off: jest.fn(),
  onDisconnect: jest.fn(() => ({
    remove: jest.fn(),
    set: jest.fn(),
  })),
}));

// Mock Firebase Auth
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

// Mock Firebase Storage
jest.mock('firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

// Mock Firebase Functions
jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

// Mock React Native Alert separately
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  __esModule: true,
  default: {
    alert: jest.fn(),
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    default: {
      View,
      createAnimatedComponent: (component: any) => component,
    },
    View: View,
    useSharedValue: jest.fn((initialValue: any) => ({ value: initialValue })),
    useAnimatedStyle: jest.fn((styleGetter: () => any) => styleGetter()),
    useAnimatedGestureHandler: jest.fn((handlers: any) => handlers),
    withSpring: jest.fn((value: any) => value),
    withTiming: jest.fn((value: any) => value),
    runOnJS: jest.fn((fn: any) => fn),
    runOnUI: jest.fn((fn: any) => fn),
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

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: View,
    State: {},
    Directions: {},
  };
});

// Mock react-native-draggable-flatlist
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { FlatList, View } = require('react-native');

  return {
    __esModule: true,
    default: (props: any) => React.createElement(FlatList, props),
    ScaleDecorator: ({ children }: any) => React.createElement(View, {}, children),
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

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      ios: { status: 'granted' },
      android: { status: 'granted' },
    })
  ),
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve({
      status: 'granted',
      ios: { status: 'granted' },
      android: { status: 'granted' },
    })
  ),
  getExpoPushTokenAsync: jest.fn(() =>
    Promise.resolve({
      data: 'ExponentPushToken[test-token]',
      type: 'expo',
    })
  ),
  getPushTokenAsync: jest.fn(() =>
    Promise.resolve({
      data: 'test-push-token',
      type: 'fcm',
    })
  ),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addPushTokenListener: jest.fn(() => ({ remove: jest.fn() })),
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
  getBadgeCountAsync: jest.fn(() => Promise.resolve(0)),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('notification-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
    DEFAULT: 3,
    LOW: 2,
    MIN: 1,
  },
}));

// Mock expo-linking
jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `yipyap://${path}`),
  parse: jest.fn((url: string) => {
    const match = url.match(/yipyap:\/\/(.+)/);
    if (!match) return { path: null, queryParams: {} };
    const [path, query] = match[1].split('?');
    const queryParams: Record<string, string> = {};
    if (query) {
      query.split('&').forEach((param) => {
        const [key, value] = param.split('=');
        queryParams[key] = value;
      });
    }
    return { path, queryParams };
  }),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  getInitialURL: jest.fn(() => Promise.resolve(null)),
}));

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  })),
  useSegments: jest.fn(() => []),
  useLocalSearchParams: jest.fn(() => ({})),
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

/**
 * Firebase Emulator Setup for Integration Tests
 *
 * Integration tests need real Firebase connected to emulators, not mocks.
 * This setup file provides a way to initialize Firebase for integration tests.
 *
 * To run integration tests:
 * 1. Start Firebase emulators: `firebase emulators:start`
 * 2. Run tests: `npm test tests/integration/`
 * 3. Or run a single integration test: `npm test tests/integration/unread-count.test.ts`
 */

// Environment variable to enable integration test mode
// Set via: INTEGRATION_TEST=true npm test tests/integration/
const IS_INTEGRATION_TEST = process.env.INTEGRATION_TEST === 'true' ||
  (process.env.npm_lifecycle_script && process.env.npm_lifecycle_script.includes('integration'));

if (IS_INTEGRATION_TEST) {
  // For integration tests, unmock Firebase modules and use real SDK
  jest.unmock('firebase/app');
  jest.unmock('firebase/firestore');
  jest.unmock('firebase/database');
  jest.unmock('firebase/auth');
  jest.unmock('firebase/storage');

  // Mock the Config to provide test Firebase configuration
  jest.mock('@/constants/Config', () => ({
    Config: {
      firebase: {
        apiKey: 'test-api-key',
        authDomain: 'test-project.firebaseapp.com',
        projectId: 'test-project',
        storageBucket: 'test-project.appspot.com',
        messagingSenderId: '123456789',
        appId: 'test-app-id',
      },
    },
  }));

  // Mock @react-native-community/netinfo to prevent network listener setup
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

  // Initialize Firebase and connect to emulators
  // This runs once before all tests
  beforeAll(async () => {
    if ((global as any).__FIREBASE_INITIALIZED__) {
      return; // Already initialized
    }

    // Import real Firebase modules (not mocked)
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
    const { getDatabase, connectDatabaseEmulator } = await import('firebase/database');
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');
    const { getStorage, connectStorageEmulator } = await import('firebase/storage');

    // Initialize Firebase app
    const testFirebaseConfig = {
      apiKey: 'test-api-key',
      authDomain: 'test-project.firebaseapp.com',
      projectId: 'test-project',
      storageBucket: 'test-project.appspot.com',
      messagingSenderId: '123456789',
      appId: 'test-app-id',
    };

    const app = initializeApp(testFirebaseConfig);

    // Connect to Firebase Emulators
    const db = getFirestore(app);
    connectFirestoreEmulator(db, 'localhost', 8080);

    const realtimeDb = getDatabase(app);
    connectDatabaseEmulator(realtimeDb, 'localhost', 9000);

    const auth = getAuth(app);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });

    const storage = getStorage(app);
    connectStorageEmulator(storage, 'localhost', 9199);

    // Store references globally
    (global as any).__FIREBASE_APP__ = app;
    (global as any).__FIREBASE_DB__ = db;
    (global as any).__FIREBASE_REALTIME_DB__ = realtimeDb;
    (global as any).__FIREBASE_AUTH__ = auth;
    (global as any).__FIREBASE_STORAGE__ = storage;
    (global as any).__FIREBASE_INITIALIZED__ = true;

    console.log('✓ Firebase emulators connected for integration tests');
    console.log('  Firestore: localhost:8080');
    console.log('  Database: localhost:9000');
    console.log('  Auth: localhost:9099');
    console.log('  Storage: localhost:9199');
  });

  // Mock the firebase service to return emulator-connected instances
  jest.mock('@/services/firebase', () => ({
    initializeFirebase: jest.fn(),
    getFirebaseDb: jest.fn(() => {
      if (!(global as any).__FIREBASE_DB__) {
        throw new Error('Firebase not initialized for integration tests. Make sure emulators are running.');
      }
      return (global as any).__FIREBASE_DB__;
    }),
    getFirebaseAuth: jest.fn(() => {
      if (!(global as any).__FIREBASE_AUTH__) {
        throw new Error('Firebase not initialized for integration tests. Make sure emulators are running.');
      }
      return (global as any).__FIREBASE_AUTH__;
    }),
    getFirebaseStorage: jest.fn(() => {
      if (!(global as any).__FIREBASE_STORAGE__) {
        throw new Error('Firebase not initialized for integration tests. Make sure emulators are running.');
      }
      return (global as any).__FIREBASE_STORAGE__;
    }),
    getFirebaseRealtimeDb: jest.fn(() => {
      if (!(global as any).__FIREBASE_REALTIME_DB__) {
        throw new Error('Firebase not initialized for integration tests. Make sure emulators are running.');
      }
      return (global as any).__FIREBASE_REALTIME_DB__;
    }),
  }));
}
