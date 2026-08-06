import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Conversation, Message } from '../types/index.js';
import { conversationSchema, messageSchema } from '../../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据目录放在 backend/data（而不是 backend/src/data），避免 nodemon 监听
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

/**
 * 文件级写锁队列
 *
 * 保证同一文件的写操作串行执行，避免并发写入导致的数据损坏。
 * 使用 Promise 链实现：每次写入等前一次完成后再执行。
 *
 * 注意：这只解决进程内的并发问题，不解决多进程/多实例的并发。
 * 对于多进程场景，需要使用 proper-lockfile 等文件锁。
 */
const writeQueues = new Map<string, Promise<void>>();

function enqueueWrite(filePath: string, writeFn: () => Promise<void>): Promise<void> {
  const prev = writeQueues.get(filePath) ?? Promise.resolve();
  const next = prev.then(writeFn, writeFn);
  writeQueues.set(filePath, next);
  // 队列完成后清理（防止 Map 无限增长）
  next.finally(() => {
    if (writeQueues.get(filePath) === next) {
      writeQueues.delete(filePath);
    }
  });
  return next;
}

/**
 * 原子写入文件
 *
 * 先写入临时文件（.tmp），再 rename 覆盖目标文件。
 * rename 在同一文件系统上是原子操作——要么看到旧内容，要么看到新内容，
 * 不会出现写入一半的中间状态。
 *
 * 如果进程在写入 .tmp 时崩溃，目标文件不受影响。
 */
async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, data, 'utf-8');
  await fs.rename(tmpPath, filePath);
}

class StorageService {
  constructor() {
    this.init();
  }

  /**
   * 初始化数据目录和默认文件
   */
  private async init() {
    try {
      // 确保数据目录存在
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.mkdir(MESSAGES_DIR, { recursive: true });

      // 如果会话文件不存在，创建默认文件
      try {
        await fs.access(CONVERSATIONS_FILE);
      } catch {
        await atomicWriteFile(
          CONVERSATIONS_FILE,
          JSON.stringify({ conversations: [] }, null, 2)
        );
        console.log('✅ Created default conversations.json');
      }
    } catch (error) {
      console.error('❌ Failed to initialize storage:', error);
    }
  }

  /**
   * 读取所有会话
   * 使用 zod schema 校验数据格式，损坏时返回空数组
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data) as { conversations?: unknown[] };
      if (!Array.isArray(parsed.conversations)) {
        console.warn('conversations.json: conversations is not an array');
        return [];
      }
      // 逐条校验，跳过无效条目
      const valid: Conversation[] = [];
      for (const item of parsed.conversations) {
        const result = conversationSchema.safeParse(item);
        if (result.success) {
          valid.push(result.data);
        } else {
          console.warn('conversations.json: skipping invalid entry', result.error.issues[0]);
        }
      }
      return valid;
    } catch (error) {
      console.error('Failed to read conversations:', error);
      return [];
    }
  }

  /**
   * 写入所有会话（原子写入 + 串行队列）
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    await enqueueWrite(CONVERSATIONS_FILE, async () => {
      await atomicWriteFile(
        CONVERSATIONS_FILE,
        JSON.stringify({ conversations }, null, 2)
      );
    });
  }

  /**
   * 读取单个会话的消息
   * 使用 zod schema 校验数据格式，损坏时返回空数组
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data) as { messages?: unknown[] };
      if (!Array.isArray(parsed.messages)) {
        console.warn(`${conversationId}.json: messages is not an array`);
        return [];
      }
      // 逐条校验，跳过无效条目
      const valid: Message[] = [];
      for (const item of parsed.messages) {
        const result = messageSchema.safeParse(item);
        if (result.success) {
          valid.push(result.data);
        } else {
          console.warn(`${conversationId}.json: skipping invalid message`, result.error.issues[0]);
        }
      }
      return valid;
    } catch {
      // 文件不存在，返回空数组
      return [];
    }
  }

  /**
   * 写入单个会话的消息（原子写入 + 串行队列）
   */
  async saveMessages(conversationId: string, messages: Message[]): Promise<void> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    await enqueueWrite(filePath, async () => {
      await atomicWriteFile(
        filePath,
        JSON.stringify({ conversationId, messages }, null, 2)
      );
    });
  }

  /**
   * 删除指定消息及其配对消息
   * 如果是 user 消息，同时移除紧跟的 assistant 回复
   * @returns 删除后的消息列表
   */
  async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<Message[]> {
    const messages = await this.getMessages(conversationId);
    const index = messages.findIndex((m) => m.id === messageId);

    if (index === -1) {
      return messages;
    }

    const msg = messages[index];
    // 如果是 user 消息，同时移除紧跟的 assistant 回复
    const removeCount =
      msg.role === 'user' &&
      index + 1 < messages.length &&
      messages[index + 1].role === 'assistant'
        ? 2
        : 1;

    messages.splice(index, removeCount);
    await this.saveMessages(conversationId, messages);

    // 更新会话的消息计数
    const conversations = await this.getConversations();
    const conversation = conversations.find((c) => c.id === conversationId);
    if (conversation) {
      conversation.messageCount = messages.length;
      conversation.updatedAt = new Date().toISOString();
      await this.saveConversations(conversations);
    }

    return messages;
  }

  /**
   * 删除会话和消息文件
   */
  async deleteConversation(conversationId: string): Promise<void> {
    // 删除消息文件
    const messagesFile = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      await fs.unlink(messagesFile);
    } catch {
      // 文件不存在，忽略
    }

    // 从会话列表中移除
    const conversations = await this.getConversations();
    const filtered = conversations.filter((c) => c.id !== conversationId);
    await this.saveConversations(filtered);
  }
}

export const storageService = new StorageService();
