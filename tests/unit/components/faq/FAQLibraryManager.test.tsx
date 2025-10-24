/**
 * Unit tests for FAQLibraryManager component
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FAQLibraryManager } from '@/components/faq/FAQLibraryManager';
import { subscribeFAQTemplates } from '@/services/faqService';
import { getFirebaseAuth } from '@/services/firebase';
import type { FAQTemplate } from '@/types/faq';
import { Timestamp } from 'firebase/firestore';

// Mock FAQ service
jest.mock('@/services/faqService');
jest.mock('@/services/firebase');

// Mock Alert
jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: jest.fn(),
}));

describe('FAQLibraryManager', () => {
  const mockTemplates: FAQTemplate[] = [
    {
      id: 'faq1',
      creatorId: 'user123',
      question: 'What are your rates?',
      answer: 'My rates start at $100 per hour.',
      keywords: ['pricing', 'rates'],
      category: 'pricing',
      isActive: true,
      useCount: 10,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: 'faq2',
      creatorId: 'user123',
      question: 'What is your availability?',
      answer: 'I am available Monday-Friday, 9am-5pm EST.',
      keywords: ['availability', 'schedule'],
      category: 'availability',
      isActive: true,
      useCount: 5,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
    {
      id: 'faq3',
      creatorId: 'user123',
      question: 'Do you offer refunds?',
      answer: 'Yes, we offer full refunds within 30 days.',
      keywords: ['refunds', 'money-back'],
      category: 'refunds',
      isActive: false,
      useCount: 2,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    },
  ];

  const mockCurrentUser = {
    uid: 'user123',
    email: 'user@example.com',
  };

  const mockOnCreateFAQ = jest.fn();
  const mockOnEditFAQ = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirebaseAuth as jest.Mock).mockReturnValue({
      currentUser: mockCurrentUser,
    });

    // Mock subscribe function to call callback immediately with templates
    (subscribeFAQTemplates as jest.Mock).mockImplementation((userId, onUpdate) => {
      onUpdate(mockTemplates);
      return jest.fn(); // Return unsubscribe function
    });
  });

  it('should render FAQ list correctly', async () => {
    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(getByText('What are your rates?')).toBeTruthy();
      expect(getByText('What is your availability?')).toBeTruthy();
      expect(getByText('Do you offer refunds?')).toBeTruthy();
    });
  });

  it('should show loading state initially', () => {
    (subscribeFAQTemplates as jest.Mock).mockImplementation(() => jest.fn());

    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    expect(getByText('Loading FAQs...')).toBeTruthy();
  });

  it('should show empty state when no templates exist', async () => {
    (subscribeFAQTemplates as jest.Mock).mockImplementation((userId, onUpdate) => {
      onUpdate([]);
      return jest.fn();
    });

    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(getByText('No FAQ Templates Yet')).toBeTruthy();
      expect(
        getByText('Create your first FAQ template to start automatically responding to common questions.')
      ).toBeTruthy();
    });
  });

  it('should call onCreateFAQ when create button is pressed', async () => {
    (subscribeFAQTemplates as jest.Mock).mockImplementation((userId, onUpdate) => {
      onUpdate([]);
      return jest.fn();
    });

    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      const createButton = getByText('Create FAQ');
      fireEvent.press(createButton);
    });

    expect(mockOnCreateFAQ).toHaveBeenCalled();
  });

  it('should filter templates by search query', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(getByText('What are your rates?')).toBeTruthy();
    });

    const searchInput = getByPlaceholderText('Search FAQs...');
    fireEvent.changeText(searchInput, 'rates');

    await waitFor(() => {
      expect(getByText('What are your rates?')).toBeTruthy();
      expect(queryByText('What is your availability?')).toBeFalsy();
      expect(queryByText('Do you offer refunds?')).toBeFalsy();
    });
  });

  it('should display results count', async () => {
    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(getByText('3 FAQs')).toBeTruthy();
    });
  });

  it('should display singular "FAQ" for single result', async () => {
    const singleTemplate = [mockTemplates[0]];

    (subscribeFAQTemplates as jest.Mock).mockImplementation((userId, onUpdate) => {
      onUpdate(singleTemplate);
      return jest.fn();
    });

    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(getByText('1 FAQ')).toBeTruthy();
    });
  });

  it('should call onEditFAQ when template card is pressed', async () => {
    const { getByText } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      const templateCard = getByText('What are your rates?');
      fireEvent.press(templateCard);
    });

    expect(mockOnEditFAQ).toHaveBeenCalledWith(mockTemplates[0]);
  });

  it('should subscribe to FAQ templates for current user', async () => {
    render(<FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />);

    await waitFor(() => {
      expect(subscribeFAQTemplates).toHaveBeenCalledWith(
        'user123',
        expect.any(Function),
        expect.any(Function)
      );
    });
  });

  it('should unsubscribe from FAQ templates on unmount', async () => {
    const mockUnsubscribe = jest.fn();
    (subscribeFAQTemplates as jest.Mock).mockImplementation((userId, onUpdate) => {
      onUpdate(mockTemplates);
      return mockUnsubscribe;
    });

    const { unmount } = render(
      <FAQLibraryManager onCreateFAQ={mockOnCreateFAQ} onEditFAQ={mockOnEditFAQ} />
    );

    await waitFor(() => {
      expect(subscribeFAQTemplates).toHaveBeenCalled();
    });

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
