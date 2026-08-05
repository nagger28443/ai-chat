import { router } from '../index.js';
import { conversationRouter } from './conversation.js';
import { messageRouter } from './message.js';

/**
 * 合并所有 router
 * 这是 tRPC 的入口 router
 */
export const appRouter = router({
  conversation: conversationRouter,
  message: messageRouter,
});

/**
 * AppRouter 类型定义
 * 前端使用此类型来获得完整的类型推导
 */
export type AppRouter = typeof appRouter;
