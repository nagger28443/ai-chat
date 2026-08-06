import { useState, useRef, useEffect } from 'react';
import { MAX_MESSAGE_LENGTH } from '../../types';
import styles from './InputArea.module.css';

interface InputAreaProps {
  onSend: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export function InputArea({ onSend, onStop, isLoading, disabled }: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOverLimit = input.length > MAX_MESSAGE_LENGTH;
  const showCounter = input.length > MAX_MESSAGE_LENGTH * 0.8; // 超过 80% 时显示计数器

  // 自动调整高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 自动聚焦
  useEffect(() => {
    if (!disabled && !isLoading) {
      textareaRef.current?.focus();
    }
  }, [disabled, isLoading]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled || isOverLimit) return;
    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    onStop?.();
  };

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputWrapper}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
          className={styles.textarea}
          disabled={disabled || isLoading}
          rows={1}
        />
        {showCounter && (
          <span className={`${styles.counter} ${isOverLimit ? styles.overLimit : ''}`}>
            {input.length}/{MAX_MESSAGE_LENGTH}
          </span>
        )}
      </div>
      {isLoading ? (
        <button
          onClick={handleStop}
          className={`${styles.button} ${styles.stopButton}`}
          title="停止生成"
        >
          ⏹
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled || isOverLimit}
          className={`${styles.button} ${styles.sendButton}`}
          title="发送消息"
        >
          ➤
        </button>
      )}
    </div>
  );
}
