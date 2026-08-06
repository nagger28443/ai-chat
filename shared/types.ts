/**
 * 共享类型定义
 * 前后端共同使用的类型，避免重复定义
 *
 * 注意：CRUD 操作的输入输出类型由 tRPC + zod 自动推导，
 * 此处只保留 SSE 端点需要的类型（前端用 satisfies 校验请求体）。
 */

import { z } from 'zod';

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

// ============ SSE 端点输入类型 ============

// POST /api/chat - 发送消息
export interface SendMessageInput {
  conversationId: string;
  content: string;
}

// POST /api/chat/resume - 续传中断的对话
export interface ResumeChatInput {
  conversationId: string;
}

// POST /api/chat/regenerate - 重新生成回复
export interface RegenerateMessageInput {
  conversationId: string;
}

// POST /api/chat/edit-and-resend - 编辑并重发
export interface EditAndResendInput {
  conversationId: string;
  messageId: string;
  newContent: string;
}
