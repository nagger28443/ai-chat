import { useState, useEffect, useRef } from 'react';
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
  // 用 ref 保存最新的 streamingMessageId（onMessage 需要）
  const streamingMessageIdRef = useRef<string | null>(null);
  streamingMessageIdRef.current = streamingMessageId;
  // 用 ref 同步追踪流式消息内容，避免 state 未更新时的竞态
  // 正常对话每字符有 20ms 延迟，React 来得及渲染；但 resume 时字符瞬间到达，
  // 多个 onMessage 在同一次渲染前触发，state.messages 还是旧值，导致字符覆盖
  const contentRef = useRef('');

  const onMessage = useMemoizedFn((content) => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      // 从 ref 读取最新累积内容，而非 state（state 可能还未更新）
      contentRef.current += content;
      updateMessage(msgId, {
        content: contentRef.current,
        status: 'streaming',
      });
    }
  });

  const onDone = useMemoizedFn(() => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage(msgId, {
        status: 'completed',
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
    // 重新加载会话列表以更新标题和消息数
    loadConversations();
  });

  const onError = useMemoizedFn((error) => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage(msgId, {
        status: 'error',
        error,
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
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
    contentRef.current = ''; // 重置内容追踪

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
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (!interruptedMsg) return;

    // 设置当前流式消息 ID
    setStreamingMessageId(interruptedMsg.id);
    setIsStreaming(true);

    // 将 contentRef 同步为前端已有的内容
    // 后端只会发送增量内容（从 frontendContentLength 开始），onMessage 追加到 contentRef
    contentRef.current = interruptedMsg.content;

    // 更新消息状态为 streaming
    updateMessage(interruptedMsg.id, {
      status: 'streaming',
    });

    // 传入前端当前内容长度，后端只发送增量内容
    await resumeStream(currentConvId, interruptedMsg.content.length);
  });

  /**
   * 自动续传：检测消息加载完成（isLoading true→false）后检查中断消息
   *
   * 用 ref 追踪上一次 isLoading 值，仅在 true→false 跳变时触发检查
   * 这精确对应 loadMessages 完成的时刻，不会重复触发
   */
  const prevIsLoadingRef = useRef(state.isLoading);

  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = state.isLoading;

    // 仅在 isLoading 从 true 变为 false 时检查
    if (!wasLoading || state.isLoading) return;

    const conversationId = state.currentConversationId;
    if (!conversationId) return;
    if (isStreamingRef.current) return;

    // 防止重复触发
    if (scheduledResumeRef.current === conversationId) return;
    scheduledResumeRef.current = conversationId;

    const interruptedMsg = messagesRef.current.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (interruptedMsg) {
      resumeConversation();
    }
  }, [state.isLoading]); // 只依赖 isLoading

  const stopStreaming = useMemoizedFn(() => {
    abort();
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage(msgId, {
        status: 'stopped',
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
  });

  return {
    messages: state.messages,
    isStreaming,
    sendMessage,
    stopStreaming,
  };
}
