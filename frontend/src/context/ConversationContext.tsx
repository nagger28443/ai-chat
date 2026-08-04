import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { Conversation, Message } from '../types';
import { api } from '../services/api';

interface ConversationState {
  conversations: Conversation[];
  currentConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
}

type ConversationAction =
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: string | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_MESSAGES' };

function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload };

    case 'SET_CURRENT_CONVERSATION':
      return { ...state, currentConversationId: action.payload };

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };

    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        ),
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'CLEAR_MESSAGES':
      return { ...state, messages: [] };

    default:
      return state;
  }
}

interface ConversationContextType {
  state: ConversationState;
  dispatch: React.Dispatch<ConversationAction>;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  createConversation: () => Promise<Conversation>;
  deleteConversation: (id: string) => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(conversationReducer, {
    conversations: [],
    currentConversationId: null,
    messages: [],
    isLoading: false,
  });

  const loadConversations = useCallback(async () => {
    try {
      const conversations = await api.getConversations();
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });

      // 如果有会话且当前没有选中的，选择第一个
      if (conversations.length > 0 && !state.currentConversationId) {
        await switchConversation(conversations[0].id);
      } else if (conversations.length === 0) {
        // 如果没有会话，创建一个
        await createConversation();
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, [state.currentConversationId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const messages = await api.getMessages(conversationId);
      dispatch({ type: 'SET_MESSAGES', payload: messages });
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const createConversation = useCallback(async () => {
    try {
      const conversation = await api.createConversation();
      dispatch({
        type: 'SET_CONVERSATIONS',
        payload: [...state.conversations, conversation],
      });
      await switchConversation(conversation.id);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }, [state.conversations]);

  const deleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        const newConversations = state.conversations.filter((c) => c.id !== id);
        dispatch({ type: 'SET_CONVERSATIONS', payload: newConversations });

        // 如果删除的是当前会话，切换到第一个
        if (state.currentConversationId === id) {
          if (newConversations.length > 0) {
            await switchConversation(newConversations[0].id);
          } else {
            // 如果没有会话了，创建一个新的
            await createConversation();
          }
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
        throw error;
      }
    },
    [state.conversations, state.currentConversationId, createConversation]
  );

  const switchConversation = useCallback(
    async (id: string) => {
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: id });
      await loadMessages(id);
    },
    [loadMessages]
  );

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
  }, []);

  // 初始化时加载会话
  useEffect(() => {
    loadConversations();
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        state,
        dispatch,
        loadConversations,
        loadMessages,
        createConversation,
        deleteConversation,
        switchConversation,
        addMessage,
        updateMessage,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
}
