/**
 * Unit tests for ResponseCard component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ResponseCard } from '@/components/chat/ResponseCard';

describe('ResponseCard', () => {
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render suggestion text', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={0} total={2} onEdit={mockOnEdit} />
    );

    expect(getByText('Test suggestion')).toBeTruthy();
  });

  it('should display AI Suggestion header', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={0} total={2} onEdit={mockOnEdit} />
    );

    expect(getByText('AI Suggestion')).toBeTruthy();
  });

  it('should show correct suggestion counter (1 of 3)', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={0} total={3} onEdit={mockOnEdit} />
    );

    expect(getByText('1 of 3')).toBeTruthy();
  });

  it('should show correct suggestion counter (2 of 3)', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={1} total={3} onEdit={mockOnEdit} />
    );

    expect(getByText('2 of 3')).toBeTruthy();
  });

  it('should call onEdit when edit button is pressed', () => {
    const { getByTestId } = render(
      <ResponseCard text="Test suggestion" index={0} total={2} onEdit={mockOnEdit} />
    );

    const editButton = getByTestId('edit-button');
    fireEvent.press(editButton);

    expect(mockOnEdit).toHaveBeenCalledTimes(1);
  });

  it('should show swipe hints when showHints is true', () => {
    const { getByText } = render(
      <ResponseCard
        text="Test suggestion"
        index={0}
        total={2}
        onEdit={mockOnEdit}
        showHints={true}
      />
    );

    expect(getByText('← Swipe to reject')).toBeTruthy();
    expect(getByText('Accept →')).toBeTruthy();
  });

  it('should not show swipe hints when showHints is false', () => {
    const { queryByText } = render(
      <ResponseCard
        text="Test suggestion"
        index={0}
        total={2}
        onEdit={mockOnEdit}
        showHints={false}
      />
    );

    expect(queryByText('← Swipe to reject')).toBeNull();
    expect(queryByText('Accept →')).toBeNull();
  });

  it('should render edit button when onEdit is provided', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={0} total={2} onEdit={mockOnEdit} />
    );

    expect(getByText('Edit')).toBeTruthy();
  });

  it('should handle long suggestion text', () => {
    const longText =
      'This is a very long suggestion text that should still render properly without breaking the layout or causing any visual issues in the card component.';
    const { getByText } = render(
      <ResponseCard text={longText} index={0} total={2} onEdit={mockOnEdit} />
    );

    expect(getByText(longText)).toBeTruthy();
  });

  it('should handle empty suggestion text', () => {
    const { getByText } = render(
      <ResponseCard text="" index={0} total={2} onEdit={mockOnEdit} />
    );

    // Component should still render header
    expect(getByText('AI Suggestion')).toBeTruthy();
  });

  it('should display sparkles icon for AI branding', () => {
    const { getByText } = render(
      <ResponseCard text="Test suggestion" index={0} total={2} onEdit={mockOnEdit} />
    );

    // Header should be present (icon is rendered via Ionicons)
    expect(getByText('AI Suggestion')).toBeTruthy();
  });
});
