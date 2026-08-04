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

export default router;
