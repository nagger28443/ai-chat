import { useState, useCallback, useEffect, useRef } from 'react';
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
  // 记录已安排自动续传的会话 ID
  const scheduledResumeRef = useRef<string | null>(null);
  // 用 ref 保存最新的 messages，避免 useEffect 闭包过期问题
  const messagesRef = useRef<Message[]>(state.messages);
  messagesRef.current = state.messages;
  // 用 ref 保存最新的 isStreaming
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

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

  const { sendMessage: sendSSERequest, resumeStream, abort } = useSSE({
    onMessage,
    onDone,
    onError,
  });

  const sendMessage = useMemoizedFn(async (content: string) => {
    if (!state.currentConversationId || isStreamingRef.current) return;

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
  });

  /**
   * 续传中断的对话
   */
  const resumeConversation = useMemoizedFn(async () => {
    const currentConvId = state.currentConversationId;
    if (!currentConvId || isStreamingRef.current) return;

    // 找到中断的消息
    const interruptedMsg = messagesRef.current.find(
      (m) => m.role === 'assistant' && m.status === 'stopped'
    );

    if (!interruptedMsg) return;

    // 设置当前流式消息 ID
    setStreamingMessageId(interruptedMsg.id);
    setIsStreaming(true);

    // 更新消息状态为 streaming
    updateMessage(interruptedMsg.id, {
      status: 'streaming',
    });

    // 发送续传请求
    await resumeStream(currentConvId);
  });

  /**
   * 自动续传：切换会话时安排自动恢复检查
   * 使用 useMemoizedFn 包裹的方法不需要放入依赖数组
   */
  useEffect(() => {
    const conversationId = state.currentConversationId;
    if (!conversationId) return;

    // 如果已经为当前会话安排过，跳过
    if (scheduledResumeRef.current === conversationId) return;

    // 标记已安排
    scheduledResumeRef.current = conversationId;

    // 延迟检查并续传
    const timer = setTimeout(() => {
      // 再次检查会话是否仍为目标会话
      if (scheduledResumeRef.current !== conversationId) return;

      // 通过 ref 读取最新值
      const hasInterrupted = messagesRef.current.some(
        (m) => m.role === 'assistant' && m.status === 'stopped'
      );

      if (hasInterrupted && !isStreamingRef.current) {
        resumeConversation();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [state.currentConversationId]); // 仅依赖会话 ID

  const stopStreaming = useMemoizedFn(() => {
    abort();
    if (streamingMessageId) {
      updateMessage(streamingMessageId, {
        status: 'stopped',
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
  });

  return {
    messages: state.messages,
    isStreaming,
    sendMessage,
    stopStreaming,
  };
}
