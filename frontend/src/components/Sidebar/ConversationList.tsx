import { useAtomValue } from 'jotai';
import { conversationsAtom, currentConversationIdAtom } from '../../atoms/conversation';
import { ConversationItem } from './ConversationItem';
import styles from './ConversationList.module.css';

export function ConversationList() {
  const conversations = useAtomValue(conversationsAtom);
  const currentId = useAtomValue(currentConversationIdAtom);

  if (conversations.length === 0) {
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
