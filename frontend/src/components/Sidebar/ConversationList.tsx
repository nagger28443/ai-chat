import { trpc } from '../../lib/trpc';
import { useSearchParam } from '../../hooks/useSearchParam';
import { ConversationItem } from './ConversationItem';
import styles from './ConversationList.module.css';

export function ConversationList() {
  const { data: conversations, isLoading } = trpc.conversation.getAll.useQuery();
  const [currentId] = useSearchParam('conversationId');

  if (isLoading) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>⏳</div>
        <div className={styles.emptyText}>加载中...</div>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        <div className={styles.emptyText}>暂无会话</div>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === currentId}
        />
      ))}
    </div>
  );
}
