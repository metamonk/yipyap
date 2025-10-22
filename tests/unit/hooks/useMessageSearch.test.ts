/**
 * Unit tests for useMessageSearch hook
 *
 * @group unit
 * @group hooks
 */

import { renderHook, act } from '@testing-library/react-native';
import { useMessageSearch } from '@/hooks/useMessageSearch';
import type { Message } from '@/types/models';
import { Timestamp } from 'firebase/firestore';

describe('useMessageSearch', () => {
  // Test data factory
  const createTestMessage = (id: string, text: string): Message => ({
    id,
    conversationId: 'test-conv-1',
    senderId: 'test-user-1',
    text,
    status: 'delivered',
    readBy: ['test-user-1'],
    timestamp: Timestamp.now(),
    metadata: {},
  });

  const testMessages: Message[] = [
    createTestMessage('msg-1', 'Hello world'),
    createTestMessage('msg-2', 'Good morning everyone'),
    createTestMessage('msg-3', 'The quick brown fox'),
    createTestMessage('msg-4', 'HELLO EVERYONE'),
  ];

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    expect(result.current.searchResults).toEqual(testMessages);
    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(typeof result.current.searchMessages).toBe('function');
    expect(typeof result.current.clearSearch).toBe('function');
  });

  it('should update search query and filter results', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    act(() => {
      result.current.searchMessages('hello');
    });

    expect(result.current.searchQuery).toBe('hello');
    expect(result.current.isSearching).toBe(true);
    expect(result.current.searchResults).toHaveLength(2);
    expect(result.current.searchResults[0].id).toBe('msg-1');
    expect(result.current.searchResults[1].id).toBe('msg-4');
  });

  it('should return all messages when query is empty', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    act(() => {
      result.current.searchMessages('');
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResults).toEqual(testMessages);
    expect(result.current.searchResults).toHaveLength(4);
  });

  it('should clear search query and reset results', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    // First, set a search query
    act(() => {
      result.current.searchMessages('hello');
    });

    expect(result.current.isSearching).toBe(true);
    expect(result.current.searchResults).toHaveLength(2);

    // Then clear search
    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchResults).toEqual(testMessages);
  });

  it('should update results when messages prop changes', () => {
    const { result, rerender } = renderHook(({ messages }) => useMessageSearch(messages), {
      initialProps: { messages: testMessages },
    });

    expect(result.current.searchResults).toHaveLength(4);

    // Update messages
    const newMessages = [...testMessages, createTestMessage('msg-5', 'New message')];

    rerender({ messages: newMessages });

    expect(result.current.searchResults).toHaveLength(5);
  });

  it('should update filtered results when messages prop changes during search', () => {
    const { result, rerender } = renderHook(({ messages }) => useMessageSearch(messages), {
      initialProps: { messages: testMessages },
    });

    // Set search query
    act(() => {
      result.current.searchMessages('hello');
    });

    expect(result.current.searchResults).toHaveLength(2);

    // Add a new message that matches the search
    const newMessages = [...testMessages, createTestMessage('msg-5', 'Hello there')];

    rerender({ messages: newMessages });

    // Should now have 3 results
    expect(result.current.searchResults).toHaveLength(3);
  });

  it('should set isSearching to true when query is non-empty', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    act(() => {
      result.current.searchMessages('hello');
    });

    expect(result.current.isSearching).toBe(true);

    act(() => {
      result.current.searchMessages('   '); // Whitespace only
    });

    expect(result.current.isSearching).toBe(false);
  });

  it('should memoize searchMessages function', () => {
    const { result, rerender } = renderHook(({ messages }) => useMessageSearch(messages), {
      initialProps: { messages: testMessages },
    });

    const firstSearchMessages = result.current.searchMessages;

    rerender({ messages: testMessages });

    const secondSearchMessages = result.current.searchMessages;

    expect(firstSearchMessages).toBe(secondSearchMessages);
  });

  it('should memoize clearSearch function', () => {
    const { result, rerender } = renderHook(({ messages }) => useMessageSearch(messages), {
      initialProps: { messages: testMessages },
    });

    const firstClearSearch = result.current.clearSearch;

    rerender({ messages: testMessages });

    const secondClearSearch = result.current.clearSearch;

    expect(firstClearSearch).toBe(secondClearSearch);
  });

  it('should handle rapid search query changes', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    act(() => {
      result.current.searchMessages('h');
      result.current.searchMessages('he');
      result.current.searchMessages('hel');
      result.current.searchMessages('hello');
    });

    expect(result.current.searchQuery).toBe('hello');
    expect(result.current.searchResults).toHaveLength(2);
  });

  it('should return empty results when no matches found', () => {
    const { result } = renderHook(() => useMessageSearch(testMessages));

    act(() => {
      result.current.searchMessages('nonexistent');
    });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(true);
  });

  it('should handle empty messages array', () => {
    const { result } = renderHook(() => useMessageSearch([]));

    act(() => {
      result.current.searchMessages('hello');
    });

    expect(result.current.searchResults).toEqual([]);
    expect(result.current.isSearching).toBe(true);
  });
});
