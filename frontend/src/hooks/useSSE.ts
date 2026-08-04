import { useCallback, useRef } from 'react';
import { api } from '../services/api';

interface UseSSEOptions {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * SSE Hook - 使用原生 fetch 实现流式通信
 */
export function useSSE({ onMessage, onDone, onError }: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 发送消息并处理 SSE 流
   */
  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      // 创建 AbortController
      abortControllerRef.current = new AbortController();

      try {
        // 发送请求获取 SSE 流
        const response = await api.sendMessage(conversationId, content);

        // 获取 ReadableStream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('Response body is not readable');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        // 读取流数据
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          // 解码二进制数据
          buffer += decoder.decode(value, { stream: true });

          // 解析 SSE 事件
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留未完成的行

          let currentEvent = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              currentEvent = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              currentData = line.slice(5).trim();
            } else if (line === '' && currentEvent && currentData) {
              // 空行表示事件结束
              handleSSEEvent(currentEvent, currentData);
              currentEvent = '';
              currentData = '';
            }
          }
        }

        // 处理缓冲区中剩余的数据
        if (buffer.trim()) {
          // 可能是最后一条未完成的消息
          console.warn('Buffer has remaining data:', buffer);
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户主动中止
          console.log('Request aborted by user');
        } else {
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [onMessage, onDone, onError]
  );

  /**
   * 处理 SSE 事件
   */
  const handleSSEEvent = (event: string, data: string) => {
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
  };

  /**
   * 中止当前请求
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { sendMessage, abort };
}
