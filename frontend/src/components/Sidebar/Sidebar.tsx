import { useSetAtom } from 'jotai';
import { createConversationAtom } from '../../atoms/actions';
import { ConversationList } from './ConversationList';
import styles from './Sidebar.module.css';

export function Sidebar() {
  const createConversation = useSetAtom(createConversationAtom);

  const handleNewConversation = async () => {
    await createConversation();
  };

  return (
    <div className={styles.sidebar}>
      <button className={styles.newBtn} onClick={handleNewConversation}>
        <span className={styles.newBtnIcon}>+</span>
        <span>新建会话</span>
      </button>
      <ConversationList />
    </div>
  );
}
