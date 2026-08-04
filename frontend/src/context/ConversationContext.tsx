import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import type { Conversation, Message } from '../types';
import { api } from '../services/api';
import { useRequest } from 'ahooks';

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
          msg.id === action.payload.id ? { ...msg, ...action.payload.updates } : msg
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

  // 用 ref 追踪 state，避免 callback 依赖 state 导致循环重建
  const currentConversationIdRef = useRef<string | null>(null);
  currentConversationIdRef.current = state.currentConversationId;
  const conversationsRef = useRef<Conversation[]>([]);
  conversationsRef.current = state.conversations;

  // ---------- useRequest：会话列表 ----------
  const { run: fetchConversations } = useRequest(api.getConversations, {
    manual: true,
    onSuccess: (conversations) => {
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
    },
  });

  // ---------- useRequest：消息列表 ----------
  const { run: fetchMessages } = useRequest(api.getMessages, {
    manual: true,
    onBefore: () => dispatch({ type: 'SET_LOADING', payload: true }),
    onSuccess: (messages) => {
      dispatch({ type: 'SET_MESSAGES', payload: messages });
    },
    onFinally: () => dispatch({ type: 'SET_LOADING', payload: false }),
  });

  // ---------- 业务方法 ----------

  const switchConversation = useCallback(
    async (id: string) => {
      dispatch({ type: 'SET_CURRENT_CONVERSATION', payload: id });
      await fetchMessages(id);
    },
    [fetchMessages]
  );

  const createConversation = useCallback(async (): Promise<Conversation> => {
    const conversation = await api.createConversation();
    dispatch({
      type: 'SET_CONVERSATIONS',
      payload: [...conversationsRef.current, conversation],
    });
    await switchConversation(conversation.id);
    return conversation;
  }, [switchConversation]);

  const loadConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      await fetchMessages(conversationId);
    },
    [fetchMessages]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await api.deleteConversation(id);
      const newConversations = conversationsRef.current.filter((c) => c.id !== id);
      dispatch({ type: 'SET_CONVERSATIONS', payload: newConversations });

      if (currentConversationIdRef.current === id) {
        if (newConversations.length > 0) {
          await switchConversation(newConversations[0].id);
        } else {
          await createConversation();
        }
      }
    },
    [switchConversation, createConversation]
  );

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    dispatch({ type: 'UPDATE_MESSAGE', payload: { id, updates } });
  }, []);

  // ---------- 初始化：useRequest 自动处理 StrictMode 双重调用 ----------
  useRequest(api.getConversations, {
    onSuccess: async (conversations) => {
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
      if (conversations.length > 0 && !currentConversationIdRef.current) {
        await switchConversation(conversations[0].id);
      } else if (conversations.length === 0) {
        await createConversation();
      }
    },
  });

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
