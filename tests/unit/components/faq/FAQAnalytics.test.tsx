/**
 * Unit tests for FAQAnalytics component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { FAQAnalytics } from '@/components/faq/FAQAnalytics';
import type { FAQAnalytics as FAQAnalyticsData } from '@/types/faq';

describe('FAQAnalytics', () => {
  const mockAnalytics: FAQAnalyticsData = {
    totalTemplates: 10,
    activeTemplates: 8,
    totalAutoResponses: 150,
    timeSavedMinutes: 300,
    topFAQs: [
      {
        id: 'faq1',
        question: 'What are your rates?',
        useCount: 50,
        category: 'pricing',
      },
      {
        id: 'faq2',
        question: 'When are you available?',
        useCount: 40,
        category: 'availability',
      },
      {
        id: 'faq3',
        question: 'Do you ship internationally?',
        useCount: 30,
        category: 'shipping',
      },
    ],
    usageByCategory: {
      pricing: 50,
      availability: 40,
      shipping: 35,
      general: 25,
    },
  };

  describe('Overview Stats', () => {
    it('should display total templates count', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('10')).toBeTruthy();
      expect(getByText('Total FAQs')).toBeTruthy();
    });

    it('should display active templates count', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('8 active')).toBeTruthy();
    });

    it('should display total auto-responses', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('150')).toBeTruthy();
      expect(getByText('Auto-Responses')).toBeTruthy();
    });

    it('should display time saved in minutes', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('300 min')).toBeTruthy();
      expect(getByText('Time Saved')).toBeTruthy();
    });

    it('should display time saved in hours', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // 300 minutes = 5 hours
      expect(getByText('~5 hours of manual responses')).toBeTruthy();
    });
  });

  describe('Top FAQs List', () => {
    it('should display top FAQs section when FAQs exist', () => {
      const { getByText, getAllByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('Top FAQs by Usage')).toBeTruthy();
    });

    it('should display all top FAQ questions', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('What are your rates?')).toBeTruthy();
      expect(getByText('When are you available?')).toBeTruthy();
      expect(getByText('Do you ship internationally?')).toBeTruthy();
    });

    it('should display FAQ categories in uppercase', () => {
      const { getAllByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Categories appear in both Top FAQs and Usage by Category sections
      expect(getAllByText('PRICING').length).toBeGreaterThan(0);
      expect(getAllByText('AVAILABILITY').length).toBeGreaterThan(0);
      expect(getAllByText('SHIPPING').length).toBeGreaterThan(0);
    });

    it('should display use counts for each FAQ', () => {
      const { getAllByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Numbers appear in both Top FAQs and Usage by Category sections
      expect(getAllByText('50').length).toBeGreaterThan(0);
      expect(getAllByText('40').length).toBeGreaterThan(0);
      expect(getAllByText('30').length).toBe(1); // Only in Top FAQs, not in Usage by Category
    });

    it('should display rank badges', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Check for rank numbers
      expect(getByText('1')).toBeTruthy();
      expect(getByText('2')).toBeTruthy();
      expect(getByText('3')).toBeTruthy();
    });

    it('should display singular "use" for count of 1', () => {
      const singleUseAnalytics: FAQAnalyticsData = {
        ...mockAnalytics,
        topFAQs: [
          {
            id: 'faq1',
            question: 'Test question',
            useCount: 1,
            category: 'general',
          },
        ],
      };

      const { getByText } = render(<FAQAnalytics analytics={singleUseAnalytics} />);

      expect(getByText('use')).toBeTruthy();
    });

    it('should display plural "uses" for count > 1', () => {
      const { getAllByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Multiple FAQs with uses > 1
      const usesLabels = getAllByText('uses');
      expect(usesLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Usage by Category', () => {
    it('should display usage by category section', () => {
      const { getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      expect(getByText('Usage by Category')).toBeTruthy();
    });

    it('should display all categories with usage', () => {
      const { getAllByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Categories appear in both Top FAQs and Usage by Category sections
      expect(getAllByText('PRICING').length).toBeGreaterThan(0);
      expect(getAllByText('AVAILABILITY').length).toBeGreaterThan(0);
      expect(getAllByText('SHIPPING').length).toBeGreaterThan(0);
      expect(getAllByText('GENERAL').length).toBeGreaterThan(0);
    });

    it('should display usage counts for each category', () => {
      const { getAllByText, getByText } = render(<FAQAnalytics analytics={mockAnalytics} />);

      // Numbers may appear in both sections
      expect(getAllByText('50').length).toBeGreaterThan(0); // pricing
      expect(getAllByText('40').length).toBeGreaterThan(0); // availability
      expect(getByText('35')).toBeTruthy(); // shipping
      expect(getByText('25')).toBeTruthy(); // general
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no top FAQs exist', () => {
      const emptyAnalytics: FAQAnalyticsData = {
        totalTemplates: 5,
        activeTemplates: 5,
        totalAutoResponses: 0,
        timeSavedMinutes: 0,
        topFAQs: [],
        usageByCategory: {},
      };

      const { getByText, queryByText } = render(<FAQAnalytics analytics={emptyAnalytics} />);

      expect(getByText('No FAQ usage yet')).toBeTruthy();
      expect(
        getByText(
          "Create FAQ templates and they'll automatically respond to matching messages."
        )
      ).toBeTruthy();

      // Should not show Top FAQs section
      expect(queryByText('Top FAQs by Usage')).toBeNull();
    });

    it('should still show overview stats even with empty FAQs', () => {
      const emptyAnalytics: FAQAnalyticsData = {
        totalTemplates: 5,
        activeTemplates: 3,
        totalAutoResponses: 0,
        timeSavedMinutes: 0,
        topFAQs: [],
        usageByCategory: {},
      };

      const { getByText } = render(<FAQAnalytics analytics={emptyAnalytics} />);

      expect(getByText('5')).toBeTruthy(); // totalTemplates
      expect(getByText('3 active')).toBeTruthy();
      expect(getByText('0')).toBeTruthy(); // totalAutoResponses
      expect(getByText('0 min')).toBeTruthy(); // timeSavedMinutes
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero time saved', () => {
      const zeroTimeAnalytics: FAQAnalyticsData = {
        ...mockAnalytics,
        totalAutoResponses: 0,
        timeSavedMinutes: 0,
      };

      const { getByText } = render(<FAQAnalytics analytics={zeroTimeAnalytics} />);

      expect(getByText('0 min')).toBeTruthy();
      expect(getByText('~0 hours of manual responses')).toBeTruthy();
    });

    it('should handle large numbers', () => {
      const largeNumbersAnalytics: FAQAnalyticsData = {
        totalTemplates: 999,
        activeTemplates: 888,
        totalAutoResponses: 10000,
        timeSavedMinutes: 20000, // ~333 hours
        topFAQs: [
          {
            id: 'faq1',
            question: 'Popular FAQ',
            useCount: 5000,
            category: 'pricing',
          },
        ],
        usageByCategory: {
          pricing: 5000,
        },
      };

      const { getByText } = render(<FAQAnalytics analytics={largeNumbersAnalytics} />);

      expect(getByText('999')).toBeTruthy();
      expect(getByText('10000')).toBeTruthy();
      expect(getByText('20000 min')).toBeTruthy();
      expect(getByText('~333 hours of manual responses')).toBeTruthy();
    });

    it('should handle exactly 10 top FAQs', () => {
      const tenFAQs = Array.from({ length: 10 }, (_, i) => ({
        id: `faq${i + 1}`,
        question: `Question ${i + 1}`,
        useCount: 10 - i,
        category: 'general',
      }));

      const tenFAQsAnalytics: FAQAnalyticsData = {
        ...mockAnalytics,
        topFAQs: tenFAQs,
      };

      const { getByText, getByTestId } = render(<FAQAnalytics analytics={tenFAQsAnalytics} />);

      // Verify all 10 FAQs are rendered
      expect(getByTestId('top-faq-0')).toBeTruthy();
      expect(getByTestId('top-faq-9')).toBeTruthy();
      expect(getByText('Question 1')).toBeTruthy();
      expect(getByText('Question 10')).toBeTruthy();
    });
  });
});
