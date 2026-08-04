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

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
