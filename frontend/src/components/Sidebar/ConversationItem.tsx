import { useState, useRef, useEffect } from 'react';
import type { Conversation } from '../../types';
import { MAX_TITLE_LENGTH } from '../../types';
import { trpc } from '../../lib/trpc';
import { useSearchParam } from '../../hooks/useSearchParam';
import { formatRelativeTime } from '../../utils/date';
import styles from './ConversationItem.module.css';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const [, setCurrentConversationId] = useSearchParam('conversationId');
  const utils = trpc.useUtils();

  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => {
      utils.conversation.getAll.invalidate();
    },
  });

  const updateMutation = trpc.conversation.update.useMutation({
    onSuccess: () => {
      utils.conversation.getAll.invalidate();
      setIsEditing(false);
    },
  });

  // 编辑模式自动聚焦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      setCurrentConversationId(conversation.id);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这个会话吗？')) {
      deleteMutation.mutate({ id: conversation.id });
    }
  };

  const handleRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditTitle(conversation.title);
    setIsEditing(true);
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      updateMutation.mutate({ id: conversation.id, title: trimmed });
    } else {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(conversation.title);
    }
  };

  const relativeTime = formatRelativeTime(conversation.updatedAt);

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ''}`}
      onClick={handleClick}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          className={styles.editInput}
          value={editTitle}
          maxLength={MAX_TITLE_LENGTH}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <div className={styles.title}>{conversation.title}</div>
          <div className={styles.meta}>
            <span className={styles.time}>{relativeTime}</span>
            <div className={styles.actions}>
              <button className={styles.actionBtn} onClick={handleRename} title="重命名">
                ✏️
              </button>
              <button className={styles.actionBtn} onClick={handleDelete} title="删除">
                🗑️
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
