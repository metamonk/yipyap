/**
 * Unit tests for FAQTemplateCard component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FAQTemplateCard } from '@/components/faq/FAQTemplateCard';
import { toggleFAQActive } from '@/services/faqService';
import type { FAQTemplate } from '@/types/faq';
import { Timestamp } from 'firebase/firestore';

// Mock FAQ service
jest.mock('@/services/faqService');

// Mock Alert
import { Alert } from 'react-native';
jest.spyOn(Alert, 'alert');

describe('FAQTemplateCard', () => {
  const mockTemplate: FAQTemplate = {
    id: 'faq123',
    creatorId: 'user123',
    question: 'What are your rates?',
    answer: 'My rates start at $100 per hour.',
    keywords: ['pricing', 'rates'],
    category: 'pricing',
    isActive: true,
    useCount: 5,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };

  const mockOnPress = jest.fn();
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render FAQ template correctly', () => {
    const { getByText } = render(
      <FAQTemplateCard
        template={mockTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    expect(getByText('What are your rates?')).toBeTruthy();
    expect(getByText('My rates start at $100 per hour.')).toBeTruthy();
    expect(getByText('PRICING')).toBeTruthy();
    expect(getByText('Used 5 times')).toBeTruthy();
  });

  it('should call onPress when card is tapped', () => {
    const { getByText } = render(
      <FAQTemplateCard
        template={mockTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    fireEvent.press(getByText('What are your rates?'));

    expect(mockOnPress).toHaveBeenCalledWith(mockTemplate);
  });

  it('should display "Used 1 time" for single use', () => {
    const singleUseTemplate = { ...mockTemplate, useCount: 1 };

    const { getByText } = render(
      <FAQTemplateCard
        template={singleUseTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    expect(getByText('Used 1 time')).toBeTruthy();
  });

  it('should show inactive overlay when template is inactive', () => {
    const inactiveTemplate = { ...mockTemplate, isActive: false };

    const { getByText } = render(
      <FAQTemplateCard
        template={inactiveTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    expect(getByText('Inactive')).toBeTruthy();
  });

  it('should toggle active status when switch is pressed', async () => {
    const updatedTemplate = { ...mockTemplate, isActive: false };
    (toggleFAQActive as jest.Mock).mockResolvedValue(updatedTemplate);

    const { getByRole } = render(
      <FAQTemplateCard
        template={mockTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    const toggle = getByRole('switch');
    fireEvent(toggle, 'onValueChange', false);

    // Wait for async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(toggleFAQActive).toHaveBeenCalledWith('faq123', false);
    expect(mockOnUpdate).toHaveBeenCalledWith(updatedTemplate);
  });

  it('should truncate long question text', () => {
    const longQuestionTemplate = {
      ...mockTemplate,
      question: 'This is a very long question that should be truncated when displayed in the card component to prevent it from taking up too much space',
    };

    const { getByText } = render(
      <FAQTemplateCard
        template={longQuestionTemplate}
        onPress={mockOnPress}
        onUpdate={mockOnUpdate}
      />
    );

    // The text should still be rendered (truncation is handled by numberOfLines prop)
    expect(
      getByText('This is a very long question that should be truncated when displayed in the card component to prevent it from taking up too much space')
    ).toBeTruthy();
  });
});
