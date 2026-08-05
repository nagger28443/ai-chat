import { Router } from 'express';
import { ConversationController } from '../controllers/conversationController.js';

const router = Router();

/**
 * 会话管理路由
 */

// 获取所有会话列表
router.get('/', ConversationController.getConversations);

// 创建新会话
router.post('/', ConversationController.createConversation);

// 删除会话
router.delete('/:id', ConversationController.deleteConversation);

// 更新会话（重命名）
router.put('/:id', ConversationController.updateConversation);

// 获取会话的消息记录
router.get('/:id/messages', ConversationController.getMessages);

export default router;
