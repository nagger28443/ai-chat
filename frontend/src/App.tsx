import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { OfflineBanner } from './components/Common/OfflineBanner';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ConversationView } from './components/Conversation/ConversationView';
import { useTheme } from './hooks/useTheme';
import { useSearchParam } from './hooks/useSearchParam';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { queryClient } from './lib/queryClient';
import { trpc } from './lib/trpc';
import type { Theme } from './types';

/**
 * 应用入口：仅负责创建 tRPC client 并包裹 Provider
 *
 * 注意：tRPC hooks 必须在 trpc.Provider 内部调用，
 * 因此依赖 tRPC 的逻辑（如会话列表校验）放在 AppContent 中。
 */
function App() {
  // 在顶层初始化主题，确保首屏无闪烁
  const { theme, toggleTheme } = useTheme();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
        }),
      ],
    })
  );

  return (
    <ErrorBoundary>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AppContent theme={theme} toggleTheme={toggleTheme} />
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}

/**
 * 应用主体：在 Provider 内部运行，可使用 tRPC hooks
 *
 * 职责：
 * - 管理当前会话 ID（通过 URL 参数）
 * - 校验 URL 中的 conversationId 是否有效，无效时自动清除
 * - 渲染离线提示、主布局、侧边栏、会话视图
 */
function AppContent({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  // 会话 ID 通过 URL 管理（可分享、可刷新恢复、浏览器前进/后退友好）
  const [currentConversationId, setCurrentConversationId] = useSearchParam('conversationId');
  // 网络状态（离线时显示提示，恢复后自动重试请求）
  const { isOnline } = useNetworkStatus();

  // 获取会话列表，用于验证 URL 中的 conversationId 是否有效
  const { data: conversationsData, isLoading: isLoadingConversations } =
    trpc.conversation.getAll.useQuery(undefined, {
      // 离线时不发起请求，避免无效错误
      enabled: isOnline,
    });

  // 验证 conversationId：列表加载完成后检查是否存在
  const conversationIdIsValid = useMemo(() => {
    // URL 无参数 → 默认首页状态，视为有效
    if (!currentConversationId) return true;
    // 列表未加载（首次加载 / 离线）→ 暂不判定
    if (!conversationsData) return true;
    // 列表已加载 → 检查是否存在
    return conversationsData.some((c) => c.id === currentConversationId);
  }, [currentConversationId, conversationsData]);

  // URL 中的 conversationId 无效 → 清除 URL 参数
  useEffect(() => {
    if (!conversationIdIsValid && !isLoadingConversations) {
      setCurrentConversationId(null);
    }
  }, [conversationIdIsValid, isLoadingConversations, setCurrentConversationId]);

  return (
    <>
      {!isOnline && <OfflineBanner />}
      <Layout theme={theme} onToggleTheme={toggleTheme} sidebar={<Sidebar />}>
        <ConversationView conversationId={currentConversationId} />
      </Layout>
    </>
  );
}

export default App;
