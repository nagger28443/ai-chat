import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { ErrorBoundary } from './components/Common/ErrorBoundary';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ConversationView } from './components/Conversation/ConversationView';
import { useTheme } from './hooks/useTheme';
import { useSearchParam } from './hooks/useSearchParam';
import { queryClient } from './lib/queryClient';
import { trpc } from './lib/trpc';

function App() {
  // 在顶层初始化主题，确保首屏无闪烁
  const { theme, toggleTheme } = useTheme();
  // 会话 ID 通过 URL 管理（可分享、可刷新恢复、浏览器前进/后退友好）
  const [currentConversationId] = useSearchParam('conversationId');

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
          <Layout theme={theme} onToggleTheme={toggleTheme} sidebar={<Sidebar />}>
            <ConversationView conversationId={currentConversationId} />
          </Layout>
        </QueryClientProvider>
      </trpc.Provider>
    </ErrorBoundary>
  );
}

export default App;
