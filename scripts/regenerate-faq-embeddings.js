/**
 * Script to regenerate embeddings for all FAQ templates
 *
 * This ensures all FAQs are properly embedded in Pinecone for semantic search.
 * Run with: GOOGLE_APPLICATION_CREDENTIALS=serviceAccountKey.json node scripts/regenerate-faq-embeddings.js
 */

const admin = require('firebase-admin');
const https = require('https');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'yipyap-444'
});

const db = admin.firestore();
const CLOUD_FUNCTION_URL = 'https://us-central1-yipyap-444.cloudfunctions.net/generateFAQEmbedding';

/**
 * Call Cloud Function via HTTP
 */
async function callCloudFunction(data) {
  // Get ID token for authentication
  const auth = admin.auth();
  const customToken = await auth.createCustomToken('script-admin');

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ data });
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(CLOUD_FUNCTION_URL, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function regenerateEmbeddings() {
  console.log('🔍 Fetching all FAQ templates...\n');

  const snapshot = await db.collection('faq_templates').get();

  console.log(`Found ${snapshot.size} FAQ templates\n`);

  let successCount = 0;
  let failCount = 0;

  for (const doc of snapshot.docs) {
    const faq = doc.data();
    const faqId = doc.id;

    console.log(`Processing: "${faq.question}"`);
    console.log(`  FAQ ID: ${faqId}`);
    console.log(`  Creator: ${faq.creatorId}`);
    console.log(`  Active: ${faq.isActive}`);

    try {
      // Call the Cloud Function to generate embedding
      const result = await callCloudFunction({
        faqId: faqId,
        question: faq.question
      });

      if (result.result && result.result.success) {
        console.log(`  ✅ SUCCESS - Embedding generated (${result.result.embeddingDimension} dimensions)\n`);
        successCount++;
      } else {
        console.log(`  ❌ FAILED - ${result.result?.error || result.error || 'Unknown error'}\n`);
        failCount++;
      }
    } catch (error) {
      console.log(`  ❌ ERROR - ${error.message}\n`);
      failCount++;
    }

    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('━'.repeat(50));
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📋 Total: ${snapshot.size}\n`);

  process.exit(failCount > 0 ? 1 : 0);
}

regenerateEmbeddings().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
