import type { Message } from '../../types';
import { MarkdownRenderer } from '../Common/MarkdownRenderer';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.messageItem} ${isUser ? styles.user : styles.assistant}`}>
      <div className={styles.avatar}>
        {isUser ? '👤' : '🤖'}
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <span className={styles.role}>
            {isUser ? '你' : 'AI 助手'}
          </span>
          <span className={styles.time}>
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
        </div>
        <div className={styles.text}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} />
          )}
          {message.status === 'streaming' && (
            <span className={styles.cursor}>▊</span>
          )}
          {message.status === 'generating' && (
            <span className={styles.interrupted}>「生成中…」</span>
          )}
          {message.status === 'stopped' && (
            <span className={styles.interrupted}>「已中断」</span>
          )}
          {message.status === 'error' && (
            <span className={styles.error}>「错误: {message.error}」</span>
          )}
        </div>
      </div>
    </div>
  );
}
