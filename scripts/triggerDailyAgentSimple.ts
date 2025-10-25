#!/usr/bin/env tsx
/**
 * Simple Daily Agent Workflow Trigger (uses deployed Cloud Function)
 *
 * Usage:
 *   npm run trigger-daily -- <userId>
 *
 * Example:
 *   npm run trigger-daily -- abc123xyz
 */

import { execSync } from 'child_process';

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

try {
  console.log('📋 Calling Cloud Function: triggerDailyAgentManual...');
  console.log('⏳ This may take 1-2 minutes...\n');

  // Call the deployed Cloud Function
  const result = execSync(
    `firebase functions:call triggerDailyAgentManual --data '{"userId":"${userId}"}'`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  console.log('✅ Response from Cloud Function:\n');
  console.log(result);

  console.log('\n📍 Check results in Firestore:');
  console.log(`   /users/${userId}/daily_executions (latest execution)`);
  console.log(`   /users/${userId}/daily_digests (latest digest)`);
  console.log(`   /users/${userId}/agent_logs (detailed logs)\n`);

  console.log('✅ Trigger successful!\n');
  console.log('💡 Tip: Check the Firebase Console to see execution details.');

} catch (error: any) {
  console.error('\n❌ Error calling Cloud Function:\n');
  console.error(error.message);

  if (error.message.includes('UNAUTHENTICATED')) {
    console.error('\n💡 Fix: Run "firebase login" to authenticate\n');
  } else if (error.message.includes('permission-denied')) {
    console.error('\n💡 Fix: Make sure you have permission to call this function\n');
  }

  process.exit(1);
}
