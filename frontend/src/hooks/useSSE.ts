import { useCallback, useRef } from 'react';
import { api } from '../services/api';
import {
  parseSSEChunk,
  flushRemainingEvent,
  initialSSEParseState,
  type SSEParseState,
} from '../utils/sse';

interface UseSSEOptions {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * SSE Hook - 使用原生 fetch 实现流式通信
 *
 * SSE 协议解析逻辑委托给纯函数 parseSSEChunk（见 utils/sse.ts），
 * 本 hook 仅负责：流读取 + 事件派发。
 */
export function useSSE({ onMessage, onDone, onError }: UseSSEOptions) {
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
   * 4. 统一错误处理（区分 AbortError 和其他错误）
   *
   * @param apiCall - 接收 signal 并返回 Response 的函数
   */
  const executeStream = useCallback(
    async (apiCall: (signal: AbortSignal) => Promise<Response>) => {
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      try {
        const response = await apiCall(signal);
        await processStream(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户主动中止
          console.log('Request aborted by user');
        } else {
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [onError, processStream]
  );

  /** 发送消息并处理 SSE 流 */
  const sendMessage = useCallback(
    (conversationId: string, content: string) =>
      executeStream((signal) => api.sendMessage(conversationId, content, signal)),
    [executeStream]
  );

  /** 续传中断的对话 */
  const resumeStream = useCallback(
    (conversationId: string) =>
      executeStream((signal) => api.resumeChat(conversationId, signal)),
    [executeStream]
  );

  /** 重新生成回复（SSE 流） */
  const regenerateStream = useCallback(
    (conversationId: string) =>
      executeStream((signal) => api.regenerateMessage(conversationId, signal)),
    [executeStream]
  );

  /** 编辑并重发（SSE 流） */
  const editAndResendStream = useCallback(
    (conversationId: string, messageId: string, newContent: string) =>
      executeStream((signal) =>
        api.editAndResendMessage(conversationId, messageId, newContent, signal)
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
