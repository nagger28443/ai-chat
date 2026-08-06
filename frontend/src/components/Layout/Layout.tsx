import React from 'react';
import type { Theme } from '../../types';
import { ThemeToggle } from '../common/ThemeToggle';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
}

export function Layout({ children, sidebar, theme, onToggleTheme }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.logo}>AI Chat Demo</div>
        <div className={styles.headerActions}>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </header>
      <div className={styles.main}>
        {sidebar && <aside>{sidebar}</aside>}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
