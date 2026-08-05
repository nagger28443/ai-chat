import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { v4 as uuidv4 } from 'uuid';
import { storageService } from '../../services/storageService.js';
import { getMessageCache } from '../../services/chatService.js';

/**
 * 会话相关 tRPC procedures
 * 返回类型由 tRPC 从返回值自动推导，前端通过 AppRouter 获得完整类型
 */
export const conversationRouter = router({
  /**
   * 获取所有会话列表
   */
  getAll: publicProcedure.query(async () => {
    const conversations = await storageService.getConversations();
    conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    return conversations;
  }),

  /**
   * 创建新会话
   */
  create: publicProcedure
    .input(
      z.object({
        title: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const newConversation = {
        id: uuidv4(),
        title: input.title || '新对话',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };

      const conversations = await storageService.getConversations();
      conversations.push(newConversation);
      await storageService.saveConversations(conversations);

      return newConversation;
    }),

  /**
   * 删除会话
   */
  delete: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === input.id);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      await storageService.deleteConversation(input.id);
      return { success: true };
    }),

  /**
   * 更新会话（重命名）
   */
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1, 'Title is required'),
      })
    )
    .mutation(async ({ input }) => {
      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === input.id);

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      conversation.title = input.title.trim();
      conversation.updatedAt = new Date().toISOString();

      await storageService.saveConversations(conversations);
      return conversation;
    }),

  /**
   * 获取会话的消息记录（支持分页）
   */
  getMessages: publicProcedure
    .input(
      z.object({
        conversationId: z.string(),
        limit: z.number().default(10),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      const { conversationId, limit, offset } = input;

      const allMessages = await storageService.getMessages(conversationId);

      // 叠加 messageCache 中的生成进度
      const cacheEntry = getMessageCache(conversationId);
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

      return { messages, hasMore, total };
    }),
});
