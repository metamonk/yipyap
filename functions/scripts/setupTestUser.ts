/**
 * Setup Test User for Auto-Archive Testing (Story 6.4)
 *
 * Creates a test user with capacity settings configured for auto-archive testing.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/setupTestUser.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

async function setupTestUser() {
  const userId = 'test-creator-123';

  await db.collection('users').doc(userId).set({
    uid: userId,
    username: 'testcreator',
    displayName: 'Test Creator',
    email: 'test@example.com',
    settings: {
      sendReadReceipts: true,
      notificationsEnabled: true,
      capacity: {
        dailyLimit: 3, // Only 3 messages per day - others will be archived
        autoArchiveEnabled: true,
        boundaryMessage: "Hi! 👋\n\nI get hundreds of messages daily and can only respond to a few each day.\n\nFor quick answers, check out my FAQ: {{faqUrl}}\nOr join our community: {{communityUrl}}\n\n[This message was sent automatically]",
        requireEditingForBusiness: true
      },
      notifications: {
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00'
      },
      links: {
        faqUrl: 'https://example.com/faq',
        communityUrl: 'https://discord.gg/example'
      }
    },
    presence: { status: 'online', lastSeen: admin.firestore.Timestamp.now() },
    createdAt: admin.firestore.Timestamp.now(),
    updatedAt: admin.firestore.Timestamp.now()
  });

  console.log('✅ Test user created:', userId);
  console.log('   - Daily capacity: 3 messages');
  console.log('   - Auto-archive: ENABLED');
  console.log('   - Boundary message: Configured');
}

setupTestUser()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
