import type { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { storageService } from "../services/storageService.js";
import { mockAiService } from "../services/mockAiService.js";
import type { Message } from "../types/index.js";

/**
 * 对话控制器
 */
export class ChatController {
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

      // 获取 AI 响应
      const responseText = mockAiService.getResponse(content);

      let fullContent = "";
      let assistantMessageId = uuidv4();

      // 逐字符发送
      for (let i = 0; i < responseText.length; i++) {
        if (clientDisconnected || res.writableEnded) {
          break;
        }

        const chunk = responseText[i];
        fullContent += chunk;

        const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;

        try {
          res.write(eventData);
        } catch (writeError) {
          clientDisconnected = true;
          break;
        }

        // 模拟打字延迟
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      // 更新会话信息
      const conversations = await storageService.getConversations();
      const conversation = conversations.find((c) => c.id === conversationId);

      if (conversation) {
        conversation.updatedAt = new Date().toISOString();
        conversation.messageCount = messages.length + 1;

        if (messages.length === 1) {
          conversation.title =
            content.slice(0, 20) + (content.length > 20 ? "..." : "");
        }

        await storageService.saveConversations(conversations);
      }

      if (clientDisconnected || res.writableEnded) {
        // 客户端断开：保存部分消息，标记为 stopped
        // 只有在已经生成了一些内容时才保存
        if (fullContent.length > 0) {
          const partialMessage: Message = {
            id: assistantMessageId,
            conversationId,
            role: "assistant",
            content: fullContent,
            createdAt: new Date().toISOString(),
            status: "stopped",
            interruptedAt: fullContent.length,
            originalPrompt: content,
          };

          messages.push(partialMessage);
          await storageService.saveMessages(conversationId, messages);
        }
      } else {
        // 正常完成：保存完整消息
        const assistantMessage: Message = {
          id: assistantMessageId,
          conversationId,
          role: "assistant",
          content: fullContent,
          createdAt: new Date().toISOString(),
          status: "completed",
        };

        messages.push(assistantMessage);
        await storageService.saveMessages(conversationId, messages);

        // 发送完成事件
        try {
          res.write("event: done\ndata: {}\n\n");
          res.end();
        } catch (writeError) {
          // 写入完成事件时连接已断开，忽略错误
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
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
   * 从中断位置继续发送 AI 响应
   */
  static async resumeMessage(req: Request, res: Response) {
    const { conversationId } = req.body;

    if (!conversationId) {
      res.status(400).json({
        success: false,
        error: "Missing conversationId",
      });
      return;
    }

    // 检查最后一条消息是否为中断的 assistant 消息
    const messages = await storageService.getMessages(conversationId);
    const lastMessage = messages[messages.length - 1];

    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.status !== "stopped" ||
      !lastMessage.originalPrompt ||
      lastMessage.interruptedAt === undefined
    ) {
      res.status(400).json({
        success: false,
        error: "No interrupted message to resume",
      });
      return;
    }

    const startPosition = lastMessage.interruptedAt;
    const originalPrompt = lastMessage.originalPrompt;
    const messageId = lastMessage.id;

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
      // 更新消息状态为 streaming
      lastMessage.status = "streaming";
      await storageService.saveMessages(conversationId, messages);

      // 获取从中断位置开始的响应
      const remainingText = mockAiService.getResponseFrom(originalPrompt, startPosition);

      let fullContent = lastMessage.content;

      // 逐字符发送剩余内容
      for (let i = 0; i < remainingText.length; i++) {
        if (clientDisconnected || res.writableEnded) {
          break;
        }

        const chunk = remainingText[i];
        fullContent += chunk;

        const eventData = `event: message\ndata: ${JSON.stringify({ content: chunk })}\n\n`;

        try {
          res.write(eventData);
        } catch (writeError) {
          clientDisconnected = true;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      if (clientDisconnected || res.writableEnded) {
        // 再次中断：更新中断位置
        lastMessage.content = fullContent;
        lastMessage.status = "stopped";
        lastMessage.interruptedAt = fullContent.length;
        await storageService.saveMessages(conversationId, messages);
      } else {
        // 正常完成
        lastMessage.content = fullContent;
        lastMessage.status = "completed";
        delete lastMessage.interruptedAt;
        delete lastMessage.originalPrompt;
        await storageService.saveMessages(conversationId, messages);

        try {
          res.write("event: done\ndata: {}\n\n");
          res.end();
        } catch (writeError) {
          // 忽略
        }
      }
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
}
