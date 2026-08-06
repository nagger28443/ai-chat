import { v4 as uuidv4 } from 'uuid';
import { storageService } from './storageService.js';
import { mockAiService } from './mockAiService.js';
import type { Message } from '../types/index.js';

/**
 * 缓存条目：存储正在生成中的消息状态
 */
export interface CacheEntry {
  messageId: string;
  conversationId: string;
  content: string;
  status: 'generating' | 'completed' | 'error';
  originalPrompt: string;
  error?: string;
}

/**
 * 消息生成缓存：key = conversationId
 * 生成完成前，进度仅存在此处，不持久化到 storage
 */
const messageCache = new Map<string, CacheEntry>();

/**
 * 根据 conversationId 查找正在生成的缓存条目
 */
export function getMessageCache(conversationId: string): CacheEntry | undefined {
  for (const entry of messageCache.values()) {
    if (entry.conversationId === conversationId && entry.status === 'generating') {
      return entry;
    }
  }
  return undefined;
}

/**
 * 根据 conversationId 查找任意状态的缓存条目
 */
export function getCacheByConversationId(conversationId: string): CacheEntry | undefined {
  for (const entry of messageCache.values()) {
    if (entry.conversationId === conversationId) {
      return entry;
    }
  }
  return undefined;
}

/**
 * 设置缓存条目
 */
export function setMessageCache(conversationId: string, entry: CacheEntry): void {
  messageCache.set(conversationId, entry);
}

/**
 * 删除缓存条目
 */
export function deleteMessageCache(conversationId: string): void {
  messageCache.delete(conversationId);
}

/**
 * 后台生成任务：独立运行，不受消费者断开影响
 * 逐字符生成内容并更新 cache
 */
async function runGenerationTask(
  conversationId: string,
  cacheEntry: CacheEntry,
  messages: Message[],
  responseText: string,
): Promise<void> {
  try {
    for (let i = 0; i < responseText.length; i++) {
      cacheEntry.content += responseText[i];
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // 生成完成：更新 cache 和 storage
    cacheEntry.status = 'completed';
    const currentMsg = messages.find((m) => m.id === cacheEntry.messageId);
    if (currentMsg) {
      currentMsg.content = cacheEntry.content;
      currentMsg.status = 'completed';
      delete currentMsg.originalPrompt;
      await storageService.saveMessages(conversationId, messages);
    }

    // 完成后延迟清理缓存（给重连的客户端一些时间获取最终状态）
    setTimeout(() => {
      if (cacheEntry.status === 'completed') {
        messageCache.delete(conversationId);
      }
    }, 5000);
  } catch (error) {
    cacheEntry.status = 'error';
    cacheEntry.error = error instanceof Error ? error.message : 'Unknown error';
  }
}

/**
 * 从 cache 读取内容的 generator
 * 独立的 generator 只负责从 cache 读取并 yield，不控制生成逻辑
 */
async function* yieldFromCache(
  cacheEntry: CacheEntry,
  startPosition: number,
): AsyncGenerator<
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
  let position = startPosition;
  // 超时保护：防止残留缓存导致无限等待
  const MAX_WAIT_MS = 60_000;
  const startTime = Date.now();

  while (true) {
    // 发送新内容
    if (cacheEntry.content.length > position) {
      for (let i = position; i < cacheEntry.content.length; i++) {
        yield { type: 'chunk', data: cacheEntry.content[i] };
      }
      position = cacheEntry.content.length;
    }

    // 检查完成状态
    if (cacheEntry.status === 'completed') {
      yield { type: 'done' };
      return;
    }

    if (cacheEntry.status === 'error') {
      yield { type: 'error', data: cacheEntry.error || 'Generation failed' };
      return;
    }

    // 超时退出
    if (Date.now() - startTime > MAX_WAIT_MS) {
      yield { type: 'error', data: 'Generation timeout' };
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/**
 * 发送消息（核心业务逻辑）
 * 保存用户消息，创建 assistant 占位，启动后台生成任务，从 cache 读取并发送
 */
export async function* sendMessage(
  conversationId: string,
  content: string,
): AsyncGenerator<
  | { type: 'userMessage'; data: Message }
  | { type: 'assistantMessageId'; data: string }
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
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

  yield { type: 'userMessage', data: userMessage };

  // 获取 AI 响应
  const responseText = mockAiService.getResponse(content);

  const assistantMessageId = uuidv4();
  const assistantMessage: Message = {
    id: assistantMessageId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'generating',
    originalPrompt: content,
  };

  messages.push(assistantMessage);
  await storageService.saveMessages(conversationId, messages);

  yield { type: 'assistantMessageId', data: assistantMessageId };

  // 创建缓存条目
  const cacheEntry: CacheEntry = {
    messageId: assistantMessageId,
    conversationId,
    content: '',
    status: 'generating',
    originalPrompt: content,
  };
  messageCache.set(conversationId, cacheEntry);

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

  // 启动后台生成任务（不等待完成，消费者断开不影响生成）
  runGenerationTask(conversationId, cacheEntry, messages, responseText);

  // 从 cache 读取并 yield（消费者断开后，后台任务继续运行）
  yield* yieldFromCache(cacheEntry, 0);
}

/**
 * 重新生成最后一条 assistant 回复
 */
export async function* regenerateMessage(
  conversationId: string,
): AsyncGenerator<
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
  const messages = await storageService.getMessages(conversationId);

  // 找到最后一条 user 消息
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex === -1) {
    yield { type: 'error', data: 'No user message found' };
    return;
  }

  const userMessage = messages[lastUserIndex];
  messages.splice(lastUserIndex + 1);

  const assistantMessageId = uuidv4();
  const assistantMessage: Message = {
    id: assistantMessageId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'generating',
    originalPrompt: userMessage.content,
  };
  messages.push(assistantMessage);
  await storageService.saveMessages(conversationId, messages);

  const cacheEntry: CacheEntry = {
    messageId: assistantMessageId,
    conversationId,
    content: '',
    status: 'generating',
    originalPrompt: userMessage.content,
  };
  messageCache.set(conversationId, cacheEntry);

  const responseText = mockAiService.getResponse(userMessage.content);

  // 启动后台生成任务
  runGenerationTask(conversationId, cacheEntry, messages, responseText);

  // 从 cache 读取并 yield
  yield* yieldFromCache(cacheEntry, 0);
}

/**
 * 编辑用户消息并重新生成回复
 */
export async function* editAndResendMessage(
  conversationId: string,
  messageId: string,
  newContent: string,
): AsyncGenerator<
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
  const messages = await storageService.getMessages(conversationId);
  const msgIndex = messages.findIndex((m) => m.id === messageId);

  if (msgIndex === -1) {
    yield { type: 'error', data: 'Message not found' };
    return;
  }

  messages[msgIndex].content = newContent;
  messages.splice(msgIndex + 1);

  const assistantMessageId = uuidv4();
  const assistantMessage: Message = {
    id: assistantMessageId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'generating',
    originalPrompt: newContent,
  };
  messages.push(assistantMessage);
  await storageService.saveMessages(conversationId, messages);

  const cacheEntry: CacheEntry = {
    messageId: assistantMessageId,
    conversationId,
    content: '',
    status: 'generating',
    originalPrompt: newContent,
  };
  messageCache.set(conversationId, cacheEntry);

  const responseText = mockAiService.getResponse(newContent);

  // 启动后台生成任务
  runGenerationTask(conversationId, cacheEntry, messages, responseText);

  // 从 cache 读取并 yield
  yield* yieldFromCache(cacheEntry, 0);
}

/**
 * 续传中断的对话
 * 从位置 0 开始发送所有缓存内容，前端负责替换本地状态
 */
export async function* resumeMessage(
  conversationId: string,
): AsyncGenerator<
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
  // 1. 优先从 cache 查找（可能正在生成中，或者已完成但未清理）
  const cacheEntry = getCacheByConversationId(conversationId);

  if (cacheEntry) {
    // 场景 A/B：cache 存在，从位置 0 开始发送所有内容
    yield* yieldFromCache(cacheEntry, 0);
    return;
  }

  // 2. Cache 未命中：从 storage 查找
  const messages = await storageService.getMessages(conversationId);
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== 'assistant') {
    yield { type: 'error', data: 'No message to resume' };
    return;
  }

  // 已完成的对话：直接补发内容
  if (lastMessage.status === 'completed') {
    // 创建一个临时 cache entry 用于 yield
    const tempCache: CacheEntry = {
      messageId: lastMessage.id,
      conversationId,
      content: lastMessage.content,
      status: 'completed',
      originalPrompt: '',
    };
    yield* yieldFromCache(tempCache, 0);
    return;
  }

  // 仍在生成中但缺少 originalPrompt，无法续传
  if (!lastMessage.originalPrompt) {
    yield { type: 'error', data: 'No message to resume' };
    return;
  }

  // 场景 C：后端重启或缓存丢失，重新生成
  const responseText = mockAiService.getResponse(lastMessage.originalPrompt);

  const newCacheEntry: CacheEntry = {
    messageId: lastMessage.id,
    conversationId,
    content: lastMessage.content, // 继承已保存的部分内容
    status: 'generating',
    originalPrompt: lastMessage.originalPrompt,
  };
  messageCache.set(conversationId, newCacheEntry);

  // 启动后台生成任务
  runGenerationTask(conversationId, newCacheEntry, messages, responseText);

  // 从 cache 读取并 yield，从位置 0 开始
  yield* yieldFromCache(newCacheEntry, 0);
}
