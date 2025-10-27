/**
 * Unit tests for PersonalizationHints component (Story 6.2)
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { PersonalizationHints } from '@/components/voice/PersonalizationHints';
import type { PersonalizationSuggestion } from '@/types/ai';

describe('PersonalizationHints Component', () => {
  const mockSuggestions: PersonalizationSuggestion[] = [
    { text: 'Add specific detail about their message', type: 'context' },
    { text: 'Include personal callback to previous conversation', type: 'callback' },
    { text: 'End with a question to continue dialogue', type: 'question' },
  ];

  it('should render all suggestions', () => {
    const { getByText } = render(<PersonalizationHints suggestions={mockSuggestions} />);

    expect(getByText('💡 Personalization suggestions:')).toBeTruthy();
    expect(getByText('Add specific detail about their message')).toBeTruthy();
    expect(getByText('Include personal callback to previous conversation')).toBeTruthy();
    expect(getByText('End with a question to continue dialogue')).toBeTruthy();
  });

  it('should render nothing when suggestions array is empty', () => {
    const { queryByText } = render(<PersonalizationHints suggestions={[]} />);

    expect(queryByText('💡 Personalization suggestions:')).toBeNull();
  });

  it('should render correct number of suggestions', () => {
    const twoSuggestions = mockSuggestions.slice(0, 2);
    const { getAllByText } = render(<PersonalizationHints suggestions={twoSuggestions} />);

    // Count bullet points
    const bullets = getAllByText('•');
    expect(bullets).toHaveLength(2);
  });
});
