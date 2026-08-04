import { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import { MessageItem } from './MessageItem';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        <div className={styles.emptyText}>开始新的对话吧！</div>
      </div>
    );
  }

  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
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
      <div ref={messagesEndRef} />
    </div>
  );
}
