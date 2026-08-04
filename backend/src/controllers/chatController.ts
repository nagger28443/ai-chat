import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storageService.js';
import { mockAiService } from '../services/mockAiService.js';
import type { Message } from '../types/index.js';

/**
 * 对话控制器
 */
export class ChatController {
  /**
   * 发送消息并返回流式响应
   */
  static async sendMessage(req: Request, res: Response) {
    const { conversationId, content } = req.body;

    // 验证请求参数
    if (!conversationId || !content) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields',
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 监听客户端断开
    let clientDisconnected = false;
    req.on('close', () => {
      clientDisconnected = true;
    });

    try {
      // 保存用户消息
      const userMessage: Message = {
        id: uuidv4(),
        conversationId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        status: 'completed',
      };

      const messages = await storageService.getMessages(conversationId);
      messages.push(userMessage);
      await storageService.saveMessages(conversationId, messages);

      // 获取 AI 响应
      const responseText = mockAiService.getResponse(content);

      let fullContent = '';
      let chunkCount = 0;

      // 逐字符发送
      for (let i = 0; i < responseText.length; i++) {
        if (clientDisconnected || res.writableEnded) {
          break;
        }

        const chunk = responseText[i];
        fullContent += chunk;
        chunkCount++;

        const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;
        res.write(eventData);

        // 模拟打字延迟
        await new Promise((resolve) => setTimeout(resolve, 30));
      }

      // 保存 AI 消息
      if (!clientDisconnected && !res.writableEnded) {
        const assistantMessage: Message = {
          id: uuidv4(),
          conversationId,
          role: 'assistant',
          content: fullContent,
          createdAt: new Date().toISOString(),
          status: 'completed',
        };

        messages.push(assistantMessage);
        await storageService.saveMessages(conversationId, messages);

        // 更新会话信息
        const conversations = await storageService.getConversations();
        const conversation = conversations.find((c) => c.id === conversationId);

        if (conversation) {
          conversation.updatedAt = new Date().toISOString();
          conversation.messageCount = messages.length;

          if (messages.length === 2) {
            conversation.title = content.slice(0, 20) + (content.length > 20 ? '...' : '');
          }

          await storageService.saveConversations(conversations);
        }

        // 发送完成事件
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    } catch (error) {
      console.error('Chat error:', error);
      if (!res.writableEnded) {
        res.write('event: error\ndata: {"message": "Internal error"}\n\n');
        res.end();
      }
    }
  }
}
