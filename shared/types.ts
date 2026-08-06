/**
 * 共享类型定义
 * 前后端共同使用的类型，避免重复定义
 *
 * 注意：CRUD 操作的输入输出类型由 tRPC + zod 自动推导，
 * 此处只保留 SSE 端点需要的类型（前端用 satisfies 校验请求体）。
 */

import { z } from 'zod';

// ============ 输入限制常量 ============

/** 消息内容最大长度（字符数） */
export const MAX_MESSAGE_LENGTH = 10_000;
/** 会话标题最大长度（字符数） */
export const MAX_TITLE_LENGTH = 100;
/** 分页 limit 范围 */
export const PAGINATION_LIMIT_MIN = 1;
export const PAGINATION_LIMIT_MAX = 100;

// ============ Zod Schemas（作为唯一数据源） ============

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number(),
});

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  createdAt: z.string(),
  status: z.enum(['sending', 'streaming', 'generating', 'completed', 'stopped', 'error']).optional(),
  error: z.string().optional(),
  /** 中断位置（已生成的字符数），用于断点续传 */
  interruptedAt: z.number().optional(),
  /** 原始用户输入，用于断点续传时重新获取 AI 响应 */
  originalPrompt: z.string().optional(),
});

// ============ 从 zod schemas 推导 TypeScript 类型 ============

export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// SSE 事件类型
export interface SSEMessageEvent {
  type: 'message';
  data: {
    content: string;
  };
}

export interface SSEDoneEvent {
  type: 'done';
  data: Record<string, never>;
}

export interface SSEErrorEvent {
  type: 'error';
  data: {
    message: string;
  };
}

export type SSEEvent = SSEMessageEvent | SSEDoneEvent | SSEErrorEvent;

// ============ 统一错误响应格式 ============

/**
 * 后端统一错误响应格式
 * 所有后端错误（tRPC、SSE、REST）都应返回此格式
 */
export interface ApiErrorResponse {
  /** 机器可读的错误码 */
  code: string;
  /** 人可读的错误信息 */
  message: string;
  /** 可选的附加信息 */
  details?: unknown;
}

/** 构造统一错误响应的辅助函数 */
export function createErrorResponse(code: string, message: string, details?: unknown): ApiErrorResponse {
  return { code, message, ...(details !== undefined ? { details } : {}) };
}

// ============ SSE 端点输入 Schema（用于后端路由校验） ============

export const sendMessageInputSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  content: z.string().min(1, 'content is required').max(MAX_MESSAGE_LENGTH, `content must be at most ${MAX_MESSAGE_LENGTH} characters`),
});

export const resumeChatInputSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
});

export const regenerateMessageInputSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
});

export const editAndResendInputSchema = z.object({
  conversationId: z.string().min(1, 'conversationId is required'),
  messageId: z.string().min(1, 'messageId is required'),
  newContent: z.string().min(1, 'newContent is required').max(MAX_MESSAGE_LENGTH, `newContent must be at most ${MAX_MESSAGE_LENGTH} characters`),
});

// ============ SSE 端点输入类型（从 schema 推导） ============

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type ResumeChatInput = z.infer<typeof resumeChatInputSchema>;
export type RegenerateMessageInput = z.infer<typeof regenerateMessageInputSchema>;
export type EditAndResendInput = z.infer<typeof editAndResendInputSchema>;
