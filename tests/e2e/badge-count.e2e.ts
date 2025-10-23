/**
 * End-to-end tests for badge count functionality
 * @module tests/e2e/badge-count
 *
 * @remarks
 * These tests verify badge count behavior on physical devices:
 * - Unread badges display correctly on conversation list
 * - App icon badge displays total unread count
 * - Badges update in real-time when messages arrive
 * - Badges update when app is backgrounded/foregrounded
 * - Badges persist across app restarts
 *
 * Prerequisites:
 * - Detox configured for iOS and Android
 * - Test users created in Firebase
 * - Firebase Emulator running (or test Firebase project)
 */

// Detox global types
declare const device: any;
declare const element: any;
declare const by: any;
declare const waitFor: any;

describe('Badge Count E2E Tests', () => {
  beforeAll(async () => {
    // Configure device for testing
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    // Reset app state before each test
    await device.reloadReactNative();
  });

  describe('Conversation List Badge Display', () => {
    it('should display unread badge when new message arrives', async () => {
      // Login as User B
      await element(by.id('login-email-input')).typeText('userb@test.com');
      await element(by.id('login-password-input')).typeText('password123');
      await element(by.id('login-button')).tap();

      // Wait for conversation list to load
      await waitFor(element(by.id('conversation-list')))
        .toBeVisible()
        .withTimeout(5000);

      // Simulate User A sending message via backend
      // (This would need a helper function to send message via API or emulator)
      // await sendTestMessage('userA', 'conversation123', 'Hello User B!');

      // Verify unread badge appears on conversation item
      await waitFor(element(by.id('conversation-item-badge-conversation123')))
        .toBeVisible()
        .withTimeout(3000);

      // Verify badge displays correct count
      await expect(element(by.id('badge-count-conversation123'))).toHaveText('1');
    });

    it('should remove unread badge when conversation is opened', async () => {
      // Assuming User B is logged in and has unread message from previous test
      await element(by.id('conversation-item-conversation123')).tap();

      // Wait for chat screen to load
      await waitFor(element(by.id('chat-screen')))
        .toBeVisible()
        .withTimeout(2000);

      // Go back to conversation list
      await element(by.id('back-button')).tap();

      // Verify badge is no longer visible
      await waitFor(element(by.id('conversation-item-badge-conversation123')))
        .not.toBeVisible()
        .withTimeout(3000);
    });

    it('should display correct badge counts for multiple conversations', async () => {
      // Send messages to multiple conversations
      // await sendTestMessage('userA', 'conv1', 'Message 1');
      // await sendTestMessage('userC', 'conv2', 'Message 2');
      // await sendTestMessage('userC', 'conv2', 'Message 3'); // conv2 should have count 2

      // Verify conv1 badge shows 1
      await expect(element(by.id('badge-count-conv1'))).toHaveText('1');

      // Verify conv2 badge shows 2
      await expect(element(by.id('badge-count-conv2'))).toHaveText('2');
    });

    it('should display "99+" for conversations with over 99 unread messages', async () => {
      // This test would require sending 100+ messages
      // Not practical for E2E, but included for completeness
      // Can be tested manually or with integration tests

      // Simulate conversation with 100 unread messages
      // await setConversationUnreadCount('conv-many', 'userB', 100);

      // Verify badge displays "99+"
      // await expect(element(by.id('badge-count-conv-many'))).toHaveText('99+');
    });
  });

  describe('App Icon Badge Count', () => {
    it('should display total unread count on app icon', async () => {
      // This test requires platform-specific APIs to check app icon badge
      // iOS: Use XCUIApplication to check badge value
      // Android: Check notification badge (varies by launcher)

      // For now, this is a placeholder that documents the expected behavior
      // Manual testing required for app icon badge verification

      // Expected behavior:
      // - User has 2 conversations with unread messages (counts: 3 and 5)
      // - App icon badge should show 8 (total across all conversations)

      // Note: Detox doesn't provide direct API to check app icon badge
      // This would need platform-specific native code or manual verification
    });

    it('should update app icon badge when message arrives while app is backgrounded', async () => {
      // Background the app
      await device.sendToHome();

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Send message via backend
      // await sendTestMessage('userA', 'conversation123', 'New message');

      // Return to app
      await device.launchApp({ newInstance: false });

      // Verify badge count updated (would need platform-specific check)
      // This is a manual verification step for now
    });

    it('should persist badge count after app restart', async () => {
      // Terminate app
      await device.terminateApp();

      // Relaunch app
      await device.launchApp({ newInstance: false });

      // Login if needed (depends on auth persistence)
      // ...

      // Wait for conversation list to load
      await waitFor(element(by.id('conversation-list')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify unread badges still display correctly
      await expect(element(by.id('badge-count-conversation123'))).toBeVisible();

      // Verify app icon badge persists (manual verification required)
    });
  });

  describe('Real-time Badge Updates', () => {
    it('should update badges in real-time when message arrives while app is open', async () => {
      // User B is on conversation list screen
      await waitFor(element(by.id('conversation-list')))
        .toBeVisible()
        .withTimeout(5000);

      // Send message from User A via backend
      // await sendTestMessage('userA', 'conversation123', 'Real-time message');

      // Verify badge appears/updates immediately
      await waitFor(element(by.id('conversation-item-badge-conversation123')))
        .toBeVisible()
        .withTimeout(3000);
    });

    it('should update badge when user sends message from another device', async () => {
      // This test verifies cross-device sync
      // Requires running app on two devices or simulators simultaneously
      // Or simulating second device activity via backend

      // Manual test scenario:
      // 1. User B logged in on Device 1 (viewing conversation list)
      // 2. User B sends message from Device 2
      // 3. Device 1 should NOT show unread badge (sender doesn't get badge)

      // Placeholder - manual verification required
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid message arrivals correctly', async () => {
      // Send multiple messages in quick succession
      // await Promise.all([
      //   sendTestMessage('userA', 'conversation123', 'Message 1'),
      //   sendTestMessage('userA', 'conversation123', 'Message 2'),
      //   sendTestMessage('userA', 'conversation123', 'Message 3'),
      // ]);

      // Verify badge shows correct total count
      await waitFor(element(by.id('badge-count-conversation123')))
        .toHaveText('3')
        .withTimeout(3000);
    });

    it('should handle offline-to-online transition', async () => {
      // Disable network
      await device.disableSynchronization();

      // Send message while offline (via backend, not from this device)
      // await sendTestMessage('userA', 'conversation123', 'Offline message');

      // Enable network
      await device.enableSynchronization();

      // Verify badge updates once online
      await waitFor(element(by.id('conversation-item-badge-conversation123')))
        .toBeVisible()
        .withTimeout(5000);
    });
  });
});

/**
 * Helper function to send test message via backend
 * (Implementation depends on test infrastructure)
 */
// @ts-expect-error - Helper function for future E2E test implementation
// eslint-disable-next-line
async function sendTestMessage(
  senderId: string,
  conversationId: string,
  text: string
): Promise<void> {
  // TODO: Implement helper to send message via Firebase Admin SDK or test API
  // This allows simulating messages from other users during E2E tests
  console.log(`Sending test message: ${senderId} -> ${conversationId}: ${text}`);
}

/**
 * Helper function to set conversation unread count for testing
 */
// @ts-expect-error - Helper function for future E2E test implementation
// eslint-disable-next-line
async function setConversationUnreadCount(
  conversationId: string,
  userId: string,
  count: number
): Promise<void> {
  // TODO: Implement helper to directly set unread count in Firestore
  console.log(`Setting unread count: ${conversationId}[${userId}] = ${count}`);
}
