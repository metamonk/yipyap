/**
 * Seed Test Messages for Auto-Archive Testing (Story 6.4)
 *
 * Creates 10 test messages:
 * - 3 high-priority (business/urgent/VIP) - should NOT be archived
 * - 7 low-priority (fan engagement) - SHOULD be archived (exceeds capacity of 3)
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/seedAutoArchiveMessages.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

interface TestMessage {
  senderId: string;
  text: string;
  category?: string;
  sentiment?: string;
  sentimentScore?: number;
  isVIP?: boolean;
}

async function seedMessages() {
  const userId = 'test-creator-123';

  const testMessages: TestMessage[] = [
    // High priority (should NOT be archived) - 3 messages
    {
      senderId: 'fan-vip-1',
      text: 'Important business opportunity!',
      category: 'business_opportunity',
      sentiment: 'positive',
      sentimentScore: 0.8
    },
    {
      senderId: 'fan-urgent-1',
      text: 'Urgent request!',
      category: 'urgent',
      sentiment: 'neutral',
      sentimentScore: 0.0
    },
    {
      senderId: 'fan-crisis-1',
      text: 'I really need help, feeling very down',
      category: 'fan_engagement',
      sentiment: 'negative',
      sentimentScore: -0.8 // Crisis threshold
    },

    // Low priority (SHOULD be archived - beyond capacity of 3) - 7 messages
    { senderId: 'fan-1', text: 'Love your content!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.9 },
    { senderId: 'fan-2', text: 'Just wanted to say hi!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.7 },
    { senderId: 'fan-3', text: 'You inspire me!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.85 },
    { senderId: 'fan-4', text: 'Keep up the great work!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.75 },
    { senderId: 'fan-5', text: 'Thanks for everything!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.8 },
    { senderId: 'fan-6', text: 'Big fan here!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.7 },
    { senderId: 'fan-7', text: 'Your videos are amazing!', category: 'fan_engagement', sentiment: 'positive', sentimentScore: 0.9 },
  ];

  console.log('Creating conversations and messages...\n');
  console.log('Expected behavior:');
  console.log('  ✅ First 3 messages (business/urgent/crisis) → KEPT (high priority)');
  console.log('  📦 Last 7 messages (fan engagement) → ARCHIVED (beyond capacity)\n');

  for (let i = 0; i < testMessages.length; i++) {
    const msg = testMessages[i];
    const convId = `test-conv-${i + 1}`;
    const msgId = `test-msg-${i + 1}`;

    // Create conversation
    await db.collection('conversations').doc(convId).set({
      id: convId,
      participantIds: [userId, msg.senderId],
      lastMessage: msg.text,
      lastMessageTimestamp: admin.firestore.Timestamp.now(),
      isArchived: false,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Create message
    const metadata: any = {
      category: msg.category || 'fan_engagement',
      sentiment: msg.sentiment || 'positive',
      sentimentScore: msg.sentimentScore || 0.7,
      aiProcessed: true
    };

    // Add VIP flag for business opportunity (to test VIP safety check)
    if (msg.category === 'business_opportunity') {
      metadata.relationshipContext = {
        isVIP: false, // Not VIP, but business category should block it
        conversationAge: 45,
        lastInteraction: admin.firestore.Timestamp.now(),
        messageCount: 20
      };
    }

    await db.collection('conversations').doc(convId).collection('messages').doc(msgId).set({
      id: msgId,
      conversationId: convId,
      senderId: msg.senderId,
      text: msg.text,
      status: 'delivered',
      readBy: [],
      timestamp: admin.firestore.Timestamp.now(),
      metadata
    });

    const icon = i < 3 ? '✅' : '📦';
    const expected = i < 3 ? 'KEEP (safety)' : 'ARCHIVE';
    console.log(`${icon} Created: ${convId} - "${msg.text}" (${msg.category}) → ${expected}`);
  }

  console.log(`\n✅ Seeded ${testMessages.length} test messages`);
  console.log('   - 3 high-priority (safety checks should prevent archiving)');
  console.log('   - 7 low-priority (should be auto-archived)\n');
  console.log('Next: Run triggerAutoArchive.ts to test workflow');
}

seedMessages()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
