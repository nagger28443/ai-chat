import { trpc } from './trpc.ts';
import type {
  SendMessageInput,
  ResumeChatInput,
  RegenerateMessageInput,
  EditAndResendInput,
} from '../types/index.ts';

const API_BASE_URL = '/api';

/**
 * API 服务层
 * - REST 端点使用 tRPC 客户端（类型自动推导）
 * - SSE 端点使用 fetch（返回原始 Response）
 */
class ApiService {
  // ============ tRPC REST 端点（类型从 AppRouter 自动推导） ============

  /**
   * 获取所有会话
   */
  getConversations() {
    return trpc.conversation.getAll.query();
  }

  /**
   * 创建新会话
   */
  createConversation(title?: string) {
    return trpc.conversation.create.mutate({ title });
  }

  /**
   * 删除会话
   */
  async deleteConversation(id: string) {
    await trpc.conversation.delete.mutate({ id });
  }

  /**
   * 更新会话/重命名
   */
  updateConversation(id: string, title: string) {
    return trpc.conversation.update.mutate({ id, title });
  }

  /**
   * 获取会话的消息（分页）
   */
  getMessages(conversationId: string, limit: number = 10, offset: number = 0) {
    return trpc.conversation.getMessages.query({
      conversationId,
      limit,
      offset,
    });
  }

  /**
   * 删除指定消息
   */
  deleteMessage(conversationId: string, messageId: string) {
    return trpc.message.delete.mutate({ conversationId, messageId });
  }

  // ============ SSE 流式端点（使用 fetch） ============

  /**
   * 发送消息（返回 SSE 流）
   */
  async sendMessage(conversationId: string, content: string): Promise<Response> {
    const url = `${API_BASE_URL}/chat`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId, content } satisfies SendMessageInput),
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
      body: JSON.stringify({
        conversationId,
        frontendContentLength,
      } satisfies ResumeChatInput),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  /**
   * 重新生成最后一条 assistant 回复（返回 SSE 流）
   */
  async regenerateMessage(conversationId: string): Promise<Response> {
    const url = `${API_BASE_URL}/chat/regenerate`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId } satisfies RegenerateMessageInput),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }

  /**
   * 编辑用户消息并重新生成回复（返回 SSE 流）
   */
  async editAndResendMessage(
    conversationId: string,
    messageId: string,
    newContent: string
  ): Promise<Response> {
    const url = `${API_BASE_URL}/chat/edit-and-resend`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        messageId,
        newContent,
      } satisfies EditAndResendInput),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  }
}

export const api = new ApiService();
