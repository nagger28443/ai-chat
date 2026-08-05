import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import conversationRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';
import { appRouter } from './trpc/routers/_app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());

// 手动解析 JSON body（解决 Express 5 的 body 解析问题）
app.use((req, res, next) => {
  if (
    (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') &&
    req.headers['content-type']?.includes('application/json')
  ) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
      } catch (error) {
        console.error('Failed to parse JSON body:', error);
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});

// 健康检查接口
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

// tRPC 中间件
app.use(
  '/api/trpc',
  createExpressMiddleware({
    router: appRouter,
  })
);

// 注册路由
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📍 Conversations: http://localhost:${PORT}/api/conversations`);
  console.log(`📍 Chat: http://localhost:${PORT}/api/chat`);
});

// 错误处理中间件
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
);

export default app;
