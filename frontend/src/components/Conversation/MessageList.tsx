import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Message } from '../../types';
import { SCROLL_NEAR_BOTTOM_THRESHOLD } from '../../constants';
import { MessageItem } from './MessageItem';
import styles from './MessageList.module.css';

/**
 * 消息列表组件
 *
 * 渲染消息列表，支持：
 * - 自动滚动到最新消息
 * - 向上滚动加载更多历史消息
 * - 断线重连提示
 * - 操作期间禁用交互按钮
 */
interface MessageListProps {
  /** 当前消息列表 */
  messages: Message[];
  /** 是否正在加载初始消息 */
  isLoading?: boolean;
  /** 是否正在断线重连（显示提示条） */
  isReconnecting?: boolean;
  /** 是否有操作进行中（禁用消息操作按钮） */
  isOperationPending?: boolean;
  /** 是否还有更旧的消息 */
  hasMore?: boolean;
  /** 是否正在加载更多 */
  isLoadingMore?: boolean;
  /** 加载更多历史消息的回调 */
  onLoadMore?: () => void;
  /** 删除消息的回调 */
  onDeleteMessage?: (messageId: string) => void;
  /** 重新生成最后一条 AI 回复的回调 */
  onRegenerate?: () => void;
  /** 编辑用户消息并重新生成的回调 */
  onEditAndResend?: (messageId: string, newContent: string) => void;
  /** 重试失败消息的回调 */
  onRetry?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isLoading,
  isReconnecting = false,
  isOperationPending = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onDeleteMessage,
  onRegenerate,
  onEditAndResend,
  onRetry,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);

  // 实时状态：用户是否在底部附近（50px 容差）→ 决定新消息时是否自动滚动
  const isNearBottomRef = useRef(false);
  // 一次性标记：首次加载时滚到底部
  const isInitialLoadRef = useRef(true);
  // 合并 3 个 prev refs 为 1 个：用于检测消息变化类型（追加 / 前置 / 会话切换）
  const prevMessagesRef = useRef<Message[]>([]);
  // 加载更多时的滚动位置恢复状态（替代 requestAnimationFrame）
  const pendingScrollRestoreRef = useRef<{ prevScrollHeight: number } | null>(null);

  // 监听滚动，追踪是否在底部
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onScroll = () => {
      isNearBottomRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight < SCROLL_NEAR_BOTTOM_THRESHOLD;
    };

    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * 同步滚动调整（useLayoutEffect，在浏览器绘制前执行，避免闪烁）
   *
   * 三种情况，按优先级：
   * 1. 加载更多完成 → 恢复滚动位置（必须最先判断，因为前置也会改变 firstId）
   * 2. 首次加载或会话切换 → 滚到底部
   * 3. 新消息追加 → 如果用户在底部附近，平滑滚动
   */
  useLayoutEffect(() => {
    if (messages.length === 0) {
      prevMessagesRef.current = messages;
      return;
    }

    const prevMessages = prevMessagesRef.current;
    const prevFirstId = prevMessages[0]?.id ?? null;
    const prevLastId = prevMessages[prevMessages.length - 1]?.id ?? null;
    const firstId = messages[0]?.id ?? null;
    const lastId = messages[messages.length - 1]?.id ?? null;
    const prevLength = prevMessages.length;
    const currLength = messages.length;

    // 更新为当前值（供下次渲染使用）
    prevMessagesRef.current = messages;

    // 情况 1：加载更多完成 → 恢复滚动位置
    // 必须在"会话切换"之前判断：前置也会改变 firstId，但不应该滚到底部
    if (pendingScrollRestoreRef.current) {
      const container = containerRef.current;
      if (container) {
        const { prevScrollHeight } = pendingScrollRestoreRef.current;
        const diff = container.scrollHeight - prevScrollHeight;
        if (diff > 0) container.scrollTop += diff;
      }
      pendingScrollRestoreRef.current = null;
      return;
    }

    // 情况 2：首次加载 / 会话切换 / 消息被清空后重新加载 → 滚到底部
    if (isInitialLoadRef.current || prevMessages.length === 0 || (prevFirstId !== null && prevFirstId !== firstId)) {
      isInitialLoadRef.current = false;
      bottomRef.current?.scrollIntoView();
      isNearBottomRef.current = true;
      return;
    }

    // 情况 3：新消息追加 → 如果用户在底部附近，平滑滚动
    if (currLength > prevLength && prevLastId !== lastId && isNearBottomRef.current) {
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
          // 记录加载前的 scrollHeight，供 useLayoutEffect 恢复滚动位置
          pendingScrollRestoreRef.current = { prevScrollHeight: container.scrollHeight };
          onLoadMore();
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
          disabled={isOperationPending}
          onDelete={onDeleteMessage}
          onRegenerate={onRegenerate}
          onEditAndResend={onEditAndResend}
          onRetry={onRetry}
        />
      ))}
      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.loadingDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span>{isReconnecting ? '正在重新连接...' : 'AI 正在思考...'}</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
