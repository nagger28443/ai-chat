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
  status: 'generating' | 'completed';
  originalPrompt: string;
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
 * 发送消息（核心业务逻辑）
 * 保存用户消息，创建 assistant 占位，逐字符生成并通过 SSE 发送
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

  // 逐字符生成（try/finally 确保即使消费者提前终止也能清理缓存）
  try {
    for (let i = 0; i < responseText.length; i++) {
      const chunk = responseText[i];
      cacheEntry.content += chunk;
      yield { type: 'chunk', data: chunk };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // 生成完成
    cacheEntry.status = 'completed';
    const currentMsg = messages.find((m) => m.id === assistantMessageId);
    if (currentMsg) {
      currentMsg.content = cacheEntry.content;
      currentMsg.status = 'completed';
      delete currentMsg.originalPrompt;
      await storageService.saveMessages(conversationId, messages);
    }

    yield { type: 'done' };
  } finally {
    // 客户端提前断开：将已生成的部分内容保存到 storage，标记为 stopped
    if (cacheEntry.status !== 'completed' && cacheEntry.content.length > 0) {
      const partialMsg = messages.find((m) => m.id === assistantMessageId);
      if (partialMsg && partialMsg.status !== 'completed') {
        partialMsg.content = cacheEntry.content;
        partialMsg.status = 'stopped';
        await storageService.saveMessages(conversationId, messages);
      }
    }
    messageCache.delete(conversationId);
  }
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

  try {
    for (let i = 0; i < responseText.length; i++) {
      cacheEntry.content += responseText[i];
      yield { type: 'chunk', data: responseText[i] };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    cacheEntry.status = 'completed';
    const currentMsg = messages.find((m) => m.id === assistantMessageId);
    if (currentMsg) {
      currentMsg.content = cacheEntry.content;
      currentMsg.status = 'completed';
      delete currentMsg.originalPrompt;
      await storageService.saveMessages(conversationId, messages);
    }

    yield { type: 'done' };
  } finally {
    // 客户端提前断开：保存部分内容，标记为 stopped
    if (cacheEntry.status !== 'completed' && cacheEntry.content.length > 0) {
      const partialMsg = messages.find((m) => m.id === assistantMessageId);
      if (partialMsg && partialMsg.status !== 'completed') {
        partialMsg.content = cacheEntry.content;
        partialMsg.status = 'stopped';
        await storageService.saveMessages(conversationId, messages);
      }
    }
    messageCache.delete(conversationId);
  }
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

  try {
    for (let i = 0; i < responseText.length; i++) {
      cacheEntry.content += responseText[i];
      yield { type: 'chunk', data: responseText[i] };
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    cacheEntry.status = 'completed';
    const currentMsg = messages.find((m) => m.id === assistantMessageId);
    if (currentMsg) {
      currentMsg.content = cacheEntry.content;
      currentMsg.status = 'completed';
      delete currentMsg.originalPrompt;
      await storageService.saveMessages(conversationId, messages);
    }

    yield { type: 'done' };
  } finally {
    // 客户端提前断开：保存部分内容，标记为 stopped
    if (cacheEntry.status !== 'completed' && cacheEntry.content.length > 0) {
      const partialMsg = messages.find((m) => m.id === assistantMessageId);
      if (partialMsg && partialMsg.status !== 'completed') {
        partialMsg.content = cacheEntry.content;
        partialMsg.status = 'stopped';
        await storageService.saveMessages(conversationId, messages);
      }
    }
    messageCache.delete(conversationId);
  }
}

/**
 * 续传中断的对话
 */
export async function* resumeMessage(
  conversationId: string,
  frontendContentLength: number,
): AsyncGenerator<
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string }
> {
  // 1. 优先从 cache 查找
  const cacheEntry = getMessageCache(conversationId);

  if (cacheEntry) {
    // 场景 A：生成仍在进行中
    yield* resumeFromCache(cacheEntry, frontendContentLength);
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
    yield* sendFromContent(lastMessage.content, frontendContentLength);
    return;
  }

  // 仍在生成中但缺少 originalPrompt，无法续传
  if (!lastMessage.originalPrompt) {
    yield { type: 'error', data: 'No message to resume' };
    return;
  }

  // 场景 C：后端重启或客户端断开后恢复，重新生成
  // 起点取最大值：确保利用 storage 中已保存的部分内容（status=stopped 时）
  const responseText = mockAiService.getResponse(lastMessage.originalPrompt);
  const startPosition = Math.max(frontendContentLength, lastMessage.content.length);

  const newCacheEntry: CacheEntry = {
    messageId: lastMessage.id,
    conversationId,
    content: lastMessage.content, // 继承已保存的部分内容
    status: 'generating',
    originalPrompt: lastMessage.originalPrompt,
  };
  messageCache.set(conversationId, newCacheEntry);

  try {
    for (let i = 0; i < responseText.length; i++) {
      // 已保存的部分内容不重复追加
      if (i >= newCacheEntry.content.length) {
        newCacheEntry.content += responseText[i];
      }
      if (i >= startPosition) {
        yield { type: 'chunk', data: responseText[i] };
        // 只在发送新内容时延迟，追赶阶段不延迟
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    newCacheEntry.status = 'completed';
    lastMessage.content = newCacheEntry.content;
    lastMessage.status = 'completed';
    delete lastMessage.originalPrompt;
    await storageService.saveMessages(conversationId, messages);

    yield { type: 'done' };
  } finally {
    // 客户端提前断开：保存已生成的部分内容到 storage，标记为 stopped
    if (newCacheEntry.status !== 'completed' && newCacheEntry.content.length > lastMessage.content.length) {
      lastMessage.content = newCacheEntry.content;
      lastMessage.status = 'stopped';
      await storageService.saveMessages(conversationId, messages);
    }
    messageCache.delete(conversationId);
  }
}

async function* resumeFromCache(
  cacheEntry: CacheEntry,
  frontendContentLength: number,
): AsyncGenerator<{ type: 'chunk'; data: string } | { type: 'done' } | { type: 'error'; data: string }> {
  let position = frontendContentLength;
  // 超时保护：防止缓存残留导致无限等待
  const MAX_WAIT_MS = 30_000;
  const startTime = Date.now();

  while (true) {
    if (cacheEntry.content.length > position) {
      for (let i = position; i < cacheEntry.content.length; i++) {
        yield { type: 'chunk', data: cacheEntry.content[i] };
      }
      position = cacheEntry.content.length;
    }

    if (cacheEntry.status === 'completed') {
      yield { type: 'done' };
      return;
    }

    // 超时退出，防止死循环
    if (Date.now() - startTime > MAX_WAIT_MS) {
      yield { type: 'error', data: 'Resume timeout: cache entry not updating' };
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function* sendFromContent(
  content: string,
  startPosition: number,
): AsyncGenerator<{ type: 'chunk'; data: string } | { type: 'done' }> {
  for (let i = startPosition; i < content.length; i++) {
    yield { type: 'chunk', data: content[i] };
  }
  yield { type: 'done' };
}
