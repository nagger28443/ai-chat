import { nodeHTTPRequestHandler } from '@trpc/server/adapters/node-http';
import type { Context } from 'koa';
import type { AppRouter } from './routers/_app.js';

/**
 * tRPC Koa 中间件
 * 使用 node-http adapter 桥接 Koa 和 tRPC
 *
 * 关键细节：tRPC 的 node-http adapter 在写入响应时，
 * 只有当 res.statusCode === 200（Node 默认值）时才设置实际状态码。
 * 但 Koa 默认将 statusCode 设为 404，所以必须在调用前重置为 200。
 */
export function createKoaMiddleware(router: AppRouter) {
  return async (ctx: Context) => {
    // 阻止 Koa 在中间件结束后写响应
    ctx.respond = false;

    const { req, res } = ctx;

    // 重置状态码：tRPC adapter 的条件判断需要这个值
    res.statusCode = 200;

    // 从 URL 中提取 tRPC path（去掉 /api/trpc/ 前缀）
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname.replace(/^\/api\/trpc\//, '');

    await nodeHTTPRequestHandler({
      router,
      req,
      res,
      path,
      createContext: () => ({}),
    });
  };
}
