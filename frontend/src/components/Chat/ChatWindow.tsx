import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useChat } from '../../hooks/useChat';
import styles from './ChatWindow.module.css';

export function ChatWindow() {
  const { messages, isStreaming, sendMessage, stopStreaming, hasMore, isLoadingMore, loadMoreMessages } = useChat();

  return (
    <div className={styles.chatWindow}>
      <MessageList
        messages={messages}
        isLoading={isStreaming}
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMoreMessages}
      />
      <InputArea
        onSend={sendMessage}
        onStop={stopStreaming}
        isLoading={isStreaming}
      />
    </div>
  );
}
