/**
 * Unit tests for the DateSeparator component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Timestamp } from 'firebase/firestore';
import { DateSeparator } from '@/components/chat/DateSeparator';
import * as dateHelpers from '@/utils/dateHelpers';

// Mock the formatDateSeparator function
jest.mock('@/utils/dateHelpers', () => ({
  formatDateSeparator: jest.fn((_timestamp) => 'Today'),
}));

describe('DateSeparator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders date text correctly', () => {
    const today = Timestamp.now();
    const { getByText } = render(<DateSeparator timestamp={today} />);
    expect(getByText('TODAY')).toBeTruthy(); // Uppercase due to textTransform
  });

  it('displays "Yesterday" for yesterday', () => {
    const yesterday = Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000);

    // Mock formatDateSeparator to return 'Yesterday'
    (dateHelpers.formatDateSeparator as jest.Mock).mockReturnValue('Yesterday');

    const { getByText } = render(<DateSeparator timestamp={yesterday} />);
    expect(getByText('YESTERDAY')).toBeTruthy(); // Uppercase due to textTransform
  });

  it('displays day name for recent dates', () => {
    const recentDate = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Mock formatDateSeparator to return a day name
    (dateHelpers.formatDateSeparator as jest.Mock).mockReturnValue('Monday');

    const { getByText } = render(<DateSeparator timestamp={recentDate} />);
    expect(getByText('MONDAY')).toBeTruthy(); // Uppercase due to textTransform
  });

  it('displays full date for older dates', () => {
    const oldDate = Timestamp.fromMillis(new Date('2024-01-15').getTime());

    // Mock formatDateSeparator to return full date
    (dateHelpers.formatDateSeparator as jest.Mock).mockReturnValue('Jan 15, 2024');

    const { getByText } = render(<DateSeparator timestamp={oldDate} />);
    expect(getByText('JAN 15, 2024')).toBeTruthy(); // Uppercase due to textTransform
  });

  it('has correct testID for testing', () => {
    const today = Timestamp.now();
    const { getByTestId } = render(<DateSeparator timestamp={today} />);
    expect(getByTestId('date-separator')).toBeTruthy();
  });

  it('calls formatDateSeparator with the provided timestamp', () => {
    const _timestamp = Timestamp.now();
    render(<DateSeparator timestamp={_timestamp} />);

    expect(dateHelpers.formatDateSeparator).toHaveBeenCalledWith(_timestamp);
    expect(dateHelpers.formatDateSeparator).toHaveBeenCalledTimes(1);
  });

  it('applies subtle styling', () => {
    const today = Timestamp.now();
    const { getByText, getByTestId } = render(<DateSeparator timestamp={today} />);
    const dateText = getByText('TODAY');
    const container = getByTestId('date-separator');

    // Verify that the text element has the expected styles
    expect(dateText.props.style).toMatchObject(
      expect.objectContaining({
        fontSize: 12,
        color: '#8E8E93',
        fontWeight: '600',
        marginHorizontal: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      })
    );

    // Verify container has row layout
    expect(container.props.style).toMatchObject(
      expect.objectContaining({
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 16,
        paddingHorizontal: 12,
      })
    );
  });

  it('renders horizontal lines on both sides', () => {
    const today = Timestamp.now();
    const { getByTestId } = render(<DateSeparator timestamp={today} />);
    const container = getByTestId('date-separator');

    // Check that container has 3 children: line, text, line
    expect(container.children).toHaveLength(3);

    // Check that first and last children are lines (View components)
    const firstChild = container.children[0];
    const lastChild = container.children[2];

    // Both should have line styles
    expect(firstChild.props.style).toMatchObject(
      expect.objectContaining({
        flex: 1,
        height: 1,
        backgroundColor: '#D1D1D6',
      })
    );

    expect(lastChild.props.style).toMatchObject(
      expect.objectContaining({
        flex: 1,
        height: 1,
        backgroundColor: '#D1D1D6',
      })
    );
  });

  it('memoizes component for performance', () => {
    const timestamp = Timestamp.now();
    const { rerender } = render(<DateSeparator timestamp={timestamp} />);

    // Mock should only be called once initially
    expect(dateHelpers.formatDateSeparator).toHaveBeenCalledTimes(1);

    // Re-render with same props
    rerender(<DateSeparator timestamp={timestamp} />);

    // Should not call formatDateSeparator again due to memoization
    expect(dateHelpers.formatDateSeparator).toHaveBeenCalledTimes(1);
  });
});
