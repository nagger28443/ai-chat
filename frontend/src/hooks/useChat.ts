import { useState, useEffect, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { useSSE } from './useSSE';
import type { Message } from '../types';
import { useMemoizedFn } from 'ahooks';
import {
  messagesAtom,
  currentConversationIdAtom,
  isLoadingAtom,
} from '../atoms/conversation';
import {
  addMessageAtom,
  updateMessageAtom,
  loadConversationsAtom,
  initConversationsAtom,
} from '../atoms/actions';

/**
 * Chat Hook - 管理对话逻辑
 * 使用 jotai atoms 替代 Context
 */
export function useChat() {
  // 读取 atoms
  const [messages] = useAtom(messagesAtom);
  const [currentConversationId] = useAtom(currentConversationIdAtom);
  const [isLoading] = useAtom(isLoadingAtom);

  // 写入 atoms
  const addMessage = useSetAtom(addMessageAtom);
  const updateMessage = useSetAtom(updateMessageAtom);
  const loadConversations = useSetAtom(loadConversationsAtom);
  const initConversations = useSetAtom(initConversationsAtom);

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // 记录已安排自动续传的会话 ID
  const scheduledResumeRef = useRef<string | null>(null);
  // 用 ref 保存最新的 messages，避免 useEffect 闭包过期问题
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  // 用 ref 保存最新的 isStreaming
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  // 用 ref 保存最新的 streamingMessageId（onMessage 需要）
  const streamingMessageIdRef = useRef<string | null>(null);
  streamingMessageIdRef.current = streamingMessageId;
  // 用 ref 同步追踪流式消息内容，避免 state 未更新时的竞态
  const contentRef = useRef('');

  // 初始化：加载会话列表
  useEffect(() => {
    initConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMessage = useMemoizedFn((content) => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      contentRef.current += content;
      updateMessage({
        id: msgId,
        updates: {
          content: contentRef.current,
          status: 'streaming',
        },
      });
    }
  });

  const onDone = useMemoizedFn(() => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage({
        id: msgId,
        updates: { status: 'completed' },
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
      updateMessage({
        id: msgId,
        updates: { status: 'error', error },
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
    if (!currentConversationId || isStreamingRef.current) return;

    // 添加用户消息
    const userMessage: Message = {
      id: uuidv4(),
      conversationId: currentConversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'completed',
    };
    addMessage(userMessage);

    // 添加 AI 消息（占位）
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: currentConversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };
    addMessage(assistantMessage);

    setStreamingMessageId(assistantMessage.id);
    setIsStreaming(true);
    contentRef.current = '';

    // 发送 SSE 请求
    await sendSSERequest(currentConversationId, content);
  });

  /**
   * 续传中断的对话
   */
  const resumeConversation = useMemoizedFn(async () => {
    if (!currentConversationId || isStreamingRef.current) return;

    // 找到中断的消息
    const interruptedMsg = messagesRef.current.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (!interruptedMsg) return;

    setStreamingMessageId(interruptedMsg.id);
    setIsStreaming(true);

    // 将 contentRef 同步为前端已有的内容
    contentRef.current = interruptedMsg.content;

    updateMessage({
      id: interruptedMsg.id,
      updates: { status: 'streaming' },
    });

    // 传入前端当前内容长度，后端只发送增量内容
    await resumeStream(currentConversationId, interruptedMsg.content.length);
  });

  /**
   * 自动续传：检测消息加载完成（isLoading true→false）后检查中断消息
   */
  const prevIsLoadingRef = useRef(isLoading);

  useEffect(() => {
    const wasLoading = prevIsLoadingRef.current;
    prevIsLoadingRef.current = isLoading;

    // 仅在 isLoading 从 true 变为 false 时检查
    if (!wasLoading || isLoading) return;

    if (!currentConversationId) return;
    if (isStreamingRef.current) return;

    if (scheduledResumeRef.current === currentConversationId) return;
    scheduledResumeRef.current = currentConversationId;

    const interruptedMsg = messagesRef.current.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (interruptedMsg) {
      resumeConversation();
    }
  }, [isLoading]);

  const stopStreaming = useMemoizedFn(() => {
    abort();
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      updateMessage({
        id: msgId,
        updates: { status: 'stopped' },
      });
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
  });

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
  };
}
