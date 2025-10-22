/**
 * Zustand store for managing conversation state
 *
 * @remarks
 * Centralized state management for conversations across the app.
 * Stores the list of conversations, active conversation, and loading state.
 */

import { create } from 'zustand';
import type { Conversation } from '@/types/models';

/**
 * Conversation store state and actions interface
 *
 * @remarks
 * Defines the shape of the conversation store including both state and actions.
 */
interface ConversationState {
  /** Array of all conversations for the current user */
  conversations: Conversation[];

  /** ID of the currently active/selected conversation (null if none selected) */
  activeConversationId: string | null;

  /** Loading state for conversations (true while fetching initial data) */
  conversationLoading: boolean;

  /**
   * Sets the entire conversations array
   *
   * @param conversations - New array of conversations to store
   *
   * @example
   * ```typescript
   * const { setConversations } = useConversationStore();
   * setConversations(updatedConversations);
   * ```
   */
  setConversations: (conversations: Conversation[]) => void;

  /**
   * Sets the active conversation ID
   *
   * @param id - Conversation ID to set as active, or null to clear
   *
   * @example
   * ```typescript
   * const { setActiveConversation } = useConversationStore();
   * setActiveConversation('user123_user456');
   * ```
   */
  setActiveConversation: (id: string | null) => void;

  /**
   * Updates a specific conversation with partial data
   *
   * @param id - ID of the conversation to update
   * @param updates - Partial conversation data to merge
   *
   * @remarks
   * Finds the conversation by ID and merges the updates.
   * Preserves all other conversation data.
   *
   * @example
   * ```typescript
   * const { updateConversation } = useConversationStore();
   * updateConversation('conv123', {
   *   unreadCount: { user123: 0 }
   * });
   * ```
   */
  updateConversation: (id: string, updates: Partial<Conversation>) => void;

  /**
   * Sets the loading state
   *
   * @param loading - New loading state
   *
   * @example
   * ```typescript
   * const { setLoading } = useConversationStore();
   * setLoading(true);
   * ```
   */
  setLoading: (loading: boolean) => void;
}

/**
 * Zustand store hook for conversation state management
 *
 * @remarks
 * Use this hook in components to access and modify conversation state.
 * The store automatically handles state updates and triggers re-renders.
 *
 * @example
 * ```typescript
 * function ConversationList() {
 *   const { conversations, conversationLoading } = useConversationStore();
 *
 *   if (conversationLoading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   return (
 *     <FlatList
 *       data={conversations}
 *       renderItem={({ item }) => <ConversationItem conversation={item} />}
 *     />
 *   );
 * }
 * ```
 */
export const useConversationStore = create<ConversationState>((set) => ({
  // Initial state
  conversations: [],
  activeConversationId: null,
  conversationLoading: false,

  // Actions
  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === id ? { ...conv, ...updates } : conv
      ),
    })),

  setLoading: (loading) => set({ conversationLoading: loading }),
}));
