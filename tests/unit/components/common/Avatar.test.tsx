/**
 * Unit tests for Avatar component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '@/components/common/Avatar';

describe('Avatar', () => {
  it('renders image when photoURL is provided', () => {
    const { getByTestId } = render(
      <Avatar photoURL="https://example.com/photo.jpg" displayName="John Doe" size={48} />
    );

    const image = getByTestId('avatar-image');
    expect(image).toBeTruthy();
    expect(image.props.source).toEqual({ uri: 'https://example.com/photo.jpg' });
  });

  it('renders fallback with initials when photoURL is null', () => {
    const { getByTestId, getByText } = render(
      <Avatar photoURL={null} displayName="Jane Smith" size={48} />
    );

    const fallback = getByTestId('avatar-fallback');
    expect(fallback).toBeTruthy();

    // Should display first letter of display name
    const initials = getByText('J');
    expect(initials).toBeTruthy();
  });

  it('displays correct initials for single word name', () => {
    const { getByText } = render(<Avatar photoURL={null} displayName="Madonna" size={48} />);

    const initials = getByText('M');
    expect(initials).toBeTruthy();
  });

  it('displays correct initials for multi-word name', () => {
    const { getByText } = render(
      <Avatar photoURL={null} displayName="John Paul Jones" size={48} />
    );

    // Should only show first letter of first name
    const initials = getByText('J');
    expect(initials).toBeTruthy();
  });

  it('handles lowercase names correctly', () => {
    const { getByText } = render(<Avatar photoURL={null} displayName="john doe" size={48} />);

    // Should uppercase the initial
    const initials = getByText('J');
    expect(initials).toBeTruthy();
  });

  it('applies correct size to container', () => {
    const size = 64;
    const { getByTestId } = render(<Avatar photoURL={null} displayName="Test User" size={size} />);

    const fallback = getByTestId('avatar-fallback');
    expect(fallback.props.style).toContainEqual(
      expect.objectContaining({
        width: size,
        height: size,
        borderRadius: size / 2,
      })
    );
  });

  it('scales font size with avatar size', () => {
    const size = 96;
    const { getByText } = render(<Avatar photoURL={null} displayName="Test User" size={size} />);

    const initials = getByText('T');
    expect(initials.props.style).toContainEqual(
      expect.objectContaining({
        fontSize: size * 0.4, // Font size should be 40% of avatar size
      })
    );
  });
});
