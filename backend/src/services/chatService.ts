import { v4 as uuidv4 } from 'uuid';
import { storageService } from './storageService.js';
import { mockAiProvider } from './mockAiService.js';
import type { AiProvider } from './aiProvider.js';
import {
  CACHE_CLEANUP_DELAY_MS,
  CACHE_POLL_INTERVAL_MS,
  CHAR_GENERATION_DELAY_MS,
  RESUME_MAX_WAIT_MS,
} from '../constants.js';
import type { Message } from '../types/index.js';

/**
 * 当前使用的 AI 提供者
 *
 * 未来可通过环境变量切换：
 *   const aiProvider: AiProvider = process.env.AI_PROVIDER === 'openai'
 *     ? openAiProvider : mockAiProvider;
 */
const aiProvider: AiProvider = mockAiProvider;

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
 * 后台生成任务：独立运行，不受消费者断开影响
 * 逐字符生成内容并更新 cache
 *
 * 每个字符生成后检查 abortSignal，被取消时立即停止并清理缓存
 */
async function runGenerationTask(
  conversationId: string,
  cacheEntry: CacheEntry,
  messages: Message[],
  responseText: string,
  abortSignal: AbortSignal,
): Promise<void> {
  try {
    for (let i = 0; i < responseText.length; i++) {
      // 检查是否被取消（用户手动中断）
      if (abortSignal.aborted) {
        // 用户主动中断：保留已生成内容，标记为 stopped，不继续生成
        cacheEntry.status = 'error';
        cacheEntry.error = 'Cancelled by user';
        const currentMsg = messages.find((m) => m.id === cacheEntry.messageId);
        if (currentMsg) {
          currentMsg.content = cacheEntry.content;
          currentMsg.status = 'stopped';
          delete currentMsg.originalPrompt;
          await storageService.saveMessages(conversationId, messages);
        }
        // 清理缓存，避免 resumeMessage 续传
        messageCache.delete(conversationId);
        generationAbortControllers.delete(conversationId);
        return;
      }
      cacheEntry.content += responseText[i];
      await new Promise((resolve) => setTimeout(resolve, CHAR_GENERATION_DELAY_MS));
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
      generationAbortControllers.delete(conversationId);
    }, CACHE_CLEANUP_DELAY_MS);
  } catch (error) {
    cacheEntry.status = 'error';
    cacheEntry.error = error instanceof Error ? error.message : 'Unknown error';
    generationAbortControllers.delete(conversationId);
  }
}

/**
 * 生成任务的取消控制器注册表
 *
 * 客户端断开 SSE 时，通过 conversationId 查找并 abort 对应的生成任务。
 */
const generationAbortControllers = new Map<string, AbortController>();

/**
 * 取消指定会话的生成任务
 *
 * 由前端在用户点击"停止"时显式调用。
 * 调用后：
 * - 后台生成任务在下一个字符迭代时检测到 abort 信号
 * - 保留已生成内容，标记消息为 'stopped'
 * - 清理 cache，不再续传
 *
 * 注意：SSE 连接断开不会触发此函数（网络断开应保留续传能力）。
 *
 * @param conversationId - 要取消的会话 ID
 */
export function cancelGeneration(conversationId: string): void {
  const controller = generationAbortControllers.get(conversationId);
  if (controller) {
    controller.abort();
  }
}

/**
 * 从 cache 读取内容的 generator
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
    if (Date.now() - startTime > RESUME_MAX_WAIT_MS) {
      yield { type: 'error', data: 'Generation timeout' };
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, CACHE_POLL_INTERVAL_MS));
  }
}

/**
 * SSE 事件联合类型（sendMessage 独有 userMessage/assistantMessageId）
 */
export type ChatSSEEvent =
  | { type: 'userMessage'; data: Message }
  | { type: 'assistantMessageId'; data: string }
  | { type: 'chunk'; data: string }
  | { type: 'done' }
  | { type: 'error'; data: string };

/**
 * 启动 AI 生成任务（公共流程）
 *
 * 封装 sendMessage / regenerateMessage / editAndResendMessage 的公共步骤：
 * 1. 创建 assistant 消息占位
 * 2. 保存到 storage
 * 3. 创建 cache 条目
 * 4. 启动后台生成任务
 * 5. 从 cache 读取并 yield
 *
 * @returns 创建的 assistant 消息 ID
 */
async function* startGeneration(
  conversationId: string,
  messages: Message[],
  prompt: string,
): AsyncGenerator<ChatSSEEvent, void, void> {
  const assistantMessageId = uuidv4();
  const assistantMessage: Message = {
    id: assistantMessageId,
    conversationId,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString(),
    status: 'generating',
    originalPrompt: prompt,
  };
  messages.push(assistantMessage);
  await storageService.saveMessages(conversationId, messages);

  yield { type: 'assistantMessageId', data: assistantMessageId };

  const cacheEntry: CacheEntry = {
    messageId: assistantMessageId,
    conversationId,
    content: '',
    status: 'generating',
    originalPrompt: prompt,
  };
  messageCache.set(conversationId, cacheEntry);

  // 注册取消控制器：客户端断开时通过 cancelGeneration 调用 abort
  const abortController = new AbortController();
  generationAbortControllers.set(conversationId, abortController);

  const responseText = aiProvider.generateFrom(prompt, 0);
  runGenerationTask(conversationId, cacheEntry, messages, responseText, abortController.signal);

  yield* yieldFromCache(cacheEntry, 0);
}

/**
 * 更新会话元数据（标题、消息数、更新时间）
 */
async function touchConversation(conversationId: string, messages: Message[], firstMessageContent?: string): Promise<void> {
  const conversations = await storageService.getConversations();
  const conversation = conversations.find((c) => c.id === conversationId);
  if (conversation) {
    conversation.updatedAt = new Date().toISOString();
    conversation.messageCount = messages.length;
    if (firstMessageContent && messages.length === 2) {
      conversation.title = firstMessageContent.slice(0, 20) + (firstMessageContent.length > 20 ? '...' : '');
    }
    await storageService.saveConversations(conversations);
  }
}

/**
 * 发送消息（核心业务逻辑）
 *
 * 流程：
 * 1. 创建并保存用户消息
 * 2. yield userMessage 事件（通知前端用户消息已保存）
 * 3. 更新会话元数据（标题、消息数）
 * 4. 启动后台生成任务，从 cache 读取并 yield 流式内容
 *
 * @param conversationId - 会话 ID
 * @param content - 用户消息内容
 * @yields ChatSSEEvent 事件流（userMessage → assistantMessageId → chunk* → done|error）
 */
export async function* sendMessage(
  conversationId: string,
  content: string,
): AsyncGenerator<ChatSSEEvent> {
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

  await touchConversation(conversationId, messages, content);

  yield* startGeneration(conversationId, messages, content);
}

/**
 * 重新生成最后一条 assistant 回复
 *
 * 流程：
 * 1. 找到最后一条 user 消息
 * 2. 截断其后的所有消息（删除旧的 assistant 回复）
 * 3. 启动新的生成任务
 *
 * @param conversationId - 会话 ID
 * @yields ChatSSEEvent 事件流
 */
export async function* regenerateMessage(
  conversationId: string,
): AsyncGenerator<ChatSSEEvent> {
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

  await touchConversation(conversationId, messages);

  yield* startGeneration(conversationId, messages, userMessage.content);
}

/**
 * 编辑用户消息并重新生成回复
 *
 * 流程：
 * 1. 找到指定的用户消息并更新其内容
 * 2. 截断该消息之后的所有消息
 * 3. 基于新内容启动生成任务
 *
 * @param conversationId - 会话 ID
 * @param messageId - 要编辑的用户消息 ID
 * @param newContent - 新的消息内容
 * @yields ChatSSEEvent 事件流
 */
export async function* editAndResendMessage(
  conversationId: string,
  messageId: string,
  newContent: string,
): AsyncGenerator<ChatSSEEvent> {
  const messages = await storageService.getMessages(conversationId);
  const msgIndex = messages.findIndex((m) => m.id === messageId);

  if (msgIndex === -1) {
    yield { type: 'error', data: 'Message not found' };
    return;
  }

  messages[msgIndex].content = newContent;
  messages.splice(msgIndex + 1);

  await touchConversation(conversationId, messages);

  yield* startGeneration(conversationId, messages, newContent);
}

/**
 * 续传中断的对话
 *
 * 三种场景：
 * - A: cache 命中且生成中 → 从 cache 位置 0 发送（前端负责替换本地状态）
 * - B: cache 命中且已完成 → 直接补发内容
 * - C: cache 未命中（后端重启/缓存丢失）→ 从 storage 恢复 originalPrompt，重新生成
 *
 * @param conversationId - 会话 ID
 * @yields ChatSSEEvent 事件流
 */
export async function* resumeMessage(
  conversationId: string,
): AsyncGenerator<ChatSSEEvent> {
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
  const newCacheEntry: CacheEntry = {
    messageId: lastMessage.id,
    conversationId,
    content: lastMessage.content, // 继承已保存的部分内容
    status: 'generating',
    originalPrompt: lastMessage.originalPrompt,
  };
  messageCache.set(conversationId, newCacheEntry);

  // 同样注册取消控制器，支持客户端断开时停止
  const abortController = new AbortController();
  generationAbortControllers.set(conversationId, abortController);

  const responseText = aiProvider.generateFrom(lastMessage.originalPrompt, 0);
  runGenerationTask(conversationId, newCacheEntry, messages, responseText, abortController.signal);

  yield* yieldFromCache(newCacheEntry, 0);
}
