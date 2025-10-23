/**
 * ConversationCreationContext
 *
 * @remarks
 * Global state management for conversation creation flow.
 * Replaces component-local state management to prevent state chaos
 * and coordinate search state across multiple components.
 * Part of the unified conversation refactor recovery - Phase 2.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { User } from '@/types/user';

interface ConversationCreationState {
  recipients: User[];
  searchQuery: string;
  groupName: string;
  messageText: string;
  isCreating: boolean;
  setRecipients: (recipients: User[]) => void;
  addRecipient: (user: User) => void;
  removeRecipient: (uid: string) => void;
  setSearchQuery: (query: string) => void;
  setGroupName: (name: string) => void;
  setMessageText: (text: string) => void;
  setIsCreating: (creating: boolean) => void;
  resetState: () => void;
}

const ConversationCreationContext = createContext<ConversationCreationState | null>(null);

interface ConversationCreationProviderProps {
  children: ReactNode;
}

/**
 * ConversationCreationProvider manages global state for the conversation creation flow
 *
 * @component
 * @example
 * ```tsx
 * <ConversationCreationProvider>
 *   <NewConversationScreen />
 * </ConversationCreationProvider>
 * ```
 */
export const ConversationCreationProvider: React.FC<ConversationCreationProviderProps> = ({
  children,
}) => {
  const [recipients, setRecipients] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [messageText, setMessageText] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const addRecipient = useCallback((user: User) => {
    setRecipients(prev => {
      // Prevent duplicates
      if (prev.some(r => r.uid === user.uid)) return prev;
      // Enforce maximum of 10 recipients for group chats
      if (prev.length >= 10) return prev;
      return [...prev, user];
    });
  }, []);

  const removeRecipient = useCallback((uid: string) => {
    setRecipients(prev => prev.filter(r => r.uid !== uid));
  }, []);

  const resetState = useCallback(() => {
    setRecipients([]);
    setSearchQuery('');
    setGroupName('');
    setMessageText('');
    setIsCreating(false);
  }, []);

  const value: ConversationCreationState = {
    recipients,
    searchQuery,
    groupName,
    messageText,
    isCreating,
    setRecipients,
    addRecipient,
    removeRecipient,
    setSearchQuery,
    setGroupName,
    setMessageText,
    setIsCreating,
    resetState,
  };

  return (
    <ConversationCreationContext.Provider value={value}>
      {children}
    </ConversationCreationContext.Provider>
  );
};

/**
 * Hook to access conversation creation state
 * @throws Error if used outside of ConversationCreationProvider
 */
export const useConversationCreation = () => {
  const context = useContext(ConversationCreationContext);
  if (!context) {
    throw new Error(
      'useConversationCreation must be used within ConversationCreationProvider'
    );
  }
  return context;
};