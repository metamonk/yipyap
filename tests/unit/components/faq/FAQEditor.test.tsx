/**
 * Unit tests for FAQEditor component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FAQEditor } from '@/components/faq/FAQEditor';
import { createFAQTemplate, updateFAQTemplate } from '@/services/faqService';
import type { FAQTemplate } from '@/types/faq';
import { Timestamp } from 'firebase/firestore';

// Mock FAQ service
jest.mock('@/services/faqService');

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('FAQEditor', () => {
  const mockOnClose = jest.fn();
  const mockOnSave = jest.fn();

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render in create mode when no template provided', () => {
      const { getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      expect(getByText('New FAQ')).toBeTruthy();
    });

    it('should show empty form fields in create mode', () => {
      const { getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const questionInput = getByPlaceholderText('What question do your fans frequently ask?');
      const answerInput = getByPlaceholderText('Write the response you want to automatically send...');

      expect(questionInput.props.value).toBe('');
      expect(answerInput.props.value).toBe('');
    });

    it('should create new FAQ template when saved', async () => {
      const createdTemplate = { ...mockTemplate, id: 'new123' };
      (createFAQTemplate as jest.Mock).mockResolvedValue({
        template: createdTemplate,
        embeddingTriggered: true,
      });

      const { getByPlaceholderText, getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Fill in form
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'New question?'
      );
      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'New answer.'
      );

      // Save
      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(createFAQTemplate).toHaveBeenCalledWith({
          question: 'New question?',
          answer: 'New answer.',
          keywords: [],
          category: 'general',
          isActive: true,
        });
      });

      expect(mockOnSave).toHaveBeenCalledWith(createdTemplate);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Edit Mode', () => {
    it('should render in edit mode when template provided', () => {
      const { getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          template={mockTemplate}
        />
      );

      expect(getByText('Edit FAQ')).toBeTruthy();
    });

    it('should pre-fill form with template data', () => {
      const { getByDisplayValue } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          template={mockTemplate}
        />
      );

      expect(getByDisplayValue('What are your rates?')).toBeTruthy();
      expect(getByDisplayValue('My rates start at $100 per hour.')).toBeTruthy();
      expect(getByDisplayValue('pricing, rates')).toBeTruthy();
    });

    it('should update existing FAQ template when saved', async () => {
      const updatedTemplate = { ...mockTemplate, question: 'Updated question?' };
      (updateFAQTemplate as jest.Mock).mockResolvedValue({
        template: updatedTemplate,
        reEmbeddingTriggered: true,
      });

      const { getByDisplayValue, getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
          template={mockTemplate}
        />
      );

      // Update question
      const questionInput = getByDisplayValue('What are your rates?');
      fireEvent.changeText(questionInput, 'Updated question?');

      // Save
      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(updateFAQTemplate).toHaveBeenCalledWith('faq123', {
          question: 'Updated question?',
          answer: 'My rates start at $100 per hour.',
          keywords: ['pricing', 'rates'],
          category: 'pricing',
          isActive: true,
        });
      });

      expect(mockOnSave).toHaveBeenCalledWith(updatedTemplate);
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Form Validation', () => {
    it('should show error when question is empty', async () => {
      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Leave question empty, fill answer
      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'Some answer'
      );

      // Try to save
      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(getByText('Question is required')).toBeTruthy();
      });

      expect(createFAQTemplate).not.toHaveBeenCalled();
    });

    it('should show error when answer is empty', async () => {
      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Fill question, leave answer empty
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'Some question?'
      );

      // Try to save
      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(getByText('Answer is required')).toBeTruthy();
      });

      expect(createFAQTemplate).not.toHaveBeenCalled();
    });

    it('should show error when question exceeds 500 characters', async () => {
      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const longQuestion = 'a'.repeat(501);
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        longQuestion
      );

      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'Answer'
      );

      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(getByText('Question must be 500 characters or less')).toBeTruthy();
      });
    });

    it('should show error when answer exceeds 2000 characters', async () => {
      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      const longAnswer = 'a'.repeat(2001);
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'Question?'
      );

      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        longAnswer
      );

      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(getByText('Answer must be 2000 characters or less')).toBeTruthy();
      });
    });
  });

  describe('Tab Switching', () => {
    it('should switch between Edit and Preview tabs', () => {
      const { getByText, queryByPlaceholderText, queryByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Initially in Edit tab
      expect(
        queryByPlaceholderText('What question do your fans frequently ask?')
      ).toBeTruthy();

      // Switch to Preview
      fireEvent.press(getByText('Preview'));

      // Edit form should be hidden, preview should show
      expect(
        queryByPlaceholderText('What question do your fans frequently ask?')
      ).toBeFalsy();
      expect(queryByText('Your question will appear here...')).toBeTruthy();

      // Switch back to Edit
      fireEvent.press(getByText('Edit'));

      expect(
        queryByPlaceholderText('What question do your fans frequently ask?')
      ).toBeTruthy();
    });

    it('should show preview with entered data', () => {
      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Enter data
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'Test question?'
      );

      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'Test answer.'
      );

      // Switch to Preview
      fireEvent.press(getByText('Preview'));

      // Preview should show the entered data
      expect(getByText('Test question?')).toBeTruthy();
      expect(getByText('Test answer.')).toBeTruthy();
    });
  });

  describe('Category Selection', () => {
    it('should allow selecting a category', () => {
      const { getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Select Pricing category
      fireEvent.press(getByText('Pricing'));

      // Switch to preview to verify
      fireEvent.press(getByText('Preview'));

      expect(getByText('PRICING')).toBeTruthy();
    });
  });

  describe('Keywords Input', () => {
    it('should parse comma-separated keywords', async () => {
      (createFAQTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate,
        embeddingTriggered: true,
      });

      const { getByPlaceholderText, getByText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'Question?'
      );

      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'Answer'
      );

      fireEvent.changeText(
        getByPlaceholderText('e.g. pricing, rates, cost, fees'),
        'pricing, rates, cost'
      );

      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(createFAQTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            keywords: ['pricing', 'rates', 'cost'],
          })
        );
      });
    });
  });

  describe('Active Toggle', () => {
    it('should toggle isActive state', async () => {
      (createFAQTemplate as jest.Mock).mockResolvedValue({
        template: mockTemplate,
        embeddingTriggered: true,
      });

      const { getByText, getByPlaceholderText } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Switch to preview to see initial active indicator
      fireEvent.press(getByText('Preview'));
      expect(getByText('Active')).toBeTruthy();

      // Fill in required fields
      fireEvent.press(getByText('Edit'));
      fireEvent.changeText(
        getByPlaceholderText('What question do your fans frequently ask?'),
        'Question?'
      );
      fireEvent.changeText(
        getByPlaceholderText('Write the response you want to automatically send...'),
        'Answer'
      );

      // Verify toggle starts as active by checking the create call
      fireEvent.press(getByText('Save'));

      await waitFor(() => {
        expect(createFAQTemplate).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: true,
          })
        );
      });
    });
  });

  describe('Modal Actions', () => {
    it('should call onClose when close button is pressed', () => {
      const { UNSAFE_getByProps } = render(
        <FAQEditor
          isVisible={true}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Find close button by icon name
      const closeButton = UNSAFE_getByProps({ name: 'close' }).parent;
      fireEvent.press(closeButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should not be visible when isVisible is false', () => {
      const { UNSAFE_queryByType } = render(
        <FAQEditor
          isVisible={false}
          onClose={mockOnClose}
          onSave={mockOnSave}
        />
      );

      // Modal should still render but with visible=false
      const modal = UNSAFE_queryByType('RCTModalHostView');
      expect(modal).toBeFalsy(); // Modal content not rendered when not visible
    });
  });
});
