import { useCallback, useRef } from 'react';
import { api } from '../services/api';

interface UseSSEOptions {
  onMessage: (content: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * SSE Hook - 使用原生 fetch 实现流式通信
 *
 * 遵循 SSE 规范：
 * - 处理多行 data（同一事件内多行 data 用 \n 连接）
 * - 去除 data 值的前导空格（格式分隔符）
 * - 处理 CRLF 行尾
 * - 使用 buffer 正确处理跨 chunk 的 UTF-8 字符
 */
export function useSSE({ onMessage, onDone, onError }: UseSSEOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * 处理 SSE 事件
   */
  const handleSSEEvent = useCallback(
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
   * 严格遵循 SSE 规范解析：
   * 1. 使用 buffer 处理跨 chunk 的 UTF-8 字符
   * 2. 逐行解析，处理 \n 和 \r\n 行尾
   * 3. 多行 data 用 \n 连接
   * 4. 空行表示事件边界
   * 5. 去除 data 值的前导空格
   */
  const processStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      // 当前 SSE 事件累积的 data（多行用 \n 连接）
      let eventData = '';
      let hasEventData = false;
      let currentEvent = 'message'; // SSE 默认事件类型为 "message"

      /** 将已累积的事件数据派发到回调 */
      const flushEvent = () => {
        if (!hasEventData) return;
        handleSSEEvent(currentEvent, eventData);
        eventData = '';
        hasEventData = false;
        currentEvent = 'message'; // 重置为默认
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // 使用 stream: true 正确处理跨 chunk 的 UTF-8 字符
        buffer += decoder.decode(value, { stream: true });

        // 逐行解析
        let lineBreak;
        while ((lineBreak = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, lineBreak);
          buffer = buffer.slice(lineBreak + 1);

          // 处理 CRLF 行尾
          if (line.endsWith('\r')) {
            line = line.slice(0, -1);
          }

          if (line.startsWith('event:')) {
            // event 字段：指定事件类型
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            // data 字段：SSE 规范规定，冒号后若有一个空格则去除（格式分隔符）
            let data = line.slice(5);
            if (data.startsWith(' ')) data = data.slice(1);

            // 同一事件内多行 data 用 \n 连接
            eventData = hasEventData ? eventData + '\n' + data : data;
            hasEventData = true;
          } else if (line === '') {
            // 空行 = 事件边界，派发已累积的事件数据
            flushEvent();
          }
          // 其他行（注释以 : 开头等）直接忽略
        }
      }

      // 流结束时若还有未派发的事件数据，补发一次
      flushEvent();

      // 处理缓冲区中剩余的数据
      if (buffer.trim()) {
        console.warn('Buffer has remaining data:', buffer);
      }
    },
    [handleSSEEvent]
  );

  /**
   * 发送消息并处理 SSE 流
   */
  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      abortControllerRef.current = new AbortController();

      try {
        const response = await api.sendMessage(conversationId, content);
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

  /**
   * 续传中断的对话
   */
  const resumeStream = useCallback(
    async (conversationId: string) => {
      abortControllerRef.current = new AbortController();

      try {
        const response = await api.resumeChat(conversationId);
        await processStream(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted by user');
        } else {
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [onError, processStream]
  );

  /**
   * 重新生成回复（SSE 流）
   */
  const regenerateStream = useCallback(
    async (conversationId: string) => {
      abortControllerRef.current = new AbortController();

      try {
        const response = await api.regenerateMessage(conversationId);
        await processStream(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted by user');
        } else {
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [onError, processStream]
  );

  /**
   * 编辑并重发（SSE 流）
   */
  const editAndResendStream = useCallback(
    async (conversationId: string, messageId: string, newContent: string) => {
      abortControllerRef.current = new AbortController();

      try {
        const response = await api.editAndResendMessage(conversationId, messageId, newContent);
        await processStream(response);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Request aborted by user');
        } else {
          onError(error instanceof Error ? error.message : 'Unknown error');
        }
      }
    },
    [onError, processStream]
  );

  /**
   * 中止当前请求
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { sendMessage, resumeStream, regenerateStream, editAndResendStream, abort };
}
