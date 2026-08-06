import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMemoizedFn } from 'ahooks';
import { trpc } from '../lib/trpc';
import { useSSE } from './useSSE';
import type { Message } from '../types';

const PAGE_SIZE = 10;

interface UseConversationChatOptions {
  conversationId: string | null;
}

/**
 * useConversationChat - 会话 chat 逻辑 hook
 *
 * 接收 conversationId 作为参数，封装完整的会话交互逻辑：
 * - 消息加载与分页
 * - 流式响应处理
 * - 发送/续传/重新生成/编辑重发
 * - SSE 连接生命周期管理
 *
 * 纯 hook，不依赖全局状态，可测试、可复用。
 */
export function useConversationChat({ conversationId }: UseConversationChatOptions) {
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
    if (!messagesData) return;

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
  // 重试动作映射：messageId → 重试函数。错误时保留，成功时清除
  const retryActionsRef = useRef<Map<string, () => Promise<void>>>(new Map());

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
      // 成功完成：清除该消息的重试动作
      retryActionsRef.current.delete(msgId);
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
  }, [conversationId, abort]);

  // 组件销毁时中止当前 SSE 连接（包括 resume/sendMessage/regenerate/editAndResend）
  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

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

    // 构造"执行发送"函数（重试时复用同一逻辑）
    const doSend = async () => {
      setStreamingMessageId(assistantMessage.id);
      setIsStreaming(true);
      contentRef.current = '';
      // 重试时重置消息状态
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? { ...msg, status: 'streaming' as const, content: '', error: undefined }
            : msg
        )
      );
      await sendSSERequest(conversationId, content);
    };

    // 注册重试动作（失败后保留，成功后在 onDone 中清除）
    retryActionsRef.current.set(assistantMessage.id, doSend);

    await doSend();
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

    // 构造"执行续传"函数（重试时复用同一逻辑）
    const doResume = async () => {
      setStreamingMessageId(interruptedMsg.id);
      setIsStreaming(true);
      contentRef.current = '';
      // 重置消息状态
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === interruptedMsg.id
            ? { ...msg, status: 'streaming' as const, content: '', error: undefined }
            : msg
        )
      );
      await resumeStream(conversationId);
    };

    // 注册重试动作
    retryActionsRef.current.set(interruptedMsg.id, doResume);

    await doResume();
  });

  /**
   * 自动续传：消息加载完成后检测中断消息并触发续传
   *
   * 直接在 messagesData 变化时执行，无需 prevDataRef hack：
   * - React useEffect 已保证只在依赖变化时运行
   * - 仅在初始加载（offset === 0）时触发，加载历史消息不触发
   * - resumingConversationsRef 防止同一会话重复调度
   */
  useEffect(() => {
    if (!messagesData || !conversationId || isStreamingRef.current) return;
    if (offset !== 0) return;
    if (resumingConversationsRef.current.has(conversationId)) return;

    const interruptedMsg = messagesData.messages.find(
      (m) => m.role === 'assistant' && (m.status === 'generating' || m.status === 'stopped')
    );

    if (interruptedMsg) {
      resumingConversationsRef.current.add(conversationId);
      // 直接传入找到的消息，避免依赖 allMessages 状态的时序
      resumeConversation(interruptedMsg);
    }
  }, [messagesData, conversationId, offset, resumeConversation]);

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

    // 构造"执行重新生成"函数
    const doRegenerate = async () => {
      setStreamingMessageId(assistantMessage.id);
      setIsStreaming(true);
      contentRef.current = '';
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? { ...msg, status: 'streaming' as const, content: '', error: undefined }
            : msg
        )
      );
      await regenerateStream(conversationId);
    };

    // 注册重试动作
    retryActionsRef.current.set(assistantMessage.id, doRegenerate);

    await doRegenerate();
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

    // 构造"执行编辑重发"函数
    const doEditAndResend = async () => {
      setStreamingMessageId(assistantMessage.id);
      setIsStreaming(true);
      contentRef.current = '';
      setAllMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessage.id
            ? { ...msg, status: 'streaming' as const, content: '', error: undefined }
            : msg
        )
      );
      await editAndResendStream(conversationId, messageId, newContent);
    };

    // 注册重试动作
    retryActionsRef.current.set(assistantMessage.id, doEditAndResend);

    await doEditAndResend();
  });

  /**
   * 重试失败的消息操作
   * 从 retryActionsRef 中取出对应的重试函数并执行
   */
  const retryMessage = useMemoizedFn(async (messageId: string) => {
    const action = retryActionsRef.current.get(messageId);
    if (!action || isStreamingRef.current) return;
    await action();
  });

  return {
    messages: allMessages,
    isStreaming,
    hasMore,
    isLoadingMore,
    sendMessage,
    stopStreaming,
    loadMoreMessages,
    deleteMessage,
    regenerate,
    editAndResend,
    retryMessage,
  };
}
