import { useSetAtom } from 'jotai';
import { trpc } from '../../lib/trpc';
import { currentConversationIdAtom } from '../../atoms/conversation';
import { ConversationList } from './ConversationList';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const setCurrentConversationId = useSetAtom(currentConversationIdAtom);
  const utils = trpc.useUtils();

  const createMutation = trpc.conversation.create.useMutation({
    onSuccess: (conversation) => {
      utils.conversation.getAll.invalidate();
      setCurrentConversationId(conversation.id);
    },
  });

  return (
    <div className={styles.sidebar}>
      <button className={styles.newBtn} onClick={() => createMutation.mutate({})} disabled={createMutation.isPending}>
        <span className={styles.newBtnIcon}>+</span>
        <span>新建会话</span>
      </button>
      <ConversationList />
    </div>
  );
}
