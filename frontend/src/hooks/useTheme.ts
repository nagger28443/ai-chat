import { useState, useEffect, useCallback } from 'react';
import type { Theme } from '../types';

type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage 不可用
  }
  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 主题管理 Hook
 * - 支持 light / dark / system 三种模式
 * - system 模式自动跟随系统主题切换
 * - 通过 data-theme 属性应用到 DOM（兼容 themes.css）
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  // 应用主题到 DOM
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme, resolvedTheme]);

  // 监听系统主题变化（仅 system 模式下生效）
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const order: Theme[] = ['light', 'dark', 'system'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
  };
}
