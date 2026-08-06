import Router from '@koa/router';
import * as chatService from '../services/chatService.js';
import type { ChatSSEEvent } from '../services/chatService.js';
import { SSEHelper } from '../utils/sse.js';
import {
  sendMessageInputSchema,
  resumeChatInputSchema,
  regenerateMessageInputSchema,
  editAndResendInputSchema,
  createErrorResponse,
  type ApiErrorResponse,
} from '../../../shared/types.js';
import type { ZodSchema } from 'zod';

const router = new Router();

/**
 * 返回 400 统一格式错误响应（写入 JSON 并结束响应）
 */
function badRequest(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }, message: string, details?: unknown) {
  const body: ApiErrorResponse = createErrorResponse('INVALID_INPUT', message, details);
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

/**
 * 提取 zod 校验失败的 details 字段
 */
function zodErrorDetails(error: import('zod').ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * 通用 SSE 路由处理器（高阶函数）
 *
 * 封装所有 SSE 端点的公共流程：
 * 1. zod 校验请求体（失败时返回 400 统一格式）
 * 2. 设置 SSE 响应头
 * 3. 分发 SSE 事件到响应流
 * 4. 统一错误处理
 *
 * 注意：客户端断开（网络中断、切换会话等）时，生成任务继续运行。
 * 只有用户显式调用 POST /cancel 才会取消生成任务。
 */
async function handleSSERoute<T>(
  ctx: { request: { body?: unknown }; res: import('http').ServerResponse; respond?: boolean },
  schema: ZodSchema<T>,
  handler: (input: T) => AsyncGenerator<ChatSSEEvent>,
  logPrefix: string,
): Promise<void> {
  const result = schema.safeParse(ctx.request.body);
  if (!result.success) {
    badRequest(ctx.res, 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  // 绕过 Koa 自动响应，直接操作原生 Node Response
  ctx.respond = false;
  const res = ctx.res;
  res.statusCode = 200;
  SSEHelper.setHeaders(res);
  res.flushHeaders();

  let clientDisconnected = false;
  res.on('close', () => {
    clientDisconnected = true;
    // 注意：不取消生成任务。后端生成任务独立于客户端连接运行，
    // 客户端可以后续通过 resume 重新连接获取剩余内容。
  });
  res.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      clientDisconnected = true;
      return;
    }
    console.error('Response error:', error);
  });

  try {
    for await (const event of handler(result.data)) {
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
        // userMessage / assistantMessageId 由 chatService 内部消费，不通过 SSE 发送
      }
    }
  } catch (error) {
    console.error(`${logPrefix} error:`, error);
    if (!res.writableEnded) {
      try { SSEHelper.sendError(res, 'Internal error'); } catch { /* ignore */ }
    }
  }
}

// ============ 路由定义 ============

router.post('/', (ctx) =>
  handleSSERoute(
    ctx,
    sendMessageInputSchema,
    (input) => chatService.sendMessage(input.conversationId, input.content),
    'Chat',
  ),
);

router.post('/resume', (ctx) =>
  handleSSERoute(
    ctx,
    resumeChatInputSchema,
    (input) => chatService.resumeMessage(input.conversationId),
    'Resume',
  ),
);

router.post('/regenerate', (ctx) =>
  handleSSERoute(
    ctx,
    regenerateMessageInputSchema,
    (input) => chatService.regenerateMessage(input.conversationId),
    'Regenerate',
  ),
);

router.post('/edit-and-resend', (ctx) =>
  handleSSERoute(
    ctx,
    editAndResendInputSchema,
    (input) => chatService.editAndResendMessage(input.conversationId, input.messageId, input.newContent),
    'Edit and resend',
  ),
);

/**
 * 取消生成任务（用户显式点击"停止"按钮时调用）
 *
 * 注意：SSE 连接断开（网络问题、切换会话等）不会触发取消。
 * 只有前端显式调用此接口才会停止后端生成任务。
 */
router.post('/cancel', async (ctx) => {
  const result = resumeChatInputSchema.safeParse(ctx.request.body);
  if (!result.success) {
    ctx.status = 400;
    ctx.body = createErrorResponse('INVALID_INPUT', 'Invalid input', zodErrorDetails(result.error));
    return;
  }

  chatService.cancelGeneration(result.data.conversationId);
  ctx.status = 200;
  ctx.body = { success: true };
});

export default router;
