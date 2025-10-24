/**
 * Unit Tests for FAQ Service
 * @module tests/unit/services/faqService.test
 *
 * Tests the FAQ service layer including:
 * - Creating FAQ templates with embedding generation
 * - Updating templates with re-embedding
 * - Deleting templates
 * - Real-time subscriptions
 * - Toggling active status
 * - Input validation
 * - Error handling
 */

import {
  createFAQTemplate,
  updateFAQTemplate,
  deleteFAQTemplate,
  subscribeFAQTemplates,
  toggleFAQActive,
} from '@/services/faqService';

// Mock Firebase modules
jest.mock('firebase/firestore');
jest.mock('firebase/functions');
jest.mock('@/services/firebase');

import * as firestore from 'firebase/firestore';
import * as functions from 'firebase/functions';
import * as firebase from '@/services/firebase';

describe('faqService', () => {
  let mockDb: any;
  let mockAuth: any;
  let mockFunctions: any;
  let mockCurrentUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock current user
    mockCurrentUser = {
      uid: 'user123',
      email: 'user@example.com',
    };

    // Mock auth
    mockAuth = {
      currentUser: mockCurrentUser,
    };

    // Mock Firestore
    mockDb = {};

    // Mock Functions
    mockFunctions = {};

    // Setup mocks
    (firebase.getFirebaseAuth as jest.Mock).mockReturnValue(mockAuth);
    (firebase.getFirebaseDb as jest.Mock).mockReturnValue(mockDb);
    (firebase.getFunctions as jest.Mock).mockReturnValue(mockFunctions);
  });

  describe('createFAQTemplate', () => {
    it('should create FAQ template with valid input', async () => {
      const input = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing', 'rates'],
        category: 'pricing',
      };

      const mockDocRef = { id: 'faq123' };
      const mockCollectionRef = {};

      (firestore.collection as jest.Mock).mockReturnValue(mockCollectionRef);
      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.setDoc as jest.Mock).mockResolvedValue(undefined);

      // Mock Cloud Function call
      const mockCallable = jest.fn().mockResolvedValue({
        data: {
          success: true,
          embeddingDimension: 1536,
        },
      });
      (functions.httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await createFAQTemplate(input);

      expect(result.template.question).toBe(input.question);
      expect(result.template.answer).toBe(input.answer);
      expect(result.template.creatorId).toBe('user123');
      expect(result.template.useCount).toBe(0);
      expect(result.template.isActive).toBe(true);
      expect(result.embeddingTriggered).toBe(true);
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      const input = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow(
        'User must be authenticated to create FAQ templates'
      );
    });

    it('should throw error when question is empty', async () => {
      const input = {
        question: '',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow('Question is required');
    });

    it('should throw error when question exceeds 500 characters', async () => {
      const input = {
        question: 'a'.repeat(501),
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow(
        'Question must be 500 characters or less'
      );
    });

    it('should throw error when answer is empty', async () => {
      const input = {
        question: 'What are your rates?',
        answer: '',
        keywords: ['pricing'],
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow('Answer is required');
    });

    it('should throw error when answer exceeds 2000 characters', async () => {
      const input = {
        question: 'What are your rates?',
        answer: 'a'.repeat(2001),
        keywords: ['pricing'],
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow(
        'Answer must be 2000 characters or less'
      );
    });

    it('should throw error when category is empty', async () => {
      const input = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: '',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow('Category is required');
    });

    it('should throw error when keywords is not an array', async () => {
      const input: any = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: 'pricing',
        category: 'pricing',
      };

      await expect(createFAQTemplate(input)).rejects.toThrow('Keywords must be an array');
    });

    it('should handle embedding generation failure gracefully', async () => {
      const input = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: 'pricing',
      };

      const mockDocRef = { id: 'faq123' };
      (firestore.collection as jest.Mock).mockReturnValue({});
      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.setDoc as jest.Mock).mockResolvedValue(undefined);

      // Mock Cloud Function failure
      const mockCallable = jest.fn().mockResolvedValue({
        data: {
          success: false,
          error: 'OpenAI API error',
        },
      });
      (functions.httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await createFAQTemplate(input);

      expect(result.template.id).toBe('faq123');
      expect(result.embeddingTriggered).toBe(false);
      expect(result.embeddingError).toContain('OpenAI API error');
    });

    it('should respect custom isActive setting', async () => {
      const input = {
        question: 'What are your rates?',
        answer: 'My rates start at $100 per hour.',
        keywords: ['pricing'],
        category: 'pricing',
        isActive: false,
      };

      const mockDocRef = { id: 'faq123' };
      (firestore.collection as jest.Mock).mockReturnValue({});
      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.setDoc as jest.Mock).mockResolvedValue(undefined);

      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: true },
      });
      (functions.httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await createFAQTemplate(input);

      expect(result.template.isActive).toBe(false);
    });
  });

  describe('updateFAQTemplate', () => {
    it('should update FAQ template with valid input', async () => {
      const mockDocRef = {};
      const mockDocSnapBefore = {
        exists: () => true,
        data: () => ({
          question: 'Old question',
          answer: 'Old answer',
          keywords: ['old'],
          category: 'old',
          isActive: true,
          creatorId: 'user123',
          useCount: 5,
        }),
      };
      const mockDocSnapAfter = {
        exists: () => true,
        data: () => ({
          question: 'Old question',
          answer: 'Updated answer',
          keywords: ['old'],
          category: 'old',
          isActive: true,
          creatorId: 'user123',
          useCount: 5,
        }),
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnapBefore)
        .mockResolvedValueOnce(mockDocSnapAfter);
      (firestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: true },
      });
      (functions.httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await updateFAQTemplate('faq123', {
        answer: 'Updated answer',
      });

      expect(result.template.answer).toBe('Updated answer');
      expect(result.reEmbeddingTriggered).toBe(false); // No question change
    });

    it('should trigger re-embedding when question is updated', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          question: 'Old question',
          answer: 'Answer',
          keywords: ['key'],
          category: 'cat',
          isActive: true,
          creatorId: 'user123',
          useCount: 5,
        }),
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

      const mockCallable = jest.fn().mockResolvedValue({
        data: { success: true, embeddingDimension: 1536 },
      });
      (functions.httpsCallable as jest.Mock).mockReturnValue(mockCallable);

      const result = await updateFAQTemplate('faq123', {
        question: 'New question',
      });

      expect(result.reEmbeddingTriggered).toBe(true);
    });

    it('should throw error when template not found', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      await expect(
        updateFAQTemplate('faq123', {
          answer: 'Updated answer',
        })
      ).rejects.toThrow('FAQ template not found');
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      await expect(
        updateFAQTemplate('faq123', {
          answer: 'Updated answer',
        })
      ).rejects.toThrow('User must be authenticated to update FAQ templates');
    });

    it('should throw error when question is empty', async () => {
      await expect(
        updateFAQTemplate('faq123', {
          question: '   ',
        })
      ).rejects.toThrow('Question cannot be empty');
    });

    it('should throw error when answer is empty', async () => {
      await expect(
        updateFAQTemplate('faq123', {
          answer: '   ',
        })
      ).rejects.toThrow('Answer cannot be empty');
    });
  });

  describe('deleteFAQTemplate', () => {
    it('should delete FAQ template successfully', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => true,
        data: () => ({
          question: 'Question',
          creatorId: 'user123',
        }),
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (firestore.deleteDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await deleteFAQTemplate('faq123');

      expect(result.firestoreDeleted).toBe(true);
      expect(firestore.deleteDoc).toHaveBeenCalledWith(mockDocRef);
    });

    it('should throw error when template not found', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      await expect(deleteFAQTemplate('faq123')).rejects.toThrow('FAQ template not found');
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      await expect(deleteFAQTemplate('faq123')).rejects.toThrow(
        'User must be authenticated to delete FAQ templates'
      );
    });

    it('should throw error when templateId is empty', async () => {
      await expect(deleteFAQTemplate('')).rejects.toThrow('Template ID is required');
    });
  });

  describe('subscribeFAQTemplates', () => {
    it('should subscribe to user FAQ templates', () => {
      const mockUnsubscribe = jest.fn();
      const mockQuery = {};

      (firestore.collection as jest.Mock).mockReturnValue({});
      (firestore.query as jest.Mock).mockReturnValue(mockQuery);
      (firestore.where as jest.Mock).mockReturnValue({});
      (firestore.orderBy as jest.Mock).mockReturnValue({});
      (firestore.onSnapshot as jest.Mock).mockReturnValue(mockUnsubscribe);

      const onUpdate = jest.fn();
      const unsubscribe = subscribeFAQTemplates('user123', onUpdate);

      expect(firestore.query).toHaveBeenCalled();
      expect(firestore.where).toHaveBeenCalledWith('creatorId', '==', 'user123');
      expect(firestore.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(typeof unsubscribe).toBe('function');
    });

    it('should call onUpdate with templates on snapshot', () => {
      const mockDocs = [
        {
          id: 'faq1',
          data: () => ({
            question: 'Q1',
            answer: 'A1',
            creatorId: 'user123',
          }),
        },
        {
          id: 'faq2',
          data: () => ({
            question: 'Q2',
            answer: 'A2',
            creatorId: 'user123',
          }),
        },
      ];

      const mockSnapshot = {
        docs: mockDocs,
      };

      let snapshotCallback: any;
      (firestore.collection as jest.Mock).mockReturnValue({});
      (firestore.query as jest.Mock).mockReturnValue({});
      (firestore.where as jest.Mock).mockReturnValue({});
      (firestore.orderBy as jest.Mock).mockReturnValue({});
      (firestore.onSnapshot as jest.Mock).mockImplementation((query, onSuccess) => {
        snapshotCallback = onSuccess;
        return jest.fn();
      });

      const onUpdate = jest.fn();
      subscribeFAQTemplates('user123', onUpdate);

      // Trigger snapshot callback
      snapshotCallback(mockSnapshot);

      expect(onUpdate).toHaveBeenCalledWith([
        { id: 'faq1', question: 'Q1', answer: 'A1', creatorId: 'user123' },
        { id: 'faq2', question: 'Q2', answer: 'A2', creatorId: 'user123' },
      ]);
    });

    it('should throw error when userId is empty', () => {
      expect(() => {
        subscribeFAQTemplates('', jest.fn());
      }).toThrow('User ID is required');
    });
  });

  describe('toggleFAQActive', () => {
    it('should toggle FAQ template to inactive', async () => {
      const mockDocRef = {};
      const mockDocSnapBefore = {
        exists: () => true,
        data: () => ({
          question: 'Question',
          answer: 'Answer',
          isActive: true,
          creatorId: 'user123',
        }),
      };
      const mockDocSnapAfter = {
        exists: () => true,
        data: () => ({
          question: 'Question',
          answer: 'Answer',
          isActive: false,
          creatorId: 'user123',
        }),
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnapBefore)
        .mockResolvedValueOnce(mockDocSnapAfter);
      (firestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await toggleFAQActive('faq123', false);

      expect(result.isActive).toBe(false);
      expect(firestore.updateDoc).toHaveBeenCalled();
    });

    it('should toggle FAQ template to active', async () => {
      const mockDocRef = {};
      const mockDocSnapBefore = {
        exists: () => true,
        data: () => ({
          question: 'Question',
          answer: 'Answer',
          isActive: false,
          creatorId: 'user123',
        }),
      };
      const mockDocSnapAfter = {
        exists: () => true,
        data: () => ({
          question: 'Question',
          answer: 'Answer',
          isActive: true,
          creatorId: 'user123',
        }),
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock)
        .mockResolvedValueOnce(mockDocSnapBefore)
        .mockResolvedValueOnce(mockDocSnapAfter);
      (firestore.updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await toggleFAQActive('faq123', true);

      expect(result.isActive).toBe(true);
    });

    it('should throw error when template not found', async () => {
      const mockDocRef = {};
      const mockDocSnap = {
        exists: () => false,
      };

      (firestore.doc as jest.Mock).mockReturnValue(mockDocRef);
      (firestore.getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      await expect(toggleFAQActive('faq123', true)).rejects.toThrow('FAQ template not found');
    });

    it('should throw error when user is not authenticated', async () => {
      mockAuth.currentUser = null;

      await expect(toggleFAQActive('faq123', true)).rejects.toThrow(
        'User must be authenticated to toggle FAQ templates'
      );
    });

    it('should throw error when templateId is empty', async () => {
      await expect(toggleFAQActive('', true)).rejects.toThrow('Template ID is required');
    });

    it('should throw error when isActive is not boolean', async () => {
      await expect(toggleFAQActive('faq123', 'true' as any)).rejects.toThrow(
        'isActive must be a boolean'
      );
    });
  });
});
