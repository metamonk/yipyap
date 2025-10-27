/**
 * Unit tests for user types and validation functions
 * Tests username, display name, capacity validation (Story 6.3)
 * and boundary message validation (Story 6.5)
 */

import {
  validateUsername,
  validateDisplayName,
  validateCapacity,
  validateBoundaryMessage,
  renderBoundaryTemplate,
  MIN_CAPACITY,
  MAX_CAPACITY,
  DEFAULT_CAPACITY,
  MIN_BOUNDARY_MESSAGE_LENGTH,
  MAX_BOUNDARY_MESSAGE_LENGTH,
  DEFAULT_BOUNDARY_MESSAGE,
} from '@/types/user';

describe('user types and validation', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      expect(validateUsername('johndoe').isValid).toBe(true);
      expect(validateUsername('user_123').isValid).toBe(true);
      expect(validateUsername('abc').isValid).toBe(true);
    });

    it('should reject usernames that are too short', () => {
      const result = validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject usernames that are too long', () => {
      const result = validateUsername('a'.repeat(21));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('20 characters or less');
    });

    it('should reject usernames with invalid characters', () => {
      const result = validateUsername('john-doe');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('letters, numbers, and underscores');
    });
  });

  describe('validateDisplayName', () => {
    it('should accept valid display names', () => {
      expect(validateDisplayName('John Doe').isValid).toBe(true);
      expect(validateDisplayName('Jane').isValid).toBe(true);
      expect(validateDisplayName('A'.repeat(50)).isValid).toBe(true);
    });

    it('should reject empty display names', () => {
      const result = validateDisplayName('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject display names that are too long', () => {
      const result = validateDisplayName('A'.repeat(51));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('50 characters or less');
    });
  });

  describe('validateCapacity (Story 6.3)', () => {
    it('should accept valid capacity within range (5-20)', () => {
      expect(validateCapacity(5).isValid).toBe(true);
      expect(validateCapacity(10).isValid).toBe(true);
      expect(validateCapacity(15).isValid).toBe(true);
      expect(validateCapacity(20).isValid).toBe(true);
    });

    it('should reject capacity below minimum (5)', () => {
      const result = validateCapacity(4);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MIN_CAPACITY} messages`);
    });

    it('should reject capacity above maximum (20)', () => {
      const result = validateCapacity(21);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`limit capacity to ${MAX_CAPACITY} messages`);
    });

    it('should reject negative capacity values', () => {
      const result = validateCapacity(-5);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MIN_CAPACITY} messages`);
    });

    it('should reject zero capacity', () => {
      const result = validateCapacity(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MIN_CAPACITY} messages`);
    });

    it('should reject non-integer capacity values', () => {
      const result = validateCapacity(10.5);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('whole number');
    });

    it('should accept default capacity', () => {
      const result = validateCapacity(DEFAULT_CAPACITY);
      expect(result.isValid).toBe(true);
    });

    it('should accept minimum capacity', () => {
      const result = validateCapacity(MIN_CAPACITY);
      expect(result.isValid).toBe(true);
    });

    it('should accept maximum capacity', () => {
      const result = validateCapacity(MAX_CAPACITY);
      expect(result.isValid).toBe(true);
    });
  });

  describe('capacity constants', () => {
    it('should have MIN_CAPACITY of 5', () => {
      expect(MIN_CAPACITY).toBe(5);
    });

    it('should have MAX_CAPACITY of 20', () => {
      expect(MAX_CAPACITY).toBe(20);
    });

    it('should have DEFAULT_CAPACITY of 10', () => {
      expect(DEFAULT_CAPACITY).toBe(10);
    });

    it('should have DEFAULT_CAPACITY within valid range', () => {
      expect(DEFAULT_CAPACITY).toBeGreaterThanOrEqual(MIN_CAPACITY);
      expect(DEFAULT_CAPACITY).toBeLessThanOrEqual(MAX_CAPACITY);
    });
  });

  describe('validateBoundaryMessage (Story 6.5)', () => {
    it('should reject boundary messages that are too short (< 50 chars)', () => {
      const result = validateBoundaryMessage('Thanks!');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`at least ${MIN_BOUNDARY_MESSAGE_LENGTH} characters`);
    });

    it('should reject boundary messages that are too long (> 500 chars)', () => {
      const result = validateBoundaryMessage('A'.repeat(501));
      expect(result.isValid).toBe(false);
      expect(result.error).toContain(`${MAX_BOUNDARY_MESSAGE_LENGTH} characters or less`);
    });

    it('should accept valid boundary messages (50-500 chars)', () => {
      const validMessage = 'A'.repeat(MIN_BOUNDARY_MESSAGE_LENGTH);
      expect(validateBoundaryMessage(validMessage).isValid).toBe(true);

      const maxMessage = 'A'.repeat(MAX_BOUNDARY_MESSAGE_LENGTH);
      expect(validateBoundaryMessage(maxMessage).isValid).toBe(true);
    });

    it('should reject empty boundary messages', () => {
      const result = validateBoundaryMessage('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should trim whitespace before validation', () => {
      const result = validateBoundaryMessage('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should accept DEFAULT_BOUNDARY_MESSAGE', () => {
      const result = validateBoundaryMessage(DEFAULT_BOUNDARY_MESSAGE);
      expect(result.isValid).toBe(true);
    });
  });

  describe('renderBoundaryTemplate (Story 6.5)', () => {
    it('should replace all template variables with provided values', () => {
      const template = 'Hi {{creatorName}}! Check {{faqUrl}} or {{communityUrl}}';
      const rendered = renderBoundaryTemplate(template, {
        creatorName: 'Alice',
        faqUrl: 'https://example.com/faq',
        communityUrl: 'https://discord.gg/example',
      });

      expect(rendered).toBe('Hi Alice! Check https://example.com/faq or https://discord.gg/example');
    });

    it('should use placeholders for missing variables', () => {
      const template = 'Hi {{creatorName}}! Check {{faqUrl}}';
      const rendered = renderBoundaryTemplate(template, {
        creatorName: 'Alice',
        // faqUrl not provided
      });

      expect(rendered).toBe('Hi Alice! Check [FAQ not configured]');
    });

    it('should render template with no variables', () => {
      const template = 'Thanks for your message!';
      const rendered = renderBoundaryTemplate(template, {});

      expect(rendered).toBe('Thanks for your message!');
    });
  });

  describe('boundary message constants (Story 6.5)', () => {
    it('should have MIN_BOUNDARY_MESSAGE_LENGTH of 50', () => {
      expect(MIN_BOUNDARY_MESSAGE_LENGTH).toBe(50);
    });

    it('should have MAX_BOUNDARY_MESSAGE_LENGTH of 500', () => {
      expect(MAX_BOUNDARY_MESSAGE_LENGTH).toBe(500);
    });

    it('should have DEFAULT_BOUNDARY_MESSAGE within valid range', () => {
      expect(DEFAULT_BOUNDARY_MESSAGE.length).toBeGreaterThanOrEqual(MIN_BOUNDARY_MESSAGE_LENGTH);
      expect(DEFAULT_BOUNDARY_MESSAGE.length).toBeLessThanOrEqual(MAX_BOUNDARY_MESSAGE_LENGTH);
    });

    it('should have DEFAULT_BOUNDARY_MESSAGE with template variables', () => {
      expect(DEFAULT_BOUNDARY_MESSAGE).toContain('{{faqUrl}}');
      expect(DEFAULT_BOUNDARY_MESSAGE).toContain('{{communityUrl}}');
    });
  });
});
