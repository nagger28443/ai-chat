import { Router } from 'express';
import { ChatController } from '../controllers/chatController.js';

const router = Router();

/**
 * 对话路由
 */

// 发送消息（SSE 流式响应）
router.post('/', ChatController.sendMessage);

// 续传中断的对话（SSE 流式响应）
router.post('/resume', ChatController.resumeMessage);

// 删除指定消息
router.delete('/messages', ChatController.deleteMessage);

// 重新生成最后一条 assistant 回复（SSE 流式响应）
router.post('/regenerate', ChatController.regenerateMessage);

// 编辑用户消息并重新生成回复（SSE 流式响应）
router.post('/edit-and-resend', ChatController.editAndResendMessage);

export default router;
