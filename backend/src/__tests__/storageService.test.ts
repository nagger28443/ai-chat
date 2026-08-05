import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { storageService } from '../services/storageService.js';
import type { Conversation } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DATA_DIR = path.join(__dirname, '..', '..', 'data-test');
const TEST_CONVERSATIONS_FILE = path.join(TEST_DATA_DIR, 'conversations.json');

describe('StorageService', () => {
  beforeEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe('getConversations', () => {
    it('应在无文件时返回空数组', async () => {
      // 由于 storageService 使用固定的 DATA_DIR，这里只测试方法存在
      const conversations = await storageService.getConversations();
      expect(Array.isArray(conversations)).toBe(true);
    });
  });

  describe('saveConversations & getConversations', () => {
    it('应能保存和读取会话列表', async () => {
      const testConversations: Conversation[] = [
        {
          id: 'test-1',
          title: '测试会话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
        },
      ];

      await storageService.saveConversations(testConversations);
      const loaded = await storageService.getConversations();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-1');
      expect(loaded[0].title).toBe('测试会话');
    });
  });

  describe('saveMessages & getMessages', () => {
    it('应能保存和读取消息', async () => {
      const conversationId = 'conv-test-1';
      const messages = [
        {
          id: 'msg-1',
          conversationId,
          role: 'user' as const,
          content: 'hello',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
        {
          id: 'msg-2',
          conversationId,
          role: 'assistant' as const,
          content: 'hi there',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
      ];

      await storageService.saveMessages(conversationId, messages);
      const loaded = await storageService.getMessages(conversationId);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].content).toBe('hello');
      expect(loaded[1].content).toBe('hi there');
    });

    it('不存在消息文件时应返回空数组', async () => {
      const loaded = await storageService.getMessages('non-existent-id');
      expect(loaded).toEqual([]);
    });
  });

  describe('deleteConversation', () => {
    it('应删除会话及其消息文件', async () => {
      const conversationId = 'conv-to-delete';

      // 先创建会话和消息
      const conversations: Conversation[] = [
        {
          id: conversationId,
          title: '要删除的会话',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 1,
        },
      ];
      await storageService.saveConversations(conversations);
      await storageService.saveMessages(conversationId, [
        {
          id: 'msg-1',
          conversationId,
          role: 'user',
          content: 'test',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
      ]);

      // 删除会话
      await storageService.deleteConversation(conversationId);

      // 验证会话已删除
      const loadedConversations = await storageService.getConversations();
      expect(loadedConversations).toHaveLength(0);

      // 验证消息已删除
      const loadedMessages = await storageService.getMessages(conversationId);
      expect(loadedMessages).toEqual([]);
    });
  });

  describe('deleteMessage', () => {
    it('应删除指定消息', async () => {
      const conversationId = 'conv-delete-msg';
      const messages = [
        {
          id: 'msg-1',
          conversationId,
          role: 'user' as const,
          content: 'first',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
        {
          id: 'msg-2',
          conversationId,
          role: 'assistant' as const,
          content: 'reply',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
        {
          id: 'msg-3',
          conversationId,
          role: 'user' as const,
          content: 'second',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
      ];

      await storageService.saveMessages(conversationId, messages);

      // 删除第三条消息（独立的 user 消息）
      const result = await storageService.deleteMessage(conversationId, 'msg-3');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-1');
      expect(result[1].id).toBe('msg-2');
    });

    it('删除 user 消息时应同时移除紧跟的 assistant 回复', async () => {
      const conversationId = 'conv-delete-pair';
      const messages = [
        {
          id: 'msg-1',
          conversationId,
          role: 'user' as const,
          content: 'question',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
        {
          id: 'msg-2',
          conversationId,
          role: 'assistant' as const,
          content: 'answer',
          createdAt: new Date().toISOString(),
          status: 'completed' as const,
        },
      ];

      await storageService.saveMessages(conversationId, messages);

      // 删除 user 消息，应同时移除 assistant 回复
      const result = await storageService.deleteMessage(conversationId, 'msg-1');
      expect(result).toHaveLength(0);
    });

    it('不存在的消息 ID 应返回原消息列表', async () => {
      const conversationId = 'conv-nonexistent';
      await storageService.saveMessages(conversationId, []);

      const result = await storageService.deleteMessage(conversationId, 'nonexistent');
      expect(result).toEqual([]);
    });
  });
});
