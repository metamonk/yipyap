/**
 * Setup Meaningful 10 Test Data
 *
 * Creates realistic test data for the Meaningful 10 workflow:
 * - Cleans up existing test data
 * - Creates user profiles with names
 * - Creates conversations
 * - Creates messages with proper metadata for Meaningful 10 processing
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const testCreatorId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

// Existing real users
const existingUsers = [
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
  'jvExoDDTXsZHly4SOEfKmHZdqE42',
  'zX4yI7Luw3PcY1TSEQ1wC6vOsfa2',
];

// New test users to create
const newTestUsers = [
  {
    id: 'sarah_chen_test_001',
    displayName: 'Sarah Chen',
    email: 'sarah.chen.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=1',
    createdAt: new Date('2023-01-15'),
  },
  {
    id: 'marcus_johnson_test_002',
    displayName: 'Marcus Johnson',
    email: 'marcus.johnson.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=12',
    createdAt: new Date('2023-03-20'),
  },
  {
    id: 'emily_rodriguez_test_003',
    displayName: 'Emily Rodriguez',
    email: 'emily.rodriguez.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=5',
    createdAt: new Date('2023-06-10'),
  },
  {
    id: 'alex_kim_test_004',
    displayName: 'Alex Kim',
    email: 'alex.kim.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=15',
    createdAt: new Date('2023-08-05'),
  },
  {
    id: 'taylor_smith_test_005',
    displayName: 'Taylor Smith',
    email: 'taylor.smith.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=9',
    createdAt: new Date('2024-01-12'),
  },
  {
    id: 'jordan_lee_test_006',
    displayName: 'Jordan Lee',
    email: 'jordan.lee.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=20',
    createdAt: new Date('2024-05-18'),
  },
  {
    id: 'casey_brown_test_007',
    displayName: 'Casey Brown',
    email: 'casey.brown.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=8',
    createdAt: new Date('2024-09-03'),
  },
  {
    id: 'jamie_wilson_test_008',
    displayName: 'Jamie Wilson',
    email: 'jamie.wilson.test@example.com',
    photoURL: 'https://i.pravatar.cc/150?img=14',
    createdAt: new Date('2025-02-20'),
  },
];

// Message templates with varying priority levels
const messageTemplates = {
  highPriority: [
    {
      text: "Hey! I've been following your journey for 3 years now, and your recent post about overcoming challenges really resonated with me. I'm going through something similar and your words gave me hope. Thank you for being so authentic and vulnerable with your community. 💙",
      category: 'fan_engagement',
      relationshipScore: 0.85,
      sentiment: 0.8,
    },
    {
      text: "I wanted to share that your content helped me get through a really difficult time last year. I've been a member of your community since the beginning, and watching you grow has inspired me to pursue my own dreams. Just wanted to say thank you! 🌟",
      category: 'fan_engagement',
      relationshipScore: 0.92,
      sentiment: 0.9,
    },
    {
      text: "Quick question about a potential collaboration opportunity. I work with a brand that aligns perfectly with your values and I'd love to discuss this with you. When would be a good time to connect? 📅",
      category: 'business',
      relationshipScore: 0.75,
      sentiment: 0.6,
    },
  ],
  mediumPriority: [
    {
      text: "Love your content! 🔥 Your recent video about productivity tips was exactly what I needed. Been following for about 6 months and you're killing it!",
      category: 'fan_engagement',
      relationshipScore: 0.55,
      sentiment: 0.7,
    },
    {
      text: "Really enjoyed your latest video! The editing was on point and the message really hit home. Keep up the amazing work! 👏",
      category: 'fan_engagement',
      relationshipScore: 0.48,
      sentiment: 0.65,
    },
    {
      text: "Hey, I've been following you for about 6 months and wanted to ask - what camera do you use? The quality is amazing!",
      category: 'question',
      relationshipScore: 0.42,
      sentiment: 0.5,
    },
    {
      text: "Your post today was super helpful! I tried the technique you mentioned and it actually worked. Thanks for sharing! 🙌",
      category: 'fan_engagement',
      relationshipScore: 0.38,
      sentiment: 0.6,
    },
  ],
  lowPriority: [
    {
      text: "What camera do you use?",
      category: 'question',
      relationshipScore: 0.15,
      sentiment: 0.3,
    },
    {
      text: "Nice video!",
      category: 'fan_engagement',
      relationshipScore: 0.10,
      sentiment: 0.4,
    },
    {
      text: "First! 🎉",
      category: 'spam',
      relationshipScore: 0.05,
      sentiment: 0.2,
    },
  ],
};

async function cleanupExistingTestData() {
  console.log('🧹 Cleaning up existing test data...\n');

  try {
    // Delete test conversations (those starting with 'conv_' or 'test_')
    const conversationsSnap = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', testCreatorId)
      .get();

    let deletedConversations = 0;
    let deletedMessages = 0;

    for (const convDoc of conversationsSnap.docs) {
      const convId = convDoc.id;

      // Delete if it's a test conversation
      if (convId.startsWith('conv_') || convId.startsWith('test_')) {
        // Delete messages subcollection
        const messagesSnap = await db
          .collection('conversations')
          .doc(convId)
          .collection('messages')
          .get();

        for (const msgDoc of messagesSnap.docs) {
          await msgDoc.ref.delete();
          deletedMessages++;
        }

        // Delete conversation
        await convDoc.ref.delete();
        deletedConversations++;
      }
    }

    // Delete test users (those ending with '_test_')
    const usersSnap = await db.collection('users').get();
    let deletedUsers = 0;

    for (const userDoc of usersSnap.docs) {
      if (userDoc.id.includes('_test_')) {
        await userDoc.ref.delete();
        deletedUsers++;
      }
    }

    console.log(`✅ Cleanup complete:`);
    console.log(`   - Deleted ${deletedConversations} conversations`);
    console.log(`   - Deleted ${deletedMessages} messages`);
    console.log(`   - Deleted ${deletedUsers} test users\n`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

async function createUserProfiles() {
  console.log('👥 Creating user profiles...\n');

  try {
    for (const user of newTestUsers) {
      const userRef = db.collection('users').doc(user.id);

      await userRef.set({
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        createdAt: admin.firestore.Timestamp.fromDate(user.createdAt),
        updatedAt: admin.firestore.Timestamp.now(),
        bio: `Test user profile for ${user.displayName}`,
        isTestUser: true,
      });

      console.log(`   ✓ Created user: ${user.displayName} (${user.id})`);
    }

    console.log(`\n✅ Created ${newTestUsers.length} user profiles\n`);

  } catch (error) {
    console.error('❌ Error creating user profiles:', error);
    throw error;
  }
}

async function createConversationsAndMessages() {
  console.log('💬 Creating conversations and messages...\n');

  const allUsers = [...existingUsers, ...newTestUsers.map(u => u.id)];
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  let conversationCount = 0;
  let messageCount = 0;

  try {
    // Create high priority conversations (3 users)
    for (let i = 0; i < 3; i++) {
      const senderId = allUsers[i];
      const template = messageTemplates.highPriority[i];

      const convId = `${senderId}_${testCreatorId}`;
      const msgId = `msg_${Date.now()}_${i}_high`;

      // Create conversation
      await db.collection('conversations').doc(convId).set({
        participantIds: [senderId, testCreatorId],
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)), // 90 days ago
        lastMessageTimestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        lastMessage: {
          text: template.text.substring(0, 100) + '...',
          senderId: senderId,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        },
        messageCount: 15 + i * 5, // Varying message counts for VIP status
        unreadCount: {
          [testCreatorId]: 1, // Test creator has 1 unread message
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        isGroup: false,
      });

      // Create message
      await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .doc(msgId)
        .set({
          conversationId: convId,
          senderId: senderId,
          recipientId: testCreatorId,
          text: template.text,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
          read: false,
          metadata: {
            processed: false,
            aiProcessed: false,
            needsReview: true,
            category: template.category,
            relationshipScore: template.relationshipScore,
            sentimentScore: template.sentiment,
            needsVoiceResponse: true,
            pendingReview: true,
            isFAQ: false,
            faqMatchConfidence: 0,
          },
        });

      conversationCount++;
      messageCount++;
      console.log(`   ✓ Created HIGH priority conversation with user ${i + 1}`);
    }

    // Create medium priority conversations (4 users)
    for (let i = 0; i < 4; i++) {
      const senderId = allUsers[i + 3];
      const template = messageTemplates.mediumPriority[i];

      const convId = `${senderId}_${testCreatorId}`;
      const msgId = `msg_${Date.now()}_${i}_medium`;

      // Create conversation
      await db.collection('conversations').doc(convId).set({
        participantIds: [senderId, testCreatorId],
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)), // 30 days ago
        lastMessageTimestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        lastMessage: {
          text: template.text.substring(0, 100) + '...',
          senderId: senderId,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        },
        messageCount: 3 + i * 2,
        unreadCount: {
          [testCreatorId]: 1, // Test creator has 1 unread message
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        isGroup: false,
      });

      // Create message
      await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .doc(msgId)
        .set({
          conversationId: convId,
          senderId: senderId,
          recipientId: testCreatorId,
          text: template.text,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
          read: false,
          metadata: {
            processed: false,
            aiProcessed: false,
            needsReview: true,
            category: template.category,
            relationshipScore: template.relationshipScore,
            sentimentScore: template.sentiment,
            needsVoiceResponse: true,
            pendingReview: true,
            isFAQ: false,
            faqMatchConfidence: 0,
          },
        });

      conversationCount++;
      messageCount++;
      console.log(`   ✓ Created MEDIUM priority conversation with user ${i + 4}`);
    }

    // Create low priority conversations (3 users)
    for (let i = 0; i < 3; i++) {
      const senderId = allUsers[i + 7];
      const template = messageTemplates.lowPriority[i];

      const convId = `${senderId}_${testCreatorId}`;
      const msgId = `msg_${Date.now()}_${i}_low`;

      // Create conversation
      await db.collection('conversations').doc(convId).set({
        participantIds: [senderId, testCreatorId],
        createdAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), // 7 days ago
        lastMessageTimestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        lastMessage: {
          text: template.text,
          senderId: senderId,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
        },
        messageCount: 1 + i,
        unreadCount: {
          [testCreatorId]: 1, // Test creator has 1 unread message
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        isGroup: false,
      });

      // Create message
      await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .doc(msgId)
        .set({
          conversationId: convId,
          senderId: senderId,
          recipientId: testCreatorId,
          text: template.text,
          timestamp: admin.firestore.Timestamp.fromDate(twoHoursAgo),
          read: false,
          metadata: {
            processed: false,
            aiProcessed: false,
            needsReview: true,
            category: template.category,
            relationshipScore: template.relationshipScore,
            sentimentScore: template.sentiment,
            needsVoiceResponse: true,
            pendingReview: true,
            isFAQ: false,
            faqMatchConfidence: 0,
          },
        });

      conversationCount++;
      messageCount++;
      console.log(`   ✓ Created LOW priority conversation with user ${i + 8}`);
    }

    console.log(`\n✅ Created ${conversationCount} conversations with ${messageCount} messages\n`);

  } catch (error) {
    console.error('❌ Error creating conversations:', error);
    throw error;
  }
}

async function printSummary() {
  console.log('\n📊 Test Data Summary:\n');

  // Count users
  const usersSnap = await db.collection('users').get();
  const testUsers = usersSnap.docs.filter(doc => doc.id.includes('_test_'));

  console.log(`👥 Users:`);
  console.log(`   - Total test users: ${testUsers.length}`);
  testUsers.forEach(doc => {
    const data = doc.data();
    console.log(`   - ${data.displayName} (${doc.id})`);
  });

  // Count conversations
  const conversationsSnap = await db
    .collection('conversations')
    .where('participantIds', 'array-contains', testCreatorId)
    .get();

  console.log(`\n💬 Conversations:`);
  console.log(`   - Total conversations: ${conversationsSnap.size}`);

  // Count messages by priority
  let highPriority = 0;
  let mediumPriority = 0;
  let lowPriority = 0;

  for (const convDoc of conversationsSnap.docs) {
    const messagesSnap = await db
      .collection('conversations')
      .doc(convDoc.id)
      .collection('messages')
      .where('recipientId', '==', testCreatorId)
      .get();

    for (const msgDoc of messagesSnap.docs) {
      const score = msgDoc.data().metadata?.relationshipScore;
      if (score >= 0.7) highPriority++;
      else if (score >= 0.3) mediumPriority++;
      else lowPriority++;
    }
  }

  console.log(`\n📬 Messages by Priority:`);
  console.log(`   - High (≥0.7): ${highPriority}`);
  console.log(`   - Medium (0.3-0.69): ${mediumPriority}`);
  console.log(`   - Low (<0.3): ${lowPriority}`);
  console.log(`   - Total: ${highPriority + mediumPriority + lowPriority}`);

  console.log(`\n✅ Ready for Meaningful 10 workflow!\n`);
}

async function main() {
  console.log('🚀 Setting up Meaningful 10 test data...\n');

  try {
    // Step 1: Cleanup
    await cleanupExistingTestData();

    // Step 2: Create user profiles
    await createUserProfiles();

    // Step 3: Create conversations and messages
    await createConversationsAndMessages();

    // Step 4: Print summary
    await printSummary();

    console.log('✅ All done! You can now run the daily agent workflow.\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
