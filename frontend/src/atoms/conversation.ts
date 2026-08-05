import { atom } from 'jotai';

/**
 * 本地 UI 状态 atoms
 * API 数据由 tRPC + react-query 管理，此处仅保留纯 UI 状态
 */

// 当前选中的会话 ID
export const currentConversationIdAtom = atom<string | null>(null);
