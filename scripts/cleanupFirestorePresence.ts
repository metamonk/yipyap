/**
 * Cleanup Old Firestore Presence Data
 * @module scripts/cleanupFirestorePresence
 *
 * @remarks
 * Removes the old 'presence' field from user documents in Firestore
 * after successful migration to Firebase Realtime Database.
 *
 * Usage:
 * ```bash
 * npx ts-node scripts/cleanupFirestorePresence.ts [--dry-run]
 * ```
 */

 

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Cleanup configuration
 */
interface CleanupConfig {
  dryRun: boolean;
  batchSize: number;
}

/**
 * Cleanup statistics
 */
interface CleanupStats {
  totalUsers: number;
  cleanedUsers: number;
  skippedUsers: number;
  failedUsers: number;
  startTime: number;
  endTime?: number;
}

/**
 * Parses command line arguments
 */
function parseArgs(): Partial<CleanupConfig> {
  const args = process.argv.slice(2);
  const config: Partial<CleanupConfig> = {};

  args.forEach((arg) => {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    }
  });

  return config;
}

/**
 * Main cleanup function
 */
async function cleanupFirestorePresence(config: CleanupConfig): Promise<void> {
  console.log('🧹 Starting Firestore presence data cleanup');
  console.log('Configuration:', config);

  const stats: CleanupStats = {
    totalUsers: 0,
    cleanedUsers: 0,
    skippedUsers: 0,
    failedUsers: 0,
    startTime: Date.now(),
  };

  try {
    // Initialize Firebase Admin SDK
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    const firestore = admin.firestore();

    console.log('✅ Firebase Admin SDK initialized');

    // Get all users from Firestore
    console.log('📋 Fetching users from Firestore...');
    const usersSnapshot = await firestore.collection('users').get();

    stats.totalUsers = usersSnapshot.size;
    console.log(`📊 Found ${stats.totalUsers} users to process`);

    // Process users in batches
    const users = usersSnapshot.docs;
    for (let i = 0; i < users.length; i += config.batchSize) {
      const batch = users.slice(i, i + config.batchSize);
      const firestoreBatch = firestore.batch();

      console.log(
        `\n📦 Processing batch ${Math.floor(i / config.batchSize) + 1} (${batch.length} users)`
      );

      for (const userDoc of batch) {
        const userData = userDoc.data();

        if (userData.presence) {
          if (config.dryRun) {
            console.log(`  🔍 [DRY RUN] Would remove presence field from user ${userDoc.id}`);
            stats.cleanedUsers++;
          } else {
            // Remove the presence field using FieldValue.delete()
            firestoreBatch.update(userDoc.ref, {
              presence: admin.firestore.FieldValue.delete(),
            });
            stats.cleanedUsers++;
          }
        } else {
          stats.skippedUsers++;
        }
      }

      // Commit batch if not in dry-run mode
      if (!config.dryRun && stats.cleanedUsers > 0) {
        try {
          await firestoreBatch.commit();
          console.log(`  ✅ Cleaned ${batch.length} users`);
        } catch (error) {
          console.error(`  ❌ Failed to clean batch:`, error);
          stats.failedUsers += batch.length;
        }
      }

      // Progress update
      const progress = ((i + batch.length) / stats.totalUsers) * 100;
      console.log(`\n📈 Progress: ${Math.round(progress)}% (${i + batch.length}/${stats.totalUsers})`);
    }

    stats.endTime = Date.now();
    const durationSec = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

    console.log('\n✅ Cleanup complete!');
    console.log('\n📊 Final Statistics:');
    console.log(`   Total users: ${stats.totalUsers}`);
    console.log(`   🧹 Cleaned: ${stats.cleanedUsers}`);
    console.log(`   ⏭️  Skipped (no presence): ${stats.skippedUsers}`);
    console.log(`   ❌ Failed: ${stats.failedUsers}`);
    console.log(`   ⏱️  Duration: ${durationSec}s`);

    if (config.dryRun) {
      console.log('\n🔍 This was a DRY RUN - no data was actually deleted');
    }

    // Cleanup
    await admin.app().delete();
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

/**
 * Entry point
 */
async function main() {
  const configOverrides = parseArgs();
  const config: CleanupConfig = {
    dryRun: false,
    batchSize: 100,
    ...configOverrides,
  };

  await cleanupFirestorePresence(config);
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
}

export { cleanupFirestorePresence, type CleanupConfig, type CleanupStats };
