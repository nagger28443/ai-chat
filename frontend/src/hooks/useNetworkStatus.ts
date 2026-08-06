import { useState, useEffect, useCallback } from 'react';
import { queryClient } from '../lib/queryClient';

/**
 * 网络状态 hook
 *
 * 监听浏览器 online/offline 事件，提供实时网络状态。
 * 当网络从离线恢复为在线时，自动失效所有 react-query 缓存，
 * 触发数据重新获取——实现"自动恢复"模式。
 *
 * 用法：
 * ```tsx
 * const { isOnline } = useNetworkStatus();
 * if (!isOnline) return <OfflineBanner />;
 * ```
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(
    () => typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    // 网络恢复时，失效所有查询缓存，触发自动重新获取
    queryClient.invalidateQueries();
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline };
}
