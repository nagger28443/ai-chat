import type { ApiResponse, Conversation, Message } from '../types';

const API_BASE_URL = '/api';

/**
 * API 服务层
 * 封装所有后端 API 调用
 */
class ApiService {
  constructor() {
    // 绑定 this，确保 useRequest 等直接调用方法时上下文不丢失
    this.getConversations = this.getConversations.bind(this);
    this.createConversation = this.createConversation.bind(this);
    this.deleteConversation = this.deleteConversation.bind(this);
    this.getMessages = this.getMessages.bind(this);
    this.sendMessage = this.sendMessage.bind(this);
    this.resumeChat = this.resumeChat.bind(this);
  }

  /**
   * 通用请求方法
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  /**
   * 获取所有会话
   */
  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>('/conversations');
  }

  /**
   * 创建新会话
   */
  async createConversation(title?: string): Promise<Conversation> {
    return this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: string): Promise<void> {
    await this.request<void>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * 获取会话的消息（分页）
   * @param limit 每页条数（默认 10）
   * @param offset 跳过最新的条数（默认 0）
   */
  async getMessages(
    conversationId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ messages: Message[]; hasMore: boolean; total: number }> {
    return this.request<{ messages: Message[]; hasMore: boolean; total: number }>(
      `/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    );
  }

  /**
   * 发送消息（返回 SSE 流）
   */
  async sendMessage(
    conversationId: string,
    content: string
  ): Promise<Response> {
    const url = `${API_BASE_URL}/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, content }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  /**
   * 续传中断的对话（返回 SSE 流）
   */
  async resumeChat(conversationId: string, frontendContentLength: number): Promise<Response> {
    const url = `${API_BASE_URL}/chat/resume`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, frontendContentLength }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }
}

export const api = new ApiService();
