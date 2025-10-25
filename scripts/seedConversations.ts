/**
 * Seed Conversations Script
 *
 * @remarks
 * Creates realistic conversations with messages for AI voice training data.
 * Run with: npx tsx scripts/seedConversations.ts
 *
 * Prerequisites:
 * - Firebase Admin SDK installed
 * - Service account key file (serviceAccountKey.json)
 * - Firestore initialized
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import { readFileSync } from 'fs';

// Load service account
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

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

/**
 * Generate conversation ID for direct messages (deterministic)
 */
function generateConversationId(participantIds: string[]): string {
  return participantIds.slice().sort().join('_');
}

/**
 * Generate realistic messages for a conversation
 */
function generateMessages(
  conversationId: string,
  participants: Array<{ uid: string; displayName: string }>,
  messagesPerUser: number,
  scenario: string
): Array<{
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  status: 'delivered';
  readBy: string[];
  timestamp: admin.firestore.Timestamp;
  metadata: {
    aiProcessed: boolean;
  };
}> {
  const messages: any[] = [];
  const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // Start 7 days ago

  // Message templates by scenario
  const templates = getMessageTemplates(scenario, participants);

  const totalMessages = messagesPerUser * participants.length;
  const timeIncrement = (7 * 24 * 60 * 60 * 1000) / totalMessages;

  // Ensure we have enough templates - expand if needed
  const expandedTemplates: string[] = [];
  const variations = [
    '', // No variation
    ' 😊',
    ' 👍',
    '!',
    '...',
  ];

  // Expand templates to ensure we have enough unique messages
  let templateIndex = 0;
  let variationIndex = 0;

  while (expandedTemplates.length < totalMessages) {
    const baseTemplate = templates[templateIndex % templates.length];
    const variation = variationIndex > 0 ? variations[variationIndex] : '';

    // Only add variation if we're repeating templates
    if (templateIndex >= templates.length) {
      expandedTemplates.push(baseTemplate + variation);
    } else {
      expandedTemplates.push(baseTemplate);
    }

    templateIndex++;

    // Cycle through variations when repeating templates
    if (templateIndex >= templates.length * (variationIndex + 1)) {
      variationIndex = (variationIndex + 1) % variations.length;
    }
  }

  // Distribute messages sequentially as a conversation
  // Alternate between participants to simulate natural conversation flow
  let participantIndex = 0;

  for (let i = 0; i < totalMessages; i++) {
    const participant = participants[participantIndex];
    const messageId = `msg_${conversationId}_${i}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = admin.firestore.Timestamp.fromMillis(
      startTime + i * timeIncrement
    );

    // Get template and replace placeholders
    let text = expandedTemplates[i];
    text = text.replace(/\{sender\}/g, participant.displayName);
    participants.forEach((p) => {
      text = text.replace(new RegExp(`\\{${p.displayName}\\}`, 'g'), p.displayName);
    });

    messages.push({
      id: messageId,
      conversationId,
      senderId: participant.uid,
      text,
      status: 'delivered' as const,
      readBy: participants.map((p) => p.uid),
      timestamp,
      metadata: {
        aiProcessed: false,
      },
    });

    // Rotate to next participant
    participantIndex = (participantIndex + 1) % participants.length;
  }

  return messages;
}

/**
 * Get message templates based on conversation scenario
 */
function getMessageTemplates(
  scenario: string,
  participants: Array<{ uid: string; displayName: string }>
): string[] {
  const scenarios: Record<string, string[]> = {
    podcast_collab: [
      "Hey! I've been thinking about starting a podcast. Would you be interested in co-hosting?",
      'That sounds amazing! What kind of topics are you thinking about?',
      "I'm thinking we could focus on tech, creativity, and entrepreneurship. Our different perspectives would make it really interesting.",
      "Love it! How often were you thinking we'd record?",
      'Maybe weekly to start? We could batch record a few episodes to stay ahead.',
      "That works for me. Do you have recording equipment or should we look into that?",
      "I have a decent mic and audio interface. We could record remotely and I'll handle the editing.",
      'Perfect! What about a name? Any ideas?',
      "How about something that captures both our styles? 'Digital Discourse' or 'The Creative Tech Hour'?",
      "I like 'Digital Discourse'! It's clean and professional.",
      "Awesome! Let's outline our first 5 episodes. I'll start a shared doc.",
      'Great idea. I can contribute some topic ideas tonight.',
      "For episode 1, maybe we introduce ourselves and talk about our journey into tech?",
      'Yes! And we could share some early failures and lessons learned.',
      "People love authenticity. Let's not hold back on the messy parts of the journey.",
      'Agreed. Episode 2 could be about AI and creativity - where they intersect.',
      "Perfect! I've been experimenting with AI tools for design work.",
      'Same here! We could demo some tools and discuss ethical implications.',
      "Let's also get some guest speakers eventually. Who would be your dream guest?",
      'Maybe someone from the open source community? Like the creator of a major framework.',
      "Great idea! We can build up to that. Let's nail our format first.",
      'True. Should we have segments or keep it conversational?',
      "Mix of both? Intro, main topic, quick tips segment, then Q&A?",
      'I like that structure. Keeps it dynamic but organized.',
      "For the quick tips, we could each share one tool or technique we're loving.",
      'Yes! And for Q&A, we can collect questions from social media.',
      'Should we set up accounts just for the podcast?',
      "Good call. I'll grab the Instagram and Twitter handles today.",
      'I can design a logo and some social media templates.',
      "You're the best! What's your design style thinking?",
      'Modern, minimal, maybe with some gradients? Tech-forward but approachable.',
      'Sounds perfect. Send me a few concepts when you have them.',
      "Will do! Okay, so timeline - when do we want to launch?",
      'Maybe 6 weeks? That gives us time to record, edit, and build some buzz.',
      "Let's aim for 5 episodes ready before launch, then stay 2-3 ahead.",
      'Smart. Should we do a trailer first?',
      "Yes! 60-90 seconds, introducing us and what listeners can expect.",
      'I can script that this weekend.',
      "Perfect! And I'll research hosting platforms. Anchor, Buzzsprout, or build custom?",
      'Anchor is free and easy for starting out. We can always migrate later.',
      'Good point. Keep it simple initially.',
      "Exactly. Let's focus on content quality over fancy infrastructure.",
      'Speaking of content, should we script episodes or use bullet points?',
      "I prefer bullets. More natural conversation that way.",
      'Agreed! We can riff off each other better.',
      "Okay I'm getting excited! Let's schedule our first recording session.",
      'How about next Saturday morning? 10am?',
      "Perfect! I'll send over the doc with episode outlines.",
      'And I\'ll have logo concepts ready to review.',
      'This is going to be great!',
      "Can't wait to get started! Talk soon! 🎙️",
    ],
    brand_partnership: [
      "Hi! I represent a sustainable fashion brand and we love your content!",
      'Thank you so much! What kind of collaboration did you have in mind?',
      "We're looking for authentic creators who align with our values. Would you be interested in a partnership?",
      "I'd love to hear more! I'm very selective about brand partnerships.",
      "Totally understand! We're offering a 3-month ambassador program with creative freedom.",
      'What does the ambassador program entail?',
      'You\'d receive our latest collection and create content around sustainable fashion choices.',
      "That sounds aligned with my values. What's the compensation structure?",
      "We're offering $5,000 per month plus 20% commission on sales through your code.",
      'That sounds fair. How much content would be expected?',
      '2-3 posts per month across your platforms, plus Stories featuring the products.',
      "I typically do more in-depth content. Would long-form videos be acceptable?",
      'Absolutely! We actually prefer that. Authenticity over quantity.',
      'Love that approach. Can you tell me more about your sustainability practices?',
      "We're carbon neutral, use only organic materials, and have transparent supply chains.",
      'Impressive! Do you have certifications I could review?',
      'Yes, we\'re B Corp certified and Fair Trade. I can send over all documentation.',
      "Perfect! I'd want to verify everything before promoting to my audience.",
      'We respect that completely. Transparency is core to our brand.',
      "When would you need an answer by? I'd like to review everything carefully.",
      'No rush! Take 2 weeks to review. We want partners who are genuinely excited.',
      'I appreciate that. What creative guidelines would there be?',
      'Very minimal. We trust your creative vision. Just need approval on final posts.',
      "That's refreshing! Most brands want heavy control.",
      'We believe authentic voices perform better than scripted content.',
      'Completely agree. Let me review the materials and think about creative concepts.',
      'Sounds great! I\'ll email everything over today.',
      'Thank you! One more question - exclusivity clauses?',
      'Only for direct fashion brand competitors during the active partnership.',
      "That's very reasonable. I can work with that.",
      'Wonderful! Looking forward to hopefully working together!',
      'Same here! Thanks for reaching out with such a thoughtful proposal.',
      'Of course! We\'ve been following you for months and love your authenticity.',
      "That means a lot! I'll be in touch soon.",
      'Perfect! Have a great day!',
      'You too! 😊',
    ],
    group_planning: [
      'Hey everyone! Should we plan that group trip we talked about?',
      "Yes! I'm so ready for a vacation!",
      'Me too! Where are we thinking?',
      'What about somewhere with both beach and culture?',
      'Portugal? Spain? Greece?',
      'Portugal could be amazing! Lisbon and the Algarve.',
      "I've always wanted to go to Portugal!",
      "Same! The food, the tile work, the beaches - all perfect.",
      'When are we thinking? I need to check my work schedule.',
      'Maybe late spring? April or May?',
      'May works better for me. More time to save up too.',
      'May sounds perfect! Weather should be ideal.',
      'How long? A week? 10 days?',
      "I can probably do 10 days if we plan far enough ahead.",
      '10 days would let us really explore without rushing.',
      'Okay so May, 10 days, Portugal - this is happening!',
      'Should we hire a travel planner or DIY it?',
      'DIY! We can share a Google doc and all contribute ideas.',
      "I'm good at finding deals on flights!",
      "And I'm great at researching neighborhoods and local spots.",
      'I can handle the itinerary organization.',
      'Perfect division of labor! Love it.',
      "Let's set a budget per person so we're all aligned.",
      'Good idea. All-in including flights?',
      'Yeah, flights, accommodation, food, activities, everything.',
      "I'm thinking $2,500-3,000 per person?",
      'That seems reasonable for 10 days in Portugal.',
      "Works for me! I'll start looking at flights.",
      'Should we get an Airbnb or do hotels?',
      'Airbnb could be fun! We could cook some meals together.',
      'And it would probably be more cost effective.',
      "Let's do Airbnb! Maybe split time between Lisbon and a beach town?",
      '5 days each location?',
      'Perfect! Lisbon for culture and food, then Algarve for beach relaxation.',
      "I'm already excited! Let me create that Google doc.",
      'Make sure we all have edit access!',
      'Will do! Sending the link now.',
      'Got it! Adding some initial research.',
      'This is going to be incredible!',
      "Can't wait! Best group trip ever! ✈️",
    ],
    tech_discussion: [
      'Did you see the latest AI model release?',
      'Yes! The capabilities are insane.',
      'What are your thoughts on the multimodal features?',
      "Game-changing for development workflows. I'm already using it for code reviews.",
      'Same! How are you integrating it into your stack?',
      "I built a custom VS Code extension that calls the API.",
      'That sounds amazing! Is it on GitHub?',
      "Not yet, still refining it. But I'll open source it soon.",
      'Please do! I would love to contribute.',
      "I'll send you early access. Your feedback would be valuable.",
      'Awesome! What programming languages does it support?',
      'Right now TypeScript, Python, Go, and Rust.',
      'Perfect! Those cover my main languages.',
      "What's your current development setup like?",
      'Neovim with heavy LSP customization, tmux, and various CLI tools.',
      'Nice! Old school but powerful.',
      "Yeah, I prefer keyboard-driven workflows. What about you?",
      "VS Code, but I'm a power user with tons of custom keybindings.",
      'Do you use Vim mode in VS Code?',
      'Absolutely! Vim motions are muscle memory at this point.',
      'Same. I tried going back to normal editing once. Lasted 5 minutes.',
      'Once you go Vim, you never go back! 😄',
      "What's your take on the serverless vs containers debate?",
      'Depends on the use case. Serverless for event-driven, containers for complex state.',
      'Exactly my thinking! Too many people try to force one solution everywhere.',
      "Right tool for the job. I'm using both in my current project.",
      'How are you handling local development for serverless?',
      'Docker Compose with LocalStack for AWS services.',
      'Clean solution! Does it handle all the AWS services you need?',
      'Most of them. S3, Lambda, DynamoDB work great. Some edge cases need workarounds.',
      'Have you tried Serverless Framework or going raw with AWS SAM?',
      'Serverless Framework. More mature ecosystem and plugin support.',
      'Good choice. The plugin ecosystem is really strong.',
      'What are you working on these days?',
      "Building a real-time collaboration tool with WebSockets and CRDTs.",
      'Ooh, CRDTs! How are you handling conflict resolution?',
      'Using Yjs for the CRDT implementation. Solid library.',
      "I've heard great things about Yjs! Performance holding up?",
      'Surprisingly well, even with large documents and many concurrent users.',
      "That's impressive! I should explore CRDTs more.",
      'Happy to share my learnings. There are some gotchas.',
      "I'd love that! Maybe we can pair on it sometime?",
      'Definitely! Let me know when you have time.',
      'Will do! This has been a great discussion.',
      'Always enjoy our tech talks! Later! 💻',
    ],
    fan_engagement: [
      'Just wanted to say I love your content!',
      'Thank you so much! That means the world! ❤️',
      'How did you get started creating content?',
      'I just started sharing things I was passionate about! No plan, just authenticity.',
      "That's inspiring! I want to start but I'm nervous.",
      "Don't overthink it! Just start. Your first videos won't be perfect and that's okay.",
      'What gear do you use for recording?',
      'Honestly, I started with just my phone! Upgraded gradually as I grew.',
      "Really? Your quality is so good though!",
      'Lighting and audio matter more than camera! I invested there first.',
      'Any specific lighting recommendations?',
      'Softbox lights from Amazon, like $50. Game changer!',
      'Thanks! What about editing software?',
      'I use DaVinci Resolve. Free and professional-grade.',
      'Wow, free? I thought you had to pay for good editing software.',
      'Nope! DaVinci Resolve free version is incredibly powerful.',
      "You're so helpful! Do you have a tutorial on your setup?",
      'Good idea! I should make that. Adding it to my content calendar.',
      "I'd watch that for sure!",
      'Noted! Anything else you want to see on the channel?',
      'Maybe a day-in-the-life? I love those!',
      "I've been thinking about that! Will plan one soon.",
      'Yay! How do you stay motivated when views are low?',
      'Focus on the process, not the numbers. Create for one person who needs it.',
      "That's beautiful. I'm going to remember that.",
      'You got this! Feel free to message me when you post your first video.',
      'Really?? That would be amazing!',
      'Absolutely! I remember how scary it was starting out.',
      'Thank you for being so kind and encouraging!',
      'Of course! We all rise together! 🚀',
    ],
    business_opportunity: [
      'Hi! Our company is looking for someone with your expertise.',
      'Thanks for reaching out! What kind of opportunity?',
      "We're developing a new SaaS product and need a technical advisor.",
      'Interesting! Can you tell me more about the product?',
      "It's a platform for remote team collaboration with AI-powered features.",
      'That space is crowded. What makes your approach different?',
      'We focus on async communication and reducing meeting fatigue.',
      'Now that\'s compelling! What would the advisor role involve?',
      'Monthly strategy sessions, technical architecture review, and market positioning.',
      'Time commitment?',
      'Roughly 10 hours per month. Flexible scheduling.',
      "And compensation? I want to make sure expectations are aligned.",
      "We're offering $500/hour as a consultant, or equity if you prefer deeper involvement.",
      "That's very competitive. Tell me about the founding team.",
      'Three of us: designer, developer, and business strategy. All ex-FAANG.',
      'Impressive backgrounds! What stage are you at?',
      "We have a working MVP with 50 beta users. Raising a seed round now.",
      'What kind of feedback are you getting from beta users?',
      'Mostly positive! They love the async features but want better mobile experience.',
      "Mobile is crucial for adoption. That's a smart priority.",
      'Exactly our thinking. Would this interest you?',
      'Potentially! Can you send over more details? Pitch deck, tech stack, etc?',
      'Absolutely! I\'ll email everything today.',
      'Perfect. What timeline for a decision?',
      "We're hoping to finalize advisors in the next 3 weeks.",
      "That works! I'll review everything carefully.",
      'Appreciate it! We really admire your work in this space.',
      'Thank you! Looking forward to learning more about your vision.',
      'Talk soon! 📧',
    ],
  };

  return scenarios[scenario] || scenarios['tech_discussion'];
}

/**
 * Create a conversation with messages
 */
async function createConversation(
  conversationData: {
    id: string;
    type: 'direct' | 'group';
    participantIds: string[];
    groupName?: string;
  },
  participants: Array<{ uid: string; username: string; displayName: string }>,
  messagesPerUser: number,
  scenario: string
) {
  const { id, type, participantIds, groupName } = conversationData;

  console.log(`\n📝 Creating ${type} conversation: ${groupName || 'Direct chat'}`);
  console.log(`   Participants: ${participants.map((p) => p.displayName).join(', ')}`);

  // Generate messages
  const messages = generateMessages(id, participants, messagesPerUser, scenario);
  console.log(`   Generated ${messages.length} messages`);

  // Get last message for conversation metadata
  const lastMessage = messages[messages.length - 1];

  // Initialize per-user maps
  const unreadCount: Record<string, number> = {};
  const archivedBy: Record<string, boolean> = {};
  const deletedBy: Record<string, boolean> = {};
  const mutedBy: Record<string, boolean> = {};

  participantIds.forEach((uid) => {
    unreadCount[uid] = 0; // All messages are read in seed data
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

  // Write conversation and all messages in batches
  const conversationRef = db.collection('conversations').doc(id);
  await conversationRef.set(conversationDoc);
  console.log(`   ✓ Created conversation document`);

  // Write messages in batches (Firestore limit is 500 operations per batch)
  const BATCH_SIZE = 500;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchMessages = messages.slice(i, i + BATCH_SIZE);

    batchMessages.forEach((message) => {
      const messageRef = db.collection('conversations').doc(id).collection('messages').doc(message.id);
      batch.set(messageRef, message);
    });

    await batch.commit();
    console.log(`   ✓ Written messages ${i + 1}-${Math.min(i + BATCH_SIZE, messages.length)}`);
  }

  console.log(`   ✅ Conversation complete!`);
}

/**
 * Main seeding function
 */
async function seedConversations() {
  try {
    console.log('🌱 Starting to seed conversations...');
    console.log('📋 Using Firebase Admin SDK with service account\n');

    // Define 10 conversations
    const conversations = [
      // 1. Group conversation with all 3 users - Podcast collaboration
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'group' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid, USERS.lily.uid],
          groupName: '🎙️ Podcast Planning',
        },
        participants: [USERS.metamonk, USERS.zeno, USERS.lily],
        scenario: 'podcast_collab',
      },
      // 2. Direct: metamonk <-> zeno - Tech discussion
      {
        data: {
          id: generateConversationId([USERS.metamonk.uid, USERS.zeno.uid]),
          type: 'direct' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid],
        },
        participants: [USERS.metamonk, USERS.zeno],
        scenario: 'tech_discussion',
      },
      // 3. Direct: metamonk <-> lily - Brand partnership
      {
        data: {
          id: generateConversationId([USERS.metamonk.uid, USERS.lily.uid]),
          type: 'direct' as const,
          participantIds: [USERS.metamonk.uid, USERS.lily.uid],
        },
        participants: [USERS.metamonk, USERS.lily],
        scenario: 'brand_partnership',
      },
      // 4. Direct: zeno <-> lily - Business opportunity
      {
        data: {
          id: generateConversationId([USERS.zeno.uid, USERS.lily.uid]),
          type: 'direct' as const,
          participantIds: [USERS.zeno.uid, USERS.lily.uid],
        },
        participants: [USERS.zeno, USERS.lily],
        scenario: 'business_opportunity',
      },
      // 5. Group: All 3 - Trip planning
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'group' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid, USERS.lily.uid],
          groupName: '✈️ Portugal Trip 2025',
        },
        participants: [USERS.metamonk, USERS.zeno, USERS.lily],
        scenario: 'group_planning',
      },
      // 6. Direct: metamonk <-> zeno - Fan engagement (metamonk as creator)
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'direct' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid],
        },
        participants: [USERS.zeno, USERS.metamonk], // zeno as fan, metamonk as creator
        scenario: 'fan_engagement',
      },
      // 7. Direct: lily <-> zeno - Fan engagement (lily as creator)
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'direct' as const,
          participantIds: [USERS.lily.uid, USERS.zeno.uid],
        },
        participants: [USERS.zeno, USERS.lily], // zeno as fan, lily as creator
        scenario: 'fan_engagement',
      },
      // 8. Group: All 3 - Tech Discussion
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'group' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid, USERS.lily.uid],
          groupName: '💻 Tech Talk',
        },
        participants: [USERS.metamonk, USERS.zeno, USERS.lily],
        scenario: 'tech_discussion',
      },
      // 9. Direct: metamonk <-> lily - Business opportunity
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'direct' as const,
          participantIds: [USERS.metamonk.uid, USERS.lily.uid],
        },
        participants: [USERS.lily, USERS.metamonk], // lily reaching out to metamonk
        scenario: 'business_opportunity',
      },
      // 10. Group: All 3 - Brand Partnership Discussion
      {
        data: {
          id: db.collection('conversations').doc().id,
          type: 'group' as const,
          participantIds: [USERS.metamonk.uid, USERS.zeno.uid, USERS.lily.uid],
          groupName: '🤝 Brand Collab',
        },
        participants: [USERS.metamonk, USERS.zeno, USERS.lily],
        scenario: 'brand_partnership',
      },
    ];

    const messagesPerUser = 50;

    // Create each conversation
    for (let i = 0; i < conversations.length; i++) {
      const { data, participants, scenario } = conversations[i];
      console.log(`\n[${i + 1}/${conversations.length}] =================`);
      await createConversation(data, participants, messagesPerUser, scenario);
    }

    console.log('\n\n✅ Successfully seeded all conversations!');
    console.log(`\n📊 Summary:`);
    console.log(`   - Total conversations: ${conversations.length}`);
    console.log(`   - Messages per user per conversation: ${messagesPerUser}`);
    console.log(`   - Total messages: ~${conversations.reduce((sum, c) => sum + c.participants.length * messagesPerUser, 0)}`);
    console.log(`\n💡 Conversations created for:`);
    console.log(`   - ${USERS.metamonk.displayName} (@${USERS.metamonk.username})`);
    console.log(`   - ${USERS.zeno.displayName} (@${USERS.zeno.username})`);
    console.log(`   - ${USERS.lily.displayName} (@${USERS.lily.username})`);
  } catch (error) {
    console.error('\n❌ Error seeding conversations:', error);
    process.exit(1);
  }
}

// Run the script
seedConversations()
  .then(() => {
    console.log('\n👋 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
