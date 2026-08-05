import type { Theme } from '../../types';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  theme: Theme;
  onToggle: () => void;
}

const themeIcons: Record<Theme, { icon: string; label: string }> = {
  light: { icon: '☀️', label: '亮色模式' },
  dark: { icon: '🌙', label: '暗色模式' },
  system: { icon: '💻', label: '跟随系统' },
};

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const { icon, label } = themeIcons[theme];

  return (
    <button
      className={styles.themeToggle}
      onClick={onToggle}
      title={`${label}（点击切换）`}
      aria-label={`当前：${label}，点击切换`}
    >
      <span className={styles.icon}>{icon}</span>
    </button>
  );
}
