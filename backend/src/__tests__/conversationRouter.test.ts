import { describe, it, expect, beforeEach } from 'vitest';
import { conversationRouter } from '../trpc/routers/conversation.js';
import { storageService } from '../services/storageService.js';

/**
 * tRPC conversation router 测试
 * 使用 router.createCaller() 创建测试用的 caller
 */
describe('conversationRouter (tRPC)', () => {
  const caller = conversationRouter.createCaller({});

  beforeEach(async () => {
    // 清空所有会话
    const conversations = await storageService.getConversations();
    for (const conv of conversations) {
      await storageService.deleteConversation(conv.id);
    }
  });

  describe('getAll', () => {
    it('应返回空列表', async () => {
      const result = await caller.getAll();
      expect(result).toEqual([]);
    });

    it('应返回所有会话（按更新时间降序）', async () => {
      await caller.create({ title: '对话1' });
      await new Promise((r) => setTimeout(r, 10));
      await caller.create({ title: '对话2' });

      const result = await caller.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('对话2');
      expect(result[1].title).toBe('对话1');
    });
  });

  describe('create', () => {
    it('应创建新会话（默认标题）', async () => {
      const result = await caller.create({});
      expect(result.title).toBe('新对话');
      expect(result.id).toBeDefined();
      expect(result.messageCount).toBe(0);
    });

    it('应创建新会话（自定义标题）', async () => {
      const result = await caller.create({ title: '测试对话' });
      expect(result.title).toBe('测试对话');
    });
  });

  describe('delete', () => {
    it('应删除指定会话', async () => {
      const conv = await caller.create({ title: '待删除' });
      const result = await caller.delete({ id: conv.id });
      expect(result.success).toBe(true);

      const all = await caller.getAll();
      expect(all).toHaveLength(0);
    });

    it('删除不存在的会话应抛出错误', async () => {
      await expect(
        caller.delete({ id: 'non-existent-id' })
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('update', () => {
    it('应重命名会话', async () => {
      const conv = await caller.create({ title: '旧标题' });
      const updated = await caller.update({ id: conv.id, title: '新标题' });
      expect(updated.title).toBe('新标题');
      expect(updated.id).toBe(conv.id);
    });

    it('标题为空应抛出错误', async () => {
      const conv = await caller.create({ title: '测试' });
      await expect(
        caller.update({ id: conv.id, title: '' })
      ).rejects.toThrow();
    });

    it('更新不存在的会话应抛出错误', async () => {
      await expect(
        caller.update({ id: 'non-existent', title: 'test' })
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('getMessages', () => {
    it('应返回空消息列表', async () => {
      const conv = await caller.create({ title: '测试' });
      const result = await caller.getMessages({
        conversationId: conv.id,
        limit: 10,
        offset: 0,
      });
      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(0);
    });
  });
});
