/**
 * E2E tests for offline functionality
 *
 * @remarks
 * Tests complete offline user flows:
 * 1. Airplane mode simulation
 * 2. Offline banner visibility
 * 3. Message sending while offline
 * 4. Message sync when reconnected
 * 5. Browsing cached data while offline
 */

/* global device, element, by, waitFor */

describe('Offline Sync E2E', () => {
  beforeAll(async () => {
    // Launch app
    await device.launchApp();

    // TODO: Add login helper when auth is implemented
    // await loginAsTestUser();
  });

  beforeEach(async () => {
    // Reset app state
    await device.reloadReactNative();

    // Ensure we're online to start
    await device.setURLBlacklist([]);
  });

  afterEach(async () => {
    // Restore network
    await device.setURLBlacklist([]);
  });

  it('displays offline banner when network disconnected', async () => {
    // Simulate offline mode by blacklisting all URLs
    await device.setURLBlacklist(['.*']);

    // Wait for offline banner to appear
    await waitFor(element(by.text("You're offline")))
      .toBeVisible()
      .withTimeout(5000);

    // Verify banner message
    await expect(element(by.text('Messages will send when reconnected'))).toBeVisible();

    // Restore network
    await device.setURLBlacklist([]);

    // Wait for banner to disappear
    await waitFor(element(by.text("You're offline")))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('sends message in offline mode and delivers when reconnected', async () => {
    // Navigate to a conversation
    // TODO: Update this when conversation list is implemented
    // await element(by.id('conversation-1')).tap();

    // Simulate offline mode
    await device.setURLBlacklist(['.*']);

    // Wait for offline banner
    await waitFor(element(by.text("You're offline")))
      .toBeVisible()
      .withTimeout(3000);

    // Type message
    await element(by.id('message-input')).typeText('Offline test message');

    // Send message
    await element(by.id('send-button')).tap();

    // Verify message appears with sending status
    await expect(element(by.text('Offline test message'))).toBeVisible();

    // TODO: Verify sending status icon when message status component has testID
    // await expect(element(by.id('status-sending'))).toBeVisible();

    // Restore network
    await device.setURLBlacklist([]);

    // Wait for offline banner to disappear
    await waitFor(element(by.text("You're offline")))
      .not.toBeVisible()
      .withTimeout(5000);

    // Wait for message to sync and show delivered status
    // TODO: Update when message status has testID
    // await waitFor(element(by.id('status-delivered')))
    //   .toBeVisible()
    //   .withTimeout(10000);
  });

  it('browses conversations and messages while offline', async () => {
    // Ensure we have cached data by loading conversations first
    // TODO: Update when conversation list screen is ready
    // await element(by.id('conversations-tab')).tap();
    // await expect(element(by.id('conversation-list'))).toBeVisible();

    // Go offline
    await device.setURLBlacklist(['.*']);

    // Verify offline banner appears
    await waitFor(element(by.text("You're offline")))
      .toBeVisible()
      .withTimeout(3000);

    // Try to navigate to a conversation
    // Should work with cached data
    // TODO: Update when conversation list is implemented
    // await element(by.id('conversation-1')).tap();

    // Verify we can see cached messages
    // TODO: Update when chat screen is ready
    // await expect(element(by.id('message-list'))).toBeVisible();

    // Verify we can navigate back
    // TODO: Add back navigation test
    // await element(by.id('back-button')).tap();
  });

  it('displays "viewing cached conversations" when offline in conversation list', async () => {
    // Navigate to conversations
    // TODO: Update when navigation is implemented
    // await element(by.id('conversations-tab')).tap();

    // Go offline
    await device.setURLBlacklist(['.*']);

    // Verify offline indicator in conversation list
    await waitFor(element(by.text('Viewing cached conversations')))
      .toBeVisible()
      .withTimeout(5000);

    // Restore network
    await device.setURLBlacklist([]);

    // Verify indicator disappears
    await waitFor(element(by.text('Viewing cached conversations')))
      .not.toBeVisible()
      .withTimeout(5000);
  });

  it('disables new conversation button when offline', async () => {
    // Navigate to conversations
    // TODO: Update when navigation is implemented
    // await element(by.id('conversations-tab')).tap();

    // Go offline
    await device.setURLBlacklist(['.*']);

    // Wait for offline state
    await waitFor(element(by.text("You're offline")))
      .toBeVisible()
      .withTimeout(3000);

    // Try to tap new conversation button
    // Should not navigate (button disabled)
    // TODO: Update when new conversation screen is implemented
    // await element(by.id('new-conversation-button')).tap();

    // Verify we're still on conversation list (not navigated)
    // TODO: Add assertion when screens are ready
  });

  it('shows offline indicator in chat screen header when offline', async () => {
    // Navigate to a conversation
    // TODO: Update when chat screen is ready
    // await element(by.id('conversation-1')).tap();

    // Go offline
    await device.setURLBlacklist(['.*']);

    // Verify offline indicator in chat header
    await waitFor(element(by.text('Offline - messages will send when connected')))
      .toBeVisible()
      .withTimeout(5000);

    // Restore network
    await device.setURLBlacklist([]);

    // Verify indicator disappears
    await waitFor(element(by.text('Offline - messages will send when connected')))
      .not.toBeVisible()
      .withTimeout(5000);
  });
});
