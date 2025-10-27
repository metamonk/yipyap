/**
 * Debug script to check group conversation permissions
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

async function checkGroup() {
  const groupId = 'hisbGOcvuU4tFN84WzuS';
  const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1'; // Zeno

  console.log('🔍 Checking group permissions...\n');
  console.log('Group ID:', groupId);
  console.log('User ID:', userId);
  console.log();

  const doc = await db.collection('conversations').doc(groupId).get();

  if (!doc.exists) {
    console.log('❌ Conversation does not exist!');
    return;
  }

  const data = doc.data();
  console.log('📋 Conversation Data:');
  console.log('  Type:', data?.type);
  console.log('  Creator ID:', data?.creatorId);
  console.log('  Admin IDs:', data?.adminIds);
  console.log('  Participant IDs:', data?.participantIds);
  console.log('  Group Name:', data?.groupName);
  console.log();

  console.log('🔍 Permission Check:');
  console.log('  Current User:', userId);
  console.log('  Is Creator?', data?.creatorId === userId);
  console.log('  Is Admin?', data?.adminIds && data.adminIds.includes(userId));
  console.log('  Is Participant?', data?.participantIds && data.participantIds.includes(userId));
  console.log();

  // Determine what's wrong
  if (data?.type !== 'group') {
    console.log('⚠️  This is not a group conversation!');
  } else if (!data?.creatorId) {
    console.log('⚠️  Missing creatorId field!');
  } else if (!data?.adminIds || !Array.isArray(data.adminIds)) {
    console.log('⚠️  Missing or invalid adminIds field!');
  } else if (!data.adminIds.includes(userId) && data.creatorId !== userId) {
    console.log('⚠️  User is NOT an admin or creator!');
    console.log('     The storage rules will deny this upload.');
  } else {
    console.log('✅ User SHOULD have permission (creator or admin)');
    console.log('   If still failing, there may be a Firebase propagation delay.');
  }
}

checkGroup()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
