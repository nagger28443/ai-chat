import { Layout } from './components/Layout/Layout';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';

function App() {
  return (
    <Layout sidebar={<Sidebar />}>
      <ChatWindow />
    </Layout>
  );
}

export default App;
