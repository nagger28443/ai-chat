import React from 'react';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function Layout({ children, sidebar }: LayoutProps) {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.logo}>AI Chat Demo</div>
        <div className={styles.headerActions}>
          {/* 主题切换按钮将在这里添加 */}
        </div>
      </header>
      <div className={styles.main}>
        {sidebar && <aside>{sidebar}</aside>}
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
