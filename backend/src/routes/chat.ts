import Router from '@koa/router';
import * as chatService from '../services/chatService.js';
import { SSEHelper } from '../utils/sse.js';
import {
  sendMessageInputSchema,
  resumeChatInputSchema,
  regenerateMessageInputSchema,
  editAndResendInputSchema,
  createErrorResponse,
  type ApiErrorResponse,
} from '../../../shared/types.js';

const router = new Router();

/**
 * 返回 400 统一格式错误响应
 */
function badRequest(res: import('http').ServerResponse, message: string, details?: unknown) {
  const body: ApiErrorResponse = createErrorResponse('INVALID_INPUT', message, details);
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * 处理 zod 校验失败的 details 字段
 */
function zodErrorDetails(error: import('zod').ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * 对话路由（Koa 风格）
 * SSE 端点通过 ctx.respond = false + ctx.res 绕过 Koa 自动响应
 *
 * 所有端点使用 zod schema 校验输入，失败时返回统一错误格式：
 * { code: 'INVALID_INPUT', message: '...', details: [...] }
 */

// 发送消息（SSE 流式响应）
router.post('/', async (ctx) => {
  const result = sendMessageInputSchema.safeParse(ctx.request.body);
  if (!result.success) {
    badRequest(ctx.res, 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  const { conversationId, content } = result.data;

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
  const result = resumeChatInputSchema.safeParse(ctx.request.body);
  if (!result.success) {
    badRequest(ctx.res, 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  const { conversationId } = result.data;

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
    for await (const event of chatService.resumeMessage(conversationId)) {
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
  const result = regenerateMessageInputSchema.safeParse(ctx.request.body);
  if (!result.success) {
    badRequest(ctx.res, 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  const { conversationId } = result.data;

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
  const result = editAndResendInputSchema.safeParse(ctx.request.body);
  if (!result.success) {
    badRequest(ctx.res, 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  const { conversationId, messageId, newContent } = result.data;

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
