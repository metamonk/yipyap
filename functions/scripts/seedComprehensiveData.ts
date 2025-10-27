/**
 * Comprehensive Test Data Generation
 *
 * 1. Deletes all users except the 4 main ones
 * 2. Deletes all messages and conversations
 * 3. Creates 10 new users with complete profiles
 * 4. Creates 200+ realistic messages
 * 5. Creates various conversation types (1-on-1 and groups)
 * 6. Heavily favors the 4 main users
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/seedComprehensiveData.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

// Main users to keep and favor heavily
const MAIN_USERS = [
  'XoBenqsIt7bRp9ZYsftif0ZQc9o1',
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
  'jvExoDDTXsZHly4SOEfKmHZdqE42',
  'zX4yI7Luw3PcY1TSEQ1wC6vOsfa2',
];

// New users to create
const NEW_USERS = [
  {
    uid: 'user_emma_001',
    username: 'emma_wilson',
    displayName: 'Emma Wilson',
    email: 'emma.wilson@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=1',
  },
  {
    uid: 'user_james_002',
    username: 'james_park',
    displayName: 'James Park',
    email: 'james.park@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=12',
  },
  {
    uid: 'user_sophia_003',
    username: 'sophia_martinez',
    displayName: 'Sophia Martinez',
    email: 'sophia.m@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=5',
  },
  {
    uid: 'user_liam_004',
    username: 'liam_anderson',
    displayName: 'Liam Anderson',
    email: 'liam.anderson@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=13',
  },
  {
    uid: 'user_olivia_005',
    username: 'olivia_garcia',
    displayName: 'Olivia Garcia',
    email: 'olivia.garcia@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=9',
  },
  {
    uid: 'user_noah_006',
    username: 'noah_johnson',
    displayName: 'Noah Johnson',
    email: 'noah.j@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=15',
  },
  {
    uid: 'user_ava_007',
    username: 'ava_smith',
    displayName: 'Ava Smith',
    email: 'ava.smith@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=10',
  },
  {
    uid: 'user_ethan_008',
    username: 'ethan_brown',
    displayName: 'Ethan Brown',
    email: 'ethan.brown@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=14',
  },
  {
    uid: 'user_mia_009',
    username: 'mia_davis',
    displayName: 'Mia Davis',
    email: 'mia.davis@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=20',
  },
  {
    uid: 'user_lucas_010',
    username: 'lucas_miller',
    displayName: 'Lucas Miller',
    email: 'lucas.miller@example.com',
    photoURL: 'https://i.pravatar.cc/300?img=11',
  },
];

// All users including new ones
const ALL_USER_IDS = [...MAIN_USERS, ...NEW_USERS.map(u => u.uid)];

// Realistic message templates (no AI slop, natural language)
const REALISTIC_MESSAGES = {
  greetings: [
    "hey",
    "what's up",
    "yo",
    "hi there",
    "morning",
    "hey how's it going",
  ],
  casual: [
    "just saw your message",
    "been meaning to reach out",
    "got a minute to talk?",
    "quick question",
    "you free later?",
    "wanted to run something by you",
    "can we chat?",
    "need your opinion on something",
    "what do you think about this",
    "i have an idea",
  ],
  business: [
    "We're looking for someone with your skillset for a project. Budget is around $8k. Interested?",
    "Our company wants to explore a partnership. Can we schedule a call?",
    "I work with brands looking for creators. We have a campaign that might fit. Want details?",
    "Would you be open to discussing a sponsorship opportunity? We're offering competitive rates",
    "I'm reaching out about a potential collaboration with our client",
    "We'd like to license some of your work for our campaign. What are your rates?",
    "Are you taking on any consulting work right now?",
    "Our team is impressed with your content. We have a paid opportunity we'd like to discuss",
    "Quick question about your availability for a brand partnership",
    "I represent a company interested in working with you. Do you have a media kit?",
  ],
  urgent: [
    "this is kind of time sensitive",
    "need to make a decision soon",
    "can you get back to me today?",
    "this can't really wait",
    "i'm in a bind here",
    "really need your help with this",
    "situation is getting urgent",
    "deadline is tomorrow",
    "need to figure this out asap",
    "this is important",
  ],
  negative: [
    "having a rough day",
    "not doing great honestly",
    "feeling overwhelmed",
    "this is harder than i thought",
    "i don't know what to do",
    "everything is a mess right now",
    "i'm exhausted",
    "can't seem to catch a break",
    "this whole situation sucks",
    "i'm stressed out",
  ],
  positive: [
    "things are going well",
    "finally making progress",
    "today was actually pretty good",
    "i'm excited about this",
    "this worked out better than expected",
    "feeling optimistic",
    "i think we're on the right track",
    "that's great news",
    "this is exactly what i needed",
    "couldn't have asked for better",
  ],
  followup: [
    "did you see my last message?",
    "following up on this",
    "just checking in",
    "any update?",
    "wanted to circle back",
    "let me know when you can",
    "still interested if you are",
    "hope this didn't get buried",
    "just bumping this up",
    "any thoughts on this?",
  ],
  responses: [
    "yeah for sure",
    "definitely",
    "i can do that",
    "sounds good",
    "that works",
    "let me check and get back to you",
    "i'll look into it",
    "makes sense",
    "i'm down",
    "count me in",
    "not sure about that",
    "maybe, let me think",
    "i'll have to pass",
    "probably not",
    "i don't think so",
  ],
  spam: [
    "CLICK HERE for exclusive offer!! Limited time only!!!",
    "Make money fast! Work from home! DM for details!!",
    "Follow for follow? Let's grow together!",
    "Check out my new post! Link in bio!",
    "Free followers guaranteed! Click now!",
    "I can make you go viral! Only $50!",
    "Want more engagement? I have the secret!",
  ],
};

async function cleanupOldUsers() {
  console.log('\n🗑️  Cleaning up users...\n');

  const usersSnap = await db.collection('users').get();
  let deletedCount = 0;

  for (const doc of usersSnap.docs) {
    if (!MAIN_USERS.includes(doc.id)) {
      await db.collection('users').doc(doc.id).delete();
      deletedCount++;
      console.log(`❌ Deleted user: ${doc.id}`);
    }
  }

  console.log(`\n✅ Deleted ${deletedCount} users, kept ${MAIN_USERS.length} main users\n`);
}

async function deleteAllConversationsAndMessages() {
  console.log('🗑️  Deleting all conversations and messages...\n');

  const conversationsSnap = await db.collection('conversations').get();
  let messageCount = 0;

  for (const convDoc of conversationsSnap.docs) {
    const messagesSnap = await db
      .collection('conversations')
      .doc(convDoc.id)
      .collection('messages')
      .get();

    messageCount += messagesSnap.size;

    // Delete messages
    for (const msgDoc of messagesSnap.docs) {
      await msgDoc.ref.delete();
    }

    // Delete conversation
    await convDoc.ref.delete();
  }

  console.log(`✅ Deleted ${conversationsSnap.size} conversations and ${messageCount} messages\n`);
}

async function createNewUsers() {
  console.log('👤 Creating 10 new users...\n');

  for (const user of NEW_USERS) {
    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      presence: {
        status: Math.random() > 0.5 ? 'online' : 'offline',
        lastSeen: admin.firestore.Timestamp.now(),
      },
      settings: {
        capacity: {
          dailyLimit: 10,
          autoArchiveEnabled: true,
        },
        dailyAgent: {
          enabled: false,
          scheduledTime: '09:00',
          timezone: 'America/Los_Angeles',
        },
      },
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
    console.log(`✅ Created: ${user.displayName} (@${user.username})`);
  }

  console.log();
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomUser(favorMainUsers: boolean = true): string {
  // 80% chance to pick from main users if favoring
  if (favorMainUsers && Math.random() < 0.8) {
    return getRandomItem(MAIN_USERS);
  }
  return getRandomItem(ALL_USER_IDS);
}

function getTimestampDaysAgo(daysAgo: number): admin.firestore.Timestamp {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  return admin.firestore.Timestamp.fromDate(date);
}

interface ConversationMessage {
  senderId: string;
  text: string;
  category: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
  sentiment: 'positive' | 'negative' | 'neutral';
  sentimentScore: number;
  daysAgo: number;
}

async function createDirectConversations() {
  console.log('💬 Creating direct conversations...\n');

  let totalMessages = 0;

  // Create conversations for each main user with various other users
  for (const mainUser of MAIN_USERS) {
    const numConversations = 2 + Math.floor(Math.random() * 3); // 2-4 conversations per main user

    for (let i = 0; i < numConversations; i++) {
      // Pick another user (can be main or new)
      let otherUser = getRandomUser(false);
      while (otherUser === mainUser) {
        otherUser = getRandomUser(false);
      }

      const participantIds = [mainUser, otherUser].sort();
      const convId = participantIds.join('_');

      // Generate messages for this conversation
      const numMessages = 10 + Math.floor(Math.random() * 20); // 10-30 messages per conversation
      const messages: ConversationMessage[] = [];

      for (let j = 0; j < numMessages; j++) {
        const isFromMain = Math.random() < 0.4; // 40% from main user, 60% from other
        const daysAgo = Math.floor(Math.random() * 45); // Spread over 45 days

        let category: any = 'general';
        let sentiment: any = 'neutral';
        let sentimentScore = 0;
        let text = '';

        // Determine message type
        const rand = Math.random();
        if (rand < 0.05) {
          // 5% business
          category = 'business_opportunity';
          text = getRandomItem(REALISTIC_MESSAGES.business);
          sentimentScore = 0.1;
        } else if (rand < 0.1) {
          // 5% urgent
          category = 'urgent';
          sentiment = 'negative';
          text = getRandomItem(REALISTIC_MESSAGES.urgent);
          sentimentScore = -0.4 - Math.random() * 0.3;
        } else if (rand < 0.13) {
          // 3% spam
          category = 'spam';
          text = getRandomItem(REALISTIC_MESSAGES.spam);
        } else if (rand < 0.18) {
          // 5% negative
          sentiment = 'negative';
          text = getRandomItem(REALISTIC_MESSAGES.negative);
          sentimentScore = -0.5 - Math.random() * 0.4;
        } else if (rand < 0.23) {
          // 5% positive
          sentiment = 'positive';
          text = getRandomItem(REALISTIC_MESSAGES.positive);
          sentimentScore = 0.5 + Math.random() * 0.4;
        } else {
          // 77% casual/general
          const messageType = getRandomItem([
            REALISTIC_MESSAGES.greetings,
            REALISTIC_MESSAGES.casual,
            REALISTIC_MESSAGES.followup,
            REALISTIC_MESSAGES.responses,
          ]);
          text = getRandomItem(messageType);
        }

        messages.push({
          senderId: isFromMain ? mainUser : otherUser,
          text,
          category,
          sentiment,
          sentimentScore,
          daysAgo,
        });
      }

      // Sort by timestamp
      messages.sort((a, b) => b.daysAgo - a.daysAgo);

      // Create conversation
      const lastMsg = messages[messages.length - 1];
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
          [participantIds[0]]: messages.filter(m => m.senderId !== participantIds[0]).length,
          [participantIds[1]]: messages.filter(m => m.senderId !== participantIds[1]).length,
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: getTimestampDaysAgo(messages[0].daysAgo),
        updatedAt: getTimestampDaysAgo(lastMsg.daysAgo),
      });

      // Create messages
      for (let k = 0; k < messages.length; k++) {
        const msg = messages[k];
        const msgId = `msg_${Date.now()}_${k}_${Math.random().toString(36).substr(2, 9)}`;

        const metadata: any = {
          category: msg.category,
          categoryConfidence: 0.85 + Math.random() * 0.15,
          sentiment: msg.sentiment,
          sentimentScore: msg.sentimentScore,
          aiProcessed: true,
          aiProcessedAt: getTimestampDaysAgo(msg.daysAgo),
          aiVersion: 'gpt-4o-mini',
        };

        if (msg.sentiment === 'positive') {
          metadata.emotionalTone = ['hopeful', 'content'];
        } else if (msg.sentiment === 'negative') {
          metadata.emotionalTone = ['frustrated', 'worried'];
        }

        if (msg.category === 'business_opportunity') {
          metadata.opportunityScore = 60 + Math.floor(Math.random() * 40);
          metadata.opportunityType = getRandomItem(['sponsorship', 'collaboration', 'partnership']);
          metadata.opportunityIndicators = ['paid opportunity', 'brand partnership'];
        }

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
            readBy: msg.senderId === mainUser ? [mainUser] : [],
            timestamp: getTimestampDaysAgo(msg.daysAgo),
            metadata,
          });

        totalMessages++;
      }

      const mainUserName = mainUser === MAIN_USERS[0] ? 'Zeno' :
                           mainUser === MAIN_USERS[1] ? 'Alex' :
                           mainUser === MAIN_USERS[2] ? 'Sarah' : 'Mike';
      console.log(`✅ ${mainUserName} ↔ ${otherUser.substring(0, 12)}: ${messages.length} messages`);
    }
  }

  console.log(`\n✅ Created direct conversations with ${totalMessages} messages\n`);
  return totalMessages;
}

async function createGroupConversations() {
  console.log('👥 Creating group conversations...\n');

  let totalMessages = 0;

  // Create 2 group conversations
  for (let i = 0; i < 2; i++) {
    const groupId = `group_${Date.now()}_${i}`;

    // Pick 4-6 participants, heavily favoring main users
    const numParticipants = 4 + Math.floor(Math.random() * 3);
    const participants = new Set<string>();

    // Add 2-3 main users
    const numMainUsers = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < numMainUsers; j++) {
      participants.add(MAIN_USERS[j]);
    }

    // Fill remaining with any users
    while (participants.size < numParticipants) {
      participants.add(getRandomUser(false));
    }

    const participantIds = Array.from(participants);
    const creatorId = participantIds[0];

    // Generate 10-15 group messages
    const numMessages = 10 + Math.floor(Math.random() * 6);
    const messages: ConversationMessage[] = [];

    for (let j = 0; j < numMessages; j++) {
      const sender = getRandomItem(participantIds);
      const daysAgo = Math.floor(Math.random() * 14);

      const messageType = getRandomItem([
        REALISTIC_MESSAGES.greetings,
        REALISTIC_MESSAGES.casual,
        REALISTIC_MESSAGES.responses,
      ]);

      messages.push({
        senderId: sender,
        text: getRandomItem(messageType),
        category: 'general',
        sentiment: 'neutral',
        sentimentScore: 0,
        daysAgo,
      });
    }

    messages.sort((a, b) => b.daysAgo - a.daysAgo);

    const lastMsg = messages[messages.length - 1];
    const groupNames = ['Weekend Plans', 'Work Group', 'Friend Zone', 'Squad Goals'];

    await db.collection('conversations').doc(groupId).set({
      id: groupId,
      type: 'group',
      participantIds,
      groupName: groupNames[i],
      creatorId,
      adminIds: [creatorId],
      lastMessage: {
        text: lastMsg.text,
        senderId: lastMsg.senderId,
        timestamp: getTimestampDaysAgo(lastMsg.daysAgo),
      },
      lastMessageTimestamp: getTimestampDaysAgo(lastMsg.daysAgo),
      unreadCount: Object.fromEntries(
        participantIds.map(id => [id, messages.filter(m => m.senderId !== id).length])
      ),
      archivedBy: {},
      deletedBy: {},
      mutedBy: {},
      createdAt: getTimestampDaysAgo(messages[0].daysAgo),
      updatedAt: getTimestampDaysAgo(lastMsg.daysAgo),
    });

    // Create messages
    for (let k = 0; k < messages.length; k++) {
      const msg = messages[k];
      const msgId = `group_msg_${Date.now()}_${k}_${Math.random().toString(36).substr(2, 9)}`;

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
          readBy: [],
          timestamp: getTimestampDaysAgo(msg.daysAgo),
          metadata: {
            category: 'general',
            sentiment: 'neutral',
            sentimentScore: 0,
            aiProcessed: true,
          },
        });

      totalMessages++;
    }

    console.log(`✅ Group "${groupNames[i]}": ${participantIds.length} members, ${messages.length} messages`);
  }

  console.log(`\n✅ Created group conversations with ${totalMessages} messages\n`);
  return totalMessages;
}

async function main() {
  console.log('\n🚀 Starting comprehensive data generation...\n');
  console.log(`📍 Keeping main users: ${MAIN_USERS.length}`);
  console.log(`📍 Creating new users: ${NEW_USERS.length}\n`);

  try {
    await cleanupOldUsers();
    await deleteAllConversationsAndMessages();
    await createNewUsers();

    const directMessages = await createDirectConversations();
    const groupMessages = await createGroupConversations();

    console.log('\n✅ Data generation complete!\n');
    console.log('Summary:');
    console.log(`  - Kept 4 main users`);
    console.log(`  - Created 10 new users with complete profiles`);
    console.log(`  - Total messages: ${directMessages + groupMessages}`);
    console.log(`  - Multiple conversation types`);
    console.log(`  - All categories represented`);
    console.log(`  - Main users heavily favored\n`);
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
