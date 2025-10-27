/**
 * Unit tests for draftAnalyticsService - Edit Tracking (Story 6.2)
 * @remarks
 * Tests draft edit event tracking, edit rate calculations, and override monitoring.
 */

import {
  DraftAnalyticsService,
  DraftEditEvent,
  TrackingResult,
  EditRateMetrics,
} from '@/services/draftAnalyticsService';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseDb } from '@/services/firebase';

// Mock Firebase modules
jest.mock('@/services/firebase');
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(),
  Timestamp: {
    now: jest.fn(),
    fromDate: jest.fn(),
  },
}));

describe('DraftAnalyticsService - Edit Tracking (Story 6.2)', () => {
  let service: DraftAnalyticsService;
  const mockDb = {} as any;
  const mockAuth = {
    currentUser: { uid: 'user123' },
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DraftAnalyticsService();

    (getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (serverTimestamp as jest.Mock).mockReturnValue({ _seconds: Date.now() / 1000 });
    (Timestamp.now as jest.Mock).mockReturnValue({
      toMillis: () => Date.now(),
      toDate: () => new Date(),
    });
    (Timestamp.fromDate as jest.Mock).mockImplementation((date) => ({
      toMillis: () => date.getTime(),
      toDate: () => date,
    }));
    (collection as jest.Mock).mockReturnValue({});
    (doc as jest.Mock).mockReturnValue({ ref: 'mock_ref' });
  });

  describe('trackEditEvent', () => {
    it('should track draft edit event successfully', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: true,
        editCount: 3,
        timeToEdit: 45000,
        requiresEditing: false,
        overrideApplied: false,
        confidence: 85,
        draftVersion: 1,
      };

      const result = await service.trackEditEvent(event);

      expect(result.success).toBe(true);
      expect(setDoc).toHaveBeenCalledTimes(2); // Event doc + aggregate metrics
    });

    it('should track edit metadata including wasEdited and editCount', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: true,
        editCount: 5,
        timeToEdit: 60000,
        requiresEditing: true,
        overrideApplied: false,
        confidence: 75,
        draftVersion: 1,
      };

      await service.trackEditEvent(event);

      // Verify event doc contains all required fields
      const eventDocCall = (setDoc as jest.Mock).mock.calls[0];
      const eventData = eventDocCall[1];

      expect(eventData.wasEdited).toBe(true);
      expect(eventData.editCount).toBe(5);
      expect(eventData.timeToEdit).toBe(60000);
      expect(eventData.requiresEditing).toBe(true);
      expect(eventData.confidence).toBe(75);
    });

    it('should track override events when user bypasses "requires editing"', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false,
      });

      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: false,
        editCount: 0,
        timeToEdit: 5000,
        requiresEditing: true, // Required editing
        overrideApplied: true, // But user overrode it
        confidence: 85,
        draftVersion: 1,
      };

      await service.trackEditEvent(event);

      const eventDocCall = (setDoc as jest.Mock).mock.calls[0];
      const eventData = eventDocCall[1];

      expect(eventData.overrideApplied).toBe(true);
      expect(eventData.requiresEditing).toBe(true);
      expect(eventData.wasEdited).toBe(false);
    });

    it('should update aggregate metrics after each event', async () => {
      (setDoc as jest.Mock).mockResolvedValue(undefined);
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => true,
        data: () => ({
          totalDrafts: 10,
          draftsEdited: 7,
          averageEditCount: 2.5,
          averageTimeToEdit: 30000,
          overridesApplied: 1,
        }),
      });

      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: true,
        editCount: 4,
        timeToEdit: 50000,
        requiresEditing: false,
        overrideApplied: false,
        confidence: 85,
        draftVersion: 1,
      };

      await service.trackEditEvent(event);

      // Verify aggregate metrics were updated
      const metricsCall = (setDoc as jest.Mock).mock.calls[1];
      const metricsData = metricsCall[1];

      expect(metricsData.totalDrafts).toBe(11); // 10 + 1
      expect(metricsData.draftsEdited).toBe(8); // 7 + 1
      expect(metricsData.editRate).toBeCloseTo(8 / 11, 5);
    });

    it('should handle unauthenticated user error', async () => {
      (getFirebaseAuth as jest.Mock).mockReturnValue({ currentUser: null });

      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: true,
        editCount: 3,
        timeToEdit: 45000,
        requiresEditing: false,
        overrideApplied: false,
        confidence: 85,
        draftVersion: 1,
      };

      const result = await service.trackEditEvent(event);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('calculateEditRateMetrics', () => {
    it('should calculate edit rate from tracked events', async () => {
      const mockEvents = [
        {
          data: () => ({
            wasEdited: true,
            editCount: 3,
            timeToEdit: 30000,
            overrideApplied: false,
          }),
        },
        {
          data: () => ({
            wasEdited: true,
            editCount: 5,
            timeToEdit: 50000,
            overrideApplied: false,
          }),
        },
        {
          data: () => ({
            wasEdited: false,
            editCount: 0,
            timeToEdit: 5000,
            overrideApplied: false,
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        forEach: (callback: (doc: any) => void) => {
          mockEvents.forEach(callback);
        },
      });

      const metrics = await service.calculateEditRateMetrics('user123', 'daily');

      expect(metrics.totalDrafts).toBe(3);
      expect(metrics.draftsEdited).toBe(2);
      expect(metrics.editRate).toBeCloseTo(2 / 3, 5); // ~0.67
      expect(metrics.averageEditCount).toBe(4); // (3 + 5) / 2
      expect(metrics.averageTimeToEdit).toBe(40000); // (30000 + 50000) / 2
    });

    it('should calculate override rate from tracked events', async () => {
      const mockEvents = [
        {
          data: () => ({
            wasEdited: false,
            editCount: 0,
            timeToEdit: 5000,
            overrideApplied: true,
          }),
        },
        {
          data: () => ({
            wasEdited: true,
            editCount: 3,
            timeToEdit: 30000,
            overrideApplied: false,
          }),
        },
        {
          data: () => ({
            wasEdited: false,
            editCount: 0,
            timeToEdit: 5000,
            overrideApplied: true,
          }),
        },
        {
          data: () => ({
            wasEdited: true,
            editCount: 2,
            timeToEdit: 20000,
            overrideApplied: false,
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValue({
        forEach: (callback: (doc: any) => void) => {
          mockEvents.forEach(callback);
        },
      });

      const metrics = await service.calculateEditRateMetrics('user123', 'weekly');

      expect(metrics.totalDrafts).toBe(4);
      expect(metrics.overridesApplied).toBe(2);
      expect(metrics.overrideRate).toBe(0.5); // 2 / 4
    });

    it('should return zero metrics when no events exist', async () => {
      (getDocs as jest.Mock).mockResolvedValue({
        forEach: (callback: (doc: any) => void) => {
          // No events
        },
      });

      const metrics = await service.calculateEditRateMetrics('user123', 'daily');

      expect(metrics.totalDrafts).toBe(0);
      expect(metrics.draftsEdited).toBe(0);
      expect(metrics.editRate).toBe(0);
      expect(metrics.overrideRate).toBe(0);
    });
  });

  describe('createDraftMetadata', () => {
    it('should create DraftMessageMetadata from edit event', () => {
      const event: DraftEditEvent = {
        messageId: 'msg456',
        conversationId: 'conv123',
        wasEdited: true,
        editCount: 3,
        timeToEdit: 45000,
        requiresEditing: false,
        overrideApplied: false,
        confidence: 85,
        draftVersion: 1,
      };

      const metadata = service.createDraftMetadata(event);

      expect(metadata.isAIDraft).toBe(true);
      expect(metadata.confidence).toBe(85);
      expect(metadata.wasEdited).toBe(true);
      expect(metadata.editCount).toBe(3);
      expect(metadata.timeToEdit).toBe(45000);
      expect(metadata.requiresEditing).toBe(false);
      expect(metadata.overrideApplied).toBe(false);
      expect(metadata.draftVersion).toBe(1);
    });
  });
});
