import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { v4 as uuidv4 } from 'uuid';
import { useSSE } from './useSSE';
import type { Message } from '../types';
import { useMemoizedFn } from 'ahooks';
import { trpc } from '../lib/trpc';
import { currentConversationIdAtom } from '../atoms/conversation';

const PAGE_SIZE = 10;

/**
 * Chat Hook - 管理对话逻辑
 * 使用 tRPC + react-query 管理 API 数据
 * 使用 React state 管理流式状态
 */
export function useChat() {
  const [currentConversationId] = useAtom(currentConversationIdAtom);
  const utils = trpc.useUtils();

  // 分页状态
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 消息列表：使用 useQuery
  const { data: messagesData, isLoading } = trpc.conversation.getMessages.useQuery(
    { conversationId: currentConversationId!, limit: PAGE_SIZE, offset },
    {
      enabled: !!currentConversationId,
    }
  );

  // 消息列表（维护完整的消息数组，加载更多时追加）
  const [allMessages, setAllMessages] = useState<Message[]>([]);

  // 当数据加载完成时更新消息列表
  useEffect(() => {
    if (messagesData) {
      // 后端返回的消息已按时间顺序排列（旧的在前，新的在后）
      // 使用 spread 创建副本，因为 tRPC 推断的类型是 readonly
      const newMessages = [...messagesData.messages];
      if (offset === 0) {
        setAllMessages(newMessages);
      } else {
        // 加载更多：把更旧的消息 prepend 到前面
        setAllMessages((prev) => [...newMessages, ...prev]);
      }
      setHasMore(messagesData.hasMore);
      setIsLoadingMore(false);
    }
  }, [messagesData, offset]);

  // 流式状态：使用 React state
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);

  // 记录已安排自动续传的会话 ID
  const scheduledResumeRef = useRef<string | null>(null);
  // 用 ref 保存最新的 messages，避免 useEffect 闭包过期问题
  const messagesRef = useRef<Message[]>(allMessages);
  messagesRef.current = allMessages;
  // 用 ref 保存最新的 isStreaming
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;
  // 用 ref 保存最新的 streamingMessageId（onMessage 需要）
  const streamingMessageIdRef = useRef<string | null>(null);
  streamingMessageIdRef.current = streamingMessageId;
  // 用 ref 同步追踪流式消息内容，避免 state 未更新时的竞态
  const contentRef = useRef('');

  const onMessage = useMemoizedFn((content) => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      contentRef.current += content;
      // 直接更新本地状态
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === msgId
            ? { ...msg, content: contentRef.current, status: 'streaming' as const }
            : msg
        )
      );
    }
  });

  const onDone = useMemoizedFn(() => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      setAllMessages((prev) =>
        prev.map((msg) => (msg.id === msgId ? { ...msg, status: 'completed' as const } : msg))
      );
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
    // 刷新会话列表以更新标题和消息数
    utils.conversation.getAll.invalidate();
    // 刷新消息列表以获取最新状态
    utils.conversation.getMessages.invalidate();
  });

  const onError = useMemoizedFn((error) => {
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      setAllMessages((prev) =>
        prev.map((msg) => (msg.id === msgId ? { ...msg, status: 'error' as const, error } : msg))
      );
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
  });

  const {
    sendMessage: sendSSERequest,
    resumeStream,
    regenerateStream,
    editAndResendStream,
    abort,
  } = useSSE({
    onMessage,
    onDone,
    onError,
  });

  // 切换会话时重置状态并中止当前 SSE 连接
  useEffect(() => {
    // 中止当前的 SSE 连接
    abort();
    // 重置流式状态
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
    // 重置分页
    setOffset(0);
    // 重置自动续传标记（允许新会话触发续传检查）
    scheduledResumeRef.current = null;
  }, [currentConversationId, abort]);

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

    // 添加 AI 消息（占位）
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: currentConversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };

    // 添加到本地消息列表
    setAllMessages((prev) => [...prev, userMessage, assistantMessage]);

    setStreamingMessageId(assistantMessage.id);
    setIsStreaming(true);
    contentRef.current = '';

    // 发送 SSE 请求
    await sendSSERequest(currentConversationId, content);
  });

  /**
   * 续传中断的对话
   * @param targetMsg 可选，直接传入要续传的消息（避免依赖 messagesRef 的时序问题）
   */
  const resumeConversation = useMemoizedFn(async (targetMsg?: Message) => {
    if (!currentConversationId || isStreamingRef.current) return;

    // 找到中断的消息：优先使用传入的参数，否则从 messagesRef 中查找
    const interruptedMsg =
      targetMsg ??
      messagesRef.current.find(
        (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
      );

    if (!interruptedMsg) return;

    setStreamingMessageId(interruptedMsg.id);
    setIsStreaming(true);

    // 将 contentRef 同步为前端已有的内容
    contentRef.current = interruptedMsg.content;

    // 更新本地状态
    setAllMessages((prev) =>
      prev.map((msg) =>
        msg.id === interruptedMsg.id ? { ...msg, status: 'streaming' as const } : msg
      )
    );

    // 传入前端当前内容长度，后端只发送增量内容
    await resumeStream(currentConversationId, interruptedMsg.content.length);
  });

  /**
   * 自动续传：检测消息加载完成后检查中断消息
   * 使用 messagesData 变化来检测（而不是 isLoading），因为缓存命中时 isLoading 不会变化
   */
  const prevDataRef = useRef(messagesData);

  useEffect(() => {
    // 检测 data 是否变化（切换会话或数据刷新）
    if (prevDataRef.current === messagesData) return;
    prevDataRef.current = messagesData;

    if (!messagesData) return;
    if (!currentConversationId) return;
    if (isStreamingRef.current) return;

    // 防止重复调度
    if (scheduledResumeRef.current === currentConversationId) return;
    scheduledResumeRef.current = currentConversationId;

    // 直接从 messagesData 中查找中断的消息（不依赖 allMessages，避免时序问题）
    const messages = messagesData.messages;
    const interruptedMsg = messages.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (interruptedMsg) {
      // 需要先更新 allMessages 状态（后端已按时间顺序排列）
      // 使用 spread 创建副本，因为 tRPC 推断的类型是 readonly
      const newMessages = [...messagesData.messages];
      setAllMessages(newMessages);
      // 然后触发续传，直接传入找到的消息（避免时序问题）
      resumeConversation(interruptedMsg);
    }
  }, [messagesData, currentConversationId, resumeConversation]);

  const stopStreaming = useMemoizedFn(() => {
    abort();
    const msgId = streamingMessageIdRef.current;
    if (msgId) {
      setAllMessages((prev) =>
        prev.map((msg) => (msg.id === msgId ? { ...msg, status: 'stopped' as const } : msg))
      );
    }
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
  });

  const loadMoreMessages = useMemoizedFn(() => {
    if (hasMore && !isLoadingMore) {
      setIsLoadingMore(true);
      setOffset((prev) => prev + PAGE_SIZE);
    }
  });

  /**
   * 删除消息
   */
  const deleteMessageMutation = trpc.message.delete.useMutation({
    onSuccess: (result) => {
      // 直接更新本地消息列表
      setAllMessages(result.messages);
      // 刷新会话列表以更新消息计数
      utils.conversation.getAll.invalidate();
    },
  });

  const deleteMessage = useMemoizedFn((messageId: string) => {
    if (currentConversationId) {
      deleteMessageMutation.mutate({ conversationId: currentConversationId, messageId });
    }
  });

  /**
   * 重新生成最后一条 assistant 回复
   */
  const regenerate = useMemoizedFn(async () => {
    if (!currentConversationId || isStreamingRef.current) return;

    // 找到最后一条 user 消息
    let lastUserIdx = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].role === 'user') {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx === -1) return;

    // 移除 lastUserIdx 之后的所有消息，并添加新的占位消息
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: currentConversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };

    // 更新本地消息列表
    const remaining = allMessages.slice(0, lastUserIdx + 1);
    setAllMessages([...remaining, assistantMessage]);

    setStreamingMessageId(assistantMessage.id);
    setIsStreaming(true);
    contentRef.current = '';

    // 发起 regenerate SSE 请求
    await regenerateStream(currentConversationId);
  });

  /**
   * 编辑用户消息并重新生成回复
   */
  const editAndResend = useMemoizedFn(async (messageId: string, newContent: string) => {
    if (!currentConversationId || isStreamingRef.current) return;

    const msgIndex = allMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // 创建占位 assistant 消息
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: currentConversationId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      status: 'streaming',
    };

    // 更新本地消息列表：更新用户消息，移除之后的所有内容，添加新 assistant 消息
    const updated: Message[] = [
      ...allMessages.slice(0, msgIndex),
      { ...allMessages[msgIndex], content: newContent },
      assistantMessage,
    ];
    setAllMessages(updated);

    setStreamingMessageId(assistantMessage.id);
    setIsStreaming(true);
    contentRef.current = '';

    // 发起 edit-and-resend SSE 请求
    await editAndResendStream(currentConversationId, messageId, newContent);
  });

  return {
    messages: allMessages,
    isStreaming,
    sendMessage,
    stopStreaming,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    deleteMessage,
    regenerate,
    editAndResend,
  };
}
