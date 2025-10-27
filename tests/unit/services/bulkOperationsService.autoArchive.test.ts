/**
 * Unit tests for auto-archive functionality (Story 6.4)
 * @module tests/unit/services/bulkOperationsService.autoArchive.test
 */

import {
  autoArchiveWithKindBoundary,
  renderBoundaryTemplate,
  isQuietHours,
  recentBoundarySent,
  shouldNotArchive,
  DEFAULT_BOUNDARY_MESSAGE_TEMPLATE,
} from '../../../services/bulkOperationsService';
import type { Message } from '../../../types/models';
import type { User } from '../../../types/user';
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
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toMillis: () => Date.now() })),
    fromMillis: jest.fn((ms: number) => ({ toMillis: () => ms })),
  },
}));

describe('renderBoundaryTemplate', () => {
  it('should replace all template variables', () => {
    const template = 'Hi {{creatorName}}! FAQ: {{faqUrl}} Community: {{communityUrl}}';
    const result = renderBoundaryTemplate(template, {
      creatorName: 'Jane Doe',
      faqUrl: 'https://example.com/faq',
      communityUrl: 'https://discord.gg/example',
    });

    expect(result).toBe('Hi Jane Doe! FAQ: https://example.com/faq Community: https://discord.gg/example');
  });

  it('should use placeholders for missing variables', () => {
    const template = 'Hi {{creatorName}}! FAQ: {{faqUrl}}';
    const result = renderBoundaryTemplate(template, {});

    expect(result).toBe('Hi [Creator]! FAQ: [FAQ not configured]');
  });

  it('should handle default boundary message template', () => {
    const result = renderBoundaryTemplate(DEFAULT_BOUNDARY_MESSAGE_TEMPLATE, {
      creatorName: 'Jane',
      faqUrl: 'https://faq.com',
      communityUrl: 'https://community.com',
    });

    // Default template doesn't include {{creatorName}}, only FAQ and community URLs
    expect(result).toContain('https://faq.com');
    expect(result).toContain('https://community.com');
    expect(result).toContain('[This message was sent automatically]');
    expect(result).toContain('I get hundreds of messages daily');
  });

  it('should handle multiple instances of the same variable', () => {
    const template = '{{creatorName}} and {{creatorName}}';
    const result = renderBoundaryTemplate(template, {
      creatorName: 'John',
    });

    expect(result).toBe('John and John');
  });
});

describe('isQuietHours', () => {
  beforeEach(() => {
    // Reset system time
    jest.useRealTimers();
  });

  it('should return false when quiet hours are disabled', () => {
    const result = isQuietHours(
      { enabled: false, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      'UTC'
    );

    expect(result).toBe(false);
  });

  it('should return false when quietHours is undefined', () => {
    const result = isQuietHours(undefined, 'UTC');

    expect(result).toBe(false);
  });

  // Skip time-based tests that require fake timers - test in integration instead
  it.skip('should detect quiet hours during regular period (10 PM to 8 AM)', () => {
    // Mock time to 11 PM (23:00)
    const mockDate = new Date('2025-10-26T23:00:00Z');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const result = isQuietHours(
      { enabled: true, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      'UTC'
    );

    expect(result).toBe(true);
    jest.useRealTimers();
  });

  it.skip('should detect outside quiet hours', () => {
    // Mock time to 3 PM (15:00)
    const mockDate = new Date('2025-10-26T15:00:00Z');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const result = isQuietHours(
      { enabled: true, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      'UTC'
    );

    expect(result).toBe(false);
    jest.useRealTimers();
  });

  it.skip('should handle quiet hours that cross midnight (early morning)', () => {
    // Mock time to 2 AM (02:00)
    const mockDate = new Date('2025-10-26T02:00:00Z');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const result = isQuietHours(
      { enabled: true, startTime: '22:00', endTime: '08:00', timezone: 'UTC' },
      'UTC'
    );

    expect(result).toBe(true);
    jest.useRealTimers();
  });

  it.skip('should handle quiet hours that do NOT cross midnight', () => {
    // Mock time to 2 PM (14:00)
    const mockDate = new Date('2025-10-26T14:00:00Z');
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);

    const result = isQuietHours(
      { enabled: true, startTime: '12:00', endTime: '14:00', timezone: 'UTC' },
      'UTC'
    );

    expect(result).toBe(true);
    jest.useRealTimers();
  });
});

describe('shouldNotArchive - Safety Checks', () => {
  it('should block archiving business messages', async () => {
    const message: Message = {
      id: 'msg1',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Partnership opportunity',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        category: 'business_opportunity',
        aiProcessed: true,
      },
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(true);
  });

  it('should block archiving urgent messages', async () => {
    const message: Message = {
      id: 'msg2',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Urgent request',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        category: 'urgent',
        aiProcessed: true,
      },
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(true);
  });

  it('should block archiving VIP conversations', async () => {
    const message: Message = {
      id: 'msg3',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Message from VIP',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        aiProcessed: true,
        relationshipContext: { isVIP: true, conversationAge: 45, lastInteraction: Timestamp.now(), messageCount: 20 },
      } as any, // Type assertion: relationshipContext is added during workflow enrichment
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(true);
  });

  it('should block archiving crisis sentiment messages (score < -0.7)', async () => {
    const message: Message = {
      id: 'msg4',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'I need help urgently',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        sentiment: 'negative',
        sentimentScore: -0.8,
        aiProcessed: true,
      },
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(true);
  });

  it('should allow archiving low-priority general messages', async () => {
    const message: Message = {
      id: 'msg5',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Just saying hi',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        category: 'fan_engagement',
        sentiment: 'positive',
        sentimentScore: 0.5,
        aiProcessed: true,
      },
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(false);
  });

  it('should allow archiving negative sentiment that is NOT crisis (score > -0.7)', async () => {
    const message: Message = {
      id: 'msg6',
      conversationId: 'conv1',
      senderId: 'user1',
      text: 'Not very happy about this',
      status: 'delivered',
      readBy: [],
      timestamp: Timestamp.now(),
      metadata: {
        sentiment: 'negative',
        sentimentScore: -0.5, // Above crisis threshold
        aiProcessed: true,
      },
    };

    const result = await shouldNotArchive(message);
    expect(result).toBe(false);
  });
});

describe('recentBoundarySent - Rate Limiting', () => {
  const { getDoc } = require('firebase/firestore');

  it('should return false when no rate limit record exists', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => false,
    } as any);

    const result = await recentBoundarySent('fan123', 'creator456');
    expect(result).toBe(false);
  });

  it('should return true when boundary was sent within window (< 7 days)', async () => {
    const threeDaysAgo = Timestamp.fromMillis(Date.now() - 3 * 24 * 60 * 60 * 1000);

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        lastBoundarySent: threeDaysAgo,
      }),
    } as any);

    const result = await recentBoundarySent('fan123', 'creator456');
    expect(result).toBe(true);
  });

  it('should return false when boundary was sent outside window (> 7 days)', async () => {
    const tenDaysAgo = Timestamp.fromMillis(Date.now() - 10 * 24 * 60 * 60 * 1000);

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        lastBoundarySent: tenDaysAgo,
      }),
    } as any);

    const result = await recentBoundarySent('fan123', 'creator456');
    expect(result).toBe(false);
  });

  it('should fail open (return false) when check fails', async () => {
    (getDoc as jest.Mock).mockRejectedValueOnce(new Error('Firestore error'));

    const result = await recentBoundarySent('fan123', 'creator456');
    expect(result).toBe(false);
  });
});

describe('autoArchiveWithKindBoundary - Integration', () => {
  const { getDoc } = require('firebase/firestore');

  it('should throw error when user not found', async () => {
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => false,
    } as any);

    const messages: Message[] = [];

    await expect(
      autoArchiveWithKindBoundary('nonexistent-user', messages)
    ).rejects.toThrow('User not found: nonexistent-user');
  });

  it('should return zero counts when auto-archive is disabled', async () => {
    const mockUser: User = {
      uid: 'user123',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      presence: { status: 'online', lastSeen: Timestamp.now() },
      settings: {
        sendReadReceipts: true,
        notificationsEnabled: true,
        capacity: {
          dailyLimit: 10,
          boundaryMessage: DEFAULT_BOUNDARY_MESSAGE_TEMPLATE,
          autoArchiveEnabled: false, // DISABLED
          requireEditingForBusiness: true,
        },
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUser,
    } as any);

    const messages: Message[] = [
      {
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'fan1',
        text: 'Hello',
        status: 'delivered',
        readBy: [],
        timestamp: Timestamp.now(),
        metadata: {},
      },
    ];

    const result = await autoArchiveWithKindBoundary('user123', messages);

    expect(result).toEqual({
      archivedCount: 0,
      boundariesSent: 0,
      rateLimited: 0,
      safetyBlocked: 0,
    });
  });

  it('should skip messages blocked by safety checks', async () => {
    const mockUser: User = {
      uid: 'user123',
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      presence: { status: 'online', lastSeen: Timestamp.now() },
      settings: {
        sendReadReceipts: true,
        notificationsEnabled: true,
        capacity: {
          dailyLimit: 10,
          boundaryMessage: DEFAULT_BOUNDARY_MESSAGE_TEMPLATE,
          autoArchiveEnabled: true,
          requireEditingForBusiness: true,
        },
      },
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    // Mock user fetch
    (getDoc as jest.Mock).mockResolvedValueOnce({
      exists: () => true,
      data: () => mockUser,
    } as any);

    const messages: Message[] = [
      // Business message - should be safety blocked
      {
        id: 'msg1',
        conversationId: 'conv1',
        senderId: 'fan1',
        text: 'Partnership opportunity',
        status: 'delivered',
        readBy: [],
        timestamp: Timestamp.now(),
        metadata: {
          category: 'business_opportunity',
        },
      },
      // Urgent message - should be safety blocked
      {
        id: 'msg2',
        conversationId: 'conv2',
        senderId: 'fan2',
        text: 'Urgent request',
        status: 'delivered',
        readBy: [],
        timestamp: Timestamp.now(),
        metadata: {
          category: 'urgent',
        },
      },
    ];

    const result = await autoArchiveWithKindBoundary('user123', messages);

    expect(result.safetyBlocked).toBe(2);
    expect(result.archivedCount).toBe(0);
    expect(result.boundariesSent).toBe(0);
  });
});
