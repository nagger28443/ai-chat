import { QueryClient } from '@tanstack/react-query';

/**
 * React Query 客户端
 * 配置全局默认选项
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 1 分钟内认为数据是新鲜的，不自动重新请求
      staleTime: 1000 * 60,
      // 窗口获得焦点时不自动刷新（避免不必要的请求）
      refetchOnWindowFocus: false,
      // 失败重试 1 次
      retry: 1,
    },
  },
});
