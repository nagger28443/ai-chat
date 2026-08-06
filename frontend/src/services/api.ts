import type {
  SendMessageInput,
  ResumeChatInput,
  RegenerateMessageInput,
  EditAndResendInput,
} from '../types/index.ts';
import { HttpError } from '../utils/httpError';

const API_BASE_URL = '/api';

/**
 * API 服务层
 * REST 端点已迁移到 tRPC hooks（见 lib/trpc.ts）
 *
 * 错误处理：所有方法在 !response.ok 时抛出 HttpError（结构化错误）
 */
class ApiService {
  // ============ SSE 流式端点（使用 fetch） ============

  /**
   * 发送消息（返回 SSE 流）
   */
  async sendMessage(
    conversationId: string,
    content: string,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.post(`${API_BASE_URL}/chat`, { conversationId, content } satisfies SendMessageInput, signal);
  }

  /**
   * 续传中断的对话（返回 SSE 流）
   */
  async resumeChat(conversationId: string, signal?: AbortSignal): Promise<Response> {
    return this.post(`${API_BASE_URL}/chat/resume`, { conversationId } satisfies ResumeChatInput, signal);
  }

  /**
   * 重新生成最后一条 assistant 回复（返回 SSE 流）
   */
  async regenerateMessage(
    conversationId: string,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.post(`${API_BASE_URL}/chat/regenerate`, { conversationId } satisfies RegenerateMessageInput, signal);
  }

  /**
   * 编辑用户消息并重新生成回复（返回 SSE 流）
   */
  async editAndResendMessage(
    conversationId: string,
    messageId: string,
    newContent: string,
    signal?: AbortSignal
  ): Promise<Response> {
    return this.post(
      `${API_BASE_URL}/chat/edit-and-resend`,
      { conversationId, messageId, newContent } satisfies EditAndResendInput,
      signal
    );
  }

  // ============ 非流式端点 ============

  /**
   * 取消指定会话的后端生成任务
   *
   * 仅用户点击"停止"按钮时调用。SSE 连接断开（网络问题、切换会话）
   * 不会触发取消，后端生成任务继续运行，下次访问可断点续传。
   */
  async cancelGeneration(conversationId: string): Promise<void> {
    await this.post(`${API_BASE_URL}/chat/cancel`, { conversationId });
  }

  /**
   * 通用 POST 请求
   * 统一处理错误响应：!response.ok 时抛出 HttpError（结构化错误）
   */
  private async post(url: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw await HttpError.fromResponse(response);
    }

    return response;
  }
}

export const api = new ApiService();
