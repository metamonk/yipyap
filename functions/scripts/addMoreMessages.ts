import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json')),
});

const db = admin.firestore();

// Main users to favor heavily
const MAIN_USERS = [
  'XoBenqsIt7bRp9ZYsftif0ZQc9o1', // Zeno
  'QKw7CZMc7aP8dLOM0jD0dUTQLQL2', // Alex
  'jvExoDDTXsZHly4SOEfKmHZdqE42', // Sarah
  'zX4yI7Luw3PcY1TSEQ1wC6vOsfa2', // Mike
];

// Realistic message templates by category
const MESSAGE_TEMPLATES = {
  fan_engagement: [
    "your content has been so inspiring lately",
    "just wanted to say thanks for being real",
    "been following for a while, appreciate what you do",
    "your perspective on things really helps",
    "wanted to reach out and say thanks",
    "really connected with what you shared recently",
    "appreciate you taking the time to engage",
    "your approach to things is refreshing",
    "thanks for being genuine",
    "just wanted to show some support",
  ],
  business_opportunity: [
    "i have a potential partnership opportunity to discuss",
    "would like to talk about a collaboration on a project",
    "have a business proposal that might interest you",
    "working on something that could be a good fit",
    "there's a paid opportunity i'd like to run by you",
    "i'm with a company that wants to work with you",
    "have a sponsorship opportunity worth discussing",
    "would like to discuss a potential deal",
    "working on a project that needs your expertise",
    "have a commercial opportunity to explore",
  ],
  spam: [
    "AMAZING OPPORTUNITY!!! Click here now!!!",
    "You've been selected for a special prize",
    "Limited time offer - act now!",
    "Make money fast with this one trick",
    "Your account needs verification immediately",
    "Congratulations! You've won",
    "Click this link for amazing deals",
    "Hot singles in your area",
    "Lose weight fast with this supplement",
    "Crypto investment opportunity - guaranteed returns",
  ],
  urgent: [
    "need to hear back soon on this",
    "this is kind of time sensitive",
    "would really appreciate a quick response",
    "need your input by end of day if possible",
    "trying to finalize something, need your thoughts",
    "on a deadline for this, can you help?",
    "hoping to get your take on this quickly",
    "need to make a decision soon, what do you think?",
    "this is somewhat urgent, can we talk?",
    "running out of time on this one",
  ],
  general: [
    "hey",
    "what's up",
    "how's it going",
    "got a minute?",
    "quick question",
    "been meaning to reach out",
    "hope you're doing well",
    "checking in",
    "wanted to catch up",
    "haven't talked in a while",
    "saw something that made me think of you",
    "random thought",
    "just curious about something",
    "wanted your opinion on something",
    "what do you think about this",
  ],
  negative: [
    "been having a rough time lately",
    "struggling with some things right now",
    "not sure what to do about this situation",
    "feeling pretty overwhelmed",
    "this has been really frustrating",
    "going through something difficult",
    "could use some advice on a problem",
    "dealing with some challenges",
    "having a hard time with this",
    "not my best week honestly",
  ],
  positive: [
    "just hit a major milestone",
    "things are going really well",
    "excited about how this turned out",
    "wanted to share some good news",
    "finally made progress on this",
    "pretty happy with how things are going",
    "just accomplished something big",
    "this worked out better than expected",
    "feeling good about where things are headed",
    "had a really productive week",
  ],
};

// Main user responses
const MAIN_USER_RESPONSES = [
  "thanks for reaching out",
  "appreciate that",
  "let me think about it",
  "sounds interesting",
  "tell me more",
  "yeah for sure",
  "i hear you",
  "that makes sense",
  "got it",
  "understood",
  "thanks for letting me know",
  "i'll get back to you",
  "noted",
  "appreciate you",
  "thanks",
  "yeah",
  "ok",
  "cool",
  "interesting",
  "makes sense",
];

// Helper functions
function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getDaysAgo(min: number, max: number): number {
  return getRandomInt(min, max);
}

interface MessageTemplate {
  text: string;
  category: string;
  sentiment: string;
  sentimentScore: number;
  emotionalTone: string;
  opportunityScore?: number;
  isVIP?: boolean;
}

function generateMessage(): MessageTemplate {
  const categories = [
    { name: 'fan_engagement', weight: 40 },
    { name: 'business_opportunity', weight: 7.5 },
    { name: 'spam', weight: 5 },
    { name: 'urgent', weight: 12.5 },
    { name: 'general', weight: 20 },
    { name: 'negative', weight: 7.5 },
    { name: 'positive', weight: 7.5 },
  ];

  // Weighted random selection
  const totalWeight = categories.reduce((sum, cat) => sum + cat.weight, 0);
  let random = Math.random() * totalWeight;

  let selectedCategory = 'general';
  for (const cat of categories) {
    random -= cat.weight;
    if (random <= 0) {
      selectedCategory = cat.name;
      break;
    }
  }

  const text = getRandomItem(MESSAGE_TEMPLATES[selectedCategory as keyof typeof MESSAGE_TEMPLATES]);

  // Base message
  const message: MessageTemplate = {
    text,
    category: selectedCategory === 'fan_engagement' ? 'fan_engagement' :
              selectedCategory === 'business_opportunity' ? 'business_opportunity' :
              selectedCategory === 'spam' ? 'spam' :
              selectedCategory === 'urgent' ? 'urgent' :
              selectedCategory === 'negative' ? 'general' :
              selectedCategory === 'positive' ? 'general' : 'general',
    sentiment: selectedCategory === 'negative' ? 'negative' :
               selectedCategory === 'positive' ? 'positive' :
               selectedCategory === 'spam' ? 'negative' : 'neutral',
    sentimentScore: selectedCategory === 'negative' ? -0.6 :
                    selectedCategory === 'positive' ? 0.7 :
                    selectedCategory === 'spam' ? -0.8 : 0.0,
    emotionalTone: selectedCategory === 'fan_engagement' ? 'appreciative' :
                   selectedCategory === 'business_opportunity' ? 'professional' :
                   selectedCategory === 'spam' ? 'promotional' :
                   selectedCategory === 'urgent' ? 'urgent' :
                   selectedCategory === 'negative' ? 'concerned' :
                   selectedCategory === 'positive' ? 'excited' : 'casual',
  };

  // Add business opportunity score
  if (selectedCategory === 'business_opportunity') {
    message.opportunityScore = getRandomInt(60, 100);
  }

  // Random VIP flag (10% chance)
  if (Math.random() < 0.1) {
    message.isVIP = true;
  }

  return message;
}

async function addMoreMessages() {
  console.log('🚀 Adding 100 more messages to existing conversations...\n');

  try {
    // Get all existing conversations
    const conversationsSnapshot = await db.collection('conversations').get();
    const conversations = conversationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    if (conversations.length === 0) {
      console.log('❌ No conversations found. Run seedComprehensiveData.ts first.');
      return;
    }

    console.log(`📊 Found ${conversations.length} conversations`);

    // Get all user profiles for sender names
    const usersSnapshot = await db.collection('users').get();
    const userProfiles = new Map();
    usersSnapshot.docs.forEach(doc => {
      userProfiles.set(doc.id, doc.data());
    });

    let messagesCreated = 0;
    const targetMessages = 100;

    // Distribute messages across conversations
    while (messagesCreated < targetMessages) {
      // Pick a random conversation (favor those with main users)
      const conversation = getRandomItem(conversations);
      const conversationData = conversation as any;

      // Determine participants
      let participants: string[] = [];
      if (conversationData.type === 'direct') {
        participants = conversationData.participants || [];
      } else if (conversationData.type === 'group') {
        participants = conversationData.participants || [];
      }

      if (participants.length < 2) {
        continue; // Skip if not enough participants
      }

      // Generate 1-3 messages for this conversation
      const messagesToAdd = getRandomInt(1, 3);

      for (let i = 0; i < messagesToAdd && messagesCreated < targetMessages; i++) {
        const messageTemplate = generateMessage();

        // Pick a sender from participants (80% chance for main users if they're in the conversation)
        const mainUsersInConversation = participants.filter(p => MAIN_USERS.includes(p));
        let senderId: string;

        if (mainUsersInConversation.length > 0 && Math.random() < 0.8) {
          senderId = getRandomItem(mainUsersInConversation);
        } else {
          senderId = getRandomItem(participants);
        }

        const senderProfile = userProfiles.get(senderId);
        const senderDisplayName = senderProfile?.displayName || 'Unknown';

        // Create timestamp (recent messages, within last 7 days)
        const daysAgo = getDaysAgo(0, 7);
        const hoursAgo = getRandomInt(0, 23);
        const minutesAgo = getRandomInt(0, 59);
        const timestamp = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000))
        );

        // Create message document
        const messageData = {
          conversationId: conversation.id,
          senderId,
          text: messageTemplate.text,
          timestamp,
          read: false,
          metadata: {
            category: messageTemplate.category,
            sentiment: messageTemplate.sentiment,
            sentimentScore: messageTemplate.sentimentScore,
            emotionalTone: messageTemplate.emotionalTone,
            aiProcessed: true,
            senderDisplayName,
            ...(messageTemplate.opportunityScore && { opportunityScore: messageTemplate.opportunityScore }),
            ...(messageTemplate.isVIP && { isVIP: true }),
            relationshipContext: {
              messageAge: daysAgo,
              totalMessages: getRandomInt(5, 50),
              lastInteraction: timestamp,
            },
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        // Add message to Firestore
        await db.collection('messages').add(messageData);
        messagesCreated++;

        // Update conversation's lastMessage and updatedAt
        await db.collection('conversations').doc(conversation.id).update({
          lastMessage: {
            text: messageTemplate.text,
            timestamp,
            senderId,
          },
          updatedAt: timestamp,
        });

        // Maybe add a response from another participant (30% chance, not for spam)
        if (messageTemplate.category !== 'spam' && Math.random() < 0.3 && messagesCreated < targetMessages) {
          // Pick a different participant to respond
          const otherParticipants = participants.filter(p => p !== senderId);
          if (otherParticipants.length > 0) {
            const responderId = getRandomItem(otherParticipants);
            const responderProfile = userProfiles.get(responderId);
            const responderDisplayName = responderProfile?.displayName || 'Unknown';

            const responseTimestamp = admin.firestore.Timestamp.fromDate(
              new Date(timestamp.toMillis() + getRandomInt(60000, 3600000)) // 1-60 minutes later
            );

            const responseData = {
              conversationId: conversation.id,
              senderId: responderId,
              text: getRandomItem(MAIN_USER_RESPONSES),
              timestamp: responseTimestamp,
              read: false,
              metadata: {
                category: 'general',
                sentiment: 'neutral',
                sentimentScore: 0.0,
                emotionalTone: 'casual',
                aiProcessed: true,
                senderDisplayName: responderDisplayName,
                relationshipContext: {
                  messageAge: daysAgo,
                  totalMessages: getRandomInt(5, 50),
                  lastInteraction: responseTimestamp,
                },
              },
              createdAt: responseTimestamp,
              updatedAt: responseTimestamp,
            };

            await db.collection('messages').add(responseData);
            messagesCreated++;

            // Update conversation again
            await db.collection('conversations').doc(conversation.id).update({
              lastMessage: {
                text: responseData.text,
                timestamp: responseTimestamp,
                senderId: responderId,
              },
              updatedAt: responseTimestamp,
            });
          }
        }

        // Show progress
        if (messagesCreated % 10 === 0) {
          console.log(`📝 Progress: ${messagesCreated}/${targetMessages} messages created`);
        }
      }
    }

    console.log('\n✅ Successfully added 100 messages!');
    console.log(`📊 Total messages created: ${messagesCreated}`);
    console.log('\n🎉 Data generation complete!');

  } catch (error) {
    console.error('❌ Error adding messages:', error);
    throw error;
  } finally {
    await admin.app().delete();
  }
}

// Run the script
addMoreMessages().catch(console.error);
