/**
 * Check the details of the latest meaningful10 digest
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';
const executionId = 'exec_1761503098600_XoBenqsIt7bRp9ZYsftif0ZQc9o1';

async function checkDigest() {
  console.log('🔍 Checking digest details...\n');
  console.log(`Execution ID: ${executionId}\n`);

  try {
    // Check for digest
    const digestsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('meaningful10_digests')
      .where('executionId', '==', executionId)
      .limit(1)
      .get();

    if (digestsSnapshot.empty) {
      console.log('❌ NO DIGEST FOUND for this execution!');

      // Check if any digests exist at all
      const allDigestsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('meaningful10_digests')
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      console.log(`\nFound ${allDigestsSnapshot.size} total digests (showing most recent):`);
      allDigestsSnapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`\n${i + 1}. Digest ID: ${doc.id}`);
        console.log(`   Execution ID: ${data.executionId}`);
        console.log(`   Created: ${data.createdAt?.toDate?.()}`);
        console.log(`   High Priority: ${data.highPriority?.length || 0}`);
        console.log(`   Medium Priority: ${data.mediumPriority?.length || 0}`);
        console.log(`   Auto Handled: ${JSON.stringify(data.autoHandled)}`);
      });

      return;
    }

    console.log('✅ DIGEST FOUND!\n');
    const digestDoc = digestsSnapshot.docs[0];
    const data = digestDoc.data();

    console.log('=== DIGEST OVERVIEW ===');
    console.log(`Document ID: ${digestDoc.id}`);
    console.log(`Execution ID: ${data.executionId}`);
    console.log(`Created At: ${data.createdAt?.toDate?.()}`);
    console.log(`Date: ${data.date}`);
    console.log(`Capacity Used: ${data.capacityUsed} / ${data.totalCapacity}`);
    console.log('');

    console.log('=== HIGH PRIORITY ===');
    console.log(`Count: ${data.highPriority?.length || 0}`);
    if (data.highPriority && data.highPriority.length > 0) {
      data.highPriority.forEach((msg, i) => {
        console.log(`\n${i + 1}. Message ID: ${msg.messageId}`);
        console.log(`   Conversation ID: ${msg.conversationId}`);
        console.log(`   From: ${msg.fanName || msg.senderName || 'Unknown'}`);
        console.log(`   Preview: ${msg.messagePreview?.substring(0, 80) || 'No preview'}`);
        console.log(`   Relationship Score: ${msg.relationshipScore}`);
        console.log(`   Draft Response: ${msg.draftResponse ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('(empty)');
    }

    console.log('\n=== MEDIUM PRIORITY ===');
    console.log(`Count: ${data.mediumPriority?.length || 0}`);
    if (data.mediumPriority && data.mediumPriority.length > 0) {
      data.mediumPriority.forEach((msg, i) => {
        console.log(`\n${i + 1}. Message ID: ${msg.messageId}`);
        console.log(`   Conversation ID: ${msg.conversationId}`);
        console.log(`   From: ${msg.fanName || msg.senderName || 'Unknown'}`);
        console.log(`   Preview: ${msg.messagePreview?.substring(0, 80) || 'No preview'}`);
        console.log(`   Relationship Score: ${msg.relationshipScore}`);
        console.log(`   Draft Response: ${msg.draftResponse ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('(empty)');
    }

    console.log('\n=== AUTO HANDLED ===');
    console.log(`Total: ${data.autoHandled?.total || 0}`);
    console.log(`FAQ Count: ${data.autoHandled?.faqCount || 0}`);
    console.log(`Archived Count: ${data.autoHandled?.archivedCount || 0}`);
    console.log(`Boundary Message Sent: ${data.autoHandled?.boundaryMessageSent || false}`);

    // Check agent logs for this execution
    console.log('\n\n=== AGENT LOGS (last 20) ===');
    const logsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('agent_logs')
      .where('executionId', '==', executionId)
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();

    if (logsSnapshot.empty) {
      console.log('No agent logs found');
    } else {
      logsSnapshot.docs.forEach((doc, i) => {
        const logData = doc.data();
        console.log(`\n${i + 1}. [${logData.level}] ${logData.step}: ${logData.message}`);
      });
    }

  } catch (error) {
    console.error('❌ Error checking digest:', error);
    throw error;
  }
}

checkDigest()
  .then(() => {
    console.log('\n\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
