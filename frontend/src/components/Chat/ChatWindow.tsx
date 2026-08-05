import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useChat } from '../../hooks/useChat';
import styles from './ChatWindow.module.css';
import { currentConversationIdAtom } from '../../atoms/conversation';
import { useAtom } from 'jotai';

export function ChatWindow() {
  const {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
    deleteMessage,
    regenerate,
    editAndResend,
  } = useChat();
  const [currentConversationId] = useAtom(currentConversationIdAtom);

  if (!currentConversationId) {
    return null;
  }
  return (
    <div className={styles.chatWindow}>
      <MessageList
        messages={messages}
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
