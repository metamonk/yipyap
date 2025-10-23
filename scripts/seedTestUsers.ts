/**
 * Seed Test Users Script
 *
 * @remarks
 * Creates test users in Firestore for development and testing.
 * Run with: npx ts-node scripts/seedTestUsers.ts
 *
 * Prerequisites:
 * - Firebase project configured
 * - Firestore initialized
 * - Environment variables set
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { Config } from '../constants/Config';

// Test users data
const testUsers = [
  {
    uid: 'test_user_1',
    username: 'alice',
    displayName: 'Alice Johnson',
    email: 'alice@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=alice'
  },
  {
    uid: 'test_user_2',
    username: 'bob',
    displayName: 'Bob Smith',
    email: 'bob@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=bob'
  },
  {
    uid: 'test_user_3',
    username: 'charlie',
    displayName: 'Charlie Brown',
    email: 'charlie@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=charlie'
  },
  {
    uid: 'test_user_4',
    username: 'diana',
    displayName: 'Diana Prince',
    email: 'diana@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=diana'
  },
  {
    uid: 'test_user_5',
    username: 'edward',
    displayName: 'Edward Norton',
    email: 'edward@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=edward'
  },
  {
    uid: 'test_user_6',
    username: 'fiona',
    displayName: 'Fiona Green',
    email: 'fiona@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=fiona'
  },
  {
    uid: 'test_user_7',
    username: 'george',
    displayName: 'George Wilson',
    email: 'george@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=george'
  },
  {
    uid: 'test_user_8',
    username: 'hannah',
    displayName: 'Hannah Montana',
    email: 'hannah@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=hannah'
  },
  {
    uid: 'test_user_9',
    username: 'isaac',
    displayName: 'Isaac Newton',
    email: 'isaac@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=isaac'
  },
  {
    uid: 'test_user_10',
    username: 'julia',
    displayName: 'Julia Roberts',
    email: 'julia@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=julia'
  },
  {
    uid: 'test_user_11',
    username: 'kevin',
    displayName: 'Kevin Hart',
    email: 'kevin@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=kevin'
  },
  {
    uid: 'test_user_12',
    username: 'laura',
    displayName: 'Laura Palmer',
    email: 'laura@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=laura'
  },
  {
    uid: 'test_user_13',
    username: 'mike',
    displayName: 'Mike Tyson',
    email: 'mike@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=mike'
  },
  {
    uid: 'test_user_14',
    username: 'nancy',
    displayName: 'Nancy Drew',
    email: 'nancy@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=nancy'
  },
  {
    uid: 'test_user_15',
    username: 'oliver',
    displayName: 'Oliver Twist',
    email: 'oliver@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=oliver'
  },
  {
    uid: 'test_user_16',
    username: 'patricia',
    displayName: 'Patricia Williams',
    email: 'patricia@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=patricia'
  },
  {
    uid: 'test_user_17',
    username: 'quinn',
    displayName: 'Quinn Taylor',
    email: 'quinn@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=quinn'
  },
  {
    uid: 'test_user_18',
    username: 'rachel',
    displayName: 'Rachel Green',
    email: 'rachel@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=rachel'
  },
  {
    uid: 'test_user_19',
    username: 'sam',
    displayName: 'Sam Wilson',
    email: 'sam@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=sam'
  },
  {
    uid: 'test_user_20',
    username: 'tina',
    displayName: 'Tina Turner',
    email: 'tina@test.com',
    photoURL: 'https://i.pravatar.cc/150?u=tina'
  }
];

async function seedTestUsers() {
  try {
    console.log('🌱 Starting to seed test users...');

    // Initialize Firebase
    const app = initializeApp(Config.firebase);
    const db = getFirestore(app);

    // Use batch writes for efficiency
    const batch = writeBatch(db);
    const now = Timestamp.now();

    for (const userData of testUsers) {
      // Create user document
      const userRef = doc(db, 'users', userData.uid);
      batch.set(userRef, {
        uid: userData.uid,
        username: userData.username,
        displayName: userData.displayName,
        displayNameLower: userData.displayName.toLowerCase(), // For search optimization
        email: userData.email,
        photoURL: userData.photoURL,
        presence: {
          status: 'offline',
          lastSeen: now
        },
        settings: {
          sendReadReceipts: true,
          notificationsEnabled: true
        },
        createdAt: now,
        updatedAt: now,
      });

      // Create username claim document
      const usernameRef = doc(db, 'usernames', userData.username);
      batch.set(usernameRef, {
        uid: userData.uid,
        createdAt: now
      });

      console.log(`  ✓ Prepared user: ${userData.displayName} (@${userData.username})`);
    }

    // Commit the batch
    console.log('\n📤 Committing batch write to Firestore...');
    await batch.commit();

    console.log('\n✅ Successfully seeded ' + testUsers.length + ' test users!');
    console.log('\nTest users created:');
    testUsers.forEach(user => {
      console.log(`  - ${user.displayName} (@${user.username}) - ${user.email}`);
    });

    console.log('\n💡 You can now search for these users in the app!');
    console.log('   Try searching for: alice, bob, charlie, etc.');

  } catch (error) {
    console.error('\n❌ Error seeding test users:', error);
    process.exit(1);
  }
}

// Run the script
seedTestUsers()
  .then(() => {
    console.log('\n👋 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });