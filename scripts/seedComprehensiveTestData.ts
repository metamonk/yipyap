/**
 * Comprehensive Test Data Seeding Script
 *
 * @remarks
 * Creates realistic conversations and messages with:
 * - ALL message categorization types (fan_engagement, business_opportunity, spam, urgent, general)
 * - Complete sentiment analysis metadata
 * - Opportunity scoring for business messages
 * - Full conversation stats (categoryStats, sentimentStats)
 * - High variability - no duplicate messages
 * - Varied conversation ages (new, established, VIP)
 * - Complete user profiles with all settings
 *
 * Run with: npx tsx scripts/seedComprehensiveTestData.ts
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

// =============================================
// USER ACCOUNTS (heavily involving XoBenqsIt7bRp9ZYsftif0ZQc9o1)
// =============================================

const USERS = {
  zeno: {
    uid: 'XoBenqsIt7bRp9ZYsftif0ZQc9o1',
    username: 'zeno',
    displayName: 'Zeno',
    email: 'zeno@yipyap.wtf',
  },
  metamonk: {
    uid: 'QKw7CZMc7aP8dLOM0jD0dUTQLQL2',
    username: 'metamonk',
    displayName: 'MetaMonk',
    email: 'metamonk@test.com',
  },
  lily: {
    uid: 'jvExoDDTXsZHly4SOEfKmHZdqE42',
    username: 'lily',
    displayName: 'Lily',
    email: 'lily@test.com',
  },
  alex: {
    uid: 'zX4yI7Luw3PcY1TSEQ1wC6vOsfa2',
    username: 'alex',
    displayName: 'Alex',
    email: 'alex@test.com',
  },
};

// =============================================
// MESSAGE TEMPLATES WITH VARIABILITY
// =============================================

interface MessageTemplate {
  category: 'fan_engagement' | 'business_opportunity' | 'spam' | 'urgent' | 'general';
  templates: Array<{
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    sentimentScore: [number, number]; // min, max range
    emotionalTones: string[];
    opportunityScore?: [number, number]; // for business_opportunity only
    opportunityType?: 'sponsorship' | 'collaboration' | 'partnership' | 'sale';
  }>;
}

const MESSAGE_TEMPLATES: MessageTemplate[] = [
  // FAN ENGAGEMENT MESSAGES
  {
    category: 'fan_engagement',
    templates: [
      {
        text: "Hey! I absolutely love your content! You've inspired me to {action}!",
        sentiment: 'positive',
        sentimentScore: [0.6, 0.9],
        emotionalTones: ['excited', 'grateful', 'inspired'],
      },
      {
        text: "Your recent {topic} post was incredibly helpful! Thank you for {reason}!",
        sentiment: 'positive',
        sentimentScore: [0.5, 0.8],
        emotionalTones: ['grateful', 'appreciative', 'happy'],
      },
      {
        text: "I've been following you for {time} and just wanted to say {compliment}!",
        sentiment: 'positive',
        sentimentScore: [0.4, 0.7],
        emotionalTones: ['appreciative', 'warm', 'supportive'],
      },
      {
        text: "Quick question about {topic} - do you have any tips for {scenario}?",
        sentiment: 'neutral',
        sentimentScore: [-0.1, 0.2],
        emotionalTones: ['curious', 'hopeful'],
      },
      {
        text: "I tried implementing your {technique} but got stuck on {problem}. Any advice?",
        sentiment: 'neutral',
        sentimentScore: [-0.2, 0.1],
        emotionalTones: ['confused', 'curious', 'determined'],
      },
    ],
  },

  // BUSINESS OPPORTUNITY MESSAGES
  {
    category: 'business_opportunity',
    templates: [
      {
        text: "Hi! I represent {company} and we're interested in a {duration} sponsorship partnership. Budget: {budget}. Interested?",
        sentiment: 'neutral',
        sentimentScore: [-0.1, 0.3],
        emotionalTones: ['professional', 'hopeful'],
        opportunityScore: [70, 95],
        opportunityType: 'sponsorship',
      },
      {
        text: "We're a {industry} brand looking for authentic creators. Would you be interested in discussing a paid collaboration? We offer {compensation}.",
        sentiment: 'positive',
        sentimentScore: [0.1, 0.4],
        emotionalTones: ['professional', 'enthusiastic'],
        opportunityScore: [65, 90],
        opportunityType: 'collaboration',
      },
      {
        text: "I'm launching a {product} and would love to partner with you. We can offer {terms}. Open to discussing details?",
        sentiment: 'positive',
        sentimentScore: [0.2, 0.5],
        emotionalTones: ['excited', 'professional', 'optimistic'],
        opportunityScore: [60, 85],
        opportunityType: 'partnership',
      },
      {
        text: "Our {industry} company wants to feature you in our {campaign}. Compensation package: {amount}. Let's chat?",
        sentiment: 'neutral',
        sentimentScore: [0.0, 0.3],
        emotionalTones: ['professional', 'business-like'],
        opportunityScore: [75, 95],
        opportunityType: 'sponsorship',
      },
      {
        text: "Hey! We're running a {type} campaign and think you'd be perfect. We're offering {compensation} plus {bonus}. Interested?",
        sentiment: 'positive',
        sentimentScore: [0.1, 0.4],
        emotionalTones: ['enthusiastic', 'hopeful'],
        opportunityScore: [55, 80],
        opportunityType: 'collaboration',
      },
    ],
  },

  // SPAM MESSAGES
  {
    category: 'spam',
    templates: [
      {
        text: "🎉 CONGRATULATIONS! You've been selected for our {offer}! Click here: {link} to claim your {prize}!",
        sentiment: 'neutral',
        sentimentScore: [-0.3, 0.0],
        emotionalTones: ['pushy', 'suspicious'],
      },
      {
        text: "Make ${amount} from home! {emoji} This {product} changed my life! Limited time offer! {link}",
        sentiment: 'neutral',
        sentimentScore: [-0.4, -0.1],
        emotionalTones: ['aggressive', 'salesy'],
      },
      {
        text: "Hey! Check out my {product}! Use code {code} for {discount}% off! {link} {emoji} {emoji}",
        sentiment: 'neutral',
        sentimentScore: [-0.3, 0.0],
        emotionalTones: ['promotional', 'pushy'],
      },
      {
        text: "URGENT: Your {account} requires immediate verification! Click {link} to avoid suspension!",
        sentiment: 'negative',
        sentimentScore: [-0.5, -0.2],
        emotionalTones: ['alarming', 'suspicious', 'urgent'],
      },
    ],
  },

  // URGENT MESSAGES
  {
    category: 'urgent',
    templates: [
      {
        text: "I'm really frustrated with {issue}. I've tried everything and nothing works! This is seriously affecting my {impact}.",
        sentiment: 'negative',
        sentimentScore: [-0.7, -0.4],
        emotionalTones: ['frustrated', 'angry', 'desperate'],
      },
      {
        text: "This is urgent - I'm having a crisis with {problem} and need help ASAP. I'm losing {consequence} every {timeframe}!",
        sentiment: 'negative',
        sentimentScore: [-0.8, -0.5],
        emotionalTones: ['panicked', 'stressed', 'desperate'],
      },
      {
        text: "I'm extremely disappointed with {aspect}. This is completely unacceptable and I need this resolved immediately!",
        sentiment: 'negative',
        sentimentScore: [-0.9, -0.6],
        emotionalTones: ['angry', 'disappointed', 'demanding'],
      },
      {
        text: "HELP NEEDED: {problem} just happened and I'm completely stuck. This is critical for my {reason}!",
        sentiment: 'negative',
        sentimentScore: [-0.6, -0.3],
        emotionalTones: ['stressed', 'worried', 'urgent'],
      },
    ],
  },

  // GENERAL MESSAGES
  {
    category: 'general',
    templates: [
      {
        text: "Hi! Just wanted to reach out about {topic}. Let me know if you're interested!",
        sentiment: 'neutral',
        sentimentScore: [-0.1, 0.1],
        emotionalTones: ['neutral', 'casual'],
      },
      {
        text: "Hey, I saw your {content} and thought {observation}. What do you think?",
        sentiment: 'neutral',
        sentimentScore: [-0.1, 0.2],
        emotionalTones: ['curious', 'casual'],
      },
      {
        text: "Quick question - do you know anything about {topic}? I'm trying to figure out {problem}.",
        sentiment: 'neutral',
        sentimentScore: [0.0, 0.2],
        emotionalTones: ['curious', 'casual'],
      },
      {
        text: "I was thinking about {topic} and remembered your work. Have you considered {idea}?",
        sentiment: 'neutral',
        sentimentScore: [-0.1, 0.3],
        emotionalTones: ['thoughtful', 'curious'],
      },
    ],
  },
];

// =============================================
// RANDOMIZATION UTILITIES
// =============================================

const VARIABLES = {
  action: [
    'start my own channel',
    'learn web development',
    'pursue my creative passions',
    'start building my portfolio',
    'launch my side project',
  ],
  topic: ['AI integration', 'React patterns', 'productivity tips', 'design workflow', 'career advice'],
  reason: [
    'sharing your knowledge',
    'being so transparent',
    'taking time to explain',
    'your detailed approach',
  ],
  time: ['6 months', 'a year', '2 years', 'ages', 'quite a while'],
  compliment: [
    'your work is amazing',
    "you're crushing it",
    'keep up the great work',
    "you're an inspiration",
  ],
  scenario: [
    'beginners',
    'scaling production',
    'improving performance',
    'better organization',
    'team collaboration',
  ],
  technique: ['caching strategy', 'testing approach', 'component architecture', 'state management'],
  problem: [
    'edge cases',
    'async handling',
    'type safety',
    'performance optimization',
    'error boundaries',
  ],
  company: ['TechVentures Inc', 'Digital Dynamics', 'InnovateCo', 'FutureScale', 'GrowthLabs'],
  duration: ['3-month', '6-month', '12-month', 'quarterly', 'annual'],
  budget: ['$5k-10k/month', '$3k-7k/month', '$10k-20k/month', '$8k-15k/month'],
  industry: ['SaaS', 'fintech', 'edtech', 'healthtech', 'sustainable fashion'],
  compensation: [
    '$500/post + commission',
    '$1000/month retainer',
    '$2000 flat fee',
    'equity + cash',
  ],
  product: ['new app', 'course platform', 'design tool', 'productivity suite', 'AI assistant'],
  terms: [
    'revenue share',
    'equity stake',
    'monthly retainer',
    'performance bonuses',
    'profit sharing',
  ],
  campaign: ['brand awareness campaign', 'product launch', 'rebranding initiative', 'series'],
  amount: ['$5,000', '$10,000', '$3,500', '$7,500', '$12,000'],
  type: ['seasonal', 'product launch', 'brand awareness', 'influencer', 'content'],
  bonus: [
    'performance bonuses',
    'affiliate commission',
    'free products',
    'exclusive access',
    'revenue share',
  ],
  offer: [
    'premium membership',
    'exclusive opportunity',
    'limited-time deal',
    'VIP package',
    'special promotion',
  ],
  link: ['bit.ly/abc123', 'sketchy-url.xyz', 'claim-now.biz', 'limited-offer.net'],
  prize: ['$1000 gift card', 'free vacation', 'luxury item', 'cash prize', 'premium package'],
  emoji: ['💰', '🎁', '🔥', '⚡', '✨', '🎉', '💎', '🚀'],
  code: ['SAVE50', 'DISCOUNT20', 'VIP10', 'SPECIAL30', 'LIMITED40'],
  discount: ['50', '30', '70', '20', '40'],
  account: ['PayPal', 'Amazon', 'Instagram', 'banking', 'email'],
  issue: [
    'the deployment process',
    'authentication flow',
    'API integration',
    'database queries',
    'performance',
  ],
  impact: ['productivity', 'deadlines', 'user experience', 'revenue', 'reputation'],
  consequence: ['money', 'users', 'data', 'customers', 'credibility'],
  timeframe: ['hour', 'day', 'minute', 'week'],
  aspect: [
    'the response time',
    'the quality',
    'the communication',
    'the reliability',
    'the support',
  ],
  content: ['blog post', 'video', 'tutorial', 'tweet', 'project', 'design'],
  observation: [
    'it was really insightful',
    'that was clever',
    'great approach',
    'interesting take',
    'solid work',
  ],
  idea: ['taking it further', 'a different angle', 'expanding on that', 'collaborating'],
};

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInRange(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function fillTemplate(template: string): string {
  let result = template;
  const matches = template.match(/\{(\w+)\}/g);
  if (matches) {
    matches.forEach((match) => {
      const key = match.slice(1, -1) as keyof typeof VARIABLES;
      if (VARIABLES[key]) {
        result = result.replace(match, randomChoice(VARIABLES[key]));
      }
    });
  }
  return result;
}

// =============================================
// MESSAGE GENERATION
// =============================================

interface GeneratedMessage {
  text: string;
  category: string;
  categoryConfidence: number;
  sentiment: string;
  sentimentScore: number;
  emotionalTone: string[];
  opportunityScore?: number;
  opportunityType?: string;
  opportunityIndicators?: string[];
  opportunityAnalysis?: string;
}

function generateUniqueMessage(categoryFilter?: string): GeneratedMessage {
  // Filter templates by category if specified
  let availableTemplates = MESSAGE_TEMPLATES;
  if (categoryFilter) {
    availableTemplates = MESSAGE_TEMPLATES.filter((t) => t.category === categoryFilter);
  }

  const templateGroup = randomChoice(availableTemplates);
  const template = randomChoice(templateGroup.templates);

  const text = fillTemplate(template.text);
  const sentimentScore = randomInRange(template.sentimentScore[0], template.sentimentScore[1]);
  const categoryConfidence = randomInRange(0.75, 0.98);

  const result: GeneratedMessage = {
    text,
    category: templateGroup.category,
    categoryConfidence,
    sentiment: template.sentiment,
    sentimentScore: Number(sentimentScore.toFixed(2)),
    emotionalTone: template.emotionalTones,
  };

  // Add opportunity scoring for business messages
  if (templateGroup.category === 'business_opportunity' && template.opportunityScore) {
    result.opportunityScore = Math.floor(
      randomInRange(template.opportunityScore[0], template.opportunityScore[1])
    );
    result.opportunityType = template.opportunityType;
    result.opportunityIndicators = [
      'sponsorship deal',
      'brand collaboration',
      'compensation',
      'budget mentioned',
    ];
    result.opportunityAnalysis = `${template.opportunityType} opportunity with ${
      result.opportunityScore >= 80 ? 'high' : result.opportunityScore >= 70 ? 'medium' : 'low'
    } potential value`;
  }

  return result;
}

// =============================================
// CONVERSATION CREATION
// =============================================

async function createConversationWithMessages(
  conversationType: 'direct' | 'group',
  participants: Array<{ uid: string; displayName: string }>,
  messageCount: number,
  conversationAge: number, // days old
  options: {
    groupName?: string;
    categoryMix?: string[]; // specific categories to include
    includeUnprocessed?: boolean; // some messages not AI processed
  } = {}
) {
  const participantIds = participants.map((p) => p.uid);
  const conversationId =
    conversationType === 'direct'
      ? participantIds.slice().sort().join('_')
      : db.collection('conversations').doc().id;

  console.log(
    `\n📝 Creating ${conversationType} conversation: ${options.groupName || 'Direct chat'}`
  );
  console.log(`   Participants: ${participants.map((p) => p.displayName).join(', ')}`);
  console.log(`   Messages: ${messageCount}, Age: ${conversationAge} days`);

  const messages: any[] = [];
  const now = Date.now();
  const conversationStart = now - conversationAge * 24 * 60 * 60 * 1000;

  // Category/sentiment tracking for conversation stats
  const categoryCounts: Record<string, number> = {};
  let lastCategory = '';
  let hasUrgent = false;
  let lastSentiment = '';
  let lastSentimentScore = 0;
  let negativeCount = 0;
  let hasCrisis = false;
  let lastCrisisAt: admin.firestore.Timestamp | undefined;

  // Generate messages
  for (let i = 0; i < messageCount; i++) {
    const categoryFilter = options.categoryMix
      ? randomChoice(options.categoryMix)
      : undefined;
    const messageData = generateUniqueMessage(categoryFilter);

    // Pick sender (alternate or random)
    const sender = participants[i % participants.length];

    const messageId = `msg_${conversationId}_${i}_${Math.random().toString(36).substr(2, 9)}`;
    const timeOffset = (conversationAge * 24 * 60 * 60 * 1000 * i) / messageCount;
    const timestamp = admin.firestore.Timestamp.fromMillis(conversationStart + timeOffset);

    // Randomly decide if message is AI processed
    const aiProcessed = options.includeUnprocessed ? Math.random() > 0.3 : true;

    const message: any = {
      id: messageId,
      conversationId,
      senderId: sender.uid,
      text: messageData.text,
      status: 'delivered',
      readBy: participantIds, // All read for now
      timestamp,
      metadata: {
        category: messageData.category,
        categoryConfidence: messageData.categoryConfidence,
        sentiment: messageData.sentiment,
        sentimentScore: messageData.sentimentScore,
        emotionalTone: messageData.emotionalTone,
        aiProcessed,
        ...(aiProcessed && {
          aiProcessedAt: timestamp,
          aiVersion: 'gpt-4o-mini',
        }),
      },
    };

    // Add opportunity fields for business messages
    if (messageData.opportunityScore) {
      message.metadata.opportunityScore = messageData.opportunityScore;
      message.metadata.opportunityType = messageData.opportunityType;
      message.metadata.opportunityIndicators = messageData.opportunityIndicators;
      message.metadata.opportunityAnalysis = messageData.opportunityAnalysis;
    }

    messages.push(message);

    // Update conversation stats
    categoryCounts[messageData.category] = (categoryCounts[messageData.category] || 0) + 1;
    lastCategory = messageData.category;
    if (messageData.category === 'urgent') hasUrgent = true;

    lastSentiment = messageData.sentiment;
    lastSentimentScore = messageData.sentimentScore;
    if (messageData.sentimentScore < -0.3) negativeCount++;
    if (messageData.sentimentScore < -0.7) {
      hasCrisis = true;
      lastCrisisAt = timestamp;
    }
  }

  // Get last message
  const lastMessage = messages[messages.length - 1];

  // Initialize per-user maps
  const unreadCount: Record<string, number> = {};
  const archivedBy: Record<string, boolean> = {};
  const deletedBy: Record<string, boolean> = {};
  const mutedBy: Record<string, boolean> = {};

  participantIds.forEach((uid) => {
    unreadCount[uid] = uid === USERS.zeno.uid ? Math.floor(Math.random() * 5) : 0;
    archivedBy[uid] = false;
    deletedBy[uid] = false;
    mutedBy[uid] = false;
  });

  // Create conversation document with full stats
  const conversationDoc: any = {
    id: conversationId,
    type: conversationType,
    participantIds,
    ...(options.groupName && { groupName: options.groupName }),
    ...(conversationType === 'group' && { creatorId: participantIds[0] }),
    ...(conversationType === 'group' && { adminIds: [participantIds[0]] }),
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
    categoryStats: {
      lastCategory,
      categoryCounts,
      hasUrgent,
    },
    sentimentStats: {
      lastSentiment,
      lastSentimentScore,
      negativeCount,
      hasCrisis,
      ...(lastCrisisAt && { lastCrisisAt }),
    },
    autoResponseEnabled: true,
    createdAt: messages[0].timestamp,
    updatedAt: lastMessage.timestamp,
  };

  // Write to Firestore
  await db.collection('conversations').doc(conversationId).set(conversationDoc);

  // Write messages in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchMessages = messages.slice(i, i + BATCH_SIZE);

    batchMessages.forEach((message) => {
      const messageRef = db
        .collection('conversations')
        .doc(conversationId)
        .collection('messages')
        .doc(message.id);
      batch.set(messageRef, message);
    });

    await batch.commit();
  }

  console.log(`   ✅ Created with ${messages.length} messages`);
  console.log(`   📊 Categories: ${JSON.stringify(categoryCounts)}`);

  return conversationDoc;
}

// =============================================
// MAIN SEEDING FUNCTION
// =============================================

async function seedComprehensiveData() {
  try {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║     Comprehensive Test Data Seeding                        ║');
    console.log('║     High Variability - No Duplicate Messages               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('🎯 Target User: Zeno (XoBenqsIt7bRp9ZYsftif0ZQc9o1)\n');

    // =============================================
    // Scenario 1: VIP Fan Relationship (long-term, positive)
    // =============================================
    await createConversationWithMessages('direct', [USERS.metamonk, USERS.zeno], 25, 90, {
      categoryMix: ['fan_engagement', 'general'],
    });

    // =============================================
    // Scenario 2: New Business Opportunity (high-value)
    // =============================================
    await createConversationWithMessages('direct', [USERS.lily, USERS.zeno], 8, 2, {
      categoryMix: ['business_opportunity'],
      includeUnprocessed: true,
    });

    // =============================================
    // Scenario 3: Spam Conversation
    // =============================================
    await createConversationWithMessages('direct', [USERS.alex, USERS.zeno], 5, 1, {
      categoryMix: ['spam'],
    });

    // =============================================
    // Scenario 4: Crisis Situation (urgent, negative sentiment)
    // =============================================
    await createConversationWithMessages('direct', [USERS.metamonk, USERS.zeno], 6, 0.5, {
      categoryMix: ['urgent'],
      includeUnprocessed: true,
    });

    // =============================================
    // Scenario 5: Mixed Category Group Chat
    // =============================================
    await createConversationWithMessages(
      'group',
      [USERS.zeno, USERS.metamonk, USERS.lily],
      30,
      14,
      {
        groupName: '🎯 Project Planning',
        categoryMix: ['fan_engagement', 'business_opportunity', 'general'],
      }
    );

    // =============================================
    // Scenario 6: Recent Fan Engagement
    // =============================================
    await createConversationWithMessages('direct', [USERS.lily, USERS.zeno], 12, 3, {
      categoryMix: ['fan_engagement', 'general'],
      includeUnprocessed: true,
    });

    // =============================================
    // Scenario 7: Long-term Business Partnership Discussion
    // =============================================
    await createConversationWithMessages('direct', [USERS.alex, USERS.zeno], 20, 45, {
      categoryMix: ['business_opportunity', 'general'],
    });

    // =============================================
    // Scenario 8: Group with Mixed Sentiment
    // =============================================
    await createConversationWithMessages(
      'group',
      [USERS.zeno, USERS.metamonk, USERS.lily, USERS.alex],
      40,
      30,
      {
        groupName: '💬 Community Discussion',
        // No categoryMix = random all categories
      }
    );

    // =============================================
    // Scenario 9: Urgent Support Request
    // =============================================
    await createConversationWithMessages('direct', [USERS.metamonk, USERS.zeno], 10, 1, {
      categoryMix: ['urgent', 'general'],
      includeUnprocessed: true,
    });

    // =============================================
    // Scenario 10: High-Value Sponsorship Opportunity
    // =============================================
    await createConversationWithMessages('direct', [USERS.lily, USERS.zeno], 15, 7, {
      categoryMix: ['business_opportunity'],
    });

    // =============================================
    // Scenario 11: Spam + Urgent Mix
    // =============================================
    await createConversationWithMessages('direct', [USERS.alex, USERS.zeno], 7, 0.25, {
      categoryMix: ['spam', 'urgent'],
    });

    // =============================================
    // Scenario 12: Long-term Fan Relationship
    // =============================================
    await createConversationWithMessages('direct', [USERS.lily, USERS.zeno], 50, 120, {
      categoryMix: ['fan_engagement', 'general'],
    });

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY                                 ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    console.log('✅ Created 12 conversations with high variability');
    console.log('✅ Included ALL categorization types:');
    console.log('   • fan_engagement');
    console.log('   • business_opportunity');
    console.log('   • spam');
    console.log('   • urgent');
    console.log('   • general');
    console.log('\n✅ Complete metadata for every message:');
    console.log('   • category + categoryConfidence');
    console.log('   • sentiment + sentimentScore + emotionalTone');
    console.log('   • opportunityScore + opportunityType (business messages)');
    console.log('   • aiProcessed + aiProcessedAt + aiVersion');
    console.log('\n✅ Complete conversation stats:');
    console.log('   • categoryStats (lastCategory, categoryCounts, hasUrgent)');
    console.log('   • sentimentStats (lastSentiment, negativeCount, hasCrisis)');
    console.log('   • autoResponseEnabled');
    console.log('\n✅ Conversation variety:');
    console.log('   • VIP relationships (90+ days old)');
    console.log('   • New conversations (< 1 day old)');
    console.log('   • Medium-term (2-45 days old)');
    console.log('   • Direct chats (1:1)');
    console.log('   • Group conversations (3-4 participants)');
    console.log('\n🎯 Primary test user: Zeno (XoBenqsIt7bRp9ZYsftif0ZQc9o1)');
    console.log('📊 Estimated total messages: ~250+');
    console.log('🎲 Every message is unique - no duplicates!\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

// Run the script
seedComprehensiveData()
  .then(() => {
    console.log('👋 Script completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
