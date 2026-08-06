import { useState, useCallback } from 'react';
import type { Message } from '../../types';
import { MAX_MESSAGE_LENGTH } from '../../types';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { MessageActions } from './MessageActions';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  /** 消息数据 */
  message: Message;
  /** 操作是否被禁用（其他操作正在进行时） */
  disabled?: boolean;
  /** 删除消息的回调 */
  onDelete?: (messageId: string) => void;
  /** 重新生成 AI 回复的回调 */
  onRegenerate?: () => void;
  /** 编辑并重发的回调 */
  onEditAndResend?: (messageId: string, newContent: string) => void;
  /** 重试失败消息的回调 */
  onRetry?: (messageId: string) => void;
}

export function MessageItem({ message, disabled, onDelete, onRegenerate, onEditAndResend, onRetry }: MessageItemProps) {
  const isUser = message.role === 'user';
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditContent(message.content);
  }, [message.content]);

  const handleEditConfirm = useCallback(() => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && trimmed.length <= MAX_MESSAGE_LENGTH) {
      onEditAndResend?.(message.id, trimmed);
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, onEditAndResend]);

  const handleEditCancel = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(false);
  }, [message.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleEditConfirm();
      } else if (e.key === 'Escape') {
        handleEditCancel();
      }
    },
    [handleEditConfirm, handleEditCancel]
  );

  return (
    <div
      className={`${styles.messageItem} ${isUser ? styles.user : styles.assistant}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
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
            isEditing ? (
              <div className={styles.editContainer}>
                <textarea
                  className={styles.editTextarea}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  rows={3}
                />
                <div className={styles.editActions}>
                  <button className={styles.editCancelBtn} onClick={handleEditCancel} disabled={disabled}>
                    取消
                  </button>
                  <button className={styles.editConfirmBtn} onClick={handleEditConfirm} disabled={disabled}>
                    发送
                  </button>
                </div>
              </div>
            ) : (
              <p>{message.content}</p>
            )
          ) : (
            <MarkdownRenderer
              content={message.content}
              isStreaming={message.status === 'streaming' || message.status === 'generating'}
            />
          )}
          {message.status === 'streaming' && !isEditing && (
            <span className={styles.cursor}>▊</span>
          )}
          {message.status === 'generating' && (
            <span className={styles.interrupted}>「生成中…」</span>
          )}
          {message.status === 'stopped' && (
            <span className={styles.interrupted}>「已中断」</span>
          )}
          {message.status === 'error' && (
            <span className={styles.error}>
              「错误: {message.error}」
              {onRetry && (
                <button
                  className={styles.retryBtn}
                  disabled={disabled}
                  onClick={() => onRetry(message.id)}
                >
                  🔄 重试
                </button>
              )}
            </span>
          )}
        </div>
        {!isEditing && (
          <MessageActions
            role={message.role}
            content={message.content}
            visible={isHovered}
            disabled={disabled}
            onRegenerate={onRegenerate}
            onEdit={isUser ? handleEdit : undefined}
            onDelete={() => onDelete?.(message.id)}
          />
        )}
      </div>
    </div>
  );
}
