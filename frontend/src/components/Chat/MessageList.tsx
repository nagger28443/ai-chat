import { useEffect, useRef, useCallback } from 'react';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onDeleteMessage?: (messageId: string) => void;
  onRegenerate?: () => void;
  onEditAndResend?: (messageId: string, newContent: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onDeleteMessage,
  onRegenerate,
  onEditAndResend,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);
  const prevLastMsgIdRef = useRef<string | null>(null);
  const prevFirstMsgIdRef = useRef<string | null>(null);
  const isInitialLoadRef = useRef(true);

  // 判断用户是否在底部附近（50px 容差）
  const checkIsNearBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const threshold = 50;
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  // 监听滚动，追踪是否在底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      isNearBottomRef.current = checkIsNearBottom();
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [checkIsNearBottom]);

  // 消息变化时的滚动处理
  useEffect(() => {
    const prevLength = prevMessagesLengthRef.current;
    const currLength = messages.length;
    const lastMsg = messages[currLength - 1];
    const lastMsgId = lastMsg?.id ?? null;
    const firstMsgId = messages[0]?.id ?? null;

    // 检测会话切换：第一条消息 ID 变了，说明整个消息列表被替换
    const isConversationSwitch = prevFirstMsgIdRef.current !== null && prevFirstMsgIdRef.current !== firstMsgId;

    // 区分 prepend（加载更多）和 append（新消息）
    const isPrepend = prevLastMsgIdRef.current !== null && prevLastMsgIdRef.current === lastMsgId;

    prevMessagesLengthRef.current = currLength;
    prevLastMsgIdRef.current = lastMsgId;
    prevFirstMsgIdRef.current = firstMsgId;

    // 首次加载 或 切换会话：直接滚到底部（无动画）
    if ((isInitialLoadRef.current || isConversationSwitch) && currLength > 0) {
      isInitialLoadRef.current = false;
      bottomRef.current?.scrollIntoView();
      isNearBottomRef.current = true;
      return;
    }

    if (currLength <= prevLength) return;

    if (isPrepend) {
      // 加载更多：不滚动（IntersectionObserver 回调处理位置恢复）
      return;
    }

    // 新消息追加：如果用户在底部，自动滚动
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // IntersectionObserver：滚动到顶部时加载更多
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container || !hasMore || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && onLoadMore) {
          // 记录加载前的 scrollHeight，用于恢复滚动位置
          const prevScrollHeight = container.scrollHeight;

          onLoadMore();

          // 等待 DOM 更新后恢复滚动位置
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            const diff = newScrollHeight - prevScrollHeight;
            if (diff > 0) {
              container.scrollTop += diff;
            }
          });
        }
      },
      { root: container, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        <div className={styles.emptyText}>开始新的对话吧！</div>
      </div>
    );
  }

  return (
    <div className={styles.messageList} ref={containerRef}>
      {/* 顶部哨兵：进入视口时触发加载更多 */}
      {hasMore && (
        <div ref={topSentinelRef} className={styles.loadMoreTrigger}>
          {isLoadingMore ? '加载中...' : ''}
        </div>
      )}
      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          onDelete={onDeleteMessage}
          onRegenerate={onRegenerate}
          onEditAndResend={onEditAndResend}
        />
      ))}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.loadingDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>AI 正在思考...</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
