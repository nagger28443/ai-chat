import { useNavigate } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { ConversationList } from './ConversationList';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const createMutation = trpc.conversation.create.useMutation({
    onSuccess: async (conversation) => {
      await utils.conversation.getAll.invalidate();
      navigate(`/conversation/${conversation.id}`);
    },
  });

  return (
    <div className={styles.sidebar}>
      <button
        className={styles.newBtn}
        onClick={() => createMutation.mutate({})}
        disabled={createMutation.isPending}
      >
        <span className={styles.newBtnIcon}>+</span>
        <span>新建会话</span>
      </button>
      <ConversationList />
    </div>
  );
}
