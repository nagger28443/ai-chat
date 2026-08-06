import { useConversationChat } from '../../hooks/useConversationChat';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import styles from './ConversationView.module.css';

interface ConversationViewProps {
  conversationId: string | null;
}

/**
 * ConversationView - 会话视图组件
 *
 * 纯编排层：接收 conversationId，委托 useConversationChat 处理所有 chat 逻辑，
 * 自身只负责 UI 渲染。
 */
export function ConversationView({ conversationId }: ConversationViewProps) {
  const {
    messages,
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
  } = useConversationChat({ conversationId });

  if (!conversationId) {
    return null;
  }

  return (
    <div className={styles.conversationView}>
      <MessageList
        messages={messages}
        isLoading={isStreaming}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMoreMessages}
        onDeleteMessage={deleteMessage}
        onRegenerate={regenerate}
        onEditAndResend={editAndResend}
        onRetry={retryMessage}
      />
      <InputArea onSend={sendMessage} onStop={stopStreaming} isLoading={isStreaming} />
    </div>
  );
}
