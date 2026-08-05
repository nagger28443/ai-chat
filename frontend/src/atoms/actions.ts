import { atom } from 'jotai';
import {
  conversationsAtom,
  currentConversationIdAtom,
  messagesAtom,
  isLoadingAtom,
  hasMoreMessagesAtom,
  messageOffsetAtom,
  isLoadingMoreAtom,
} from './conversation';
import { api } from '../services/api';
import type { Message } from '../types';

const PAGE_SIZE = 10;

/**
 * 操作 atoms - 业务逻辑
 */

// 加载会话列表
export const loadConversationsAtom = atom(null, async (_get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);
  return conversations;
});

// 加载消息（首次加载，取最新 PAGE_SIZE 条）
export const loadMessagesAtom = atom(null, async (_get, set, conversationId: string) => {
  set(isLoadingAtom, true);
  set(messageOffsetAtom, 0);
  try {
    const result = await api.getMessages({ conversationId, limit: PAGE_SIZE, offset: 0 });
    set(messagesAtom, result.messages);
    set(hasMoreMessagesAtom, result.hasMore);
    set(messageOffsetAtom, result.messages.length);
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    set(isLoadingAtom, false);
  }
});

// 加载更多历史消息（向上滚动触发）
export const loadMoreMessagesAtom = atom(null, async (get, set, conversationId: string) => {
  if (get(isLoadingMoreAtom) || !get(hasMoreMessagesAtom)) return;

  set(isLoadingMoreAtom, true);
  const currentOffset = get(messageOffsetAtom);
  try {
    const result = await api.getMessages({ conversationId, limit: PAGE_SIZE, offset: currentOffset });
    // 将旧消息 prepend 到现有消息前面
    const currentMessages = get(messagesAtom);
    set(messagesAtom, [...result.messages, ...currentMessages]);
    set(hasMoreMessagesAtom, result.hasMore);
    set(messageOffsetAtom, currentOffset + result.messages.length);
  } catch (error) {
    console.error('Failed to load more messages:', error);
  } finally {
    set(isLoadingMoreAtom, false);
  }
});

// 切换会话
export const switchConversationAtom = atom(null, async (get, set, id: string) => {
  set(currentConversationIdAtom, id);
  set(messageOffsetAtom, 0);
  set(hasMoreMessagesAtom, false);
  set(isLoadingAtom, true);
  try {
    const result = await api.getMessages({ conversationId: id, limit: PAGE_SIZE, offset: 0 });
    set(messagesAtom, result.messages);
    set(hasMoreMessagesAtom, result.hasMore);
    set(messageOffsetAtom, result.messages.length);
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    set(isLoadingAtom, false);
  }
});

// 创建新会话
export const createConversationAtom = atom(null, async (get, set) => {
  const conversation = await api.createConversation();
  const conversations = get(conversationsAtom);
  set(conversationsAtom, [...conversations, conversation]);
  set(currentConversationIdAtom, conversation.id);
  set(messagesAtom, []);
  set(hasMoreMessagesAtom, false);
  set(messageOffsetAtom, 0);
  return conversation;
});

// 删除会话
export const deleteConversationAtom = atom(null, async (get, set, id: string) => {
  await api.deleteConversation({ id });
  const conversations = get(conversationsAtom).filter((c) => c.id !== id);
  set(conversationsAtom, conversations);

  const currentId = get(currentConversationIdAtom);
  if (currentId === id) {
    if (conversations.length > 0) {
      set(currentConversationIdAtom, conversations[0].id);
      set(isLoadingAtom, true);
      try {
        const result = await api.getMessages({ conversationId: conversations[0].id, limit: PAGE_SIZE, offset: 0 });
        set(messagesAtom, result.messages);
        set(hasMoreMessagesAtom, result.hasMore);
        set(messageOffsetAtom, result.messages.length);
      } finally {
        set(isLoadingAtom, false);
      }
    } else {
      const newConv = await api.createConversation();
      set(conversationsAtom, [newConv]);
      set(currentConversationIdAtom, newConv.id);
      set(messagesAtom, []);
      set(hasMoreMessagesAtom, false);
      set(messageOffsetAtom, 0);
    }
  }
});

// 更新会话（重命名）
export const updateConversationAtom = atom(
  null,
  async (get, set, payload: { id: string; title: string }) => {
    const updated = await api.updateConversation({ id: payload.id, title: payload.title });
    const conversations = get(conversationsAtom);
    set(
      conversationsAtom,
      conversations.map((c) => (c.id === payload.id ? { ...c, ...updated } : c))
    );
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
      get(messagesAtom).map((msg) => (msg.id === payload.id ? { ...msg, ...payload.updates } : msg))
    );
  }
);

// 删除消息
export const deleteMessageAtom = atom(
  null,
  async (get, set, payload: { conversationId: string; messageId: string }) => {
    try {
      const result = await api.deleteMessage({ conversationId: payload.conversationId, messageId: payload.messageId });
      set(messagesAtom, result.messages);

      // 更新会话消息计数
      const conversations = get(conversationsAtom);
      const conversation = conversations.find((c) => c.id === payload.conversationId);
      if (conversation) {
        conversation.messageCount = result.messages.length;
        set(conversationsAtom, [...conversations]);
      }
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  }
);

// 重新生成（移除指定消息之后的所有内容，前端状态更新后由 hook 发起 SSE）
export const regenerateAtom = atom(
  null,
  (get, set, conversationId: string) => {
    const messages = get(messagesAtom);

    // 找到最后一条 user 消息
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) return null;

    // 移除 lastUserIdx 之后的所有消息
    const remaining = messages.slice(0, lastUserIdx + 1);
    set(messagesAtom, remaining);

    return remaining[lastUserIdx].content; // 返回用户消息内容供 hook 使用
  }
);

// 编辑并重发（更新用户消息，移除之后的所有内容）
export const editAndResendAtom = atom(
  null,
  (get, set, payload: { messageId: string; newContent: string }) => {
    const messages = get(messagesAtom);
    const msgIndex = messages.findIndex((m) => m.id === payload.messageId);

    if (msgIndex === -1) return null;

    // 更新用户消息内容，移除之后的所有消息
    const updated: Message[] = [
      ...messages.slice(0, msgIndex),
      { ...messages[msgIndex], content: payload.newContent },
    ];
    set(messagesAtom, updated);

    return payload.newContent; // 返回新内容供 hook 使用
  }
);

// 初始化：加载会话并自动选择第一个
export const initConversationsAtom = atom(null, async (get, set) => {
  const conversations = await api.getConversations();
  set(conversationsAtom, conversations);

  const currentId = get(currentConversationIdAtom);
  if (conversations.length > 0 && !currentId) {
    const firstId = conversations[0].id;
    set(currentConversationIdAtom, firstId);
    set(isLoadingAtom, true);
    try {
      const result = await api.getMessages({ conversationId: firstId, limit: PAGE_SIZE, offset: 0 });
      set(messagesAtom, result.messages);
      set(hasMoreMessagesAtom, result.hasMore);
      set(messageOffsetAtom, result.messages.length);
    } finally {
      set(isLoadingAtom, false);
    }
  } else if (conversations.length === 0) {
    const newConv = await api.createConversation();
    set(conversationsAtom, [newConv]);
    set(currentConversationIdAtom, newConv.id);
    set(messagesAtom, []);
    set(hasMoreMessagesAtom, false);
    set(messageOffsetAtom, 0);
  }
});
