import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message, Conversation } from '../types/index.js';

// Mock storageService BEFORE importing chatService
vi.mock('../services/storageService.js', () => {
  const messagesStore = new Map<string, Message[]>();
  const conversationsStore: Conversation[] = [];

  return {
    storageService: {
      getConversations: vi.fn(async () => [...conversationsStore]),
      saveConversations: vi.fn(async (convs: Conversation[]) => {
        conversationsStore.length = 0;
        conversationsStore.push(...convs);
      }),
      getMessages: vi.fn(async (conversationId: string) => {
        return [...(messagesStore.get(conversationId) ?? [])];
      }),
      saveMessages: vi.fn(async (conversationId: string, msgs: Message[]) => {
        messagesStore.set(conversationId, [...msgs]);
      }),
      deleteMessage: vi.fn(async (conversationId: string, messageId: string) => {
        const msgs = messagesStore.get(conversationId) ?? [];
        const filtered = msgs.filter((m) => m.id !== messageId);
        messagesStore.set(conversationId, filtered);
        return filtered;
      }),
      deleteConversation: vi.fn(async () => {}),
      createConversation: vi.fn(async () => ({}) as Conversation),
    },
    // 暴露 store 便于测试设置
    __messagesStore: messagesStore,
    __conversationsStore: conversationsStore,
  };
});

import * as chatService from '../services/chatService.js';
import { storageService } from '../services/storageService.js';

/**
 * 从异步生成器中取前 N 个事件（避免等待完整生成）
 */
async function takeEvents<T>(gen: AsyncGenerator<T>, count: number): Promise<T[]> {
  const events: T[] = [];
  for await (const event of gen) {
    events.push(event);
    if (events.length >= count) break;
  }
  return events;
}

/**
 * 设置测试会话和消息
 */
async function setupConversation(id: string, messages: Message[] = []) {
  const conv: Conversation = {
    id,
    title: '测试',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: messages.length,
  };
  vi.mocked(storageService.saveConversations).mockImplementation(async (convs) => {
    const store = (await import('../services/storageService.js')) as unknown as {
      __conversationsStore: Conversation[];
    };
    store.__conversationsStore.length = 0;
    store.__conversationsStore.push(...convs);
  });
  await storageService.saveConversations([conv]);
  await storageService.saveMessages(id, messages);
}

describe('chatService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // 清空 store
    const mod = (await import('../services/storageService.js')) as unknown as {
      __messagesStore: Map<string, Message[]>;
      __conversationsStore: Conversation[];
    };
    mod.__messagesStore.clear();
    mod.__conversationsStore.length = 0;
  });

  describe('sendMessage', () => {
    it('应首先发送 userMessage 和 assistantMessageId', async () => {
      await setupConversation('conv-1');

      const gen = chatService.sendMessage('conv-1', '你好');
      const events = await takeEvents(gen, 3);

      // 第 1 个事件：userMessage
      expect(events[0].type).toBe('userMessage');
      if (events[0].type === 'userMessage') {
        expect(events[0].data.role).toBe('user');
        expect(events[0].data.content).toBe('你好');
      }

      // 第 2 个事件：assistantMessageId
      expect(events[1].type).toBe('assistantMessageId');
      if (events[1].type === 'assistantMessageId') {
        expect(typeof events[1].data).toBe('string');
        expect(events[1].data.length).toBeGreaterThan(0);
      }

      // 后续是 chunk 事件
      expect(events[2].type).toBe('chunk');
    });
  });

  describe('resumeMessage', () => {
    it('无缓存无消息时应返回错误', async () => {
      await setupConversation('conv-empty', []);

      const gen = chatService.resumeMessage('conv-empty');
      const events = await takeEvents(gen, 1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('error');
      if (events[0].type === 'error') {
        expect(events[0].data).toContain('No message to resume');
      }
    });

    it('已完成的消息应直接补发内容', async () => {
      const messages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-completed',
          role: 'user',
          content: '你好',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
        {
          id: 'msg-2',
          conversationId: 'conv-completed',
          role: 'assistant',
          content: '你好！我是 AI 助手',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
      ];
      await setupConversation('conv-completed', messages);

      const gen = chatService.resumeMessage('conv-completed');
      const events = await takeEvents(gen, 5);

      // 应该有 chunk 事件
      const chunks = events.filter((e) => e.type === 'chunk');
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('regenerateMessage', () => {
    it('无 user 消息时应返回错误', async () => {
      await setupConversation('conv-nouser', []);

      const gen = chatService.regenerateMessage('conv-nouser');
      const events = await takeEvents(gen, 1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('error');
    });

    it('应产生新的 assistantMessageId 事件', async () => {
      const messages: Message[] = [
        {
          id: 'msg-user',
          conversationId: 'conv-regen',
          role: 'user',
          content: '你好',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
        {
          id: 'msg-assistant',
          conversationId: 'conv-regen',
          role: 'assistant',
          content: '旧回复',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
      ];
      await setupConversation('conv-regen', messages);

      const gen = chatService.regenerateMessage('conv-regen');
      const events = await takeEvents(gen, 3);

      // 应该有新的 assistantMessageId
      expect(events.some((e) => e.type === 'assistantMessageId')).toBe(true);
    });
  });

  describe('editAndResendMessage', () => {
    it('消息不存在时应返回错误', async () => {
      await setupConversation('conv-notfound', []);

      const gen = chatService.editAndResendMessage('conv-notfound', 'nonexistent-id', '新内容');
      const events = await takeEvents(gen, 1);

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('error');
      if (events[0].type === 'error') {
        expect(events[0].data).toBe('Message not found');
      }
    });

    it('应更新用户消息并产生新的 assistantMessageId', async () => {
      const messages: Message[] = [
        {
          id: 'msg-user',
          conversationId: 'conv-edit',
          role: 'user',
          content: '原始内容',
          createdAt: new Date().toISOString(),
          status: 'completed',
        },
      ];
      await setupConversation('conv-edit', messages);

      const gen = chatService.editAndResendMessage('conv-edit', 'msg-user', '编辑后的内容');
      const events = await takeEvents(gen, 2);

      expect(events[0].type).toBe('assistantMessageId');
    });
  });

  describe('getMessageCache / getCacheByConversationId', () => {
    it('无缓存时应返回 undefined', () => {
      expect(chatService.getMessageCache('nonexistent')).toBeUndefined();
      expect(chatService.getCacheByConversationId('nonexistent')).toBeUndefined();
    });
  });

  describe('cancelGeneration', () => {
    it('取消不存在的会话不应抛出错误', () => {
      expect(() => chatService.cancelGeneration('nonexistent')).not.toThrow();
    });

    it('取消后消息应标记为 stopped 并保留已生成内容', async () => {
      await setupConversation('conv-cancel');

      // 启动生成任务（不消费 SSE 流，模拟客户端断开）
      const gen = chatService.sendMessage('conv-cancel', '你好');
      // 消费事件直到收到第一个 chunk（确保 cache 已设置）
      const initialEvents = await takeEvents(gen, 3);
      expect(initialEvents[0].type).toBe('userMessage');
      expect(initialEvents[1].type).toBe('assistantMessageId');
      expect(initialEvents[2].type).toBe('chunk');

      // 此时后台正在生成中（cache 存在）
      const cacheEntry = chatService.getCacheByConversationId('conv-cancel');
      expect(cacheEntry).toBeDefined();

      // 取消生成
      chatService.cancelGeneration('conv-cancel');

      // 等待后台任务检测到 abort 并保存
      await new Promise((resolve) => setTimeout(resolve, 200));

      // 验证 storage 中的消息状态
      const messages = await storageService.getMessages('conv-cancel');
      const assistantMsg = messages.find((m) => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg!.status).toBe('stopped');
    });
  });
});
