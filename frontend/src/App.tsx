import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { useTheme } from './hooks/useTheme';
import { queryClient } from './lib/queryClient';
import { trpc } from './lib/trpc';

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
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <Layout theme={theme} onToggleTheme={toggleTheme} sidebar={<Sidebar />}>
          <ChatWindow />
        </Layout>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

export default App;
