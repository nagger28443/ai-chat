import { atom } from 'jotai';
import type { Conversation, Message } from '../types';

/**
 * 基础 atoms - 对话状态
 */

// 会话列表
export const conversationsAtom = atom<Conversation[]>([]);

// 当前选中的会话 ID
export const currentConversationIdAtom = atom<string | null>(null);

// 当前会话的消息列表
export const messagesAtom = atom<Message[]>([]);

// 消息加载状态
export const isLoadingAtom = atom<boolean>(false);

// 是否还有更多历史消息（分页）
export const hasMoreMessagesAtom = atom<boolean>(false);

// 当前已加载的消息偏移量（分页）
export const messageOffsetAtom = atom<number>(0);

// 是否正在加载更多消息
export const isLoadingMoreAtom = atom<boolean>(false);

/**
 * 派生 atoms
 */

// 当前会话对象
export const currentConversationAtom = atom((get) => {
  const id = get(currentConversationIdAtom);
  if (!id) return null;
  return get(conversationsAtom).find((c) => c.id === id) ?? null;
});
