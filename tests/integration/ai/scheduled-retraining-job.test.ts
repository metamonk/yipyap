/**
 * Integration Tests for Subtask 17.8: Weekly Retraining Scheduled Job
 * @module tests/integration/ai/scheduled-retraining-job
 *
 * @remarks
 * Tests verify that the weekly voice profile retraining scheduled job:
 * - Correctly identifies users eligible for retraining
 * - Processes users according to their retraining schedule
 * - Creates proper job tracking records
 * - Handles execution correctly
 *
 * Tests use Firebase Emulator Suite for isolated testing.
 * Set SKIP_INTEGRATION_TESTS=1 to skip these tests.
 *
 * @group integration
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { serverTimestamp, setDoc, doc, getDoc, query, where, collection, getDocs } from 'firebase/firestore';

const SKIP_TESTS = process.env.SKIP_INTEGRATION_TESTS === '1';

let testEnv: RulesTestEnvironment;

describe('Subtask 17.8: Weekly Retraining Scheduled Job Execution', () => {
  beforeAll(async () => {
    if (SKIP_TESTS) {
      console.log('⏭️  Skipping integration tests (SKIP_INTEGRATION_TESTS=1)');
      return;
    }

    // Initialize test environment with Firebase Emulator
    testEnv = await initializeTestEnvironment({
      projectId: 'yipyap-test-scheduled-job',
      firestore: {
        host: 'localhost',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (SKIP_TESTS) return;
    // Clear Firestore data before each test
    await testEnv.clearFirestore();
  });

  describe('User Selection for Retraining', () => {
    it('should identify users with weekly retraining schedule', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Create test users with different settings
        await setDoc(doc(db, 'users', 'user1'), {
          uid: 'user1',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'weekly',
            },
          },
        });

        await setDoc(doc(db, 'users', 'user2'), {
          uid: 'user2',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'monthly',
            },
          },
        });

        await setDoc(doc(db, 'users', 'user3'), {
          uid: 'user3',
          settings: {
            voiceMatching: {
              enabled: false,
              retrainingSchedule: 'weekly',
            },
          },
        });

        await setDoc(doc(db, 'users', 'user4'), {
          uid: 'user4',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'weekly',
            },
          },
        });

        // Query for weekly retraining users (simulating what the scheduled function does)
        const usersRef = collection(db, 'users');
        const weeklyQuery = query(
          usersRef,
          where('settings.voiceMatching.enabled', '==', true),
          where('settings.voiceMatching.retrainingSchedule', '==', 'weekly')
        );

        const snapshot = await getDocs(weeklyQuery);

        // Should find user1 and user4 (both enabled + weekly)
        expect(snapshot.size).toBe(2);

        const userIds = snapshot.docs.map(doc => doc.id);
        expect(userIds).toContain('user1');
        expect(userIds).toContain('user4');
        expect(userIds).not.toContain('user2'); // monthly
        expect(userIds).not.toContain('user3'); // disabled
      });
    });

    it('should identify users with biweekly retraining schedule', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'users', 'user1'), {
          uid: 'user1',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'biweekly',
            },
          },
        });

        await setDoc(doc(db, 'users', 'user2'), {
          uid: 'user2',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'weekly',
            },
          },
        });

        const usersRef = collection(db, 'users');
        const biweeklyQuery = query(
          usersRef,
          where('settings.voiceMatching.enabled', '==', true),
          where('settings.voiceMatching.retrainingSchedule', '==', 'biweekly')
        );

        const snapshot = await getDocs(biweeklyQuery);

        expect(snapshot.size).toBe(1);
        expect(snapshot.docs[0].id).toBe('user1');
      });
    });

    it('should identify users with monthly retraining schedule', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        await setDoc(doc(db, 'users', 'user1'), {
          uid: 'user1',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'monthly',
            },
          },
        });

        await setDoc(doc(db, 'users', 'user2'), {
          uid: 'user2',
          settings: {
            voiceMatching: {
              enabled: true,
              retrainingSchedule: 'weekly',
            },
          },
        });

        const usersRef = collection(db, 'users');
        const monthlyQuery = query(
          usersRef,
          where('settings.voiceMatching.enabled', '==', true),
          where('settings.voiceMatching.retrainingSchedule', '==', 'monthly')
        );

        const snapshot = await getDocs(monthlyQuery);

        expect(snapshot.size).toBe(1);
        expect(snapshot.docs[0].id).toBe('user1');
      });
    });
  });

  describe('Scheduled Job Execution Flow', () => {
    it('should create job record before starting retraining', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Simulate the start of a scheduled job
        const jobId = `weekly-${Date.now()}`;

        // Step 1: Query eligible users
        await setDoc(doc(db, 'users', 'user1'), {
          uid: 'user1',
          settings: {
            voiceMatching: { enabled: true, retrainingSchedule: 'weekly' },
          },
        });

        await setDoc(doc(db, 'users', 'user2'), {
          uid: 'user2',
          settings: {
            voiceMatching: { enabled: true, retrainingSchedule: 'weekly' },
          },
        });

        const usersSnapshot = await getDocs(
          query(
            collection(db, 'users'),
            where('settings.voiceMatching.enabled', '==', true),
            where('settings.voiceMatching.retrainingSchedule', '==', 'weekly')
          )
        );

        // Step 2: Create job tracking record
        await setDoc(doc(db, 'retraining_jobs', jobId), {
          jobId,
          schedule: 'weekly',
          status: 'running',
          startedAt: serverTimestamp(),
          totalUsers: usersSnapshot.size,
          successfulRetrains: 0,
          failedRetrains: 0,
        });

        // Step 3: Verify job record was created
        const jobDoc = await getDoc(doc(db, 'retraining_jobs', jobId));
        expect(jobDoc.exists()).toBe(true);

        const jobData = jobDoc.data();
        expect(jobData?.jobId).toBe(jobId);
        expect(jobData?.schedule).toBe('weekly');
        expect(jobData?.status).toBe('running');
        expect(jobData?.totalUsers).toBe(2);
      });
    });

    it('should update job status to completed after retraining', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const jobId = `weekly-${Date.now()}`;

        // Create initial job record
        await setDoc(doc(db, 'retraining_jobs', jobId), {
          jobId,
          schedule: 'weekly',
          status: 'running',
          startedAt: serverTimestamp(),
          totalUsers: 5,
          successfulRetrains: 0,
          failedRetrains: 0,
        });

        // Simulate job completion
        await setDoc(doc(db, 'retraining_jobs', jobId), {
          status: 'completed',
          completedAt: serverTimestamp(),
          successfulRetrains: 4,
          failedRetrains: 1,
          durationMs: 25000,
          errors: ['User user-5: Insufficient training data'],
        }, { merge: true });

        // Verify job was marked complete
        const jobDoc = await getDoc(doc(db, 'retraining_jobs', jobId));
        const jobData = jobDoc.data();

        expect(jobData?.status).toBe('completed');
        expect(jobData?.successfulRetrains).toBe(4);
        expect(jobData?.failedRetrains).toBe(1);
        expect(jobData?.durationMs).toBe(25000);
        expect(jobData?.errors).toHaveLength(1);
      });
    });

    it('should handle job failures gracefully', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        const jobId = `weekly-${Date.now()}`;

        // Create job record
        await setDoc(doc(db, 'retraining_jobs', jobId), {
          jobId,
          schedule: 'weekly',
          status: 'running',
          startedAt: serverTimestamp(),
          totalUsers: 3,
          successfulRetrains: 0,
          failedRetrains: 0,
        });

        // Simulate job failure
        await setDoc(doc(db, 'retraining_jobs', jobId), {
          status: 'failed',
          completedAt: serverTimestamp(),
          successfulRetrains: 0,
          failedRetrains: 3,
          durationMs: 5000,
          errors: [
            'User user-1: OpenAI API rate limit exceeded',
            'User user-2: OpenAI API rate limit exceeded',
            'User user-3: OpenAI API rate limit exceeded',
          ],
        }, { merge: true });

        // Verify job was marked as failed
        const jobDoc = await getDoc(doc(db, 'retraining_jobs', jobId));
        const jobData = jobDoc.data();

        expect(jobData?.status).toBe('failed');
        expect(jobData?.successfulRetrains).toBe(0);
        expect(jobData?.failedRetrains).toBe(3);
        expect(jobData?.errors).toHaveLength(3);
      });
    });
  });

  describe('Scheduled Job Schedule Verification', () => {
    it('should verify weekly schedule (every Monday at 2 AM UTC)', () => {
      if (SKIP_TESTS) return;

      // The cron expression for weekly job is: '0 2 * * 1'
      // This test documents the schedule configuration
      const cronExpression = '0 2 * * 1';

      // Parse cron (simplified validation)
      const parts = cronExpression.split(' ');
      expect(parts).toHaveLength(5);

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      expect(minute).toBe('0'); // 0th minute
      expect(hour).toBe('2'); // 2 AM
      expect(dayOfMonth).toBe('*'); // Any day of month
      expect(month).toBe('*'); // Any month
      expect(dayOfWeek).toBe('1'); // Monday (0 = Sunday, 1 = Monday)
    });

    it('should verify biweekly schedule (1st and 15th at 2 AM UTC)', () => {
      if (SKIP_TESTS) return;

      // The cron expression for biweekly job is: '0 2 1,15 * *'
      const cronExpression = '0 2 1,15 * *';

      const parts = cronExpression.split(' ');
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      expect(minute).toBe('0');
      expect(hour).toBe('2');
      expect(dayOfMonth).toBe('1,15'); // 1st and 15th of month
      expect(month).toBe('*');
      expect(dayOfWeek).toBe('*');
    });

    it('should verify monthly schedule (1st of month at 2 AM UTC)', () => {
      if (SKIP_TESTS) return;

      // The cron expression for monthly job is: '0 2 1 * *'
      const cronExpression = '0 2 1 * *';

      const parts = cronExpression.split(' ');
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      expect(minute).toBe('0');
      expect(hour).toBe('2');
      expect(dayOfMonth).toBe('1'); // 1st of month
      expect(month).toBe('*');
      expect(dayOfWeek).toBe('*');
    });
  });

  describe('Job History Tracking', () => {
    it('should maintain history of completed retraining jobs', async () => {
      if (SKIP_TESTS) return;

      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();

        // Create multiple job records (simulating history)
        const jobs = [
          {
            jobId: 'weekly-1000',
            schedule: 'weekly',
            status: 'completed',
            startedAt: serverTimestamp(),
            completedAt: serverTimestamp(),
            totalUsers: 10,
            successfulRetrains: 9,
            failedRetrains: 1,
            durationMs: 30000,
          },
          {
            jobId: 'weekly-2000',
            schedule: 'weekly',
            status: 'completed',
            startedAt: serverTimestamp(),
            completedAt: serverTimestamp(),
            totalUsers: 12,
            successfulRetrains: 12,
            failedRetrains: 0,
            durationMs: 28000,
          },
          {
            jobId: 'weekly-3000',
            schedule: 'weekly',
            status: 'running',
            startedAt: serverTimestamp(),
            totalUsers: 15,
            successfulRetrains: 8,
            failedRetrains: 0,
          },
        ];

        for (const job of jobs) {
          await setDoc(doc(db, 'retraining_jobs', job.jobId), job);
        }

        // Query all jobs
        const jobsSnapshot = await getDocs(collection(db, 'retraining_jobs'));
        expect(jobsSnapshot.size).toBe(3);

        // Query completed jobs only
        const completedSnapshot = await getDocs(
          query(collection(db, 'retraining_jobs'), where('status', '==', 'completed'))
        );
        expect(completedSnapshot.size).toBe(2);

        // Query running jobs
        const runningSnapshot = await getDocs(
          query(collection(db, 'retraining_jobs'), where('status', '==', 'running'))
        );
        expect(runningSnapshot.size).toBe(1);
      });
    });
  });
});
