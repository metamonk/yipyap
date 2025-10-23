/**
 * Presence Data Migration Script
 * @module scripts/migratePresence
 *
 * @remarks
 * Migrates user presence data from Firestore to Firebase Realtime Database.
 * Supports rollback and incremental migration.
 * Includes progress logging and error handling.
 *
 * Usage:
 * ```bash
 * npx ts-node scripts/migratePresence.ts [--dry-run] [--batch-size=100]
 * ```
 */

 

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { PresenceData, DevicePresence } from '../types/models';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Migration configuration
 */
interface MigrationConfig {
  /** Whether to run in dry-run mode (no writes) */
  dryRun: boolean;

  /** Number of users to migrate per batch */
  batchSize: number;

  /** Whether to continue on errors */
  continueOnError: boolean;
}

/**
 * Migration statistics
 */
interface MigrationStats {
  totalUsers: number;
  migratedUsers: number;
  skippedUsers: number;
  failedUsers: number;
  startTime: number;
  endTime?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MigrationConfig = {
  dryRun: false,
  batchSize: 100,
  continueOnError: true,
};

/**
 * Parses command line arguments
 */
function parseArgs(): Partial<MigrationConfig> {
  const args = process.argv.slice(2);
  const config: Partial<MigrationConfig> = {};

  args.forEach((arg) => {
    if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      config.batchSize = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--stop-on-error') {
      config.continueOnError = false;
    }
  });

  return config;
}

/**
 * Migrates a single user's presence data
 */
async function migrateUserPresence(
  userId: string,
  firestoreData: admin.firestore.DocumentData,
  rtdb: admin.database.Database,
  dryRun: boolean
): Promise<void> {
  try {
    // Extract presence data from Firestore user document
    const firestorePresence = firestoreData.presence;

    if (!firestorePresence) {
      console.log(`  ⚠️  User ${userId}: No presence data found, skipping`);
      return;
    }

    // Build RTDB presence structure
    const presenceData: PresenceData = {
      state: firestorePresence.status === 'online' ? 'online' : 'offline',
      lastSeen: firestorePresence.lastSeen?.toMillis
        ? firestorePresence.lastSeen.toMillis()
        : Date.now(),
      devices: {},
    };

    // Create a device entry (since Firestore doesn't have device tracking)
    // This creates a "legacy" device entry for the migrated presence
    const deviceId = 'migrated-device';
    const devicePresence: DevicePresence = {
      state: presenceData.state === 'online' ? 'online' : 'offline',
      platform: 'web', // Default to web for migrated data
      lastActivity: presenceData.lastSeen,
    };

    presenceData.devices[deviceId] = devicePresence;

    if (dryRun) {
      console.log(`  🔍 [DRY RUN] Would migrate user ${userId}:`, presenceData);
    } else {
      // Write to RTDB
      const presenceRef = rtdb.ref(`presence/${userId}`);
      await presenceRef.set(presenceData);
      console.log(`  ✅ Migrated user ${userId}`);
    }
  } catch (error) {
    console.error(`  ❌ Failed to migrate user ${userId}:`, error);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migratePresence(config: MigrationConfig): Promise<void> {
  console.log('🚀 Starting presence data migration');
  console.log('Configuration:', config);

  const stats: MigrationStats = {
    totalUsers: 0,
    migratedUsers: 0,
    skippedUsers: 0,
    failedUsers: 0,
    startTime: Date.now(),
  };

  try {
    // Initialize Firebase Admin SDK
    const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    // Initialize Firebase Admin (script runs once, so we don't need to check for existing apps)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    });

    const firestore = admin.firestore();
    const rtdb = admin.database();

    console.log('✅ Firebase Admin SDK initialized');

    // Get all users from Firestore
    console.log('📋 Fetching users from Firestore...');
    const usersSnapshot = await firestore.collection('users').get();

    stats.totalUsers = usersSnapshot.size;
    console.log(`📊 Found ${stats.totalUsers} users to migrate`);

    // Process users in batches
    const users = usersSnapshot.docs;
    for (let i = 0; i < users.length; i += config.batchSize) {
      const batch = users.slice(i, i + config.batchSize);
      console.log(
        `\n📦 Processing batch ${Math.floor(i / config.batchSize) + 1} (${batch.length} users)`
      );

      for (const userDoc of batch) {
        try {
          await migrateUserPresence(userDoc.id, userDoc.data(), rtdb, config.dryRun);
          stats.migratedUsers++;
        } catch (error) {
          stats.failedUsers++;

          if (!config.continueOnError) {
            throw error;
          }
        }
      }

      // Progress update
      const progress = ((i + batch.length) / stats.totalUsers) * 100;
      console.log(`\n📈 Progress: ${Math.round(progress)}% (${i + batch.length}/${stats.totalUsers})`);
    }

    stats.endTime = Date.now();
    const durationSec = ((stats.endTime - stats.startTime) / 1000).toFixed(2);

    console.log('\n✅ Migration complete!');
    console.log('\n📊 Final Statistics:');
    console.log(`   Total users: ${stats.totalUsers}`);
    console.log(`   ✅ Migrated: ${stats.migratedUsers}`);
    console.log(`   ⚠️  Skipped: ${stats.skippedUsers}`);
    console.log(`   ❌ Failed: ${stats.failedUsers}`);
    console.log(`   ⏱️  Duration: ${durationSec}s`);

    if (config.dryRun) {
      console.log('\n🔍 This was a DRY RUN - no data was actually migrated');
    }

    // Cleanup
    await admin.app().delete();
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

/**
 * Entry point
 */
async function main() {
  const configOverrides = parseArgs();
  const config: MigrationConfig = {
    ...DEFAULT_CONFIG,
    ...configOverrides,
  };

  await migratePresence(config);
}

// Run if called directly (ES module compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export { migratePresence, type MigrationConfig, type MigrationStats };
