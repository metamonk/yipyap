import React from 'react';
import { render } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/common/OfflineBanner';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      View: View,
    },
    SlideInUp: {
      duration: jest.fn(() => ({})),
    },
    SlideOutUp: {
      duration: jest.fn(() => ({})),
    },
  };
});

describe('OfflineBanner', () => {
  it('displays banner when offline', () => {
    const { getByText } = render(<OfflineBanner isOffline={true} />);

    expect(getByText("You're offline")).toBeTruthy();
    expect(getByText('Messages will send when reconnected')).toBeTruthy();
  });

  it('hides banner when online', () => {
    const { queryByText } = render(<OfflineBanner isOffline={false} />);

    expect(queryByText("You're offline")).toBeNull();
    expect(queryByText('Messages will send when reconnected')).toBeNull();
  });

  it('renders with correct styling when offline', () => {
    const { getByText } = render(<OfflineBanner isOffline={true} />);

    const mainText = getByText("You're offline");
    const subtext = getByText('Messages will send when reconnected');

    expect(mainText).toBeTruthy();
    expect(subtext).toBeTruthy();
  });

  it('returns null when online', () => {
    const { toJSON } = render(<OfflineBanner isOffline={false} />);

    // Component should return null and not render anything
    expect(toJSON()).toBeNull();
  });
});
