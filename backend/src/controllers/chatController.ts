import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { storageService } from "../services/storageService.js";
import { mockAiService } from "../services/mockAiService.js";
import type { Message } from "../types/index.js";

/**
 * 缓存条目：存储正在生成中的消息状态
 */
interface CacheEntry {
  messageId: string;
  conversationId: string;
  content: string;
  status: "generating" | "completed";
  originalPrompt: string;
}

/**
 * 对话控制器
 */
export class ChatController {
  /**
   * 消息生成缓存：key = conversationId
   * 生成完成前，进度仅存在此处，不持久化到 storage
   */
  static messageCache: Map<string, CacheEntry> = new Map();

  /**
   * 根据 conversationId 查找正在生成的缓存条目
   */
  static getCacheByConversationId(
    conversationId: string,
  ): CacheEntry | undefined {
    for (const entry of ChatController.messageCache.values()) {
      if (
        entry.conversationId === conversationId &&
        entry.status === "generating"
      ) {
        return entry;
      }
    }
    return undefined;
  }

  static async sendMessage(req: Request, res: Response) {
    const { conversationId, content } = req.body;

    // 验证请求参数
    if (!conversationId || !content) {
      res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // 禁用 socket 超时，防止长连接被中断
    if (req.socket) {
      req.socket.setTimeout(0);
    }

    // 立即发送响应头
    res.flushHeaders();

    // 监听客户端断开
    let clientDisconnected = false;
    res.on("close", () => {
      clientDisconnected = true;
    });

    // 监听响应错误（如 ECONNRESET）
    res.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET" || error.code === "EPIPE") {
        clientDisconnected = true;
        return;
      }
      console.error("Response error:", error);
    });

    try {
      // 保存用户消息
      const userMessage: Message = {
        id: uuidv4(),
        conversationId,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
        status: "completed",
      };

      const messages = await storageService.getMessages(conversationId);
      messages.push(userMessage);
      await storageService.saveMessages(conversationId, messages);

      // 获取 AI 响应（确定性：相同输入永远返回相同输出）
      const responseText = mockAiService.getResponse(content);
      console.log(responseText);

      const assistantMessageId = uuidv4();

      // 创建 assistant 消息占位（status='generating'，content=''）
      // 写入 storage 一次，前端刷新后可通过它检测到中断
      const assistantMessage: Message = {
        id: assistantMessageId,
        conversationId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        status: "generating",
        originalPrompt: content,
      };

      messages.push(assistantMessage);
      await storageService.saveMessages(conversationId, messages);

      // 在 messageCache 中创建缓存条目（key = conversationId）
      const cacheEntry: CacheEntry = {
        messageId: assistantMessageId,
        conversationId,
        content: "",
        status: "generating",
        originalPrompt: content,
      };
      ChatController.messageCache.set(conversationId, cacheEntry);

      // 更新会话信息
      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === conversationId);

      if (conversation) {
        conversation.updatedAt = new Date().toISOString();
        conversation.messageCount = messages.length;

        if (messages.length === 2) {
          conversation.title =
            content.slice(0, 20) + (content.length > 20 ? "..." : "");
        }

        await storageService.saveConversations(conversations);
      }

      // 逐字符生成（即使客户端断开也继续）
      // 进度仅写入 messageCache，不写 storage
      for (let i = 0; i < responseText.length; i++) {
        const chunk = responseText[i];
        cacheEntry.content += chunk;

        // 仅在客户端连接时发送
        if (!clientDisconnected && !res.writableEnded) {
          const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;

          try {
            res.write(eventData);
          } catch (writeError) {
            clientDisconnected = true;
          }
        }

        // 模拟打字延迟
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // 生成完成：标记 cache 为 completed
      cacheEntry.status = "completed";

      // 一次性持久化到 storage
      const currentMsg = messages.find((m) => m.id === assistantMessageId);
      if (currentMsg) {
        currentMsg.content = cacheEntry.content;
        currentMsg.status = "completed";
        delete currentMsg.originalPrompt;
        await storageService.saveMessages(conversationId, messages);
      }

      // 清理缓存
      ChatController.messageCache.delete(conversationId);

      // 发送完成事件（仅在客户端连接时）
      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write("event: done\ndata: {}\n\n");
          res.end();
        } catch (writeError) {
          // 写入完成事件时连接已断开，忽略错误
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      // 出错时也要清理缓存
      ChatController.messageCache.delete(conversationId);

      if (!res.writableEnded) {
        try {
          res.write('event: error\ndata: {"message": "Internal error"}\n\n');
          res.end();
        } catch (writeError) {
          // 写入错误响应时连接已断开，忽略错误
        }
      }
    }
  }

  /**
   * 续传中断的对话
   *
   * 设计原则：
   * - 优先从 messageCache 读取生成进度（内存，快速）
   * - 如果 cache 中无条目（后端重启），从 storage 检测并重新生成
   * - sendMessage 是唯一的内容生成者；resumeMessage 在 cache 场景只做转发
   *   在 storage 场景（后端重启）下，resumeMessage 承担重新生成的职责
   */
  static async resumeMessage(req: Request, res: Response) {
    const { conversationId, frontendContentLength = 0 } = req.body;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: "Missing conversationId",
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (req.socket) {
      req.socket.setTimeout(0);
    }

    res.flushHeaders();

    // 监听客户端断开
    let clientDisconnected = false;
    res.on("close", () => {
      clientDisconnected = true;
    });

    res.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ECONNRESET" || error.code === "EPIPE") {
        clientDisconnected = true;
        return;
      }
      console.error("Response error:", error);
    });

    try {
      // 1. 优先从 messageCache 查找
      const cacheEntry =
        ChatController.getCacheByConversationId(conversationId);

      if (cacheEntry) {
        // ---- 场景 A：生成仍在进行中（cache 命中）----
        await ChatController.resumeFromCache(
          res,
          cacheEntry,
          frontendContentLength,
          () => clientDisconnected,
        );
        return;
      }

      // 2. Cache 未命中：从 storage 查找
      const messages = await storageService.getMessages(conversationId);
      const lastMessage = messages[messages.length - 1];

      if (
        !lastMessage ||
        lastMessage.role !== "assistant" ||
        !lastMessage.originalPrompt
      ) {
        res.write(
          'event: error\ndata: {"message": "No message to resume"}\n\n',
        );
        res.end();
        return;
      }

      if (lastMessage.status === "completed") {
        // ---- 场景 B：消息已完成，补发剩余内容 ----
        await ChatController.sendFromContent(
          res,
          lastMessage.content,
          frontendContentLength,
          () => clientDisconnected,
        );
        return;
      }

      // ---- 场景 C：后端重启，消息仍为 generating ----
      // 用 originalPrompt 重新生成完整响应
      const responseText = mockAiService.getResponse(
        lastMessage.originalPrompt,
      );

      // 前端可能已有部分内容（如 storage 中有上次保存的部分内容）
      const startPosition = frontendContentLength;

      // 创建 cache 条目，让后续请求也能跟踪
      const newCacheEntry: CacheEntry = {
        messageId: lastMessage.id,
        conversationId,
        content: "",
        status: "generating",
        originalPrompt: lastMessage.originalPrompt,
      };
      ChatController.messageCache.set(conversationId, newCacheEntry);

      // 逐字符生成，但只发送 startPosition 之后的内容
      for (let i = 0; i < responseText.length; i++) {
        if (clientDisconnected) break;

        newCacheEntry.content += responseText[i];

        // 只发送前端还没有的内容
        if (i >= startPosition) {
          const eventData = `event: message\ndata: ${JSON.stringify({ content: responseText[i] })}\n\n`;
          try {
            res.write(eventData);
          } catch (writeError) {
            clientDisconnected = true;
            break;
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      if (!clientDisconnected) {
        // 生成完成：持久化到 storage
        newCacheEntry.status = "completed";
        lastMessage.content = newCacheEntry.content;
        lastMessage.status = "completed";
        delete lastMessage.originalPrompt;
        await storageService.saveMessages(conversationId, messages);
        ChatController.messageCache.delete(conversationId);

        try {
          res.write("event: done\ndata: {}\n\n");
          res.end();
        } catch (writeError) {
          // 忽略
        }
      }
      // 如果客户端断开，cache 条目保留，sendMessage 的循环或下次 resume 会继续
    } catch (error) {
      console.error("Resume error:", error);
      if (!res.writableEnded) {
        try {
          res.write('event: error\ndata: {"message": "Internal error"}\n\n');
          res.end();
        } catch (writeError) {
          // 忽略
        }
      }
    }
  }

  /**
   * 删除指定消息
   */
  static async deleteMessage(req: Request, res: Response) {
    const { conversationId, messageId } = req.body;

    if (!conversationId || !messageId) {
      res.status(400).json({
        success: false,
        error: 'Missing conversationId or messageId',
      });
      return;
    }

    try {
      const messages = await storageService.deleteMessage(
        conversationId,
        messageId
      );
      res.json({
        success: true,
        data: { messages },
      });
    } catch (error) {
      console.error('Delete message error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete message',
      });
    }
  }

  /**
   * 重新生成最后一条 assistant 回复
   */
  static async regenerateMessage(req: Request, res: Response) {
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: 'Missing conversationId',
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (req.socket) {
      req.socket.setTimeout(0);
    }

    res.flushHeaders();

    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    res.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
        clientDisconnected = true;
        return;
      }
      console.error('Response error:', error);
    });

    try {
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
        if (!res.writableEnded) {
          res.write('event: error\ndata: {"message": "No user message found"}\n\n');
          res.end();
        }
        return;
      }

      // 移除 lastUserIndex 之后的所有消息
      const userMessage = messages[lastUserIndex];
      messages.splice(lastUserIndex + 1);

      // 创建新的 assistant 消息占位
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

      // 创建缓存条目
      const cacheEntry: CacheEntry = {
        messageId: assistantMessageId,
        conversationId,
        content: '',
        status: 'generating',
        originalPrompt: userMessage.content,
      };
      ChatController.messageCache.set(conversationId, cacheEntry);

      // 获取 AI 响应
      const responseText = mockAiService.getResponse(userMessage.content);

      // 逐字符生成
      for (let i = 0; i < responseText.length; i++) {
        const chunk = responseText[i];
        cacheEntry.content += chunk;

        if (!clientDisconnected && !res.writableEnded) {
          const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;
          try {
            res.write(eventData);
          } catch {
            clientDisconnected = true;
          }
        }

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

      ChatController.messageCache.delete(conversationId);

      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write('event: done\ndata: {}\n\n');
          res.end();
        } catch {
          // 忽略
        }
      }
    } catch (error) {
      console.error('Regenerate error:', error);
      ChatController.messageCache.delete(conversationId);
      if (!res.writableEnded) {
        try {
          res.write('event: error\ndata: {"message": "Internal error"}\n\n');
          res.end();
        } catch {
          // 忽略
        }
      }
    }
  }

  /**
   * 编辑用户消息并重新生成回复
   */
  static async editAndResendMessage(req: Request, res: Response) {
    const { conversationId, messageId, newContent } = req.body;

    if (!conversationId || !messageId || !newContent) {
      res.status(400).json({
        success: false,
        error: 'Missing conversationId, messageId, or newContent',
      });
      return;
    }

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    if (req.socket) {
      req.socket.setTimeout(0);
    }

    res.flushHeaders();

    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
    });

    res.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
        clientDisconnected = true;
        return;
      }
      console.error('Response error:', error);
    });

    try {
      const messages = await storageService.getMessages(conversationId);
      const msgIndex = messages.findIndex((m) => m.id === messageId);

      if (msgIndex === -1) {
        if (!res.writableEnded) {
          res.write('event: error\ndata: {"message": "Message not found"}\n\n');
          res.end();
        }
        return;
      }

      // 更新用户消息内容
      messages[msgIndex].content = newContent;
      // 移除该消息之后的所有消息
      messages.splice(msgIndex + 1);

      // 创建新的 assistant 消息占位
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

      // 创建缓存条目
      const cacheEntry: CacheEntry = {
        messageId: assistantMessageId,
        conversationId,
        content: '',
        status: 'generating',
        originalPrompt: newContent,
      };
      ChatController.messageCache.set(conversationId, cacheEntry);

      // 获取 AI 响应
      const responseText = mockAiService.getResponse(newContent);

      // 逐字符生成
      for (let i = 0; i < responseText.length; i++) {
        const chunk = responseText[i];
        cacheEntry.content += chunk;

        if (!clientDisconnected && !res.writableEnded) {
          const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;
          try {
            res.write(eventData);
          } catch {
            clientDisconnected = true;
          }
        }

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

      ChatController.messageCache.delete(conversationId);

      if (!clientDisconnected && !res.writableEnded) {
        try {
          res.write('event: done\ndata: {}\n\n');
          res.end();
        } catch {
          // 忽略
        }
      }
    } catch (error) {
      console.error('Edit and resend error:', error);
      ChatController.messageCache.delete(conversationId);
      if (!res.writableEnded) {
        try {
          res.write('event: error\ndata: {"message": "Internal error"}\n\n');
          res.end();
        } catch {
          // 忽略
        }
      }
    }
  }

  /**
   * 从 messageCache 轮询并发送内容（场景 A）
   */
  private static async resumeFromCache(
    res: Response,
    cacheEntry: CacheEntry,
    frontendContentLength: number,
    isDisconnected: () => boolean,
  ): Promise<void> {
    let position = frontendContentLength;

    while (!isDisconnected()) {
      // 发送新增内容
      if (cacheEntry.content.length > position) {
        for (let i = position; i < cacheEntry.content.length; i++) {
          if (isDisconnected()) break;

          const eventData = `event: message\ndata: ${JSON.stringify({ content: cacheEntry.content[i] })}\n\n`;
          try {
            res.write(eventData);
          } catch (writeError) {
            break;
          }
        }
        position = cacheEntry.content.length;
      }

      // 检查是否完成
      if (cacheEntry.status === "completed") {
        if (!isDisconnected() && !res.writableEnded) {
          try {
            res.write("event: done\ndata: {}\n\n");
            res.end();
          } catch (writeError) {
            // 忽略
          }
        }
        return;
      }

      // 等待后再次轮询
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  /**
   * 直接发送已有内容（场景 B：消息已完成）
   */
  private static async sendFromContent(
    res: Response,
    content: string,
    startPosition: number,
    isDisconnected: () => boolean,
  ): Promise<void> {
    for (let i = startPosition; i < content.length; i++) {
      if (isDisconnected()) break;

      const eventData = `event: message\ndata: ${JSON.stringify({ content: content[i] })}\n\n`;
      try {
        res.write(eventData);
      } catch (writeError) {
        break;
      }
    }

    if (!isDisconnected() && !res.writableEnded) {
      try {
        res.write("event: done\ndata: {}\n\n");
        res.end();
      } catch (writeError) {
        // 忽略
      }
    }
  }
}
