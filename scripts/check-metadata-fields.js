/**
 * Check exact metadata field names
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

async function checkMetadataFields() {
  console.log('🔍 Checking metadata field names...\n');

  try {
    // Check one test message
    const testMsg = await db
      .collection('conversations')
      .doc('conv_1761499215052_gl7jve1ut')
      .collection('messages')
      .doc('msg_1761499215511_4wuo1ovuf')
      .get();

    if (testMsg.exists) {
      const data = testMsg.data();
      console.log('TEST MESSAGE metadata:');
      console.log(JSON.stringify(data.metadata, null, 2));
      console.log('');
    }

    // Check one real message
    const realMsg = await db
      .collection('conversations')
      .doc('QKw7CZMc7aP8dLOM0jD0dUTQLQL2_XoBenqsIt7bRp9ZYsftif0ZQc9o1')
      .collection('messages')
      .doc('msg_QKw7CZMc7aP8dLOM0jD0dUTQLQL2_XoBenqsIt7bRp9ZYsftif0ZQc9o1_0_cx0pkk1pc')
      .get();

    if (realMsg.exists) {
      const data = realMsg.data();
      console.log('REAL MESSAGE metadata:');
      console.log(JSON.stringify(data.metadata, null, 2));
      console.log('');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkMetadataFields()
  .then(() => {
    console.log('✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
  });
