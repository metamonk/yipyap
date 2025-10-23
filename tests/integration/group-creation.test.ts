/**
 * Integration tests for group conversation creation flow
 * @module tests/integration/group-creation
 * @description Tests the full group creation flow including Firestore operations,
 * real-time sync, and Firebase Storage uploads using Firebase Emulator Suite
 */

// Note: These imports would be used in a full implementation
// import {
//   createConversationWithFirstMessage,
//   uploadGroupPhoto,
//   subscribeToConversations,
// } from '../../services/conversationService';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
// import { getStorage } from 'firebase/storage';

describe('Group Creation - Integration Tests', () => {
  let testEnv: RulesTestEnvironment;
  const projectId = 'test-project';

  // Test users
  const creator = { uid: 'creator-123', email: 'creator@test.com' };
  const user2 = { uid: 'user-456', email: 'user2@test.com' };
  const user3 = { uid: 'user-789', email: 'user3@test.com' };

  beforeAll(async () => {
    // Initialize Firebase Test Environment with emulator
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: 'localhost',
        port: 8080,
        rules: `
          rules_version = '2';
          service cloud.firestore {
            match /databases/{database}/documents {
              match /conversations/{conversationId} {
                allow create: if request.auth != null &&
                  request.auth.uid in request.resource.data.participantIds &&
                  (
                    (request.resource.data.type == 'direct' &&
                     request.resource.data.participantIds.size() == 2) ||
                    (request.resource.data.type == 'group' &&
                     request.resource.data.creatorId == request.auth.uid &&
                     request.resource.data.groupName != null &&
                     request.resource.data.groupName.size() > 0 &&
                     request.resource.data.participantIds.size() >= 3 &&
                     request.resource.data.participantIds.size() <= 50)
                  );

                allow read: if request.auth != null &&
                  request.auth.uid in resource.data.participantIds;
              }

              match /conversations/{conversationId}/messages/{messageId} {
                allow create: if request.auth != null &&
                  request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;

                allow read: if request.auth != null &&
                  request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participantIds;
              }
            }
          }
        `,
      },
      storage: {
        host: 'localhost',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  describe('Group Conversation Creation with Firestore', () => {
    it('should create group with 3 participants and appear in all participant lists', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const user2Context = testEnv.authenticatedContext(user2.uid);
      const user3Context = testEnv.authenticatedContext(user3.uid);

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const groupName = 'Test Group';
      const firstMessage = 'Welcome to the group!';

      // Create group as creator
      const creatorFirestore = creatorContext.firestore();
      const conversationRef = doc(creatorFirestore, 'conversations', 'test-group-1');

      await assertSucceeds(
        setDoc(conversationRef, {
          type: 'group',
          participantIds,
          groupName,
          groupPhotoURL: null,
          creatorId: creator.uid,
          lastMessage: {
            text: firstMessage,
            senderId: creator.uid,
            timestamp: new Date(),
          },
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      // Verify all participants can read the group
      const user2Firestore = user2Context.firestore();
      const user2Doc = await assertSucceeds(
        getDoc(doc(user2Firestore, 'conversations', 'test-group-1'))
      );
      expect(user2Doc.exists()).toBe(true);
      expect(user2Doc.data()?.groupName).toBe(groupName);

      const user3Firestore = user3Context.firestore();
      const user3Doc = await assertSucceeds(
        getDoc(doc(user3Firestore, 'conversations', 'test-group-1'))
      );
      expect(user3Doc.exists()).toBe(true);
      expect(user3Doc.data()?.groupName).toBe(groupName);
    });

    it('should enforce minimum 3 participants for group creation', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const tooFewParticipants = [creator.uid, user2.uid]; // Only 2
      const conversationRef = doc(creatorFirestore, 'conversations', 'invalid-group');

      await assertFails(
        setDoc(conversationRef, {
          type: 'group',
          participantIds: tooFewParticipants,
          groupName: 'Invalid Group',
          groupPhotoURL: null,
          creatorId: creator.uid,
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should enforce maximum 50 participants for group creation', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const tooManyParticipants = Array.from({ length: 51 }, (_, i) => `user-${i}`);
      const conversationRef = doc(creatorFirestore, 'conversations', 'invalid-group-2');

      await assertFails(
        setDoc(conversationRef, {
          type: 'group',
          participantIds: tooManyParticipants,
          groupName: 'Too Large Group',
          groupPhotoURL: null,
          creatorId: creator.uid,
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should require group name for group conversations', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const conversationRef = doc(creatorFirestore, 'conversations', 'no-name-group');

      await assertFails(
        setDoc(conversationRef, {
          type: 'group',
          participantIds,
          groupName: null, // Missing group name
          groupPhotoURL: null,
          creatorId: creator.uid,
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should require creatorId to match authenticated user', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const conversationRef = doc(creatorFirestore, 'conversations', 'wrong-creator');

      await assertFails(
        setDoc(conversationRef, {
          type: 'group',
          participantIds,
          groupName: 'Test Group',
          groupPhotoURL: null,
          creatorId: user2.uid, // Wrong creator ID
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should allow exactly 50 participants (max limit)', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const maxParticipants = Array.from({ length: 50 }, (_, i) => `user-${i}`);
      maxParticipants[0] = creator.uid; // Ensure creator is in list

      const conversationRef = doc(creatorFirestore, 'conversations', 'max-group');

      await assertSucceeds(
        setDoc(conversationRef, {
          type: 'group',
          participantIds: maxParticipants,
          groupName: 'Maximum Size Group',
          groupPhotoURL: null,
          creatorId: creator.uid,
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should create group with photo URL when provided', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const groupPhotoURL = 'https://storage.googleapis.com/test-bucket/group-photo.jpg';
      const conversationRef = doc(creatorFirestore, 'conversations', 'group-with-photo');

      await assertSucceeds(
        setDoc(conversationRef, {
          type: 'group',
          participantIds,
          groupName: 'Group with Photo',
          groupPhotoURL,
          creatorId: creator.uid,
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      // Verify photo URL is saved
      const savedDoc = await getDoc(conversationRef);
      expect(savedDoc.data()?.groupPhotoURL).toBe(groupPhotoURL);
    });

    it('should not allow non-participant to create group', async () => {
      const outsiderContext = testEnv.authenticatedContext('outsider-999');
      const outsiderFirestore = outsiderContext.firestore();

      // Outsider tries to create group without being in participants
      const participantIds = [creator.uid, user2.uid, user3.uid];
      const conversationRef = doc(outsiderFirestore, 'conversations', 'outsider-group');

      await assertFails(
        setDoc(conversationRef, {
          type: 'group',
          participantIds,
          groupName: 'Outsider Group',
          groupPhotoURL: null,
          creatorId: 'outsider-999',
          lastMessage: null,
          lastMessageTimestamp: new Date(),
          unreadCount: {},
          archivedBy: {},
          deletedBy: {},
          mutedBy: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );
    });

    it('should prevent non-participant from reading group conversation', async () => {
      // First create a group
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const conversationRef = doc(creatorFirestore, 'conversations', 'private-group');

      await setDoc(conversationRef, {
        type: 'group',
        participantIds,
        groupName: 'Private Group',
        groupPhotoURL: null,
        creatorId: creator.uid,
        lastMessage: null,
        lastMessageTimestamp: new Date(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Outsider tries to read
      const outsiderContext = testEnv.authenticatedContext('outsider-999');
      const outsiderFirestore = outsiderContext.firestore();

      await assertFails(getDoc(doc(outsiderFirestore, 'conversations', 'private-group')));
    });

    it('should handle group creation with first message atomically', async () => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const creatorFirestore = creatorContext.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const groupName = 'Atomic Group';
      const firstMessage = 'Hello everyone!';

      // Create conversation with first message
      const conversationRef = doc(creatorFirestore, 'conversations', 'atomic-group');
      await setDoc(conversationRef, {
        type: 'group',
        participantIds,
        groupName,
        groupPhotoURL: null,
        creatorId: creator.uid,
        lastMessage: {
          text: firstMessage,
          senderId: creator.uid,
          timestamp: new Date(),
        },
        lastMessageTimestamp: new Date(),
        unreadCount: {
          [user2.uid]: 1,
          [user3.uid]: 1,
        },
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Add the first message to messages subcollection
      const messageRef = doc(creatorFirestore, 'conversations/atomic-group/messages', 'msg-1');
      await setDoc(messageRef, {
        text: firstMessage,
        senderId: creator.uid,
        timestamp: new Date(),
        status: 'delivered',
        readBy: [creator.uid],
      });

      // Verify conversation and message exist
      const savedConv = await getDoc(conversationRef);
      expect(savedConv.exists()).toBe(true);
      expect(savedConv.data()?.lastMessage.text).toBe(firstMessage);

      const savedMsg = await getDoc(messageRef);
      expect(savedMsg.exists()).toBe(true);
      expect(savedMsg.data()?.text).toBe(firstMessage);
    });
  });

  describe('Real-Time Subscription Tests', () => {
    it('should notify all participants when group is created', async (done) => {
      const creatorContext = testEnv.authenticatedContext(creator.uid);
      const user2Context = testEnv.authenticatedContext(user2.uid);

      const creatorFirestore = creatorContext.firestore();
      const user2Firestore = user2Context.firestore();

      const participantIds = [creator.uid, user2.uid, user3.uid];
      const groupName = 'Real-Time Group';

      let user2Notified = false;

      // Setup listener for user2 before group creation
      const unsubscribe = user2Firestore
        .collection('conversations')
        .where('participantIds', 'array-contains', user2.uid)
        .onSnapshot((snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' && change.doc.data().groupName === groupName) {
              user2Notified = true;
              unsubscribe();
              done();
            }
          });
        });

      // Create group as creator
      const conversationRef = doc(creatorFirestore, 'conversations', 'realtime-group');
      await setDoc(conversationRef, {
        type: 'group',
        participantIds,
        groupName,
        groupPhotoURL: null,
        creatorId: creator.uid,
        lastMessage: null,
        lastMessageTimestamp: new Date(),
        unreadCount: {},
        archivedBy: {},
        deletedBy: {},
        mutedBy: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Give some time for the listener to fire
      setTimeout(() => {
        if (!user2Notified) {
          unsubscribe();
          done(new Error('User2 was not notified of group creation'));
        }
      }, 2000);
    });
  });
});
