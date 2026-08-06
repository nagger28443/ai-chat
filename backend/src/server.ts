import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import http from 'http';
import chatRoutes from './routes/chat.js';
import { appRouter } from './trpc/routers/_app.js';
import { createKoaMiddleware } from './trpc/koaAdapter.js';
import { rateLimit } from './middleware/rateLimit.js';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, BODY_JSON_LIMIT, SHUTDOWN_TIMEOUT_MS } from './constants.js';

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || 3000;

// 错误处理
app.on('error', (err: Error) => {
  console.error('Server error:', err);
});

// 中间件
app.use(cors());

// 限流：每个 IP 每 15 秒最多 100 次请求
app.use(rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, max: RATE_LIMIT_MAX }));

// tRPC 中间件（在 bodyparser 之前，因为它需要读取原始流）
const trpcMiddleware = createKoaMiddleware(appRouter);
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/trpc/')) {
    await trpcMiddleware(ctx);
  } else {
    await next();
  }
});

// bodyparser 只应用于非 tRPC 路由（限制请求体大小）
app.use(bodyParser({ jsonLimit: BODY_JSON_LIMIT }));

// 健康检查接口
router.get('/api/health', (ctx) => {
  ctx.body = {
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  };
});

// SSE 业务路由
router.use('/api/chat', chatRoutes.routes(), chatRoutes.allowedMethods());

// 应用路由
app.use(router.routes());
app.use(router.allowedMethods());

// 404 处理（跳过已发送响应的请求，如 tRPC/SSE）
app.use((ctx) => {
  if (ctx.res.writableEnded) return;
  ctx.status = 404;
  ctx.body = {
    success: false,
    error: 'Not found',
  };
});

// ============ 启动与优雅停机 ============

const server = http.createServer(app.callback());

// 跟踪活跃的 SSE 连接（用于优雅停机时关闭）
const activeSSEResponses = new Set<import('http').ServerResponse>();
export function trackSSEResponse(res: import('http').ServerResponse) {
  activeSSEResponses.add(res);
  res.on('close', () => activeSSEResponses.delete(res));
}

let isShuttingDown = false;

/**
 * 优雅停机
 *
 * 1. 设置 isShuttingDown 标志，停止接受新连接
 * 2. 向所有活跃 SSE 客户端发送 done 事件并关闭连接
 * 3. 等待进行中的请求完成（最长 SHUTDOWN_TIMEOUT_MS）
 * 4. 强制退出
 */
async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n🛑 Received ${signal}, starting graceful shutdown...`);

  // 1. 停止接受新连接
  server.close(() => {
    console.log('✅ All connections closed');
  });

  // 2. 通知活跃 SSE 客户端
  for (const res of activeSSEResponses) {
    try {
      if (!res.writableEnded) {
        res.write('event: done\ndata: {}\n\n');
        res.end();
      }
    } catch {
      // ignore
    }
  }
  activeSSEResponses.clear();

  // 3. 超时强制退出
  setTimeout(() => {
    console.warn('⚠️ Shutdown timeout reached, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动服务器
server.listen(PORT, () => {
  console.log(`🚀 Backend server (Koa) is running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 tRPC: http://localhost:${PORT}/api/trpc`);
  console.log(`📍 Chat (SSE): http://localhost:${PORT}/api/chat`);
});

export default app;
