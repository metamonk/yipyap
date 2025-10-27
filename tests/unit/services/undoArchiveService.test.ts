/**
 * Unit tests for Undo Archive Service (Story 6.4)
 * @module tests/unit/services/undoArchiveService.test
 */

import {
  fetchActiveUndoRecords,
  undoArchive,
  isUndoValid,
  getTimeRemainingForUndo,
  formatTimeRemaining,
} from '../../../services/undoArchiveService';
import type { UndoArchive } from '../../../types/ai';
import { Timestamp } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../../services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({
    collection: jest.fn(),
    doc: jest.fn(),
  })),
}));

// Mock Firestore functions
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  doc: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })),
  },
}));

describe('isUndoValid', () => {
  it('should return true for valid undo record', () => {
    const futureTime = Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000); // 10 hours from now

    const undoRecord: UndoArchive = {
      id: 'undo1',
      userId: 'user1',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: futureTime,
      boundaryMessageSent: true,
      canUndo: true,
    };

    expect(isUndoValid(undoRecord)).toBe(true);
  });

  it('should return false if already undone (canUndo = false)', () => {
    const futureTime = Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000);

    const undoRecord: UndoArchive = {
      id: 'undo1',
      userId: 'user1',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: futureTime,
      boundaryMessageSent: true,
      canUndo: false, // Already undone
    };

    expect(isUndoValid(undoRecord)).toBe(false);
  });

  it('should return false if expired', () => {
    const pastTime = Timestamp.fromMillis(Date.now() - 10 * 60 * 60 * 1000); // 10 hours ago

    const undoRecord: UndoArchive = {
      id: 'undo1',
      userId: 'user1',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: pastTime, // Expired
      boundaryMessageSent: true,
      canUndo: true,
    };

    expect(isUndoValid(undoRecord)).toBe(false);
  });
});

describe('getTimeRemainingForUndo', () => {
  it('should calculate remaining time correctly', () => {
    const twoHoursFromNow = Date.now() + 2 * 60 * 60 * 1000;
    const expiresAt = Timestamp.fromMillis(twoHoursFromNow);

    const undoRecord: UndoArchive = {
      id: 'undo1',
      userId: 'user1',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt,
      boundaryMessageSent: true,
      canUndo: true,
    };

    const remaining = getTimeRemainingForUndo(undoRecord);

    // Should be approximately 2 hours (within 1 second tolerance)
    expect(remaining).toBeGreaterThan(2 * 60 * 60 * 1000 - 1000);
    expect(remaining).toBeLessThan(2 * 60 * 60 * 1000 + 1000);
  });

  it('should return 0 for expired records', () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    const expiresAt = Timestamp.fromMillis(twoHoursAgo);

    const undoRecord: UndoArchive = {
      id: 'undo1',
      userId: 'user1',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt,
      boundaryMessageSent: true,
      canUndo: true,
    };

    const remaining = getTimeRemainingForUndo(undoRecord);
    expect(remaining).toBe(0);
  });
});

describe('formatTimeRemaining', () => {
  it('should format hours and minutes correctly', () => {
    const twoHours45Min = 2 * 60 * 60 * 1000 + 45 * 60 * 1000;
    expect(formatTimeRemaining(twoHours45Min)).toBe('2h 45m');
  });

  it('should format only minutes when less than 1 hour', () => {
    const fortyFiveMin = 45 * 60 * 1000;
    expect(formatTimeRemaining(fortyFiveMin)).toBe('45m');
  });

  it('should format only hours when exactly on the hour', () => {
    const threeHours = 3 * 60 * 60 * 1000;
    expect(formatTimeRemaining(threeHours)).toBe('3h 0m');
  });

  it('should return "Expired" for 0 or negative time', () => {
    expect(formatTimeRemaining(0)).toBe('Expired');
    expect(formatTimeRemaining(-1000)).toBe('Expired');
  });

  it('should handle very small positive values', () => {
    const oneMinute = 60 * 1000;
    expect(formatTimeRemaining(oneMinute)).toBe('1m');
  });
});

describe('fetchActiveUndoRecords', () => {
  const { getDocs, query, where, orderBy, limit } = require('firebase/firestore');

  it('should fetch active undo records for user', async () => {
    const mockRecords = [
      {
        id: 'undo1',
        data: () => ({
          userId: 'user123',
          conversationId: 'conv1',
          messageId: 'msg1',
          archivedAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000),
          boundaryMessageSent: true,
          canUndo: true,
        }),
      },
      {
        id: 'undo2',
        data: () => ({
          userId: 'user123',
          conversationId: 'conv2',
          messageId: 'msg2',
          archivedAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(Date.now() + 5 * 60 * 60 * 1000),
          boundaryMessageSent: false,
          canUndo: true,
        }),
      },
    ];

    (getDocs as jest.Mock).mockResolvedValueOnce({
      forEach: (callback: any) => mockRecords.forEach(callback),
    });

    (query as jest.Mock).mockReturnValueOnce({});
    (where as jest.Mock).mockReturnValue({});
    (orderBy as jest.Mock).mockReturnValue({});
    (limit as jest.Mock).mockReturnValue({});

    const records = await fetchActiveUndoRecords('user123');

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe('undo1');
    expect(records[0].conversationId).toBe('conv1');
    expect(records[1].id).toBe('undo2');
    expect(records[1].conversationId).toBe('conv2');
  });

  it('should return empty array when no records found', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({
      forEach: (callback: any) => {}, // Empty result
    });

    const records = await fetchActiveUndoRecords('user123');
    expect(records).toHaveLength(0);
  });
});

describe('undoArchive', () => {
  const { getDoc, updateDoc } = require('firebase/firestore');

  it('should successfully undo archive', async () => {
    const mockUndoRecord = {
      userId: 'user123',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000),
      boundaryMessageSent: true,
      canUndo: true,
    };

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUndoRecord,
    });

    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await undoArchive('undo1', 'user123');

    expect(result).toBe(true);
    expect(updateDoc).toHaveBeenCalledTimes(2); // Once for conversation, once for undo record
  });

  it('should fail if undo record not found', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => false,
    });

    const result = await undoArchive('nonexistent', 'user123');
    expect(result).toBe(false);
  });

  it('should fail if undo record belongs to different user', async () => {
    const mockUndoRecord = {
      userId: 'otherUser',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000),
      boundaryMessageSent: true,
      canUndo: true,
    };

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUndoRecord,
    });

    const result = await undoArchive('undo1', 'user123');
    expect(result).toBe(false);
  });

  it('should fail if undo already performed', async () => {
    const mockUndoRecord = {
      userId: 'user123',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 60 * 1000),
      boundaryMessageSent: true,
      canUndo: false, // Already undone
    };

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUndoRecord,
    });

    const result = await undoArchive('undo1', 'user123');
    expect(result).toBe(false);
  });

  it('should fail if undo record expired', async () => {
    const mockUndoRecord = {
      userId: 'user123',
      conversationId: 'conv1',
      messageId: 'msg1',
      archivedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() - 10 * 60 * 60 * 1000), // Expired
      boundaryMessageSent: true,
      canUndo: true,
    };

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUndoRecord,
    });

    const result = await undoArchive('undo1', 'user123');
    expect(result).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    (getDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));

    const result = await undoArchive('undo1', 'user123');
    expect(result).toBe(false);
  });
});
