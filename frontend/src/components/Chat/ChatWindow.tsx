import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { useChat } from '../../hooks/useChat';
import styles from './ChatWindow.module.css';

export function ChatWindow() {
  const { messages, isStreaming, sendMessage, stopStreaming } = useChat();

  return (
    <div className={styles.chatWindow}>
      <MessageList messages={messages} isLoading={isStreaming} />
      <InputArea
        onSend={sendMessage}
        onStop={stopStreaming}
        isLoading={isStreaming}
      />
    </div>
  );
}
