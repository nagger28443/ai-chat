import { useState, useCallback } from 'react';
import styles from './MessageActions.module.css';

interface MessageActionsProps {
  /** 消息角色 */
  role: 'user' | 'assistant';
  /** 消息内容（用于复制） */
  content: string;
  /** 操作栏是否可见（由父组件的 hover 状态控制） */
  visible: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageActions({
  role,
  content,
  visible,
  onCopy,
  onRegenerate,
  onEdit,
  onDelete,
}: MessageActionsProps) {
  const [showCopied, setShowCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 1500);
    onCopy?.();
  }, [content, onCopy]);

  return (
    <div className={`${styles.actionBar} ${visible ? styles.visible : ''}`}>
      <button
        className={styles.actionBtn}
        onClick={handleCopy}
        title="复制消息"
      >
        📋
        {showCopied && <span className={styles.copied}>已复制</span>}
      </button>
      {role === 'assistant' && onRegenerate && (
        <button
          className={styles.actionBtn}
          onClick={onRegenerate}
          title="重新生成"
        >
          🔄
        </button>
      )}
      {role === 'user' && onEdit && (
        <button
          className={styles.actionBtn}
          onClick={onEdit}
          title="编辑并重发"
        >
          ✏️
        </button>
      )}
      {onDelete && (
        <button
          className={styles.actionBtn}
          onClick={onDelete}
          title="删除消息"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
