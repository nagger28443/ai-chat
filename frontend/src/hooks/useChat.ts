import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useConversation } from '../context/ConversationContext';
import { useSSE } from './useSSE';
import type { Message } from '../types';
import { useMemoizedFn } from 'ahooks';

/**
 * Chat Hook - 管理对话逻辑
 */
export function useChat() {
  const { state, addMessage, updateMessage, loadConversations } = useConversation();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  const onMessage = useMemoizedFn((content) => {
    if (streamingMessageId) {
      // 更新流式消息内容
      updateMessage(streamingMessageId, {
        content: (state.messages.find((m) => m.id === streamingMessageId)?.content || '') + content,
        status: 'streaming',
      });
    }
  });
  const onDone = useMemoizedFn(() => {
    if (streamingMessageId) {
      updateMessage(streamingMessageId, {
        status: 'completed',
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    // 重新加载会话列表以更新标题和消息数
    loadConversations();
  });
  const onError = useMemoizedFn((error) => {
    if (streamingMessageId) {
      updateMessage(streamingMessageId, {
        status: 'error',
        error,
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
  });

  const { sendMessage: sendSSERequest, abort } = useSSE({
    onMessage,
    onDone,
    onError,
  });

  const sendMessage = useCallback(
    async (content: string) => {
      if (!state.currentConversationId || isStreaming) return;

      // 添加用户消息
      const userMessage: Message = {
        id: uuidv4(),
        conversationId: state.currentConversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        status: 'completed',
      };
      addMessage(userMessage);

      // 添加 AI 消息（占位）
      const assistantMessage: Message = {
        id: uuidv4(),
        conversationId: state.currentConversationId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'streaming',
      };
      addMessage(assistantMessage);

      setStreamingMessageId(assistantMessage.id);
      setIsStreaming(true);

      // 发送 SSE 请求
      await sendSSERequest(state.currentConversationId, content);
    },
    [
      state.currentConversationId,
      state.messages,
      isStreaming,
      addMessage,
      updateMessage,
      sendSSERequest,
      loadConversations,
    ]
  );

  const stopStreaming = useCallback(() => {
    abort();
    if (streamingMessageId) {
      updateMessage(streamingMessageId, {
        status: 'stopped',
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
  }, [abort, streamingMessageId, updateMessage]);

  return {
    messages: state.messages,
    isStreaming,
    sendMessage,
    stopStreaming,
  };
}
