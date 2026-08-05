import Router from '@koa/router';
import * as chatService from '../services/chatService.js';
import { SSEHelper } from '../utils/sse.js';
import type {
  SendMessageInput,
  ResumeChatInput,
  RegenerateMessageInput,
  EditAndResendInput,
} from '../types/index.js';

const router = new Router();

/**
 * 对话路由（Koa 风格）
 * SSE 端点通过 ctx.respond = false + ctx.res 绕过 Koa 自动响应
 */

// 发送消息（SSE 流式响应）
router.post('/', async (ctx) => {
  const { conversationId, content } = ctx.request.body as SendMessageInput;

  if (!conversationId || !content) {
    ctx.status = 400;
    ctx.body = { success: false, error: 'Missing required fields' };
    return;
  }

  // 绕过 Koa 自动响应，直接操作原生 Node Response
  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200; // 重置 Koa 默认的 404

  SSEHelper.setHeaders(res);
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => { clientDisconnected = true; });
  res.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      clientDisconnected = true;
      return;
    }
    console.error('Response error:', error);
  });

  try {
    for await (const event of chatService.sendMessage(conversationId, content)) {
      if (clientDisconnected || res.writableEnded) break;

      switch (event.type) {
        case 'chunk':
          try {
            SSEHelper.sendMessage(res, event.data);
          } catch {
            clientDisconnected = true;
          }
          break;
        case 'done':
          if (!clientDisconnected && !res.writableEnded) {
            try {
              SSEHelper.sendDone(res);
            } catch { /* ignore */ }
          }
          break;
        case 'error':
          if (!clientDisconnected && !res.writableEnded) {
            try {
              SSEHelper.sendError(res, event.data);
            } catch { /* ignore */ }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.writableEnded) {
      try {
        SSEHelper.sendError(res, 'Internal error');
      } catch { /* ignore */ }
    }
  }
});

// 续传中断的对话（SSE 流式响应）
router.post('/resume', async (ctx) => {
  const { conversationId, frontendContentLength = 0 } = ctx.request.body as ResumeChatInput;

  if (!conversationId) {
    ctx.status = 400;
    ctx.body = { success: false, error: 'Missing conversationId' };
    return;
  }

  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200; // 重置 Koa 默认的 404

  SSEHelper.setHeaders(res);
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => { clientDisconnected = true; });
  res.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      clientDisconnected = true;
      return;
    }
    console.error('Response error:', error);
  });

  try {
    for await (const event of chatService.resumeMessage(conversationId, frontendContentLength)) {
      if (clientDisconnected || res.writableEnded) break;

      switch (event.type) {
        case 'chunk':
          try { SSEHelper.sendMessage(res, event.data); } catch { clientDisconnected = true; }
          break;
        case 'done':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendDone(res); } catch { /* ignore */ }
          }
          break;
        case 'error':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendError(res, event.data); } catch { /* ignore */ }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Resume error:', error);
    if (!res.writableEnded) {
      try { SSEHelper.sendError(res, 'Internal error'); } catch { /* ignore */ }
    }
  }
});

// 重新生成最后一条 assistant 回复（SSE 流式响应）
router.post('/regenerate', async (ctx) => {
  const { conversationId } = ctx.request.body as RegenerateMessageInput;

  if (!conversationId) {
    ctx.status = 400;
    ctx.body = { success: false, error: 'Missing conversationId' };
    return;
  }

  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200; // 重置 Koa 默认的 404

  SSEHelper.setHeaders(res);
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => { clientDisconnected = true; });
  res.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      clientDisconnected = true;
      return;
    }
    console.error('Response error:', error);
  });

  try {
    for await (const event of chatService.regenerateMessage(conversationId)) {
      if (clientDisconnected || res.writableEnded) break;

      switch (event.type) {
        case 'chunk':
          try { SSEHelper.sendMessage(res, event.data); } catch { clientDisconnected = true; }
          break;
        case 'done':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendDone(res); } catch { /* ignore */ }
          }
          break;
        case 'error':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendError(res, event.data); } catch { /* ignore */ }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Regenerate error:', error);
    if (!res.writableEnded) {
      try { SSEHelper.sendError(res, 'Internal error'); } catch { /* ignore */ }
    }
  }
});

// 编辑用户消息并重新生成回复（SSE 流式响应）
router.post('/edit-and-resend', async (ctx) => {
  const { conversationId, messageId, newContent } = ctx.request.body as EditAndResendInput;

  if (!conversationId || !messageId || !newContent) {
    ctx.status = 400;
    ctx.body = { success: false, error: 'Missing conversationId, messageId, or newContent' };
    return;
  }

  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200; // 重置 Koa 默认的 404

  SSEHelper.setHeaders(res);
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => { clientDisconnected = true; });
  res.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      clientDisconnected = true;
      return;
    }
    console.error('Response error:', error);
  });

  try {
    for await (const event of chatService.editAndResendMessage(conversationId, messageId, newContent)) {
      if (clientDisconnected || res.writableEnded) break;

      switch (event.type) {
        case 'chunk':
          try { SSEHelper.sendMessage(res, event.data); } catch { clientDisconnected = true; }
          break;
        case 'done':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendDone(res); } catch { /* ignore */ }
          }
          break;
        case 'error':
          if (!clientDisconnected && !res.writableEnded) {
            try { SSEHelper.sendError(res, event.data); } catch { /* ignore */ }
          }
          break;
      }
    }
  } catch (error) {
    console.error('Edit and resend error:', error);
    if (!res.writableEnded) {
      try { SSEHelper.sendError(res, 'Internal error'); } catch { /* ignore */ }
    }
  }
});

export default router;
