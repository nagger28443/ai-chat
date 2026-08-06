import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { OfflineBanner } from './components/Common/OfflineBanner';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ConversationView } from './components/Conversation/ConversationView';
import { useTheme } from './hooks/useTheme';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { queryClient } from './lib/queryClient';
import { trpc } from './lib/trpc';
import type { Theme } from './types';

/**
 * 应用入口：创建 tRPC client 并包裹 Provider + Router
 */
function App() {
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
 * 应用主体：在 Provider 内部运行，使用 react-router 管理路由
 *
 * 路由定义：
 * - `/` → 首页（无会话，显示空状态）
 * - `/conversation/:conversationId` → 具体会话
 * - 其他路径 → 重定向到首页
 */
function AppContent({ theme, toggleTheme }: { theme: Theme; toggleTheme: () => void }) {
  const { isOnline } = useNetworkStatus();

  return (
    <>
      {!isOnline && <OfflineBanner />}
      <Layout theme={theme} onToggleTheme={toggleTheme} sidebar={<Sidebar />}>
        <Routes>
          <Route path="/" element={<EmptyState />} />
          <Route path="/conversation/:conversationId" element={<ConversationRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </>
  );
}

/**
 * 首页空状态：无会话选中
 */
function EmptyState() {
  return <ConversationView conversationId={null} />;
}

/**
 * 会话路由：从 URL 参数读取 conversationId 并校验有效性
 *
 * 如果 conversationId 不存在（会话被删除等），自动重定向到首页
 */
function ConversationRoute() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  // 获取会话列表，用于验证 URL 中的 conversationId 是否有效
  const { data: conversationsData, isLoading: isLoadingConversations } =
    trpc.conversation.getAll.useQuery(undefined, {
      // 无 conversationId 时不查询
      enabled: !!conversationId,
    });

  // 验证 conversationId：列表加载完成后检查是否存在
  const isValid = useMemo(() => {
    if (!conversationId) return false;
    if (!conversationsData) return true; // 加载中，暂不判定
    return conversationsData.some((c) => c.id === conversationId);
  }, [conversationId, conversationsData]);

  // 无效 → 重定向到首页
  useEffect(() => {
    if (!isValid && !isLoadingConversations) {
      navigate('/', { replace: true });
    }
  }, [isValid, isLoadingConversations, navigate]);

  // 加载中或无效时显示空状态
  if (!conversationId || (!isValid && isLoadingConversations)) {
    return <ConversationView conversationId={null} />;
  }

  return <ConversationView conversationId={conversationId} />;
}

export default App;
