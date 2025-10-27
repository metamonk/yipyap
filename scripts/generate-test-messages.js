/**
 * Generate test conversations and messages for Meaningful 10 testing
 * Creates messages with varying relationship scores to test High/Medium/Auto-handled tiers
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

// Your user ID (the creator)
const CREATOR_ID = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

// Generate random fan user IDs
function generateFanId(index) {
  return `test_fan_${Date.now()}_${index}`;
}

/**
 * Create a test conversation
 */
async function createConversation(creatorId, fanId, fanName) {
  const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const conversationData = {
    id: conversationId,
    type: 'direct',
    participantIds: [creatorId, fanId],
    participants: {
      [creatorId]: {
        userId: creatorId,
        displayName: 'Zeno (Creator)',
        role: 'creator',
      },
      [fanId]: {
        userId: fanId,
        displayName: fanName,
        role: 'fan',
      },
    },
    // lastMessage object structure (required by ConversationListItem)
    lastMessage: {
      text: 'New message', // Will be updated when message is created
      senderId: fanId,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    },
    lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),

    // Required fields for conversationService
    deletedBy: {}, // Empty object - no one has deleted this conversation
    archivedBy: {}, // Empty object - no one has archived this conversation
    mutedBy: {}, // Empty object - no one has muted this conversation
    unreadCount: {
      [creatorId]: 1, // Creator has 1 unread message (from the fan)
      [fanId]: 0,
    },
  };

  await db.collection('conversations').doc(conversationId).set(conversationData);
  console.log(`✅ Created conversation: ${conversationId} with ${fanName}`);

  return conversationId;
}

/**
 * Create a test message with specific relationship score
 *
 * Relationship scoring criteria (from the code):
 * - High Priority (≥0.7): Deep personal connections, meaningful interactions
 * - Medium Priority (0.3-0.69): Regular engagement, moderate connection
 * - Auto-handled (<0.3): Generic messages, FAQ-like content
 */
async function createMessage(conversationId, senderId, senderName, text, relationshipScore) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const messageData = {
    id: messageId,
    conversationId: conversationId,
    senderId: senderId,
    senderName: senderName,
    text: text,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),

    // Metadata for AI workflow processing
    metadata: {
      // Mark as unprocessed so daily agent picks it up
      processed: false,
      needsReview: true,

      // Set relationship score directly for testing
      relationshipScore: relationshipScore,

      // Add some realistic AI categorization metadata
      category: relationshipScore >= 0.7 ? 'Personal' :
                relationshipScore >= 0.3 ? 'Engagement' : 'General',
      sentimentScore: relationshipScore >= 0.7 ? 0.8 :
                      relationshipScore >= 0.3 ? 0.5 : 0.2,

      // Mark as needing voice response (so it gets drafted)
      needsVoiceResponse: true,
      pendingReview: true,
    },
  };

  // Create the message
  await db.collection('conversations')
    .doc(conversationId)
    .collection('messages')
    .doc(messageId)
    .set(messageData);

  // Update conversation's lastMessage
  await db.collection('conversations')
    .doc(conversationId)
    .update({
      lastMessage: {
        text: text,
        senderId: senderId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      },
      lastMessageTimestamp: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

  console.log(`  📨 Created ${relationshipScore >= 0.7 ? 'HIGH' : relationshipScore >= 0.3 ? 'MEDIUM' : 'LOW'} priority message from ${senderName}`);

  return messageId;
}

/**
 * Main function to generate test data
 */
async function generateTestData() {
  console.log('🚀 Generating test conversations and messages...\n');

  try {
    // Create 3 test conversations with different relationship levels

    // 1. HIGH PRIORITY - Close friend/important connection
    const conv1Id = await createConversation(
      CREATOR_ID,
      generateFanId(1),
      'Sarah Chen'
    );

    await createMessage(
      conv1Id,
      generateFanId(1),
      'Sarah Chen',
      "Hey! I've been following your journey for 3 years now, and your recent post about overcoming challenges really resonated with me. I'm going through something similar and your words gave me hope. Thank you for being so authentic and vulnerable with your community. 💙",
      0.85 // High relationship score
    );

    // 2. HIGH PRIORITY - Long-time supporter with meaningful message
    const conv2Id = await createConversation(
      CREATOR_ID,
      generateFanId(2),
      'Marcus Johnson'
    );

    await createMessage(
      conv2Id,
      generateFanId(2),
      'Marcus Johnson',
      "I wanted to share that your content helped me get through a really difficult time last year. I've been a member of your community since the beginning, and seeing how you've grown has inspired me to pursue my own goals. Would love to hear your thoughts on balancing creativity with mental health.",
      0.92 // Very high relationship score
    );

    // 3. MEDIUM PRIORITY - Regular engagement, appreciative
    const conv3Id = await createConversation(
      CREATOR_ID,
      generateFanId(3),
      'Emily Rodriguez'
    );

    await createMessage(
      conv3Id,
      generateFanId(3),
      'Emily Rodriguez',
      "Really enjoyed your latest video! The editing was top-notch and the message was super clear. Keep up the great work! 🎬",
      0.55 // Medium relationship score
    );

    // 4. MEDIUM PRIORITY - Thoughtful question
    const conv4Id = await createConversation(
      CREATOR_ID,
      generateFanId(4),
      'Alex Kim'
    );

    await createMessage(
      conv4Id,
      generateFanId(4),
      'Alex Kim',
      "I've been following you for about 6 months now. Your advice on time management has been super helpful. Do you have any tips for staying consistent with content creation while working a full-time job?",
      0.48 // Medium relationship score
    );

    // 5. LOW PRIORITY - Generic compliment (should be auto-handled)
    const conv5Id = await createConversation(
      CREATOR_ID,
      generateFanId(5),
      'Taylor Smith'
    );

    await createMessage(
      conv5Id,
      generateFanId(5),
      'Taylor Smith',
      "Love your content! 🔥",
      0.15 // Low relationship score - auto-handled
    );

    // 6. LOW PRIORITY - Simple question (FAQ-like)
    const conv6Id = await createConversation(
      CREATOR_ID,
      generateFanId(6),
      'Jordan Lee'
    );

    await createMessage(
      conv6Id,
      generateFanId(6),
      'Jordan Lee',
      "What camera do you use?",
      0.10 // Very low relationship score - auto-handled
    );

    console.log('\n✅ Test data generation complete!\n');
    console.log('Summary:');
    console.log('  - 6 conversations created');
    console.log('  - 2 HIGH priority messages (relationship score ≥ 0.7)');
    console.log('  - 2 MEDIUM priority messages (relationship score 0.3-0.69)');
    console.log('  - 2 LOW priority messages (relationship score < 0.3, auto-handled)');
    console.log('\n📋 Next steps:');
    console.log('  1. Run the daily agent workflow');
    console.log('  2. Check the Daily tab to see the digest');
    console.log('  3. Verify High/Medium/Auto-handled sections have the right messages');

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    throw error;
  }
}

// Run the script
generateTestData()
  .then(() => {
    console.log('\n✅ Script complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
