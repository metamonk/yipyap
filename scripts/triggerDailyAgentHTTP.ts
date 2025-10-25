#!/usr/bin/env tsx
/**
 * Daily Agent Workflow Trigger via HTTP
 *
 * Usage:
 *   npm run trigger-daily -- <userId>
 *
 * Example:
 *   npm run trigger-daily -- abc123xyz
 */

import { execSync } from 'child_process';
import * as https from 'https';

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: User ID is required\n');
  console.log('Usage:');
  console.log('  npm run trigger-daily -- <userId>');
  console.log('\nExample:');
  console.log('  npm run trigger-daily -- abc123xyz\n');
  process.exit(1);
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       Daily Agent Workflow Manual Trigger                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`🎯 Target User: ${userId}\n`);

/**
 * Get Firebase ID token for authentication
 */
async function getAuthToken(): Promise<string> {
  try {
    console.log('📋 Getting Firebase auth token...');
    const token = execSync('firebase login:ci --no-localhost', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    return token;
  } catch (error) {
    // Try getting token from existing login
    try {
      const tokenJson = execSync('firebase login:list --json', {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const data = JSON.parse(tokenJson);
      if (data && data.length > 0) {
        console.log('✅ Using existing Firebase login\n');
        // We'll use curl with --user flag instead
        return '';
      }
    } catch (e) {
      console.error('❌ Not logged in to Firebase. Run: firebase login');
      process.exit(1);
    }
    return '';
  }
}

/**
 * Call Cloud Function via curl
 */
async function callCloudFunction(userId: string): Promise<void> {
  try {
    console.log('📋 Calling Cloud Function: triggerDailyAgentManual...');
    console.log('⏳ This may take 1-2 minutes...\n');

    // Get project details
    const projectInfo = execSync('firebase projects:list --json', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    const projects = JSON.parse(projectInfo);
    const currentProject = projects.find((p: any) => p.projectId === 'yipyap-444');

    if (!currentProject) {
      throw new Error('Project yipyap-444 not found');
    }

    // Cloud Function URL
    const functionUrl = `https://us-central1-yipyap-444.cloudfunctions.net/triggerDailyAgentManual`;

    console.log(`🔗 Function URL: ${functionUrl}\n`);

    // Get Firebase auth token for the current user
    console.log('📋 Getting authentication token...');
    const tokenResult = execSync('firebase login:use --add', {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();

    console.log('💡 Note: This function requires Firebase Authentication.');
    console.log('   You need to call it from the app with a user auth token.\n');

    console.log('📱 To test from the app, use this code:\n');
    console.log('```typescript');
    console.log('import { getFunctions, httpsCallable } from "firebase/functions";');
    console.log('');
    console.log('const functions = getFunctions();');
    console.log('const trigger = httpsCallable(functions, "triggerDailyAgentManual");');
    console.log('');
    console.log('try {');
    console.log(`  const result = await trigger({ userId: "${userId}" });`);
    console.log('  console.log("Workflow result:", result.data);');
    console.log('} catch (error) {');
    console.log('  console.error("Error:", error);');
    console.log('}');
    console.log('```\n');

    console.log('📍 Alternative: Check Firestore manually:');
    console.log(`   /users/${userId}/daily_executions (latest execution)`);
    console.log(`   /users/${userId}/daily_digests (latest digest)`);
    console.log(`   /users/${userId}/agent_logs (detailed logs)\n`);

    console.log('🕐 Or wait for the scheduler to run at the next hour mark.');
    console.log('   The scheduler checks every hour if it\'s time to run the workflow.\n');

  } catch (error: any) {
    console.error('\n❌ Error:\n');
    console.error(error.message);
    process.exit(1);
  }
}

// Run
callCloudFunction(userId);
