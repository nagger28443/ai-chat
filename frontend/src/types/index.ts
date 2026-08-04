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
  status?: 'sending' | 'streaming' | 'completed' | 'stopped' | 'error';
  error?: string;
}

// 主题类型
export type Theme = 'light' | 'dark' | 'auto';

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
