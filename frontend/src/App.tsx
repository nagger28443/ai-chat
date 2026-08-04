import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { ConversationProvider } from './context/ConversationContext';

function App() {
  return (
    <ConversationProvider>
      <Layout sidebar={<Sidebar />}>
        <ChatWindow />
      </Layout>
    </ConversationProvider>
  );
}

export default App;
