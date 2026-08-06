import type {
  SendMessageInput,
  ResumeChatInput,
  RegenerateMessageInput,
  EditAndResendInput,
} from '../types/index.ts';

const API_BASE_URL = '/api';

/**
 * SSE 流式端点 API
 * REST 端点已迁移到 tRPC hooks（见 lib/trpc.ts）
 */
class ApiService {
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
  async resumeChat(conversationId: string): Promise<Response> {
    const url = `${API_BASE_URL}/chat/resume`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
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
