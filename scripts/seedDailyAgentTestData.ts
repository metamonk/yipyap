/**
 * Seed Daily Agent Test Data Script
 *
 * @remarks
 * 1. Cleans up all existing conversations
 * 2. Seeds fresh conversations
 * 3. Adds specific conversations for user zeno with messages >1 hour old for daily agent testing
 *
 * Run with: npx tsx scripts/seedDailyAgentTestData.ts
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { readFileSync } from 'fs';

// Load service account
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Real users from the app
const USERS = {
  metamonk: {
    uid: 'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
    username: 'metamonk',
    displayName: 'metamonk',
  },
  zeno: {
    uid: 'XoBenqsIt7bRp9ZYsftif0ZQc9o1',
    username: 'zeno',
    displayName: 'zeno',
  },
  lily: {
    uid: 'jvExoDDTXsZHly4SOEfKmHZdqE42',
    username: 'lily',
    displayName: 'Lily',
  },
};

const USER_IDS = Object.values(USERS).map((u) => u.uid);

/**
 * Step 1: Clean up all existing conversations
 */
async function cleanupAllConversations() {
  console.log('🗑️  Step 1: Cleaning up all existing conversations...\n');

  const conversationsSnapshot = await db
    .collection('conversations')
    .where('participantIds', 'array-contains-any', USER_IDS)
    .get();

  console.log(`Found ${conversationsSnapshot.size} conversations to delete\n`);

  if (conversationsSnapshot.empty) {
    console.log('No conversations found. Skipping cleanup.\n');
    return;
  }

  for (const conversationDoc of conversationsSnapshot.docs) {
    const conversationId = conversationDoc.id;
    const conversationData = conversationDoc.data();

    console.log(`Deleting: ${conversationData.groupName || 'Direct chat'} (${conversationId})`);

    // Delete all messages
    const messagesSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .get();

    // Delete in batches
    const BATCH_SIZE = 500;
    const messageDocs = messagesSnapshot.docs;
    for (let i = 0; i < messageDocs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const batchDocs = messageDocs.slice(i, i + BATCH_SIZE);
      batchDocs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }

    // Delete conversation
    await conversationDoc.ref.delete();
    console.log(`  ✅ Deleted\n`);
  }

  console.log('✅ Cleanup complete!\n');
}

/**
 * Generate conversation ID for direct messages
 */
function generateConversationId(participantIds: string[]): string {
  return participantIds.slice().sort().join('_');
}

/**
 * Create messages with specific timing for daily agent testing
 */
function generateTestMessages(
  conversationId: string,
  fromUser: { uid: string; displayName: string },
  toUser: { uid: string; displayName: string },
  hoursAgo: number,
  messageTemplates: string[]
): Array<any> {
  const messages: any[] = [];
  const now = Date.now();
  const baseTime = now - hoursAgo * 60 * 60 * 1000; // X hours ago

  messageTemplates.forEach((text, index) => {
    const messageId = `msg_${conversationId}_${index}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = admin.firestore.Timestamp.fromMillis(
      baseTime + index * 2 * 60 * 1000 // 2 minutes between messages
    );

    messages.push({
      id: messageId,
      conversationId,
      senderId: fromUser.uid,
      text,
      status: 'delivered',
      readBy: [fromUser.uid], // NOT read by recipient (zeno)
      timestamp,
      metadata: {
        aiProcessed: false, // IMPORTANT: Not processed yet
      },
    });
  });

  return messages;
}

/**
 * FAQ-style messages (for auto-response testing)
 */
const FAQ_MESSAGES = [
  "Hey! What are your hours?",
  "Do you offer weekend availability?",
  "What's your pricing for consulting?",
];

/**
 * Business inquiry messages (for draft response testing)
 */
const BUSINESS_MESSAGES = [
  "Hi! I'm interested in collaborating on a new project. Do you have time for a quick call this week?",
  "I saw your work on the AI features - really impressive! Would love to discuss a potential partnership.",
];

/**
 * Support request messages (for categorization testing)
 */
const SUPPORT_MESSAGES = [
  "I'm having trouble with the authentication flow. Can you help?",
  "The app keeps crashing when I try to upload images. Any ideas?",
];

/**
 * Create a single conversation with messages
 */
async function createConversation(
  conversationData: {
    id: string;
    type: 'direct' | 'group';
    participantIds: string[];
    groupName?: string;
  },
  messages: any[],
  description: string
) {
  const { id, type, participantIds, groupName } = conversationData;

  console.log(`📝 Creating: ${description}`);
  console.log(`   Conversation ID: ${id}`);
  console.log(`   Messages: ${messages.length}`);

  const lastMessage = messages[messages.length - 1];

  // Initialize per-user maps
  const unreadCount: Record<string, number> = {};
  const archivedBy: Record<string, boolean> = {};
  const deletedBy: Record<string, boolean> = {};
  const mutedBy: Record<string, boolean> = {};

  participantIds.forEach((uid) => {
    // Zeno has unread messages from others
    unreadCount[uid] = uid === USERS.zeno.uid ? messages.length : 0;
    archivedBy[uid] = false;
    deletedBy[uid] = false;
    mutedBy[uid] = false;
  });

  // Create conversation document
  const conversationDoc = {
    id,
    type,
    participantIds,
    ...(groupName && { groupName }),
    ...(type === 'group' && { creatorId: participantIds[0] }),
    ...(type === 'group' && { adminIds: [participantIds[0]] }),
    lastMessage: {
      text: lastMessage.text,
      senderId: lastMessage.senderId,
      timestamp: lastMessage.timestamp,
    },
    lastMessageTimestamp: lastMessage.timestamp,
    unreadCount,
    archivedBy,
    deletedBy,
    mutedBy,
    createdAt: messages[0].timestamp,
    updatedAt: lastMessage.timestamp,
  };

  // Write conversation
  await db.collection('conversations').doc(id).set(conversationDoc);

  // Write messages in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchMessages = messages.slice(i, i + BATCH_SIZE);

    batchMessages.forEach((message) => {
      const messageRef = db
        .collection('conversations')
        .doc(id)
        .collection('messages')
        .doc(message.id);
      batch.set(messageRef, message);
    });

    await batch.commit();
  }

  console.log(`   ✅ Created!\n`);
}

/**
 * Step 2: Seed test conversations
 */
async function seedTestConversations() {
  console.log('🌱 Step 2: Seeding conversations for daily agent testing...\n');

  // Conversation 1: metamonk → zeno (FAQ questions, 2 hours old)
  const conv1Messages = generateTestMessages(
    generateConversationId([USERS.metamonk.uid, USERS.zeno.uid]),
    USERS.metamonk,
    USERS.zeno,
    2, // 2 hours ago
    FAQ_MESSAGES
  );

  await createConversation(
    {
      id: generateConversationId([USERS.metamonk.uid, USERS.zeno.uid]),
      type: 'direct',
      participantIds: [USERS.metamonk.uid, USERS.zeno.uid],
    },
    conv1Messages,
    'FAQ Questions (2 hours old, should auto-respond)'
  );

  // Conversation 2: lily → zeno (Business inquiry, 3 hours old)
  const conv2Messages = generateTestMessages(
    generateConversationId([USERS.lily.uid, USERS.zeno.uid]),
    USERS.lily,
    USERS.zeno,
    3, // 3 hours ago
    BUSINESS_MESSAGES
  );

  await createConversation(
    {
      id: generateConversationId([USERS.lily.uid, USERS.zeno.uid]),
      type: 'direct',
      participantIds: [USERS.lily.uid, USERS.zeno.uid],
    },
    conv2Messages,
    'Business Inquiry (3 hours old, should draft response)'
  );

  // Conversation 3: metamonk → zeno (Support request, 4 hours old)
  const conv3Id = db.collection('conversations').doc().id;
  const conv3Messages = generateTestMessages(
    conv3Id,
    USERS.metamonk,
    USERS.zeno,
    4, // 4 hours old
    SUPPORT_MESSAGES
  );

  await createConversation(
    {
      id: conv3Id,
      type: 'direct',
      participantIds: [USERS.metamonk.uid, USERS.zeno.uid],
    },
    conv3Messages,
    'Support Request (4 hours old, should categorize)'
  );

  // Conversation 4: Recent conversation (should be ignored by daily agent)
  const recentConvId = db.collection('conversations').doc().id;
  const recentMessages = generateTestMessages(
    recentConvId,
    USERS.lily,
    USERS.zeno,
    0.5, // 30 minutes ago (< 1 hour, should be ignored)
    ["Hey, just sent you a message!"]
  );

  await createConversation(
    {
      id: recentConvId,
      type: 'direct',
      participantIds: [USERS.lily.uid, USERS.zeno.uid],
    },
    recentMessages,
    'Recent conversation (30 min old, should be IGNORED - too recent)'
  );

  console.log('✅ Test conversations created!\n');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Daily Agent Test Data Seeding                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    // Step 1: Clean up
    await cleanupAllConversations();

    // Step 2: Seed test data
    await seedTestConversations();

    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('✅ All conversations cleaned up');
    console.log('✅ Test conversations created for user: zeno\n');
    console.log('📊 Test Scenarios Created:');
    console.log('   1. FAQ questions (2h old) → Should auto-respond');
    console.log('   2. Business inquiry (3h old) → Should draft response');
    console.log('   3. Support request (4h old) → Should categorize');
    console.log('   4. Recent message (30m old) → Should IGNORE\n');
    console.log('🎯 Next Steps:');
    console.log('   1. Go to Profile → Test Daily Agent');
    console.log('   2. Tap "Trigger Workflow"');
    console.log('   3. Check statistics:');
    console.log('      - Messages Fetched: Should be 7-8');
    console.log('      - FAQs Detected: Should be 3');
    console.log('      - Auto-Responses Sent: 0-3 (depends on config)');
    console.log('   4. Go to Daily tab to see the digest!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Run the script
main()
  .then(() => {
    console.log('👋 Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
