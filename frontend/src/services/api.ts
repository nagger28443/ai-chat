import { trpc } from './trpc.ts';
import type { AppRouter } from '../../../backend/src/trpc/routers/_app.js';
import type { inferProcedureInput } from '@trpc/server';
import type {
  SendMessageInput,
  ResumeChatInput,
  RegenerateMessageInput,
  EditAndResendInput,
} from '../types/index.ts';

// 从 tRPC router 推导输入类型
type CreateConversationInput = inferProcedureInput<AppRouter['conversation']['create']>;
type UpdateConversationInput = inferProcedureInput<AppRouter['conversation']['update']>;
type DeleteConversationInput = inferProcedureInput<AppRouter['conversation']['delete']>;
type GetMessagesInput = inferProcedureInput<AppRouter['conversation']['getMessages']>;
type DeleteMessageInput = inferProcedureInput<AppRouter['message']['delete']>;

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
  createConversation(input?: CreateConversationInput) {
    return trpc.conversation.create.mutate(input ?? {});
  }

  /**
   * 删除会话
   */
  deleteConversation(input: DeleteConversationInput) {
    return trpc.conversation.delete.mutate(input);
  }

  /**
   * 更新会话/重命名
   */
  updateConversation(input: UpdateConversationInput) {
    return trpc.conversation.update.mutate(input);
  }

  /**
   * 获取会话的消息（分页）
   */
  getMessages(input: GetMessagesInput) {
    return trpc.conversation.getMessages.query(input);
  }

  /**
   * 删除指定消息
   */
  deleteMessage(input: DeleteMessageInput) {
    return trpc.message.delete.mutate(input);
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
