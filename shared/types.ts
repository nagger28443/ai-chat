/**
 * 共享类型定义
 * 前后端共同使用的类型，避免重复定义
 */

// 会话类型
export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// 消息类型
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'sending' | 'streaming' | 'generating' | 'completed' | 'stopped' | 'error';
  error?: string;
  /** 中断位置（已生成的字符数），用于断点续传 */
  interruptedAt?: number;
  /** 原始用户输入，用于断点续传时重新获取 AI 响应 */
  originalPrompt?: string;
}

// 主题类型
export type Theme = 'light' | 'dark' | 'system';

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

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
  frontendContentLength: number;
}

// DELETE /api/chat/messages - 删除指定消息
export interface DeleteMessageInput {
  conversationId: string;
  messageId: string;
}

// DELETE /api/chat/messages - 删除消息响应
export interface DeleteMessageOutput {
  messages: Message[];
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

// GET /api/conversations/:id/messages - 获取消息列表响应
export interface GetMessagesOutput {
  messages: Message[];
  hasMore: boolean;
  total: number;
}

// POST /api/conversations - 创建会话输入
export interface CreateConversationInput {
  title?: string;
}

// PUT /api/conversations/:id - 更新会话输入
export interface UpdateConversationInput {
  title: string;
}
