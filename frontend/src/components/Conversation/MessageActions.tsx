import { useState, useCallback } from 'react';
import { COPIED_INDICATOR_DURATION } from '../../constants';
import styles from './MessageActions.module.css';

interface MessageActionsProps {
  /** 消息角色 */
  role: 'user' | 'assistant';
  /** 消息内容（用于复制） */
  content: string;
  /** 操作栏是否可见（由父组件的 hover 状态控制） */
  visible: boolean;
  /** 操作是否被禁用（其他操作正在进行时） */
  disabled?: boolean;
  onCopy?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MessageActions({
  role,
  content,
  visible,
  disabled,
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
    setTimeout(() => setShowCopied(false), COPIED_INDICATOR_DURATION);
    onCopy?.();
  }, [content, onCopy]);

  return (
    <div className={`${styles.actionBar} ${visible ? styles.visible : ''}`}>
      <button
        className={styles.actionBtn}
        onClick={handleCopy}
        disabled={disabled}
        title="复制消息"
      >
        📋
        {showCopied && <span className={styles.copied}>已复制</span>}
      </button>
      {role === 'assistant' && onRegenerate && (
        <button
          className={styles.actionBtn}
          onClick={onRegenerate}
          disabled={disabled}
          title="重新生成"
        >
          🔄
        </button>
      )}
      {role === 'user' && onEdit && (
        <button
          className={styles.actionBtn}
          onClick={onEdit}
          disabled={disabled}
          title="编辑并重发"
        >
          ✏️
        </button>
      )}
      {onDelete && (
        <button
          className={styles.actionBtn}
          onClick={onDelete}
          disabled={disabled}
          title="删除消息"
        >
          🗑️
        </button>
      )}
    </div>
  );
}
