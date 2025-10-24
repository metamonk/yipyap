/**
 * Agent Execution Log service for tracking daily agent workflow execution
 *
 * @remarks
 * This service handles agent execution log operations including:
 * - Retrieving execution history
 * - Fetching logs for specific executions
 * - Calculating performance metrics
 * - Real-time subscription to execution updates
 * Never access Firestore directly from components - always use this service layer.
 *
 * @module services/agentExecutionLogService
 */

import {
  collection,
  doc,
  getDoc,
  query,
  where,
  orderBy,
  getDocs,
  limit as firestoreLimit,
  FirestoreError,
  onSnapshot,
  Unsubscribe,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from './firebase';
import type { DailyAgentExecution, AgentExecutionLog } from '@/types/ai';

/**
 * Performance metrics calculated from execution data
 */
export interface PerformanceMetrics {
  /** Average execution duration in milliseconds */
  averageDuration: number;

  /** Average cost per execution in USD cents */
  averageCost: number;

  /** Success rate (completed / total) */
  successRate: number;

  /** Total number of executions */
  totalExecutions: number;

  /** Total messages processed across all executions */
  totalMessagesProcessed: number;

  /** Total auto-responses sent */
  totalAutoResponses: number;
}

/**
 * Retrieves execution history for the current user
 *
 * @param limitCount - Maximum number of executions to retrieve (default: 30)
 * @param userId - User ID (optional, defaults to current user)
 * @returns Promise resolving to array of executions
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const history = await getExecutionHistory(7); // Last 7 executions
 * history.forEach(exec => {
 *   console.log(`${exec.id}: ${exec.status}`);
 * });
 * ```
 */
export async function getExecutionHistory(
  limitCount: number = 30,
  userId?: string
): Promise<DailyAgentExecution[]> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access execution history');
    }

    const uid = userId || currentUser!.uid;
    const executionsQuery = query(
      collection(db, 'users', uid, 'daily_executions'),
      orderBy('executionDate', 'desc'),
      firestoreLimit(limitCount)
    );

    const querySnapshot = await getDocs(executionsQuery);

    return querySnapshot.docs.map((doc) => doc.data() as DailyAgentExecution);
  } catch (error) {
    console.error('Error fetching execution history:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load execution history: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieves a specific execution by ID
 *
 * @param executionId - Execution document ID
 * @param userId - User ID (optional, defaults to current user)
 * @returns Promise resolving to the execution, or null if not found
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const execution = await getExecutionById('exec_123');
 * if (execution) {
 *   console.log(`Status: ${execution.status}`);
 *   console.log(`Duration: ${execution.metrics.duration}ms`);
 * }
 * ```
 */
export async function getExecutionById(
  executionId: string,
  userId?: string
): Promise<DailyAgentExecution | null> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access execution details');
    }

    const uid = userId || currentUser!.uid;
    const executionDoc = doc(db, 'users', uid, 'daily_executions', executionId);
    const executionSnapshot = await getDoc(executionDoc);

    if (!executionSnapshot.exists()) {
      return null;
    }

    return executionSnapshot.data() as DailyAgentExecution;
  } catch (error) {
    console.error('Error fetching execution by ID:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load execution: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Retrieves logs for a specific execution
 *
 * @param executionId - Execution document ID
 * @param userId - User ID (optional, defaults to current user)
 * @returns Promise resolving to array of log entries
 * @throws {FirestoreError} When Firestore operation fails
 *
 * @example
 * ```typescript
 * const logs = await getExecutionLogs('exec_123');
 * logs.forEach(log => {
 *   console.log(`[${log.level}] ${log.message}`);
 * });
 * ```
 */
export async function getExecutionLogs(
  executionId: string,
  userId?: string
): Promise<AgentExecutionLog[]> {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to access execution logs');
    }

    const uid = userId || currentUser!.uid;
    const logsQuery = query(
      collection(db, 'users', uid, 'agent_logs'),
      where('executionId', '==', executionId),
      orderBy('timestamp', 'asc')
    );

    const querySnapshot = await getDocs(logsQuery);

    return querySnapshot.docs.map((doc) => doc.data() as AgentExecutionLog);
  } catch (error) {
    console.error('Error fetching execution logs:', error);
    if (error instanceof FirestoreError) {
      throw new Error(`Failed to load execution logs: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Calculates performance metrics from execution history
 *
 * @param executions - Array of execution records
 * @returns Calculated performance metrics
 *
 * @example
 * ```typescript
 * const history = await getExecutionHistory(30);
 * const metrics = calculatePerformanceMetrics(history);
 * console.log(`Success rate: ${metrics.successRate}%`);
 * console.log(`Avg duration: ${metrics.averageDuration}ms`);
 * ```
 */
export function calculatePerformanceMetrics(
  executions: DailyAgentExecution[]
): PerformanceMetrics {
  if (executions.length === 0) {
    return {
      averageDuration: 0,
      averageCost: 0,
      successRate: 0,
      totalExecutions: 0,
      totalMessagesProcessed: 0,
      totalAutoResponses: 0,
    };
  }

  const completedExecutions = executions.filter((exec) => exec.status === 'completed');
  const totalDuration = completedExecutions.reduce(
    (sum, exec) => sum + (exec.metrics?.duration || 0),
    0
  );
  const totalCost = completedExecutions.reduce(
    (sum, exec) => sum + (exec.metrics?.costIncurred || 0),
    0
  );
  const totalMessages = executions.reduce(
    (sum, exec) => sum + (exec.results?.messagesFetched || 0),
    0
  );
  const totalAutoResponses = executions.reduce(
    (sum, exec) => sum + (exec.results?.autoResponsesSent || 0),
    0
  );

  return {
    averageDuration: completedExecutions.length > 0 ? totalDuration / completedExecutions.length : 0,
    averageCost: completedExecutions.length > 0 ? totalCost / completedExecutions.length : 0,
    successRate: (completedExecutions.length / executions.length) * 100,
    totalExecutions: executions.length,
    totalMessagesProcessed: totalMessages,
    totalAutoResponses: totalAutoResponses,
  };
}

/**
 * Subscribes to real-time updates for execution history
 *
 * @param callback - Function called when executions change
 * @param limitCount - Maximum number of executions to watch (default: 30)
 * @param userId - User ID (optional, defaults to current user)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore listener setup fails
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToExecutionHistory((executions) => {
 *   console.log(`${executions.length} executions`);
 *   const latest = executions[0];
 *   console.log(`Latest status: ${latest.status}`);
 * });
 * ```
 */
export function subscribeToExecutionHistory(
  callback: (executions: DailyAgentExecution[]) => void,
  limitCount: number = 30,
  userId?: string
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to subscribe to execution history');
    }

    const uid = userId || currentUser!.uid;
    const executionsQuery = query(
      collection(db, 'users', uid, 'daily_executions'),
      orderBy('executionDate', 'desc'),
      firestoreLimit(limitCount)
    );

    return onSnapshot(
      executionsQuery,
      (snapshot) => {
        const executions = snapshot.docs.map((doc) => doc.data() as DailyAgentExecution);
        callback(executions);
      },
      (error) => {
        console.error('Error in execution history subscription:', error);
        throw new Error(`Failed to listen for execution updates: ${error.message}`);
      }
    );
  } catch (error) {
    console.error('Error setting up execution history subscription:', error);
    throw error;
  }
}

/**
 * Subscribes to real-time updates for a specific execution
 *
 * @param executionId - Execution document ID to subscribe to
 * @param callback - Function called when execution changes
 * @param userId - User ID (optional, defaults to current user)
 * @returns Unsubscribe function to stop listening to updates
 * @throws {FirestoreError} When Firestore listener setup fails
 *
 * @example
 * ```typescript
 * const unsubscribe = subscribeToExecution('exec_123', (execution) => {
 *   if (execution) {
 *     console.log(`Status: ${execution.status}`);
 *   }
 * });
 * ```
 */
export function subscribeToExecution(
  executionId: string,
  callback: (execution: DailyAgentExecution | null) => void,
  userId?: string
): Unsubscribe {
  try {
    const db = getFirebaseDb();
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;

    if (!currentUser && !userId) {
      throw new Error('User must be authenticated to subscribe to execution');
    }

    const uid = userId || currentUser!.uid;
    const executionDoc = doc(db, 'users', uid, 'daily_executions', executionId);

    return onSnapshot(
      executionDoc,
      (snapshot) => {
        if (!snapshot.exists()) {
          callback(null);
          return;
        }

        callback(snapshot.data() as DailyAgentExecution);
      },
      (error) => {
        console.error('Error in execution subscription:', error);
        throw new Error(`Failed to listen for execution updates: ${error.message}`);
      }
    );
  } catch (error) {
    console.error('Error setting up execution subscription:', error);
    throw error;
  }
}
