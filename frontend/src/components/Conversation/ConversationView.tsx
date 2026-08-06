import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMemoizedFn } from 'ahooks';
import { trpc } from '../../lib/trpc';
import { useSSE } from '../../hooks/useSSE';
import type { Message } from '../../types';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import styles from './ConversationView.module.css';

const PAGE_SIZE = 10;

interface ConversationViewProps {
  conversationId: string | null;
}

/**
 * ConversationView - 会话视图组件
 * 接收 conversationId 作为 prop，内部管理所有 chat 逻辑
 * 使用 tRPC + react-query 管理 API 数据
 * 使用 React state 管理流式状态
 */
export function ConversationView({ conversationId }: ConversationViewProps) {
  const utils = trpc.useUtils();

  // 分页状态
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 消息列表：使用 useQuery
  const { data: messagesData } = trpc.conversation.getMessages.useQuery(
    { conversationId: conversationId!, limit: PAGE_SIZE, offset },
    {
      enabled: !!conversationId,
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

  // 记录当前正在续传的会话 ID（有活跃的 SSE 连接）
  const resumingConversationsRef = useRef<Set<string>>(new Set());
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
    // 从续传集合中移除（续传已完成）
    if (conversationId) {
      resumingConversationsRef.current.delete(conversationId);
    }
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
    // 从续传集合中移除（续传出错）
    if (conversationId) {
      resumingConversationsRef.current.delete(conversationId);
    }
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
    // 将当前会话从续传集合中移除（因为连接已断开）
    if (conversationId) {
      resumingConversationsRef.current.delete(conversationId);
    }
    // 重置流式状态
    setIsStreaming(false);
    setStreamingMessageId(null);
    contentRef.current = '';
    // 重置分页
    setOffset(0);
  }, [conversationId]);

  const sendMessage = useMemoizedFn(async (content: string) => {
    if (!conversationId || isStreamingRef.current) return;

    // 添加用户消息
    const userMessage: Message = {
      id: uuidv4(),
      conversationId: conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      status: 'completed',
    };

    // 添加 AI 消息（占位）
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: conversationId,
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
    await sendSSERequest(conversationId, content);
  });

  /**
   * 续传中断的对话
   * @param targetMsg 可选，直接传入要续传的消息（避免依赖 messagesRef 的时序问题）
   */
  const resumeConversation = useMemoizedFn(async (targetMsg?: Message) => {
    if (!conversationId || isStreamingRef.current) return;

    // 找到中断的消息：优先使用传入的参数，否则从 messagesRef 中查找
    const interruptedMsg =
      targetMsg ??
      messagesRef.current.find(
        (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
      );

    if (!interruptedMsg) return;

    setStreamingMessageId(interruptedMsg.id);
    setIsStreaming(true);

    // 重置 contentRef，后端会从位置 0 开始发送所有内容
    contentRef.current = '';

    // 更新本地状态
    setAllMessages((prev) =>
      prev.map((msg) =>
        msg.id === interruptedMsg.id ? { ...msg, status: 'streaming' as const, content: '' } : msg
      )
    );

    // 后端会从位置 0 开始发送所有缓存内容
    await resumeStream(conversationId);
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
    if (!conversationId) return;
    if (isStreamingRef.current) return;

    // 防止重复调度：检查是否已经有活跃的 SSE 连接
    if (resumingConversationsRef.current.has(conversationId)) return;

    // 直接从 messagesData 中查找中断的消息（不依赖 allMessages，避免时序问题）
    const messages = messagesData.messages;
    const interruptedMsg = messages.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (interruptedMsg) {
      // 标记这个会话正在续传
      resumingConversationsRef.current.add(conversationId);
      // 需要先更新 allMessages 状态（后端已按时间顺序排列）
      // 使用 spread 创建副本，因为 tRPC 推断的类型是 readonly
      const newMessages = [...messagesData.messages];
      setAllMessages(newMessages);
      // 然后触发续传，直接传入找到的消息（避免时序问题）
      resumeConversation(interruptedMsg);
    }
  }, [messagesData, conversationId, resumeConversation]);

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
    if (conversationId) {
      deleteMessageMutation.mutate({ conversationId: conversationId, messageId });
    }
  });

  /**
   * 重新生成最后一条 assistant 回复
   */
  const regenerate = useMemoizedFn(async () => {
    if (!conversationId || isStreamingRef.current) return;

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
      conversationId: conversationId,
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
    await regenerateStream(conversationId);
  });

  /**
   * 编辑用户消息并重新生成回复
   */
  const editAndResend = useMemoizedFn(async (messageId: string, newContent: string) => {
    if (!conversationId || isStreamingRef.current) return;

    const msgIndex = allMessages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    // 创建占位 assistant 消息
    const assistantMessage: Message = {
      id: uuidv4(),
      conversationId: conversationId,
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
    await editAndResendStream(conversationId, messageId, newContent);
  });

  if (!conversationId) {
    return null;
  }

  return (
    <div className={styles.conversationView}>
      <MessageList
        messages={allMessages}
        isLoading={isStreaming}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMoreMessages}
        onDeleteMessage={deleteMessage}
        onRegenerate={regenerate}
        onEditAndResend={editAndResend}
      />
      <InputArea onSend={sendMessage} onStop={stopStreaming} isLoading={isStreaming} />
    </div>
  );
}
