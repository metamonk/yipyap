#!/usr/bin/env tsx
/**
 * Manual Daily Agent Workflow Trigger Script
 *
 * Usage:
 *   npm run trigger-daily-agent -- <userId>
 *
 * Or directly:
 *   tsx scripts/triggerDailyAgent.ts <userId>
 *
 * Example:
 *   npm run trigger-daily-agent -- abc123
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
// Uses Application Default Credentials (ADC) or GOOGLE_APPLICATION_CREDENTIALS env var
// To set up, run: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'yipyap-444',
  });
}

const db = admin.firestore();

/**
 * Triggers the daily agent workflow for a specific user
 * @param userId - User ID to trigger workflow for
 */
async function triggerDailyAgentWorkflow(userId: string): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Daily Agent Workflow Manual Trigger                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`🎯 Target User: ${userId}\n`);

  try {
    // Step 1: Verify user exists
    console.log('📋 Step 1: Verifying user exists...');
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      console.error(`❌ Error: User ${userId} does not exist in Firestore`);
      process.exit(1);
    }

    const userData = userDoc.data();
    console.log(`✅ User found: ${userData?.displayName || userId}\n`);

    // Step 2: Check daily agent config
    console.log('📋 Step 2: Checking daily agent configuration...');
    const configDoc = await db
      .collection('users')
      .doc(userId)
      .collection('ai_workflow_config')
      .doc(userId)
      .get();

    if (!configDoc.exists) {
      console.log('⚠️  Warning: No daily agent config found. Using defaults.');
      console.log('   Creating default config...\n');

      // Create default config
      await db
        .collection('users')
        .doc(userId)
        .collection('ai_workflow_config')
        .doc(userId)
        .set({
          features: {
            dailyWorkflowEnabled: true,
            categorizationEnabled: true,
            faqDetectionEnabled: true,
            voiceMatchingEnabled: true,
            sentimentAnalysisEnabled: true,
          },
          workflowSettings: {
            dailyWorkflowTime: '09:00',
            timezone: 'America/Chicago',
            maxAutoResponses: 20,
            requireApproval: false,
            escalationThreshold: 0.3,
            activeThresholdMinutes: 30,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      console.log('✅ Default config created\n');
    } else {
      const config = configDoc.data();
      console.log('✅ Config found:');
      console.log(`   Daily Workflow: ${config?.features?.dailyWorkflowEnabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   Require Approval: ${config?.workflowSettings?.requireApproval ? '✅ Yes' : '❌ No'}`);
      console.log(`   Max Auto-Responses: ${config?.workflowSettings?.maxAutoResponses || 20}`);
      console.log(`   Scheduled Time: ${config?.workflowSettings?.dailyWorkflowTime || '09:00'}`);
      console.log(`   Timezone: ${config?.workflowSettings?.timezone || 'America/Chicago'}\n`);
    }

    // Step 3: Trigger the workflow via Cloud Function
    console.log('📋 Step 3: Triggering daily agent workflow...');
    console.log('⏳ This may take 1-2 minutes...\n');

    // Import the orchestrateWorkflow function directly
    const { orchestrateWorkflow } = require('../functions/src/ai/daily-agent-workflow');

    const startTime = Date.now();
    const result = await orchestrateWorkflow(userId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Step 4: Display results
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    Workflow Results                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log(`✅ Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`🆔 Execution ID: ${result.executionId}\n`);

    console.log('📊 Results:');
    console.log(`   Messages Fetched:         ${result.results.messagesFetched}`);
    console.log(`   Messages Categorized:     ${result.results.messagesCategorized}`);
    console.log(`   FAQs Detected:            ${result.results.faqsDetected}`);
    console.log(`   Auto-Responses Sent:      ${result.results.autoResponsesSent}`);
    console.log(`   Responses Drafted:        ${result.results.responsesDrafted}`);
    console.log(`   Messages Needing Review:  ${result.results.messagesNeedingReview}\n`);

    console.log('💰 Cost Metrics:');
    console.log(`   Total Duration: ${result.metrics.duration}ms`);
    console.log(`   Estimated Cost: $${result.metrics.costIncurred?.toFixed(4) || '0.0000'}\n`);

    // Step 5: Show where to view more details
    console.log('📍 View Details in Firestore:');
    console.log(`   /users/${userId}/daily_executions/${result.executionId}`);
    console.log(`   /users/${userId}/daily_digests (check latest)\n`);

    // Step 6: Check for digest
    console.log('📋 Step 4: Checking for daily digest...');
    const digestsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('daily_digests')
      .where('executionId', '==', result.executionId)
      .limit(1)
      .get();

    if (!digestsSnap.empty) {
      const digest = digestsSnap.docs[0].data();
      console.log(`✅ Digest created: "${digest.summary?.summaryText}"\n`);
    } else {
      console.log('⚠️  No digest found (may still be generating)\n');
    }

    console.log('✅ Workflow completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Workflow Error:\n');
    console.error(error);
    process.exit(1);
  }
}

// Main execution
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: User ID is required\n');
  console.log('Usage:');
  console.log('  npm run trigger-daily-agent -- <userId>');
  console.log('\nExample:');
  console.log('  npm run trigger-daily-agent -- abc123\n');
  process.exit(1);
}

// Run the workflow
triggerDailyAgentWorkflow(userId)
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
