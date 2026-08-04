import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storageService.js';
import { ChatController } from './chatController.js';
import type { ApiResponse, Conversation } from '../types/index.js';

/**
 * 会话管理控制器
 */
export class ConversationController {
  /**
   * 获取所有会话列表
   */
  static async getConversations(
    _req: Request,
    res: Response<ApiResponse<Conversation[]>>
  ) {
    try {
      const conversations = await storageService.getConversations();
      // 按更新时间降序排序
      conversations.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error('Failed to get conversations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get conversations',
      });
    }
  }

  /**
   * 创建新会话
   */
  static async createConversation(
    req: Request,
    res: Response<ApiResponse<Conversation>>
  ) {
    try {
      const { title } = req.body;

      const newConversation: Conversation = {
        id: uuidv4(),
        title: title || '新对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };

      // 读取现有会话
      const conversations = await storageService.getConversations();
      conversations.push(newConversation);

      // 保存会话列表
      await storageService.saveConversations(conversations);

      res.status(201).json({
        success: true,
        data: newConversation,
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create conversation',
      });
    }
  }

  /**
   * 删除会话
   */
  static async deleteConversation(
    req: Request,
    res: Response<ApiResponse>
  ) {
    try {
      const { id } = req.params;
      const conversationId = Array.isArray(id) ? id[0] : id;

      // 检查会话是否存在
      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === conversationId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
        return;
      }

      // 删除会话和消息文件
      await storageService.deleteConversation(conversationId);

      res.json({
        success: true,
      });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation',
      });
    }
  }

  /**
   * 获取会话的消息记录
   */
  static async getMessages(
    req: Request,
    res: Response<ApiResponse>
  ) {
    try {
      const { id } = req.params;
      const conversationId = Array.isArray(id) ? id[0] : id;

      const messages = await storageService.getMessages(conversationId);

      // 叠加 messageCache 中的生成进度（刷新页面后前端能看到 generating 状态和已生成内容）
      const cacheEntry = ChatController.getCacheByConversationId(conversationId);
      if (cacheEntry) {
        const cachedMsg = messages.find((m) => m.id === cacheEntry.messageId);
        if (cachedMsg) {
          cachedMsg.content = cacheEntry.content;
          cachedMsg.status = 'generating';
        }
      }

      res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error('Failed to get messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
      });
    }
  }
}
