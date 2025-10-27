/**
 * Unit tests for draftManagementService - Auto-Save Functionality (Story 6.2)
 * @remarks
 * Tests draft auto-save, restoration, history tracking, and cleanup operations.
 */

import {
  DraftManagementService,
  DraftSaveResult,
  DraftRestoreResult,
  DraftHistoryResult,
} from '@/services/draftManagementService';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/services/firebase';

// Mock Firebase modules
jest.mock('@/services/firebase');
jest.mock('firebase/firestore');

describe('DraftManagementService - Auto-Save (Story 6.2)', () => {
  let service: DraftManagementService;
  const mockDb = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new DraftManagementService();

    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
    (Timestamp.fromMillis as jest.Mock).mockImplementation((ms) => ({
      toMillis: () => ms,
    }));
    (collection as jest.Mock).mockReturnValue({});
    (doc as jest.Mock).mockImplementation((db, ...pathSegments) => ({
      ref: `${pathSegments.join('/')}`,
    }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('saveDraft', () => {
    it('should debounce draft saves for 5 seconds by default', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

      // Start save
      const savePromise = service.saveDraft('conv123', 'msg456', 'Draft text', 85, 1);

      // Advance time by 3 seconds (should not save yet)
      jest.advanceTimersByTime(3000);
      await Promise.resolve(); // Let promises resolve

      // Verify setDoc not called yet
      expect(setDoc).not.toHaveBeenCalled();

      // Advance time by 2 more seconds (total 5 seconds)
      jest.advanceTimersByTime(2000);

      // Wait for save to complete
      const result = await savePromise;

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous debounced save when new save is triggered', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

      // First save
      service.saveDraft('conv123', 'msg456', 'First draft', 85, 1);

      // Advance time by 2 seconds
      jest.advanceTimersByTime(2000);

      // Second save (should cancel first)
      const savePromise = service.saveDraft('conv123', 'msg456', 'Second draft', 85, 1);

      // Advance time by 5 seconds
      jest.advanceTimersByTime(5000);
      await savePromise;

      // Should only have saved once (the second draft)
      expect(setDoc).toHaveBeenCalledTimes(1);
      const saveCall = (setDoc as jest.Mock).mock.calls[0];
      expect(saveCall[1].draftText).toBe('Second draft');
    });

    it('should save immediately when debounceMs is 0', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

      const result = await service.saveDraft('conv123', 'msg456', 'Immediate draft', 85, 1, 0);

      expect(result.success).toBe(true);
      expect(result.draftId).toBe('pending'); // Indicates immediate resolution
    });

    it('should deactivate previous drafts before saving new one', async () => {
      const mockPreviousDraft = {
        id: 'old_draft',
        ref: 'mock_ref',
      };

      (getDocs as jest.Mock).mockResolvedValue({
        docs: [mockPreviousDraft],
        empty: false,
      });
      (setDoc as jest.Mock).mockResolvedValue(undefined);

      const savePromise = service.saveDraft('conv123', 'msg456', 'New draft', 85, 2);

      // Advance time to trigger save
      jest.advanceTimersByTime(5000);
      await savePromise;

      // Should have called setDoc twice: once to deactivate, once to save new
      expect(setDoc).toHaveBeenCalledTimes(2);
      expect(setDoc).toHaveBeenCalledWith(mockPreviousDraft.ref, { isActive: false }, { merge: true });
    });

    it('should set 7-day TTL expiration on saved drafts', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

      const savePromise = service.saveDraft('conv123', 'msg456', 'Draft with TTL', 85, 1);

      jest.advanceTimersByTime(5000);
      await savePromise;

      const saveCall = (setDoc as jest.Mock).mock.calls[0];
      const draftData = saveCall[1];

      expect(draftData.expiresAt).toBeDefined();
      // expiresAt should be 7 days from now
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(draftData.expiresAt.toMillis()).toBeCloseTo(Date.now() + sevenDays, -3);
    });

    it('should handle save errors gracefully', async () => {
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });
      (setDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

      const savePromise = service.saveDraft('conv123', 'msg456', 'Error draft', 85, 1);

      jest.advanceTimersByTime(5000);
      const result = await savePromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain('Firestore error');
    });
  });

  describe('restoreDraft', () => {
    it('should restore the most recent active draft', async () => {
      const mockDraft = {
        id: 'draft_123',
        data: () => ({
          messageId: 'msg456',
          conversationId: 'conv123',
          draftText: 'Restored draft text',
          confidence: 85,
          version: 1,
          isActive: true,
        }),
      };

      (getDocs as jest.Mock).mockResolvedValue({
        docs: [mockDraft],
        empty: false,
      });

      const result = await service.restoreDraft('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.draft).toBeDefined();
      expect(result.draft?.draftText).toBe('Restored draft text');
      expect(result.draft?.id).toBe('draft_123');
    });

    it('should return undefined draft when no active draft exists', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [],
        empty: true,
      });

      const result = await service.restoreDraft('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.draft).toBeUndefined();
    });

    it('should handle restore errors gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Query error'));

      const result = await service.restoreDraft('conv123', 'msg456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Query error');
    });
  });

  describe('getDraftHistory', () => {
    it('should return all draft versions ordered by version', async () => {
      const mockDrafts = [
        {
          id: 'draft_v1',
          data: () => ({
            messageId: 'msg456',
            version: 1,
            draftText: 'Version 1',
            confidence: 80,
          }),
        },
        {
          id: 'draft_v2',
          data: () => ({
            messageId: 'msg456',
            version: 2,
            draftText: 'Version 2',
            confidence: 85,
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDrafts,
        empty: false,
      });

      const result = await service.getDraftHistory('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.drafts).toHaveLength(2);
      expect(result.drafts?.[0].version).toBe(1);
      expect(result.drafts?.[1].version).toBe(2);
    });

    it('should return empty array when no draft history exists', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [],
        empty: true,
      });

      const result = await service.getDraftHistory('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(result.drafts).toEqual([]);
    });
  });

  describe('clearDrafts', () => {
    it('should delete all drafts for a message', async () => {
      const mockDrafts = [
        { id: 'draft_1', ref: 'ref_1' },
        { id: 'draft_2', ref: 'ref_2' },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        docs: mockDrafts,
        empty: false,
      });
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await service.clearDrafts('conv123', 'msg456');

      expect(result.success).toBe(true);
      expect(deleteDoc).toHaveBeenCalledTimes(2);
      expect(deleteDoc).toHaveBeenCalledWith('ref_1');
      expect(deleteDoc).toHaveBeenCalledWith('ref_2');
    });

    it('should cancel pending debounced saves before clearing', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });
      (deleteDoc as jest.Mock).mockResolvedValue(undefined);

      // Start a debounced save
      service.saveDraft('conv123', 'msg456', 'Draft to cancel', 85, 1);

      // Clear drafts before save completes
      await service.clearDrafts('conv123', 'msg456');

      // Advance time past debounce
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // setDoc should not have been called (save was cancelled)
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('should handle clear errors gracefully', async () => {
      (getDocs as jest.Mock).mockRejectedValue(new Error('Delete error'));

      const result = await service.clearDrafts('conv123', 'msg456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Delete error');
    });
  });

  describe('cancelDebouncedSave', () => {
    it('should cancel pending debounced save', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDocs as jest.Mock).mockResolvedValue({ docs: [], empty: true });

      // Start a debounced save
      service.saveDraft('conv123', 'msg456', 'Draft to cancel', 85, 1);

      // Cancel it
      service.cancelDebouncedSave('conv123', 'msg456');

      // Advance time past debounce
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // setDoc should not have been called
      expect(setDoc).not.toHaveBeenCalled();
    });
  });
});
