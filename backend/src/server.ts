import Koa from 'koa';
import Router from '@koa/router';
import cors from '@koa/cors';
import bodyParser from 'koa-bodyparser';
import chatRoutes from './routes/chat.js';
import { appRouter } from './trpc/routers/_app.js';
import { createKoaMiddleware } from './trpc/koaAdapter.js';

const app = new Koa();
const router = new Router();
const PORT = process.env.PORT || 3000;

// 错误处理
app.on('error', (err: Error) => {
  console.error('Server error:', err);
});

// 中间件
app.use(cors());

// tRPC 中间件（在 bodyparser 之前，因为它需要读取原始流）
const trpcMiddleware = createKoaMiddleware(appRouter);
app.use(async (ctx, next) => {
  if (ctx.path.startsWith('/api/trpc/')) {
    await trpcMiddleware(ctx);
  } else {
    await next();
  }
});

// bodyparser 只应用于非 tRPC 路由
app.use(bodyParser());

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

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Backend server (Koa) is running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 tRPC: http://localhost:${PORT}/api/trpc`);
  console.log(`📍 Chat (SSE): http://localhost:${PORT}/api/chat`);
});

export default app;
