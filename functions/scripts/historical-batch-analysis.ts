/**
 * Historical Batch Analysis - Week 0 Accelerated Validation
 *
 * Analyzes last 30 days of messages using the same relationship scoring
 * algorithm as shadow mode. Generates sample "Meaningful 10" digests for
 * immediate manual validation.
 *
 * Usage:
 *   npm run batch-analysis
 *
 * Output:
 *   - results/batch-analysis-{timestamp}.json (raw data)
 *   - results/batch-analysis-{timestamp}.md (human-readable)
 *   - results/sample-digests-{timestamp}.md (for manual review)
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Check if running locally with service account key
  // When compiled, __dirname is lib/scripts, so go up 3 levels: lib/scripts -> lib -> functions -> project root
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    path.resolve(__dirname, '../../../serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    console.log(`✅ Using service account: ${serviceAccountPath}`);
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    console.log(`❌ Service account not found at: ${serviceAccountPath}`);
    console.log('Using default credentials (Cloud Function environment)');
    admin.initializeApp();
  }
}

const db = admin.firestore();

/**
 * Scoring weights (same as shadow mode)
 */
const SCORING_WEIGHTS = {
  business_opportunity: 50,
  urgent: 40,
  crisis_sentiment: 100,
  vip_relationship: 30,
  message_count_bonus: 30,
  recent_interaction: 15,
};

/**
 * Batch analysis configuration
 */
interface BatchConfig {
  daysBack: number;
  maxCreators: number;
  minMessagesPerCreator: number;
  outputDir: string;
}

const DEFAULT_CONFIG: BatchConfig = {
  daysBack: 30,
  maxCreators: 50,
  minMessagesPerCreator: 5,
  outputDir: './results',
};

/**
 * Message data structure
 */
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  timestamp: admin.firestore.Timestamp;
  metadata?: {
    category?: string;
    sentiment?: number;
    opportunityScore?: number;
  };
}

/**
 * Conversation data structure
 */
interface Conversation {
  id: string;
  createdAt: admin.firestore.Timestamp;
  lastMessageTimestamp: admin.firestore.Timestamp;
  messageCount: number;
}

/**
 * Relationship score result
 */
interface ScoreResult {
  messageId: string;
  conversationId: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  breakdown: {
    category: number;
    sentiment: number;
    opportunity: number;
    relationship: number;
  };
  messagePreview: string;
  category?: string;
}

/**
 * Meaningful 10 digest
 */
interface Meaningful10Digest {
  creatorId: string;
  analysisDate: Date;
  totalMessages: number;
  highPriority: ScoreResult[];
  mediumPriority: ScoreResult[];
  lowPriority: ScoreResult[];
}

/**
 * Calculate relationship score (same logic as shadow mode)
 */
function calculateScore(
  message: Message,
  conversation: Conversation
): ScoreResult {
  const breakdown = {
    category: 0,
    sentiment: 0,
    opportunity: 0,
    relationship: 0,
  };

  // 1. Category score
  if (message.metadata?.category === 'Business') {
    breakdown.category += SCORING_WEIGHTS.business_opportunity;
  }
  if (message.metadata?.category === 'Urgent') {
    breakdown.category += SCORING_WEIGHTS.urgent;
  }

  // 2. Sentiment score
  if (message.metadata?.sentiment !== undefined && message.metadata.sentiment < -0.7) {
    breakdown.sentiment += SCORING_WEIGHTS.crisis_sentiment;
  }

  // 3. Opportunity score
  if (message.metadata?.opportunityScore !== undefined && message.metadata.opportunityScore > 80) {
    breakdown.opportunity += SCORING_WEIGHTS.business_opportunity;
  }

  // 4. Relationship context
  const now = admin.firestore.Timestamp.now();
  const conversationAge =
    (now.toMillis() - conversation.createdAt.toMillis()) / (1000 * 60 * 60 * 24);
  const isVIP = conversation.messageCount > 10 && conversationAge > 30;

  if (isVIP) {
    breakdown.relationship += SCORING_WEIGHTS.vip_relationship;
  }
  if (conversation.messageCount > 10) {
    breakdown.relationship += SCORING_WEIGHTS.message_count_bonus;
  }

  const daysSinceInteraction =
    (now.toMillis() - conversation.lastMessageTimestamp.toMillis()) / (1000 * 60 * 60 * 24);
  if (daysSinceInteraction < 7) {
    breakdown.relationship += SCORING_WEIGHTS.recent_interaction;
  }

  // Calculate total
  const score = Math.min(
    100,
    breakdown.category + breakdown.sentiment + breakdown.opportunity + breakdown.relationship
  );

  // Assign priority
  let priority: 'high' | 'medium' | 'low' = 'low';
  if (score >= 70) priority = 'high';
  else if (score >= 40) priority = 'medium';

  return {
    messageId: message.id,
    conversationId: message.conversationId,
    score,
    priority,
    breakdown,
    messagePreview: message.text.substring(0, 100),
    category: message.metadata?.category,
  };
}

/**
 * Fetch active creators (creators with messages in last N days)
 * Note: Messages don't have recipientId - must find via conversations
 */
async function fetchActiveCreators(
  daysBack: number,
  maxCreators: number
): Promise<string[]> {
  console.log(`\n[1/6] Fetching active creators from last ${daysBack} days...`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  // Query users collection for creators
  const usersSnapshot = await db.collection('users').limit(maxCreators * 2).get();

  const creators: string[] = [];
  for (const userDoc of usersSnapshot.docs) {
    // Find conversations where this user is a participant
    const conversationsSnapshot = await db
      .collection('conversations')
      .where('participantIds', 'array-contains', userDoc.id)
      .where('lastMessageTimestamp', '>=', cutoffTimestamp)
      .limit(1)
      .get();

    if (!conversationsSnapshot.empty) {
      creators.push(userDoc.id);
    }

    if (creators.length >= maxCreators) break;
  }

  console.log(`✅ Found ${creators.length} active creators`);
  return creators;
}

/**
 * Fetch messages for a creator (messages received, not sent)
 * Note: Must find via conversations since messages don't have recipientId
 */
async function fetchCreatorMessages(
  creatorId: string,
  daysBack: number
): Promise<Message[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

  // 1. Find all conversations where this creator is a participant
  const conversationsSnapshot = await db
    .collection('conversations')
    .where('participantIds', 'array-contains', creatorId)
    .where('lastMessageTimestamp', '>=', cutoffTimestamp)
    .get();

  const messages: Message[] = [];

  // 2. For each conversation, get messages sent TO the creator (sender != creator)
  for (const convDoc of conversationsSnapshot.docs) {
    const conversationId = convDoc.id;

    const messagesSnapshot = await db
      .collection('conversations')
      .doc(conversationId)
      .collection('messages')
      .where('timestamp', '>=', cutoffTimestamp)
      .get();

    messagesSnapshot.forEach(msgDoc => {
      const data = msgDoc.data();
      // Only include messages NOT sent by the creator (i.e., received by creator)
      if (data.senderId !== creatorId) {
        messages.push({
          id: msgDoc.id,
          conversationId: conversationId,
          senderId: data.senderId,
          text: data.text || '',
          timestamp: data.timestamp,
          metadata: data.metadata,
        });
      }
    });
  }

  return messages;
}

/**
 * Fetch conversation data
 */
async function fetchConversation(conversationId: string): Promise<Conversation | null> {
  const convDoc = await db.collection('conversations').doc(conversationId).get();

  if (!convDoc.exists) return null;

  const data = convDoc.data()!;
  return {
    id: convDoc.id,
    createdAt: data.createdAt || admin.firestore.Timestamp.now(),
    lastMessageTimestamp: data.lastMessageTimestamp || admin.firestore.Timestamp.now(),
    messageCount: data.messageCount || 0,
  };
}

/**
 * Generate Meaningful 10 digest for a creator
 */
async function generateDigest(creatorId: string, daysBack: number): Promise<Meaningful10Digest> {
  // Fetch messages
  const messages = await fetchCreatorMessages(creatorId, daysBack);

  if (messages.length === 0) {
    return {
      creatorId,
      analysisDate: new Date(),
      totalMessages: 0,
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
    };
  }

  // Fetch conversation contexts
  const conversationIds = [...new Set(messages.map(m => m.conversationId))];
  const conversations = new Map<string, Conversation>();

  for (const convId of conversationIds) {
    const conv = await fetchConversation(convId);
    if (conv) conversations.set(convId, conv);
  }

  // Score each message
  const scores: ScoreResult[] = [];
  for (const message of messages) {
    const conversation = conversations.get(message.conversationId);
    if (!conversation) continue;

    const score = calculateScore(message, conversation);
    scores.push(score);
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  // Build digest
  return {
    creatorId,
    analysisDate: new Date(),
    totalMessages: messages.length,
    highPriority: scores.filter(s => s.priority === 'high').slice(0, 3),
    mediumPriority: scores.filter(s => s.priority === 'medium').slice(0, 7),
    lowPriority: scores.filter(s => s.priority === 'low'),
  };
}

/**
 * Run batch analysis
 */
async function runBatchAnalysis(config: BatchConfig = DEFAULT_CONFIG) {
  console.log('🚀 Starting Historical Batch Analysis');
  console.log('=====================================');
  console.log(`Date range: Last ${config.daysBack} days`);
  console.log(`Max creators: ${config.maxCreators}`);
  console.log(`Min messages: ${config.minMessagesPerCreator}`);
  console.log('');

  const startTime = Date.now();

  // 1. Fetch active creators
  const creators = await fetchActiveCreators(config.daysBack, config.maxCreators);

  // 2. Generate digests
  console.log(`\n[2/6] Generating digests for ${creators.length} creators...`);
  const digests: Meaningful10Digest[] = [];
  let processedCount = 0;

  for (const creatorId of creators) {
    try {
      const digest = await generateDigest(creatorId, config.daysBack);

      // Only include if meets minimum message threshold
      if (digest.totalMessages >= config.minMessagesPerCreator) {
        digests.push(digest);
      }

      processedCount++;
      if (processedCount % 10 === 0) {
        console.log(`  Processed ${processedCount}/${creators.length} creators...`);
      }
    } catch (error) {
      console.error(`  Error processing creator ${creatorId}:`, error);
    }
  }

  console.log(`✅ Generated ${digests.length} valid digests`);

  // 3. Calculate statistics
  console.log('\n[3/6] Calculating statistics...');
  const stats = {
    totalCreators: digests.length,
    totalMessages: digests.reduce((sum, d) => sum + d.totalMessages, 0),
    avgMessagesPerCreator: 0,
    highPriorityDistribution: {
      total: 0,
      withBusiness: 0,
      withUrgent: 0,
      withCrisis: 0,
    },
    scoreDistribution: {
      high: 0,
      medium: 0,
      low: 0,
    },
  };

  stats.avgMessagesPerCreator = stats.totalMessages / stats.totalCreators;

  digests.forEach(digest => {
    stats.scoreDistribution.high += digest.highPriority.length;
    stats.scoreDistribution.medium += digest.mediumPriority.length;
    stats.scoreDistribution.low += digest.lowPriority.length;

    digest.highPriority.forEach(msg => {
      stats.highPriorityDistribution.total++;
      if (msg.category === 'Business') stats.highPriorityDistribution.withBusiness++;
      if (msg.category === 'Urgent') stats.highPriorityDistribution.withUrgent++;
      if (msg.breakdown.sentiment > 0) stats.highPriorityDistribution.withCrisis++;
    });
  });

  console.log(`✅ Statistics calculated`);

  // 4. Sort by interesting samples (most high priority messages)
  console.log('\n[4/6] Selecting sample digests for manual review...');
  const sampleDigests = digests
    .filter(d => d.highPriority.length > 0)
    .sort((a, b) => b.highPriority.length - a.highPriority.length)
    .slice(0, 50);

  console.log(`✅ Selected ${sampleDigests.length} sample digests`);

  // 5. Save results
  console.log('\n[5/6] Saving results...');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Create output directory
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  // Save JSON
  const jsonPath = path.join(config.outputDir, `batch-analysis-${timestamp}.json`);
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ stats, digests, sampleDigests }, null, 2),
    'utf-8'
  );
  console.log(`  ✅ JSON: ${jsonPath}`);

  // Save markdown summary
  const mdPath = path.join(config.outputDir, `batch-analysis-${timestamp}.md`);
  const markdown = generateMarkdownSummary(stats, sampleDigests);
  fs.writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`  ✅ Markdown: ${mdPath}`);

  // Save sample digests for manual review
  const samplesPath = path.join(config.outputDir, `sample-digests-${timestamp}.md`);
  const samplesMarkdown = generateSampleDigestsMarkdown(sampleDigests);
  fs.writeFileSync(samplesPath, samplesMarkdown, 'utf-8');
  console.log(`  ✅ Samples: ${samplesPath}`);

  // 6. Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n[6/6] ✅ COMPLETE');
  console.log('=====================================');
  console.log(`Duration: ${duration}s`);
  console.log(`Total creators analyzed: ${stats.totalCreators}`);
  console.log(`Total messages scored: ${stats.totalMessages}`);
  console.log(`Sample digests for review: ${sampleDigests.length}`);
  console.log('');
  console.log('📊 Next steps:');
  console.log(`1. Review samples: ${samplesPath}`);
  console.log(`2. Spot-check 50+ digests`);
  console.log(`3. Validate 80%+ accuracy`);
  console.log('');

  return { stats, digests, sampleDigests };
}

/**
 * Generate markdown summary
 */
function generateMarkdownSummary(stats: any, samples: Meaningful10Digest[]): string {
  return `# Historical Batch Analysis Results
**Generated**: ${new Date().toISOString()}

## Overview

- **Total Creators**: ${stats.totalCreators}
- **Total Messages**: ${stats.totalMessages}
- **Avg Messages/Creator**: ${stats.avgMessagesPerCreator.toFixed(1)}
- **Sample Digests**: ${samples.length}

## Score Distribution

| Priority | Count | Percentage |
|----------|-------|------------|
| High (≥70) | ${stats.scoreDistribution.high} | ${((stats.scoreDistribution.high / stats.totalMessages) * 100).toFixed(1)}% |
| Medium (40-69) | ${stats.scoreDistribution.medium} | ${((stats.scoreDistribution.medium / stats.totalMessages) * 100).toFixed(1)}% |
| Low (<40) | ${stats.scoreDistribution.low} | ${((stats.scoreDistribution.low / stats.totalMessages) * 100).toFixed(1)}% |

## High Priority Analysis

- **Total High Priority**: ${stats.highPriorityDistribution.total}
- **Business Opportunities**: ${stats.highPriorityDistribution.withBusiness} (${((stats.highPriorityDistribution.withBusiness / stats.highPriorityDistribution.total) * 100).toFixed(1)}%)
- **Urgent Messages**: ${stats.highPriorityDistribution.withUrgent} (${((stats.highPriorityDistribution.withUrgent / stats.highPriorityDistribution.total) * 100).toFixed(1)}%)
- **Crisis Sentiment**: ${stats.highPriorityDistribution.withCrisis} (${((stats.highPriorityDistribution.withCrisis / stats.highPriorityDistribution.total) * 100).toFixed(1)}%)

## Manual Review

Sample digests have been generated in \`sample-digests-*.md\`.

**Instructions:**
1. Review each sample digest
2. For top 3 high priority messages, ask: "Is this important?"
3. Record match/mismatch
4. Calculate accuracy: Matches / Total

**Target**: 80%+ accuracy (≥40 matches out of 50 samples)
`;
}

/**
 * Generate sample digests markdown for manual review
 */
function generateSampleDigestsMarkdown(samples: Meaningful10Digest[]): string {
  let md = `# Sample Digests for Manual Review
**Generated**: ${new Date().toISOString()}
**Total Samples**: ${samples.length}

## Instructions

For each digest below:
1. Review the **Top 3 High Priority** messages
2. Ask: "Would I prioritize this message in my top 3?"
3. Record your judgment: ✅ Match or ❌ Mismatch
4. Calculate accuracy at the end

---

`;

  samples.forEach((digest, index) => {
    md += `## Sample ${index + 1}: Creator ${digest.creatorId.substring(0, 8)}...\n\n`;
    md += `**Total Messages**: ${digest.totalMessages}\n`;
    md += `**High Priority**: ${digest.highPriority.length}\n`;
    md += `**Medium Priority**: ${digest.mediumPriority.length}\n\n`;

    if (digest.highPriority.length > 0) {
      md += `### 🎯 Top 3 High Priority (Respond Today)\n\n`;
      digest.highPriority.forEach((msg, i) => {
        md += `**${i + 1}. Score: ${msg.score}** | Category: ${msg.category || 'Unknown'}\n`;
        md += `- **Preview**: "${msg.messagePreview}..."\n`;
        md += `- **Breakdown**: Category=${msg.breakdown.category}, Sentiment=${msg.breakdown.sentiment}, Opportunity=${msg.breakdown.opportunity}, Relationship=${msg.breakdown.relationship}\n`;
        md += `- **Manual Judgment**: [ ] ✅ Important | [ ] ❌ Not important\n\n`;
      });
    }

    md += `---\n\n`;
  });

  md += `## Accuracy Tracking\n\n`;
  md += `| Sample | High Priority 1 | High Priority 2 | High Priority 3 | Match Count |\n`;
  md += `|--------|-----------------|-----------------|-----------------|-------------|\n`;

  for (let i = 1; i <= samples.length; i++) {
    md += `| ${i} | | | | /3 |\n`;
  }

  md += `\n**Total Accuracy**: ___/150 = ___%\n`;
  md += `**Target**: ≥80% (≥120 matches)\n`;

  return md;
}

// Run if executed directly
if (require.main === module) {
  runBatchAnalysis()
    .then(() => {
      console.log('✅ Batch analysis complete');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Batch analysis failed:', error);
      process.exit(1);
    });
}

export { runBatchAnalysis, BatchConfig };
