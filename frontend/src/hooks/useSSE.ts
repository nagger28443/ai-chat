import { useCallback, useRef } from 'react';
import { api } from '../services/api';
import { isHttpError } from '../utils/httpError';
import {
  parseSSEChunk,
  flushRemainingEvent,
  initialSSEParseState,
  type SSEParseState,
} from '../utils/sse';
import { SSE_MAX_RETRIES, SSE_RETRY_BASE_DELAY_MS } from '../constants';

interface UseSSEOptions {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  /** 断线重连时回调，用于显示"正在重新连接..."UI */
  onReconnecting?: (attempt: number) => void;
}

/**
 * SSE Hook - 使用原生 fetch 实现流式通信
 *
 * SSE 协议解析逻辑委托给纯函数 parseSSEChunk（见 utils/sse.ts），
 * 本 hook 仅负责：流读取 + 事件派发。
 *
 * 错误处理：
 * - HttpError：后端返回的结构化错误，直接使用 message
 * - TypeError（网络错误/离线）：提供友好的中文提示，自动重试
 * - AbortError：用户主动取消，不报错
 * - 其他错误：使用通用错误消息
 *
 * 自动重连：
 * - 网络错误时自动重试（指数退避），最多 SSE_MAX_RETRIES 次
 * - 重连时切换为 resumeStream，从后端 cache 恢复断点
 */
export function useSSE({ onMessage, onDone, onError, onReconnecting }: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 派发单个 SSE 事件到对应的回调
   */
  const dispatchSSEEvent = useCallback(
    (event: string, data: string) => {
      try {
        const parsedData = JSON.parse(data);

        switch (event) {
          case 'message':
            onMessage(parsedData.content);
            break;
          case 'done':
            onDone();
            break;
          case 'error':
            onError(parsedData.message);
            break;
          default:
            console.warn('Unknown SSE event:', event);
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error);
      }
    },
    [onMessage, onDone, onError]
  );

  /**
   * 处理 SSE 流数据
   *
   * 纯 I/O 层：从 Response 读取 chunk，交给 parseSSEChunk 解析，
   * 将解析出的事件派发到回调。
   */
  const processStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let parseState: SSEParseState = { ...initialSSEParseState };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用 stream: true 正确处理跨 chunk 的 UTF-8 字符
        const text = decoder.decode(value, { stream: true });
        const result = parseSSEChunk(text, parseState);
        parseState = result.state;

        // 派发本 chunk 解析出的所有事件
        for (const evt of result.events) {
          dispatchSSEEvent(evt.event, evt.data);
        }
      }

      // 流结束时若还有未派发的事件，补发一次
      const finalEvent = flushRemainingEvent(parseState);
      if (finalEvent) {
        dispatchSSEEvent(finalEvent.event, finalEvent.data);
      }

      // 处理缓冲区中剩余的数据（不完整的行）
      if (parseState.buffer.trim()) {
        console.warn('Buffer has remaining data:', parseState.buffer);
      }
    },
    [dispatchSSEEvent]
  );

  /**
   * 通用 SSE 请求执行器（高阶函数）
   *
   * 封装所有 stream 方法的公共流程：
   * 1. 创建 AbortController 并绑定 signal
   * 2. 调用 api 方法获取 Response
   * 3. 处理 SSE 流
   * 4. 网络错误时自动重试（指数退避），切换为 resumeStream
   * 5. 统一错误处理（区分 AbortError / HttpError / 网络错误）
   *
   * @param apiCall - 接收 signal 并返回 Response 的函数
   * @param conversationId - 可选，用于断线重连时调用 resumeStream
   */
  const executeStream = useCallback(
    async (
      apiCall: (signal: AbortSignal) => Promise<Response>,
      conversationId?: string,
    ) => {
      let currentApiCall = apiCall;
      let retries = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const signal = controller.signal;

        try {
          const response = await currentApiCall(signal);
          await processStream(response);
          return; // 成功完成
        } catch (error) {
          // 检查 abort 是否在等待期间被调用（abort() 会把 ref 置为 null 或另一个 controller）
          if (abortControllerRef.current !== controller) {
            console.log('Request aborted by user');
            return;
          }

          const isNetworkError =
            error instanceof TypeError && error.message === 'Failed to fetch';

          // 网络错误 + 有 conversationId → 自动重连
          if (
            isNetworkError &&
            conversationId &&
            retries < SSE_MAX_RETRIES
          ) {
            retries++;
            const delay = SSE_RETRY_BASE_DELAY_MS * Math.pow(2, retries - 1);
            console.log(
              `SSE 断线，${delay}ms 后第 ${retries} 次重连...`,
            );
            onReconnecting?.(retries);
            await new Promise((resolve) => setTimeout(resolve, delay));
            // 等待期间可能被 abort，检查后继续
            if (abortControllerRef.current !== controller) return;
            // 重连时切换为 resumeStream
            const cid = conversationId;
            currentApiCall = (sig) => api.resumeChat(cid, sig);
            continue;
          }

          // 不可重试的错误，派发给调用方
          if (isHttpError(error)) {
            onError(error.message);
          } else if (isNetworkError) {
            onError('网络连接失败，请检查网络后重试');
          } else {
            onError(error instanceof Error ? error.message : '未知错误');
          }
          return;
        }
      }
    },
    [onError, processStream, onReconnecting]
  );

  /** 发送消息并处理 SSE 流 */
  const sendMessage = useCallback(
    (conversationId: string, content: string) =>
      executeStream(
        (signal) => api.sendMessage(conversationId, content, signal),
        conversationId,
      ),
    [executeStream]
  );

  /** 续传中断的对话 */
  const resumeStream = useCallback(
    (conversationId: string) =>
      executeStream(
        (signal) => api.resumeChat(conversationId, signal),
        conversationId,
      ),
    [executeStream]
  );

  /** 重新生成回复（SSE 流） */
  const regenerateStream = useCallback(
    (conversationId: string) =>
      executeStream(
        (signal) => api.regenerateMessage(conversationId, signal),
        conversationId,
      ),
    [executeStream]
  );

  /** 编辑并重发（SSE 流） */
  const editAndResendStream = useCallback(
    (conversationId: string, messageId: string, newContent: string) =>
      executeStream(
        (signal) =>
          api.editAndResendMessage(conversationId, messageId, newContent, signal),
        conversationId,
      ),
    [executeStream]
  );

  /** 中止当前请求 */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { sendMessage, resumeStream, regenerateStream, editAndResendStream, abort };
}
