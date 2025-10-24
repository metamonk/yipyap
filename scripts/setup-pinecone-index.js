/**
 * Pinecone Index Setup Script
 *
 * Creates the yipyap-faq-embeddings index in Pinecone with proper configuration.
 * Run this script once during initial setup of Story 5.4.
 *
 * Prerequisites:
 * - Pinecone account created at https://www.pinecone.io
 * - PINECONE_API_KEY environment variable set in .env.local
 *
 * Usage:
 *   node scripts/setup-pinecone-index.js
 */

const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

const INDEX_CONFIG = {
  name: 'yipyap-faq-embeddings',
  dimension: 1536, // OpenAI text-embedding-3-small
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
};

async function setupPineconeIndex() {
  console.log('🚀 Pinecone Index Setup Script\n');

  // Check for API key
  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: PINECONE_API_KEY not found in environment variables');
    console.error('   Please set it in .env.local file\n');
    process.exit(1);
  }

  console.log('✅ Pinecone API key found');
  console.log('📋 Index Configuration:');
  console.log(`   Name: ${INDEX_CONFIG.name}`);
  console.log(`   Dimension: ${INDEX_CONFIG.dimension}`);
  console.log(`   Metric: ${INDEX_CONFIG.metric}`);
  console.log(`   Cloud: ${INDEX_CONFIG.spec.serverless.cloud}`);
  console.log(`   Region: ${INDEX_CONFIG.spec.serverless.region}\n`);

  try {
    // Initialize Pinecone client
    const pinecone = new Pinecone({ apiKey });

    // Check if index already exists
    console.log('🔍 Checking for existing index...');
    const existingIndexes = await pinecone.listIndexes();
    const indexExists = existingIndexes.indexes?.some(
      (index) => index.name === INDEX_CONFIG.name
    );

    if (indexExists) {
      console.log('✅ Index already exists!');
      console.log('   No action needed - index is ready to use\n');

      // Verify index configuration
      const indexDescription = await pinecone.describeIndex(INDEX_CONFIG.name);
      console.log('📊 Current Index Details:');
      console.log(`   Dimension: ${indexDescription.dimension}`);
      console.log(`   Metric: ${indexDescription.metric}`);
      console.log(`   Status: ${indexDescription.status?.state || 'unknown'}\n`);

      if (indexDescription.dimension !== INDEX_CONFIG.dimension) {
        console.warn('⚠️  Warning: Index dimension mismatch!');
        console.warn(`   Expected: ${INDEX_CONFIG.dimension}`);
        console.warn(`   Actual: ${indexDescription.dimension}`);
        console.warn('   You may need to delete and recreate the index\n');
      }

      return;
    }

    // Create new index
    console.log('🔨 Creating new Pinecone index...');
    console.log('   This may take a few moments...\n');

    await pinecone.createIndex(INDEX_CONFIG);

    // Wait for index to be ready
    console.log('⏳ Waiting for index to be ready...');
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds timeout

    while (attempts < maxAttempts) {
      const description = await pinecone.describeIndex(INDEX_CONFIG.name);

      if (description.status?.ready) {
        console.log('✅ Index is ready!\n');
        console.log('📊 Index Details:');
        console.log(`   Name: ${description.name}`);
        console.log(`   Dimension: ${description.dimension}`);
        console.log(`   Metric: ${description.metric}`);
        console.log(`   Status: ${description.status.state}\n`);
        break;
      }

      process.stdout.write('.');
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxAttempts) {
      console.warn('\n⚠️  Index creation initiated but not confirmed ready');
      console.warn('   Please check Pinecone dashboard to verify index status\n');
    }

    console.log('✅ Pinecone setup complete!');
    console.log('\n📝 Next Steps:');
    console.log('   1. Verify index in Pinecone dashboard: https://app.pinecone.io');
    console.log('   2. Configure PINECONE_API_KEY in Vercel Dashboard');
    console.log('   3. Deploy Edge Functions to use FAQ detection\n');

  } catch (error) {
    console.error('\n❌ Error during setup:', error.message);

    if (error.message.includes('ALREADY_EXISTS')) {
      console.error('   Index already exists - no action needed');
    } else if (error.message.includes('INVALID_ARGUMENT')) {
      console.error('   Invalid configuration - check INDEX_CONFIG settings');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('   API key lacks permissions - verify API key in Pinecone dashboard');
    } else {
      console.error('   Unexpected error - check Pinecone dashboard and API key');
    }

    console.error('\n   For help: https://docs.pinecone.io/docs/troubleshooting\n');
    process.exit(1);
  }
}

// Run setup
setupPineconeIndex().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
