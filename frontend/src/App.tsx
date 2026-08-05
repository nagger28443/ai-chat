import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { useTheme } from './hooks/useTheme';

function App() {
  // 在顶层初始化主题，确保首屏无闪烁
  const { theme, toggleTheme } = useTheme();

  return (
    <Layout theme={theme} onToggleTheme={toggleTheme} sidebar={<Sidebar />}>
      <ChatWindow />
    </Layout>
  );
}

export default App;
