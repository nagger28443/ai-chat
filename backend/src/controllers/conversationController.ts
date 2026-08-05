import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../services/storageService.js';
import { ChatController } from './chatController.js';
import type {
  ApiResponse,
  Conversation,
  CreateConversationInput,
  UpdateConversationInput,
} from '../types/index.js';

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
      const { title } = req.body as CreateConversationInput;

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
   * 更新会话（重命名）
   */
  static async updateConversation(
    req: Request,
    res: Response<ApiResponse<Conversation>>
  ) {
    try {
      const { id } = req.params;
      const conversationId = Array.isArray(id) ? id[0] : id;
      const { title } = req.body as UpdateConversationInput;

      if (!title || typeof title !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Title is required',
        });
        return;
      }

      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === conversationId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        });
        return;
      }

      conversation.title = title.trim();
      conversation.updatedAt = new Date().toISOString();

      await storageService.saveConversations(conversations);

      res.json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      console.error('Failed to update conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update conversation',
      });
    }
  }

  /**
   * 获取会话的消息记录（支持分页）
   * 查询参数：limit（默认 10）、offset（默认 0）
   * 返回最新的 limit 条消息，offset 用于加载更多
   */
  static async getMessages(
    req: Request,
    res: Response<ApiResponse>
  ) {
    try {
      const { id } = req.params;
      const conversationId = Array.isArray(id) ? id[0] : id;
      const limit = parseInt(req.query.limit as string) || 10;
      const offset = parseInt(req.query.offset as string) || 0;

      const allMessages = await storageService.getMessages(conversationId);

      // 叠加 messageCache 中的生成进度
      const cacheEntry = ChatController.getCacheByConversationId(conversationId);
      if (cacheEntry) {
        const cachedMsg = allMessages.find((m) => m.id === cacheEntry.messageId);
        if (cachedMsg) {
          cachedMsg.content = cacheEntry.content;
          cachedMsg.status = 'generating';
        }
      }

      // 分页：从末尾取最新的 limit 条（offset=0 表示最新的一批）
      const total = allMessages.length;
      const start = Math.max(0, total - limit - offset);
      const end = offset === 0 ? total : total - offset;
      const messages = allMessages.slice(start, end);
      const hasMore = start > 0;

      res.json({
        success: true,
        data: { messages, hasMore, total },
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
