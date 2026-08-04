import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Conversation, Message } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');
const MESSAGES_DIR = path.join(DATA_DIR, 'messages');

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
        await fs.writeFile(
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
   */
  async getConversations(): Promise<Conversation[]> {
    try {
      const data = await fs.readFile(CONVERSATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.conversations || [];
    } catch (error) {
      console.error('Failed to read conversations:', error);
      return [];
    }
  }

  /**
   * 写入所有会话
   */
  async saveConversations(conversations: Conversation[]): Promise<void> {
    try {
      await fs.writeFile(
        CONVERSATIONS_FILE,
        JSON.stringify({ conversations }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save conversations:', error);
      throw error;
    }
  }

  /**
   * 读取单个会话的消息
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed.messages || [];
    } catch {
      // 文件不存在，返回空数组
      return [];
    }
  }

  /**
   * 写入单个会话的消息
   */
  async saveMessages(conversationId: string, messages: Message[]): Promise<void> {
    const filePath = path.join(MESSAGES_DIR, `${conversationId}.json`);
    try {
      await fs.writeFile(
        filePath,
        JSON.stringify({ conversationId, messages }, null, 2)
      );
    } catch (error) {
      console.error('Failed to save messages:', error);
      throw error;
    }
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
