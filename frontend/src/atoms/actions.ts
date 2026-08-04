import { atom } from 'jotai';
import {
  conversationsAtom,
  currentConversationIdAtom,
  messagesAtom,
  isLoadingAtom,
} from './conversation';
import { api } from '../services/api';
import type { Message } from '../types';

/**
 * 操作 atoms - 业务逻辑
 */

// 加载会话列表
export const loadConversationsAtom = atom(null, async (_get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);
  return conversations;
});

// 加载消息
export const loadMessagesAtom = atom(
  null,
  async (_get, set, conversationId: string) => {
    set(isLoadingAtom, true);
    try {
      const messages = await api.getMessages(conversationId);
      set(messagesAtom, messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// 切换会话
export const switchConversationAtom = atom(
  null,
  async (get, set, id: string) => {
    set(currentConversationIdAtom, id);
    // 加载该会话的消息
    set(isLoadingAtom, true);
    try {
      const messages = await api.getMessages(id);
      set(messagesAtom, messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      set(isLoadingAtom, false);
    }
  }
);

// 创建新会话
export const createConversationAtom = atom(
  null,
  async (get, set) => {
    const conversation = await api.createConversation();
    const conversations = get(conversationsAtom);
    set(conversationsAtom, [...conversations, conversation]);
    // 切换到新会话
    set(currentConversationIdAtom, conversation.id);
    set(messagesAtom, []);
    return conversation;
  }
);

// 删除会话
export const deleteConversationAtom = atom(
  null,
  async (get, set, id: string) => {
    await api.deleteConversation(id);
    const conversations = get(conversationsAtom).filter((c) => c.id !== id);
    set(conversationsAtom, conversations);

    // 如果删除的是当前会话，切换到第一个或创建新会话
    const currentId = get(currentConversationIdAtom);
    if (currentId === id) {
      if (conversations.length > 0) {
        set(currentConversationIdAtom, conversations[0].id);
        set(isLoadingAtom, true);
        try {
          const messages = await api.getMessages(conversations[0].id);
          set(messagesAtom, messages);
        } finally {
          set(isLoadingAtom, false);
        }
      } else {
        // 没有会话了，创建一个新的
        const newConv = await api.createConversation();
        set(conversationsAtom, [newConv]);
        set(currentConversationIdAtom, newConv.id);
        set(messagesAtom, []);
      }
    }
  }
);

// 添加消息（本地操作）
export const addMessageAtom = atom(null, (get, set, message: Message) => {
  set(messagesAtom, [...get(messagesAtom), message]);
});

// 更新消息（本地操作）
export const updateMessageAtom = atom(
  null,
  (get, set, payload: { id: string; updates: Partial<Message> }) => {
    set(
      messagesAtom,
      get(messagesAtom).map((msg) =>
        msg.id === payload.id ? { ...msg, ...payload.updates } : msg
      )
    );
  }
);

// 初始化：加载会话并自动选择第一个
export const initConversationsAtom = atom(null, async (get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);

  const currentId = get(currentConversationIdAtom);
  if (conversations.length > 0 && !currentId) {
    // 自动选择第一个会话
    const firstId = conversations[0].id;
    set(currentConversationIdAtom, firstId);
    set(isLoadingAtom, true);
    try {
      const messages = await api.getMessages(firstId);
      set(messagesAtom, messages);
    } finally {
      set(isLoadingAtom, false);
    }
  } else if (conversations.length === 0) {
    // 没有会话，创建一个
    const newConv = await api.createConversation();
    set(conversationsAtom, [newConv]);
    set(currentConversationIdAtom, newConv.id);
    set(messagesAtom, []);
  }
});
