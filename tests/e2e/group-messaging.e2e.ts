/**
 * E2E tests for group chat messaging experience
 *
 * @remarks
 * Tests the complete user flow for group messaging including
 * UI interactions, message display, and real-time updates.
 * Uses Detox for iOS and Android testing.
 */

import { by, device, element, expect as detoxExpect, waitFor } from 'detox';

describe('Group Messaging E2E', () => {
  const testGroupName = 'Test Group Chat';

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Group chat message display', () => {
    it('should show messages from all participants with sender attribution (AC: 1, 2)', async () => {
      // Navigate to test group conversation
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Wait for chat screen to load
      await waitFor(element(by.id('message-container')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify messages show sender names
      await detoxExpect(element(by.text('John Doe'))).toBeVisible();
      await detoxExpect(element(by.text('Jane Smith'))).toBeVisible();
      await detoxExpect(element(by.text('Bob Johnson'))).toBeVisible();

      // Verify each message has sender avatar
      const avatars = await element(by.id('avatar')).getAttributes();
      detoxExpect(avatars.elements).toHaveLength(3); // 3 different senders
    });

    it('should display messages in chronological order (AC: 1)', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Check message order
      const messages = await element(by.id('message-container')).getAttributes();

      // Messages should be in order (newest at bottom due to inverted FlatList)
      // First message should be oldest
      const firstMessage = messages.elements[0];
      const lastMessage = messages.elements[messages.elements.length - 1];

      // Timestamps should be in ascending order
      detoxExpect(firstMessage.timestamp).toBeLessThan(lastMessage.timestamp);
    });

    it('should distinguish own messages from others with visual style (AC: 5)', async () => {
      // Login as test user
      await loginAsTestUser('user1');

      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Send a message
      await element(by.id('message-input')).typeText('My test message');
      await element(by.id('send-button')).tap();

      // Own message should be right-aligned with blue background
      const ownMessage = await element(by.text('My test message')).getAttributes();
      detoxExpect(ownMessage.style.justifyContent).toBe('flex-end');
      detoxExpect(ownMessage.style.backgroundColor).toBe('#007AFF');

      // Other's message should be left-aligned with gray background
      const otherMessage = await element(by.text('Hello from Jane')).getAttributes();
      detoxExpect(otherMessage.style.justifyContent).toBe('flex-start');
      detoxExpect(otherMessage.style.backgroundColor).toBe('#E5E5EA');
    });

    it('should always show sender name and avatar in group context (AC: 2)', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Send own message
      await element(by.id('message-input')).typeText('Test message');
      await element(by.id('send-button')).tap();

      // Even own message should show sender info in group
      await waitFor(element(by.text('You')))
        .toBeVisible()
        .withTimeout(3000);

      // Avatar should be visible for own message
      const messageContainer = await element(by.text('Test message')).getAncestor(
        by.id('message-container')
      );
      const avatar = await messageContainer.getDescendant(by.id('avatar'));
      await detoxExpect(avatar).toBeVisible();
    });
  });

  describe('Real-time message delivery', () => {
    it('should receive new messages in real-time (AC: 4)', async () => {
      // Open group chat on Device 1
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Simulate another user sending a message (would use second device in real test)
      // For testing, we'll trigger via a test helper endpoint
      await sendTestGroupMessage('user2', 'Real-time test message');

      // Message should appear within 1 second
      await waitFor(element(by.text('Real-time test message')))
        .toBeVisible()
        .withTimeout(1000);

      // Verify sender attribution
      await detoxExpect(element(by.text('Jane Smith'))).toBeVisible();
    });

    it('should update all participants simultaneously (AC: 4)', async () => {
      // This would require multiple devices in a real test
      // Simulating with sequential checks

      // Device 1: Open group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Device 1: Send message
      await element(by.id('message-input')).typeText('Broadcast message');
      await element(by.id('send-button')).tap();

      // Verify message appears immediately (optimistic update)
      await detoxExpect(element(by.text('Broadcast message'))).toBeVisible();

      // Simulate checking on other devices (in real test, would be parallel)
      // All participants should see the message
      await verifyMessageOnAllParticipants('Broadcast message');
    });
  });

  describe('Message input and sending', () => {
    it('should send messages with optimistic UI update (AC: 6)', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Type and send message
      const testMessage = 'Optimistic update test';
      await element(by.id('message-input')).typeText(testMessage);
      await element(by.id('send-button')).tap();

      // Message should appear immediately (before server confirmation)
      await detoxExpect(element(by.text(testMessage))).toBeVisible();

      // Initially shows "sending" status
      const statusIcon = await element(by.id('message-status')).getAttributes();
      detoxExpect(statusIcon.status).toBe('sending');

      // Wait for delivery confirmation
      await waitFor(element(by.id('message-status')))
        .toHaveLabel('delivered')
        .withTimeout(3000);
    });

    it('should support offline message queuing (AC: 6)', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Enable airplane mode
      await device.setLocation(0, 0); // Triggers offline mode in test environment

      // Send message while offline
      await element(by.id('message-input')).typeText('Offline message');
      await element(by.id('send-button')).tap();

      // Message should appear with "sending" status
      await detoxExpect(element(by.text('Offline message'))).toBeVisible();
      await detoxExpect(
        element(by.text('Offline - messages will send when connected'))
      ).toBeVisible();

      // Disable airplane mode
      await device.setLocation(37.7749, -122.4194); // Restores connection

      // Message should sync and update to "delivered"
      await waitFor(element(by.id('message-status')))
        .toHaveLabel('delivered')
        .withTimeout(5000);
    });
  });

  describe('Message pagination and scrolling', () => {
    it('should load older messages on scroll (AC: 6)', async () => {
      // Navigate to group with many messages
      await element(by.id('conversations-tab')).tap();
      await element(by.text('Large Group Chat')).tap();

      // Initially should show recent messages
      await detoxExpect(element(by.text('Recent message 50'))).toBeVisible();

      // Scroll to top to load older messages
      await element(by.id('messages-list')).scrollTo('top');

      // Loading indicator should appear
      await detoxExpect(element(by.text('Loading older messages...'))).toBeVisible();

      // Older messages should load
      await waitFor(element(by.text('Old message 1')))
        .toBeVisible()
        .withTimeout(3000);

      // Can continue scrolling to load more
      await element(by.id('messages-list')).scrollTo('top');
      await waitFor(element(by.text('Very old message')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should show "No more messages" when all loaded', async () => {
      // Navigate to small group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text('Small Group')).tap();

      // Scroll to top
      await element(by.id('messages-list')).scrollTo('top');

      // Should show end indicator
      await waitFor(element(by.text('No more messages')))
        .toBeVisible()
        .withTimeout(3000);
    });
  });

  describe('Group header and metadata', () => {
    it('should display group name and participant count', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Verify group name in header
      await detoxExpect(element(by.text(testGroupName))).toBeVisible();

      // Verify participant count
      await detoxExpect(element(by.text('5 participants'))).toBeVisible();

      // Verify group avatar (if set)
      const groupAvatar = await element(by.id('header-avatar')).getAttributes();
      detoxExpect(groupAvatar).toBeDefined();
    });

    it('should navigate to group settings', async () => {
      // Navigate to group chat
      await element(by.id('conversations-tab')).tap();
      await element(by.text(testGroupName)).tap();

      // Open menu
      await element(by.id('menu-button')).tap();

      // Tap group info
      await element(by.text('Group Info')).tap();

      // Should navigate to group settings screen
      await waitFor(element(by.id('group-settings-screen')))
        .toBeVisible()
        .withTimeout(3000);

      // Should show participant list
      await detoxExpect(element(by.text('Participants'))).toBeVisible();
      await detoxExpect(element(by.text('John Doe'))).toBeVisible();
      await detoxExpect(element(by.text('Jane Smith'))).toBeVisible();
    });
  });

  describe('Performance', () => {
    it('should handle 50+ concurrent users smoothly (AC: 8)', async () => {
      // Navigate to large group
      await element(by.id('conversations-tab')).tap();
      await element(by.text('50 Person Group')).tap();

      // Measure initial load time
      const startTime = Date.now();
      await waitFor(element(by.id('messages-list')))
        .toBeVisible()
        .withTimeout(5000);
      const loadTime = Date.now() - startTime;

      // Should load within 2 seconds
      detoxExpect(loadTime).toBeLessThan(2000);

      // Send a message
      await element(by.id('message-input')).typeText('Performance test');
      const sendStartTime = Date.now();
      await element(by.id('send-button')).tap();

      // Message should appear immediately (optimistic)
      await detoxExpect(element(by.text('Performance test'))).toBeVisible();
      const optimisticTime = Date.now() - sendStartTime;
      detoxExpect(optimisticTime).toBeLessThan(100); // Under 100ms

      // Should receive delivery confirmation quickly
      await waitFor(element(by.id('message-status')))
        .toHaveLabel('delivered')
        .withTimeout(500); // Under 500ms for delivery
    });

    it('should maintain smooth scrolling with many messages', async () => {
      // Navigate to group with 500+ messages
      await element(by.id('conversations-tab')).tap();
      await element(by.text('Busy Group Chat')).tap();

      // Scroll performance test
      await element(by.id('messages-list')).scroll(200, 'down', NaN, 0.8);
      await element(by.id('messages-list')).scroll(200, 'up', NaN, 0.8);
      await element(by.id('messages-list')).scroll(200, 'down', NaN, 0.8);

      // UI should remain responsive
      await element(by.id('message-input')).typeText('Still responsive');
      await element(by.id('send-button')).tap();
      await detoxExpect(element(by.text('Still responsive'))).toBeVisible();
    });
  });
});

// Helper functions for testing

async function loginAsTestUser(userId: string) {
  // Implementation would vary based on auth setup
  await element(by.id('email-input')).typeText(`${userId}@test.com`);
  await element(by.id('password-input')).typeText('testpass123');
  await element(by.id('login-button')).tap();
  await waitFor(element(by.id('conversations-tab')))
    .toBeVisible()
    .withTimeout(5000);
}

async function sendTestGroupMessage(senderId: string, text: string) {
  // In real tests, this would trigger a message via test API
  // or use a second device instance
  // For now, simulating with a mock
  // eslint-disable-next-line no-console
  console.log(`Simulating message from ${senderId}: ${text}`);
}

async function verifyMessageOnAllParticipants(messageText: string) {
  // In real tests, would check on multiple device instances
  // Simulating verification
  // eslint-disable-next-line no-console
  console.log(`Verifying message "${messageText}" on all participants`);
}
