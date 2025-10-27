/**
 * Verify Auto-Archive Results (Story 6.4)
 *
 * Checks Firestore to verify:
 * - Correct messages were archived
 * - Undo records created
 * - Rate limits set
 * - Safety checks respected
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json npx ts-node functions/scripts/verifyAutoArchive.ts
 */

import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.cert(require('../../serviceAccountKey.json'))
});

const db = admin.firestore();

async function verifyResults() {
  const userId = 'test-creator-123';

  console.log('🔍 Auto-Archive Verification Report');
  console.log('═══════════════════════════════════════\n');

  // Count archived conversations
  const archivedSnapshot = await db.collection('conversations')
    .where('participantIds', 'array-contains', userId)
    .where('isArchived', '==', true)
    .get();

  console.log(`📦 Archived Conversations: ${archivedSnapshot.size}`);
  for (const doc of archivedSnapshot.docs) {
    const data = doc.data();
    console.log(`   - ${doc.id}: "${data.lastMessage}"`);
  }

  // Count non-archived (kept) conversations
  const keptSnapshot = await db.collection('conversations')
    .where('participantIds', 'array-contains', userId)
    .where('isArchived', '==', false)
    .get();

  console.log(`\n✅ Kept Conversations (High Priority): ${keptSnapshot.size}`);
  for (const doc of keptSnapshot.docs) {
    const data = doc.data();
    const msgs = await doc.ref.collection('messages').get();
    const firstMsg = msgs.docs[0]?.data();
    const category = firstMsg?.metadata?.category || 'unknown';
    console.log(`   - ${doc.id}: "${data.lastMessage}" (${category})`);
  }

  // Count undo records
  const undoSnapshot = await db.collection('undo_archive')
    .where('userId', '==', userId)
    .where('canUndo', '==', true)
    .get();

  console.log(`\n🔄 Active Undo Records: ${undoSnapshot.size}`);
  for (const doc of undoSnapshot.docs) {
    const data = doc.data();
    const expiresAt = data.expiresAt.toDate();
    const timeLeftMs = expiresAt.getTime() - Date.now();
    const hoursLeft = Math.floor(timeLeftMs / (1000 * 60 * 60));
    const minutesLeft = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    console.log(`   - ${data.conversationId}: ${hoursLeft}h ${minutesLeft}m remaining`);
  }

  // Count rate limits
  const rateLimitsSnapshot = await db.collection('rate_limits')
    .doc('boundary_messages')
    .collection('limits')
    .get();

  console.log(`\n⏱️  Boundary Rate Limits: ${rateLimitsSnapshot.size}`);
  for (const doc of rateLimitsSnapshot.docs) {
    const data = doc.data();
    const sentDate = data.lastBoundarySent.toDate();
    console.log(`   - ${data.fanId}: Last sent ${sentDate.toLocaleString()}`);
  }

  // Safety check - verify no business/urgent/VIP/crisis archived
  console.log(`\n🛡️  Safety Check:`);
  let safetyViolations = 0;
  const violationDetails: string[] = [];

  for (const conv of archivedSnapshot.docs) {
    const msgs = await conv.ref.collection('messages').get();
    for (const msg of msgs.docs) {
      const metadata = msg.data().metadata || {};

      if (metadata.category === 'business_opportunity') {
        safetyViolations++;
        violationDetails.push(`   ❌ VIOLATION: ${conv.id} is BUSINESS but was archived!`);
      }
      if (metadata.category === 'urgent') {
        safetyViolations++;
        violationDetails.push(`   ❌ VIOLATION: ${conv.id} is URGENT but was archived!`);
      }
      if (metadata.relationshipContext?.isVIP) {
        safetyViolations++;
        violationDetails.push(`   ❌ VIOLATION: ${conv.id} is VIP but was archived!`);
      }
      if (metadata.sentimentScore !== undefined && metadata.sentimentScore < -0.7) {
        safetyViolations++;
        violationDetails.push(`   ❌ VIOLATION: ${conv.id} has CRISIS sentiment (${metadata.sentimentScore}) but was archived!`);
      }
    }
  }

  if (safetyViolations === 0) {
    console.log(`   ✅ All safety checks PASSED! No business/urgent/VIP/crisis messages archived.`);
  } else {
    console.log(`   ❌ ${safetyViolations} safety violations found:`);
    violationDetails.forEach(detail => console.log(detail));
  }

  // Summary
  console.log(`\n═══════════════════════════════════════`);
  console.log(`📊 SUMMARY:`);
  console.log(`   - Archived: ${archivedSnapshot.size} conversations`);
  console.log(`   - Kept: ${keptSnapshot.size} conversations (high priority)`);
  console.log(`   - Undo records: ${undoSnapshot.size} active`);
  console.log(`   - Rate limits: ${rateLimitsSnapshot.size} fans`);
  console.log(`   - Safety: ${safetyViolations === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`═══════════════════════════════════════\n`);

  if (archivedSnapshot.size === 0) {
    console.log('⚠️  WARNING: No messages archived. Did workflow run? Is autoArchiveEnabled: true?');
  }

  if (safetyViolations > 0) {
    console.error('🚨 CRITICAL: Safety violations detected! Review shouldNotArchive() logic.');
    process.exit(1);
  }
}

verifyResults()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
