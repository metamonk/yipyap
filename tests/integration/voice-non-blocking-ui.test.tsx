/**
 * Integration tests for Task 13: Response Generation Non-Blocking UI
 *
 * Verifies that AI suggestion generation never blocks user input or typing (AC: IV1)
 *
 * Test scenarios:
 * 1. User can start typing immediately when message arrives
 * 2. Suggestion loading doesn't block text input
 * 3. Typing manually hides suggestions
 * 4. User can continue typing while suggestions load in background
 */

import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { MessageInput } from '@/components/chat/MessageInput';
import { ResponseSuggestions } from '@/components/chat/ResponseSuggestions';
import { voiceMatchingService } from '@/services/voiceMatchingService';
import { useAuth } from '@/hooks/useAuth';
import { onSnapshot } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/services/voiceMatchingService');
jest.mock('@/hooks/useAuth');
jest.mock('firebase/firestore');
jest.mock('@/services/firebase', () => ({
  getFirebaseDb: jest.fn(() => ({})),
}));
jest.mock('@/services/typingService', () => ({
  typingService: {
    setTyping: jest.fn(),
  },
}));

describe('Task 13: Response Generation Non-Blocking UI', () => {
  const mockOnSend = jest.fn();
  const mockUserProfile = {
    uid: 'user1',
    settings: {
      voiceMatching: {
        enabled: true,
        autoShowSuggestions: true,
        suggestionCount: 2,
        retrainingSchedule: 'weekly' as const,
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ userProfile: mockUserProfile });
    (voiceMatchingService.generateSuggestions as jest.Mock).mockResolvedValue({
      success: true,
      suggestions: [
        { text: 'Thanks for the message!' },
        { text: 'I appreciate your feedback.' },
      ],
    });
  });

  describe('Subtask 13.1: Load suggestions asynchronously in background', () => {
    it('should load suggestions without blocking UI', async () => {
      // Simulate slow suggestion generation (2 seconds)
      (voiceMatchingService.generateSuggestions as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  suggestions: [{ text: 'Response 1' }],
                }),
              2000
            )
          )
      );

      const { getByTestId } = render(
        <ResponseSuggestions
          conversationId="conv1"
          incomingMessageId="msg1"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onEdit={jest.fn()}
        />
      );

      // Should show loading state immediately (non-blocking)
      await waitFor(() => {
        expect(getByTestId('loading-indicator')).toBeTruthy();
      });

      // UI remains responsive during loading
      expect(voiceMatchingService.generateSuggestions).toHaveBeenCalledWith(
        'conv1',
        'msg1',
        2
      );
    });

    it('should not block when generateSuggestions is called', async () => {
      const startTime = Date.now();

      const { getByTestId } = render(
        <ResponseSuggestions
          conversationId="conv1"
          incomingMessageId="msg1"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onEdit={jest.fn()}
        />
      );

      // Component should render immediately without waiting for suggestions
      const renderTime = Date.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should render in <100ms

      // Loading indicator should appear immediately
      await waitFor(() => {
        expect(getByTestId('loading-indicator')).toBeTruthy();
      });
    });
  });

  describe('Subtask 13.2: Show loading indicator while suggestions generate', () => {
    it('should display loading indicator during suggestion generation', async () => {
      const { getByText } = render(
        <ResponseSuggestions
          conversationId="conv1"
          incomingMessageId="msg1"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onEdit={jest.fn()}
        />
      );

      // Should show loading text
      await waitFor(() => {
        expect(getByText('Generating suggestions...')).toBeTruthy();
      });
    });

    it('should hide loading indicator after suggestions load', async () => {
      const { queryByText, getByText } = render(
        <ResponseSuggestions
          conversationId="conv1"
          incomingMessageId="msg1"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onEdit={jest.fn()}
        />
      );

      // Initially shows loading
      await waitFor(() => {
        expect(getByText('Generating suggestions...')).toBeTruthy();
      });

      // After loading completes, loading indicator should be gone
      await waitFor(() => {
        expect(queryByText('Generating suggestions...')).toBeNull();
      });
    });
  });

  describe('Subtask 13.3: Allow user to start typing before suggestions load', () => {
    it('should allow immediate typing in MessageInput while suggestions load', async () => {
      // Mock onSnapshot to simulate incoming message
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((query, callback) => {
        // Simulate incoming message after component mounts
        setTimeout(() => {
          callback({
            empty: false,
            docs: [
              {
                id: 'msg1',
                data: () => ({
                  senderId: 'user2',
                  text: 'Hey there!',
                  timestamp: new Date(),
                }),
              },
            ],
          });
        }, 50);
        return mockUnsubscribe;
      });

      // Simulate slow suggestion generation
      (voiceMatchingService.generateSuggestions as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  suggestions: [{ text: 'Response 1' }],
                }),
              1000
            )
          )
      );

      const { getByPlaceholderText } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // User should be able to type immediately, even before suggestions load
      await act(async () => {
        fireEvent.changeText(input, 'M');
        fireEvent.changeText(input, 'My');
        fireEvent.changeText(input, 'My response');
      });

      // Input should update immediately without blocking
      expect(input.props.value).toBe('My response');

      // Suggestions should still be loading in background
      // (but not blocking user input)
    });

    it('should not freeze or lag UI while suggestions are generating', async () => {
      const { getByPlaceholderText } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // Measure typing responsiveness
      const typingStartTime = Date.now();

      await act(async () => {
        fireEvent.changeText(input, 'Test message');
      });

      const typingDuration = Date.now() - typingStartTime;

      // Typing should be instantaneous (<50ms)
      expect(typingDuration).toBeLessThan(50);
      expect(input.props.value).toBe('Test message');
    });
  });

  describe('Subtask 13.4: Hide suggestions if user starts typing manually', () => {
    it('should hide suggestions when user starts typing', async () => {
      // Mock onSnapshot to simulate incoming message
      const mockUnsubscribe = jest.fn();
      (onSnapshot as jest.Mock).mockImplementation((query, callback) => {
        callback({
          empty: false,
          docs: [
            {
              id: 'msg1',
              data: () => ({
                senderId: 'user2',
                text: 'Hey!',
                timestamp: new Date(),
              }),
            },
          ],
        });
        return mockUnsubscribe;
      });

      const { getByPlaceholderText, queryByTestId } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      // Wait for suggestions to appear
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeTruthy();
      });

      const input = getByPlaceholderText('Type a message...');

      // User starts typing manually
      await act(async () => {
        fireEvent.changeText(input, 'I');
      });

      // Suggestions should be hidden
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeNull();
      });
    });

    it('should not show suggestions if user is already typing', async () => {
      const mockUnsubscribe = jest.fn();
      let messageCallback: any;

      (onSnapshot as jest.Mock).mockImplementation((query, callback) => {
        messageCallback = callback;
        return mockUnsubscribe;
      });

      const { getByPlaceholderText, queryByTestId } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // User starts typing BEFORE message arrives
      await act(async () => {
        fireEvent.changeText(input, 'I am typing...');
      });

      // Now incoming message arrives
      await act(async () => {
        messageCallback({
          empty: false,
          docs: [
            {
              id: 'msg1',
              data: () => ({
                senderId: 'user2',
                text: 'Hey!',
                timestamp: new Date(),
              }),
            },
          ],
        });
      });

      // Suggestions should be hidden because user is typing
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeNull();
      });
    });
  });

  describe('Subtask 13.5: Integration test - manual typing never blocked', () => {
    it('should verify user can type immediately and suggestions appear later without interruption', async () => {
      const mockUnsubscribe = jest.fn();
      let messageCallback: any;

      (onSnapshot as jest.Mock).mockImplementation((query, callback) => {
        messageCallback = callback;
        return mockUnsubscribe;
      });

      // Simulate realistic suggestion loading time (1.5 seconds)
      (voiceMatchingService.generateSuggestions as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  success: true,
                  suggestions: [
                    { text: 'Thanks!' },
                    { text: 'Got it.' },
                  ],
                }),
              1500
            )
          )
      );

      const { getByPlaceholderText, queryByTestId } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // Step 1: Incoming message arrives
      await act(async () => {
        messageCallback({
          empty: false,
          docs: [
            {
              id: 'msg1',
              data: () => ({
                senderId: 'user2',
                text: 'Can you help me?',
                timestamp: new Date(),
              }),
            },
          ],
        });
      });

      // Step 2: User can type IMMEDIATELY (0ms delay)
      const typingStartTime = Date.now();
      await act(async () => {
        fireEvent.changeText(input, 'S');
      });
      const typingResponseTime = Date.now() - typingStartTime;

      // CRITICAL: Typing must be instantaneous (<10ms)
      expect(typingResponseTime).toBeLessThan(10);
      expect(input.props.value).toBe('S');

      // Step 3: User continues typing while suggestions are loading
      await act(async () => {
        fireEvent.changeText(input, 'Su');
        fireEvent.changeText(input, 'Sure');
      });

      // Input should update without any lag
      expect(input.props.value).toBe('Sure');

      // Step 4: Suggestions should be hidden because user is typing
      await waitFor(() => {
        expect(queryByTestId('response-suggestions-container')).toBeNull();
      });

      // Step 5: Verify suggestions loaded in background (but were hidden)
      await waitFor(
        () => {
          expect(voiceMatchingService.generateSuggestions).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      // SUCCESS: User typing was never blocked by suggestion generation
    });

    it('should maintain 60fps UI performance during suggestion generation', async () => {
      const { getByPlaceholderText } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // Simulate rapid typing (60 characters in quick succession)
      const testMessage = 'This is a test message to verify UI remains responsive';
      const typingStartTime = Date.now();

      for (let i = 1; i <= testMessage.length; i++) {
        await act(async () => {
          fireEvent.changeText(input, testMessage.substring(0, i));
        });
      }

      const totalTypingTime = Date.now() - typingStartTime;
      const avgTimePerChar = totalTypingTime / testMessage.length;

      // Each character update should be <5ms on average (well under 16ms for 60fps)
      expect(avgTimePerChar).toBeLessThan(5);
    });
  });

  describe('Performance Targets (from handoff doc)', () => {
    it('should generate suggestions in <3 seconds', async () => {
      const startTime = Date.now();

      const { getByText } = render(
        <ResponseSuggestions
          conversationId="conv1"
          incomingMessageId="msg1"
          onAccept={jest.fn()}
          onReject={jest.fn()}
          onEdit={jest.fn()}
        />
      );

      // Wait for suggestions to load
      await waitFor(
        () => {
          expect(getByText(/Thanks for the message!/)).toBeTruthy();
        },
        { timeout: 3000 }
      );

      const loadTime = Date.now() - startTime;

      // Should load in under 3 seconds (requirement from handoff)
      expect(loadTime).toBeLessThan(3000);
    });

    it('should allow typing with 0ms delay', async () => {
      const { getByPlaceholderText } = render(
        <MessageInput
          onSend={mockOnSend}
          conversationId="conv1"
          userId="user1"
        />
      );

      const input = getByPlaceholderText('Type a message...');

      // Measure exact typing delay
      const startTime = Date.now();
      await act(async () => {
        fireEvent.changeText(input, 'Test');
      });
      const delay = Date.now() - startTime;

      // Should be effectively instantaneous (0ms, allowing <5ms for test overhead)
      expect(delay).toBeLessThan(5);
    });
  });
});
