/**
 * Comprehensive Test Data Seeding Script
 *
 * Creates realistic test data with:
 * - Complete user profiles
 * - 1-on-1 and group conversations
 * - 200+ realistic messages (no AI slop)
 * - All message categories and sentiment types
 * - Proper timestamps spread over time
 * - All message metadata fields populated
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/seedRealisticTestData.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

// User IDs
const MAIN_USER = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1'; // Main test user
const TEST_USERS = [
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
  'jvExoDDTXsZHly4SOEfKmHZdqE42',
  'zX4yI7Luw3PcY1TSEQ1wC6vOsfa2',
];

// All participants including main user
// const ALL_USERS = [MAIN_USER, ...TEST_USERS]; // Reserved for future use

// User profiles to ensure they're complete
const USER_PROFILES = [
  {
    uid: MAIN_USER,
    username: 'zeno',
    displayName: 'Zeno',
    email: 'zeno@example.com',
  },
  {
    uid: TEST_USERS[0],
    username: 'alex_chen',
    displayName: 'Alex Chen',
    email: 'alex@example.com',
  },
  {
    uid: TEST_USERS[1],
    username: 'sarah_kim',
    displayName: 'Sarah Kim',
    email: 'sarah@example.com',
  },
  {
    uid: TEST_USERS[2],
    username: 'mike_rivera',
    displayName: 'Mike Rivera',
    email: 'mike@example.com',
  },
];

// Realistic message templates (no emojis, sound like real people)
const MESSAGE_TEMPLATES = {
  fan_engagement: [
    "Hey, been watching your stuff for a while now. Really appreciate what you do.",
    "Just wanted to drop by and say thanks. Your content helped me through some rough times.",
    "Love the new direction you're taking with the channel",
    "Been following you since the beginning. Keep it up",
    "Your last video really hit home for me",
    "Thanks for being consistent. Rare these days",
    "Just discovered your channel. Going through all the old content now",
    "You inspired me to start my own thing. Thank you",
    "Been a lurker for ages but had to finally say something",
    "Your perspective on things is really refreshing",
    "Finally someone who gets it",
    "This is exactly what I needed to hear today",
    "You put into words what I couldn't",
    "Really solid advice in your last post",
    "Just wanted to let you know your work matters",
    "Been sharing your stuff with friends",
    "You helped me understand something I've been struggling with",
    "Keep doing what you're doing",
    "Your content quality is next level",
    "Really appreciate the effort you put into this",
  ],
  business_opportunity: [
    "Hi, I work for a brand that's interested in collaborating with you. Do you have time for a quick call?",
    "Hey, we're looking for content creators in your niche for a paid partnership. Budget is $5k-10k. Interested?",
    "Our company wants to sponsor your next video series. Can we discuss terms?",
    "Reaching out about a potential brand deal. We have a $15k budget for Q1 campaigns.",
    "Would you be interested in being a brand ambassador? Long-term partnership, competitive compensation",
    "We'd like to license some of your content for our marketing campaign. What are your rates?",
    "Hi, I'm a marketing director at XYZ Corp. We're impressed with your work and want to explore a partnership",
    "Are you available for consulting work? We need someone with your expertise for a project",
    "Our client is interested in having you as a spokesperson. Can we schedule a call to discuss?",
    "We have a product launch coming up and think you'd be perfect for it. Paid opportunity, $8k",
  ],
  spam: [
    "Click here for FREE followers and engagement! Limited time offer",
    "Make $5000/month working from home! DM me for details",
    "Check out my profile for amazing content you'll love!!",
    "Follow for follow? Let's help each other grow!",
    "I can boost your engagement by 300% guaranteed. Check my services",
    "Amazing opportunity! Get rich quick! Link in bio!",
    "Want to go viral? I have the secret formula. Only $99",
    "Free iPhone giveaway! Click link to enter now!",
    "You won't believe this one trick that influencers don't want you to know",
    "Exclusive crypto investment opportunity! Triple your money in 30 days",
  ],
  urgent: [
    "Hey, I really need your advice on something important. Can we talk?",
    "This is kind of time sensitive. Are you available to chat today?",
    "I'm in a tough spot and could really use your perspective on this",
    "Quick question that's been bothering me. Got a minute?",
    "Need to make a decision by tomorrow. Would value your input",
    "Something happened and I don't know what to do. Can you help?",
    "I'm dealing with something serious and you're the only one I thought to reach out to",
    "This can't wait. When can we talk?",
    "I'm really struggling with this decision. Could use your help",
    "Emergency situation here. Are you around?",
  ],
  general: [
    "What's up",
    "You around?",
    "Hey",
    "Quick question for you",
    "Got a sec?",
    "Yo",
    "Can I ask you something?",
    "How's it going",
    "Haven't heard from you in a while",
    "Hope you're doing well",
    "Just checking in",
    "What are you working on these days?",
    "How have you been?",
    "Long time no talk",
    "What's new with you?",
  ],
  negative: [
    "I'm not doing great to be honest",
    "Been having a really rough week",
    "Everything feels overwhelming right now",
    "I don't know if I can keep doing this",
    "Feeling pretty down lately",
    "Nothing seems to be working out",
    "I'm exhausted and don't know what to do",
    "This whole situation is getting to me",
    "I feel stuck and don't see a way forward",
    "Really struggling with this right now",
  ],
  positive: [
    "Things are looking up finally",
    "I'm actually excited about this opportunity",
    "Today was a good day",
    "I think I'm finally getting somewhere",
    "This worked out better than I expected",
    "I'm proud of how far I've come",
    "Something good finally happened",
    "I'm feeling hopeful about this",
    "This might actually work",
    "I'm glad I stuck with it",
  ],
  follow_up: [
    "Did you see my last message?",
    "Just following up on this",
    "Any thoughts on what I mentioned?",
    "Still interested if you are",
    "Let me know when you get a chance",
    "No rush but wanted to check back",
    "Circling back on this",
    "Hope this doesn't get lost in your messages",
    "Still waiting to hear back",
    "Any update on this?",
  ],
};

interface MessageConfig {
  senderId: string;
  text: string;
  category: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  sentimentScore: number;
  daysAgo: number; // How many days ago to set the timestamp
  isVIP?: boolean;
  isFAQ?: boolean;
  opportunityScore?: number;
}

async function deleteAllData() {
  console.log('\n🗑️  Deleting all existing conversations and messages...\n');

  // Get all conversations
  const conversationsSnap = await db.collection('conversations').get();

  let messageCount = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const convDoc of conversationsSnap.docs) {
    // Delete all messages in this conversation
    const messagesSnap = await db
      .collection('conversations')
      .doc(convDoc.id)
      .collection('messages')
      .get();

    messageCount += messagesSnap.size;

    messagesSnap.docs.forEach(msgDoc => {
      batch.delete(msgDoc.ref);
      batchCount++;

      // Firestore batch limit is 500
      if (batchCount >= 450) {
        batch.commit();
        batchCount = 0;
      }
    });

    // Delete conversation
    batch.delete(convDoc.ref);
    batchCount++;
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✅ Deleted ${conversationsSnap.size} conversations and ${messageCount} messages\n`);
}

async function ensureUsers() {
  console.log('👤 Ensuring user profiles are complete...\n');

  for (const profile of USER_PROFILES) {
    const userDoc = await db.collection('users').doc(profile.uid).get();

    if (!userDoc.exists) {
      // Create user
      await db.collection('users').doc(profile.uid).set({
        ...profile,
        presence: {
          status: 'offline',
          lastSeen: admin.firestore.Timestamp.now(),
        },
        settings: {
          capacity: {
            dailyLimit: 10,
            autoArchiveEnabled: true,
          },
          dailyAgent: {
            enabled: true,
            scheduledTime: '09:00',
            timezone: 'America/Los_Angeles',
          },
        },
        createdAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`✅ Created user: ${profile.displayName}`);
    } else {
      // Update user to ensure all fields exist
      await db.collection('users').doc(profile.uid).update({
        displayName: profile.displayName,
        username: profile.username,
        email: profile.email,
        updatedAt: admin.firestore.Timestamp.now(),
      });
      console.log(`✅ Updated user: ${profile.displayName}`);
    }
  }

  console.log();
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getTimestampDaysAgo(daysAgo: number): admin.firestore.Timestamp {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  // Add random hours/minutes to spread messages throughout the day
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return admin.firestore.Timestamp.fromDate(date);
}

function generateMessages(): MessageConfig[] {
  const messages: MessageConfig[] = [];

  // 80 fan engagement messages (40% - realistic distribution)
  for (let i = 0; i < 80; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.fan_engagement);
    const sentimentType = Math.random() > 0.8 ? 'neutral' : 'positive';
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'fan_engagement',
      sentiment: sentimentType,
      sentimentScore: sentimentType === 'positive' ? 0.6 + Math.random() * 0.3 : 0.0,
      daysAgo: Math.floor(Math.random() * 30), // Spread over last 30 days
    });
  }

  // 15 business opportunities (7.5%)
  for (let i = 0; i < 15; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.business_opportunity);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'business_opportunity',
      sentiment: 'neutral',
      sentimentScore: 0.1,
      daysAgo: Math.floor(Math.random() * 60),
      isVIP: Math.random() > 0.5,
      opportunityScore: 60 + Math.floor(Math.random() * 40), // 60-100
    });
  }

  // 10 spam messages (5%)
  for (let i = 0; i < 10; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.spam);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'spam',
      sentiment: 'neutral',
      sentimentScore: 0.0,
      daysAgo: Math.floor(Math.random() * 90),
    });
  }

  // 25 urgent messages (12.5%)
  for (let i = 0; i < 25; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.urgent);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'urgent',
      sentiment: 'negative',
      sentimentScore: -0.4 - Math.random() * 0.4, // -0.4 to -0.8
      daysAgo: Math.floor(Math.random() * 7), // Recent
    });
  }

  // 40 general messages (20%)
  for (let i = 0; i < 40; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.general);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'general',
      sentiment: 'neutral',
      sentimentScore: 0.0,
      daysAgo: Math.floor(Math.random() * 45),
    });
  }

  // 15 negative sentiment messages (7.5%)
  for (let i = 0; i < 15; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.negative);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'urgent',
      sentiment: 'negative',
      sentimentScore: -0.6 - Math.random() * 0.3, // -0.6 to -0.9
      daysAgo: Math.floor(Math.random() * 14),
    });
  }

  // 15 positive messages (7.5%)
  for (let i = 0; i < 15; i++) {
    const text = getRandomItem(MESSAGE_TEMPLATES.positive);
    messages.push({
      senderId: getRandomItem(TEST_USERS),
      text,
      category: 'general',
      sentiment: 'positive',
      sentimentScore: 0.5 + Math.random() * 0.4,
      daysAgo: Math.floor(Math.random() * 20),
    });
  }

  // Shuffle messages
  return messages.sort(() => Math.random() - 0.5);
}

// Simple responses from main user for conversation flow
const MAIN_USER_RESPONSES = [
  "Thanks for reaching out",
  "I appreciate that",
  "Let me think about it",
  "That sounds interesting",
  "I'll get back to you on this",
  "Can you tell me more?",
  "I'm listening",
  "Got it",
  "Understood",
  "Makes sense",
  "I hear you",
  "Thanks for sharing",
  "I'll consider it",
  "Appreciate the message",
  "Let's talk about this",
];

async function createConversationsAndMessages() {
  console.log('💬 Creating conversations and messages...\n');

  const messages = generateMessages();
  console.log(`📊 Generated ${messages.length} messages\n`);

  // Group messages by sender to create conversations
  const conversationMap = new Map<string, MessageConfig[]>();

  messages.forEach(msg => {
    if (!conversationMap.has(msg.senderId)) {
      conversationMap.set(msg.senderId, []);
    }
    conversationMap.get(msg.senderId)!.push(msg);
  });

  console.log(`📊 Creating ${conversationMap.size} 1-on-1 conversations\n`);

  // Create conversations and messages
  let totalMessages = 0;

  for (const [senderId, msgs] of conversationMap.entries()) {
    // Sort messages by timestamp (oldest first)
    msgs.sort((a, b) => b.daysAgo - a.daysAgo);

    // Create deterministic conversation ID
    const participantIds = [MAIN_USER, senderId].sort();
    const convId = participantIds.join('_');

    // Get sender info
    const senderProfile = USER_PROFILES.find(u => u.uid === senderId);
    const mainUserProfile = USER_PROFILES.find(u => u.uid === MAIN_USER);

    // Build conversation messages with alternation
    const conversationMessages: Array<{
      senderId: string;
      text: string;
      category: string;
      sentiment: string;
      sentimentScore: number;
      daysAgo: number;
      metadata: any;
    }> = [];

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];

      // Add the incoming message
      conversationMessages.push({
        senderId: msg.senderId,
        text: msg.text,
        category: msg.category,
        sentiment: msg.sentiment,
        sentimentScore: msg.sentimentScore,
        daysAgo: msg.daysAgo,
        metadata: {
          category: msg.category,
          categoryConfidence: 0.85 + Math.random() * 0.15,
          sentiment: msg.sentiment,
          sentimentScore: msg.sentimentScore,
          aiProcessed: true,
          aiProcessedAt: getTimestampDaysAgo(msg.daysAgo),
          aiVersion: 'gpt-4o-mini',
          senderDisplayName: senderProfile?.displayName,
          ...(msg.opportunityScore && { opportunityScore: msg.opportunityScore }),
          ...(msg.sentiment === 'positive' && {
            emotionalTone: getRandomItem([
              ['grateful', 'appreciative'],
              ['excited', 'hopeful'],
              ['content', 'satisfied'],
            ]),
          }),
          ...(msg.sentiment === 'negative' && {
            emotionalTone: getRandomItem([
              ['frustrated', 'worried'],
              ['sad', 'overwhelmed'],
              ['anxious', 'stressed'],
            ]),
          }),
          ...(msg.category === 'business_opportunity' && msg.opportunityScore && {
            opportunityType: getRandomItem(['sponsorship', 'collaboration', 'partnership']),
            opportunityIndicators: ['brand collaboration', 'paid partnership', 'compensation mentioned'],
            opportunityAnalysis: 'Potential brand partnership with compensation discussion',
          }),
          ...(msg.isVIP && {
            relationshipContext: {
              isVIP: true,
              conversationAge: 60 + Math.floor(Math.random() * 120),
              lastInteraction: getTimestampDaysAgo(msg.daysAgo),
              messageCount: 50 + Math.floor(Math.random() * 100),
            },
          }),
        },
      });

      // 50% chance to add a response from main user (but not for spam)
      if (msg.category !== 'spam' && Math.random() > 0.5 && i < msgs.length - 1) {
        conversationMessages.push({
          senderId: MAIN_USER,
          text: getRandomItem(MAIN_USER_RESPONSES),
          category: 'general',
          sentiment: 'neutral',
          sentimentScore: 0.0,
          daysAgo: msg.daysAgo,
          metadata: {
            category: 'general',
            sentiment: 'neutral',
            sentimentScore: 0.0,
            aiProcessed: true,
            senderDisplayName: mainUserProfile?.displayName,
          },
        });
      }
    }

    // Get the actual last message
    const lastMsg = conversationMessages[conversationMessages.length - 1];

    // Create conversation
    await db.collection('conversations').doc(convId).set({
      id: convId,
      type: 'direct',
      participantIds,
      lastMessage: {
        text: lastMsg.text,
        senderId: lastMsg.senderId,
        timestamp: getTimestampDaysAgo(lastMsg.daysAgo),
      },
      lastMessageTimestamp: getTimestampDaysAgo(lastMsg.daysAgo),
      unreadCount: {
        [MAIN_USER]: conversationMessages.filter(m => m.senderId !== MAIN_USER).length,
        [senderId]: conversationMessages.filter(m => m.senderId === MAIN_USER).length,
      },
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: getTimestampDaysAgo(msgs[0].daysAgo),
      updatedAt: getTimestampDaysAgo(lastMsg.daysAgo),
    });

    // Create all messages for this conversation
    for (let i = 0; i < conversationMessages.length; i++) {
      const msg = conversationMessages[i];
      const msgId = `msg_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`;

      await db
        .collection('conversations')
        .doc(convId)
        .collection('messages')
        .doc(msgId)
        .set({
          id: msgId,
          conversationId: convId,
          senderId: msg.senderId,
          text: msg.text,
          status: 'delivered',
          readBy: msg.senderId === MAIN_USER ? [MAIN_USER] : [],
          timestamp: getTimestampDaysAgo(msg.daysAgo),
          metadata: msg.metadata,
        });

      totalMessages++;
    }

    const incomingCount = conversationMessages.filter(m => m.senderId === senderId).length;
    const responseCount = conversationMessages.filter(m => m.senderId === MAIN_USER).length;
    console.log(`✅ ${senderProfile?.displayName}: ${incomingCount} incoming, ${responseCount} responses`);
  }

  console.log(`\n✅ Created ${conversationMap.size} conversations with ${totalMessages} messages\n`);
}

async function createGroupConversation() {
  console.log('👥 Creating group conversation...\n');

  const groupId = 'group_' + Date.now();
  const groupMessages: MessageConfig[] = [
    {
      senderId: TEST_USERS[0],
      text: "Anyone want to grab lunch later?",
      category: 'general',
      sentiment: 'neutral',
      sentimentScore: 0.0,
      daysAgo: 2,
    },
    {
      senderId: TEST_USERS[1],
      text: "I'm down. Where are we thinking?",
      category: 'general',
      sentiment: 'positive',
      sentimentScore: 0.3,
      daysAgo: 2,
    },
    {
      senderId: TEST_USERS[2],
      text: "Can't make it today unfortunately",
      category: 'general',
      sentiment: 'neutral',
      sentimentScore: -0.1,
      daysAgo: 2,
    },
    {
      senderId: MAIN_USER,
      text: "How about that new place on Main Street?",
      category: 'general',
      sentiment: 'neutral',
      sentimentScore: 0.1,
      daysAgo: 2,
    },
    {
      senderId: TEST_USERS[0],
      text: "Sounds good to me",
      category: 'general',
      sentiment: 'positive',
      sentimentScore: 0.4,
      daysAgo: 2,
    },
  ];

  // Create group conversation
  const lastMsg = groupMessages[groupMessages.length - 1];
  await db.collection('conversations').doc(groupId).set({
    id: groupId,
    type: 'group',
    participantIds: [MAIN_USER, ...TEST_USERS],
    groupName: 'Weekend Squad',
    creatorId: TEST_USERS[0],
    adminIds: [TEST_USERS[0]],
    lastMessage: {
      text: lastMsg.text,
      senderId: lastMsg.senderId,
      timestamp: getTimestampDaysAgo(lastMsg.daysAgo),
    },
    lastMessageTimestamp: getTimestampDaysAgo(lastMsg.daysAgo),
    unreadCount: {
      [MAIN_USER]: groupMessages.length - 1,
      [TEST_USERS[0]]: 4,
      [TEST_USERS[1]]: 3,
      [TEST_USERS[2]]: 2,
    },
    archivedBy: {},
    deletedBy: {},
    mutedBy: {},
    createdAt: getTimestampDaysAgo(5),
    updatedAt: getTimestampDaysAgo(2),
  });

  // Create group messages
  for (let i = 0; i < groupMessages.length; i++) {
    const msg = groupMessages[i];
    const msgId = `group_msg_${Date.now()}_${i}`;
    const senderProfile = USER_PROFILES.find(u => u.uid === msg.senderId);

    await db
      .collection('conversations')
      .doc(groupId)
      .collection('messages')
      .doc(msgId)
      .set({
        id: msgId,
        conversationId: groupId,
        senderId: msg.senderId,
        text: msg.text,
        status: 'delivered',
        readBy: msg.senderId === MAIN_USER ? [MAIN_USER] : [],
        timestamp: getTimestampDaysAgo(msg.daysAgo),
        metadata: {
          category: msg.category,
          sentiment: msg.sentiment,
          sentimentScore: msg.sentimentScore,
          aiProcessed: true,
          senderDisplayName: senderProfile?.displayName,
        },
      });
  }

  console.log(`✅ Created group conversation with ${groupMessages.length} messages\n`);
}

async function main() {
  console.log('\n🚀 Starting comprehensive test data generation...\n');
  console.log(`📍 Main User: ${MAIN_USER}`);
  console.log(`📍 Test Users: ${TEST_USERS.join(', ')}\n`);

  try {
    await deleteAllData();
    await ensureUsers();
    await createConversationsAndMessages();
    await createGroupConversation();

    console.log('\n✅ Test data generation complete!\n');
    console.log('Summary:');
    console.log('  - All old data deleted');
    console.log('  - User profiles ensured complete');
    console.log('  - 200+ realistic messages created');
    console.log('  - Multiple conversation types');
    console.log('  - All message categories represented');
    console.log('  - Proper timestamps and metadata\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
