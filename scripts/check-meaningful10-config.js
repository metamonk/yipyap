/**
 * Check if Meaningful 10 is enabled in user config
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

async function checkConfig() {
  const userId = 'XoBenqsIt7bRp9ZYsftif0ZQc9o1';

  console.log('Checking Meaningful 10 configuration...\n');

  // Check ai_workflow_config
  const configDoc = await db
    .collection('users')
    .doc(userId)
    .collection('ai_workflow_config')
    .doc(userId)
    .get();

  if (!configDoc.exists) {
    console.log('❌ NO CONFIG FOUND');
    console.log('Expected location: /users/' + userId + '/ai_workflow_config/' + userId);
    console.log('\nThis means meaningful10.enabled defaults to TRUE');
    return;
  }

  const configData = configDoc.data();
  console.log('✅ Config found:\n');
  console.log(JSON.stringify(configData, null, 2));

  console.log('\n---\n');
  console.log('Meaningful 10 Status:');
  if (configData?.meaningful10?.enabled === false) {
    console.log('❌ DISABLED - meaningful10.enabled is explicitly set to false');
  } else if (configData?.meaningful10?.enabled === true) {
    console.log('✅ ENABLED - meaningful10.enabled is explicitly set to true');
  } else {
    console.log('✅ ENABLED (default) - meaningful10.enabled is not set, defaults to true');
  }
}

checkConfig()
  .then(() => {
    console.log('\n✅ Check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
