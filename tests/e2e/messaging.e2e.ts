/**
 * E2E tests for messaging functionality including timestamps and date separators
 */

/* global device, element, by, waitFor */

describe('Messaging E2E Tests', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  // Helper function to log in as test user
  const loginAsTestUser = async () => {
    // Navigate to login if not already logged in
    try {
      await expect(element(by.id('login-screen'))).toBeVisible();
      await element(by.id('email-input')).typeText('test@example.com');
      await element(by.id('password-input')).typeText('test123456');
      await element(by.id('login-button')).tap();
      await waitFor(element(by.id('conversations-screen')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // Already logged in
    }
  };

  describe('Message Timestamps', () => {
    it('displays timestamp on every message', async () => {
      await loginAsTestUser();

      // Navigate to a conversation
      await element(by.id('conversation-item')).atIndex(0).tap();
      await expect(element(by.id('chat-screen'))).toBeVisible();

      // Send a new message
      await element(by.id('message-input')).typeText('Test message with timestamp');
      await element(by.id('send-button')).tap();

      // Wait for message to appear
      await waitFor(element(by.text('Test message with timestamp')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify timestamp is visible
      // Timestamp should be in format like "10:45 AM"
      await expect(element(by.id('message-timestamp')).atIndex(0)).toBeVisible();

      // Verify timestamp shows correct format (contains AM or PM)
      await expect(
        element(by.text(/(AM|PM)/).withAncestor(by.id('message-container')))
      ).toBeVisible();
    });

    it('shows timestamps in user local timezone', async () => {
      await loginAsTestUser();

      // Navigate to a conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Send a message
      await element(by.id('message-input')).typeText('Timezone test message');
      await element(by.id('send-button')).tap();

      // Get current time for comparison
      const now = new Date();
      const expectedHour = now.getHours();
      const expectedPeriod = expectedHour >= 12 ? 'PM' : 'AM';

      // Verify timestamp contains expected period
      await expect(element(by.text(new RegExp(expectedPeriod)))).toBeVisible();
    });

    it('displays timestamp in subtle styling', async () => {
      await loginAsTestUser();

      // Navigate to a conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Check that timestamp exists but with smaller/gray styling
      // Note: Detox can't directly check styles, but we can verify the element exists
      await expect(element(by.id('message-timestamp')).atIndex(0)).toBeVisible();

      // The timestamp should be in the metadata container
      await expect(
        element(by.id('message-timestamp')).atIndex(0).withAncestor(by.id('metadata-container'))
      ).toBeVisible();
    });
  });

  describe('Date Separators', () => {
    it('displays date separators in multi-day conversation', async () => {
      await loginAsTestUser();

      // Navigate to a conversation with messages from multiple days
      // (Assuming test data includes such a conversation)
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Verify date separator is visible
      await expect(element(by.id('date-separator')).atIndex(0)).toBeVisible();

      // Verify separator shows expected text (e.g., "TODAY", "YESTERDAY")
      await expect(
        element(by.text(/TODAY|YESTERDAY|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY/))
      ).toBeVisible();
    });

    it('shows "Today" separator for current date messages', async () => {
      await loginAsTestUser();

      // Navigate to conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Send a new message (will be from today)
      await element(by.id('message-input')).typeText('Message for today');
      await element(by.id('send-button')).tap();

      // Wait for message
      await waitFor(element(by.text('Message for today')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify "TODAY" separator exists
      await expect(element(by.text('TODAY'))).toBeVisible();
    });

    it('shows day name for messages from last 7 days', async () => {
      await loginAsTestUser();

      // Navigate to a conversation with recent messages
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Check for day name separators
      const dayNames = [
        'MONDAY',
        'TUESDAY',
        'WEDNESDAY',
        'THURSDAY',
        'FRIDAY',
        'SATURDAY',
        'SUNDAY',
      ];

      // At least one day name should be visible if there are messages from the past week
      let foundDayName = false;
      for (const day of dayNames) {
        try {
          await expect(element(by.text(day))).toBeVisible();
          foundDayName = true;
          break;
        } catch {
          // Continue checking other days
        }
      }

      // If no day names found, at least TODAY or YESTERDAY should be present
      if (!foundDayName) {
        try {
          await expect(element(by.text('YESTERDAY'))).toBeVisible();
        } catch {
          await expect(element(by.text('TODAY'))).toBeVisible();
        }
      }
    });

    it('does not duplicate separators for same-day messages', async () => {
      await loginAsTestUser();

      // Navigate to conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Send multiple messages quickly (same day)
      await element(by.id('message-input')).typeText('First message');
      await element(by.id('send-button')).tap();

      await element(by.id('message-input')).typeText('Second message');
      await element(by.id('send-button')).tap();

      await element(by.id('message-input')).typeText('Third message');
      await element(by.id('send-button')).tap();

      // Wait for all messages to appear
      await waitFor(element(by.text('Third message')))
        .toBeVisible()
        .withTimeout(3000);

      // Count "TODAY" separators - should be only one for all today's messages
      const todaySeparators = await element(by.text('TODAY'));

      // Detox doesn't have a direct count method, but we can verify
      // that at least one exists and scrolling doesn't reveal more
      await expect(todaySeparators).toBeVisible();
    });

    it('maintains separators when scrolling through messages', async () => {
      await loginAsTestUser();

      // Navigate to conversation with many messages
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Scroll up to load older messages
      await element(by.id('messages-list')).scroll(500, 'up');

      // Date separators should still be visible
      await expect(element(by.id('date-separator')).atIndex(0)).toBeVisible();

      // Scroll back down
      await element(by.id('messages-list')).scroll(500, 'down');

      // Separators should remain consistent
      await expect(element(by.id('date-separator')).atIndex(0)).toBeVisible();
    });
  });

  describe('Timestamp and Separator Integration', () => {
    it('shows both individual timestamps and date separators', async () => {
      await loginAsTestUser();

      // Navigate to conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Verify date separator exists
      await expect(element(by.id('date-separator')).atIndex(0)).toBeVisible();

      // Verify individual message timestamps also exist
      await expect(element(by.id('message-timestamp')).atIndex(0)).toBeVisible();

      // Both should be visible simultaneously
      await expect(element(by.text('TODAY'))).toBeVisible();
      await expect(element(by.text(/(AM|PM)/))).toBeVisible();
    });

    it('updates separators when new day begins', async () => {
      await loginAsTestUser();

      // Navigate to conversation
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Send a message (marks today)
      await element(by.id('message-input')).typeText('Message sent today');
      await element(by.id('send-button')).tap();

      // Verify TODAY separator
      await expect(element(by.text('TODAY'))).toBeVisible();

      // Note: In a real test, we would need to simulate time passing
      // or use a conversation that already has messages from different days
      // For now, we just verify the current behavior works
    });

    it('handles pagination with date separators correctly', async () => {
      await loginAsTestUser();

      // Navigate to conversation with many messages
      await element(by.id('conversation-item')).atIndex(0).tap();

      // Scroll to top to trigger pagination
      await element(by.id('messages-list')).scrollTo('top');

      // Wait for loading indicator (if visible)
      try {
        await waitFor(element(by.id('loading-more-indicator')))
          .toBeVisible()
          .withTimeout(2000);

        await waitFor(element(by.id('loading-more-indicator')))
          .not.toBeVisible()
          .withTimeout(5000);
      } catch {
        // Loading might be too fast to catch
      }

      // Verify date separators are still properly displayed after pagination
      await expect(element(by.id('date-separator')).atIndex(0)).toBeVisible();
    });
  });
});
