import type { Context, Next } from 'koa';

/**
 * 限流中间件配置选项
 */
interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 每个窗口内允许的最大请求数 */
  max: number;
}

/**
 * 滑动窗口限流器
 *
 * 基于 IP 的固定窗口限流：
 * - 每个 IP 在 windowMs 时间窗口内最多 max 次请求
 * - 窗口到期后计数器自动重置
 * - 超出限制返回 429 Too Many Requests
 *
 * 注意：这是进程内限流，不跨多实例。
 * 生产环境应使用 Redis 等共享存储实现分布式限流。
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max } = options;
  const hits = new Map<string, { count: number; resetAt: number }>();

  // 定期清理过期条目，防止 Map 无限增长
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now >= entry.resetAt) hits.delete(key);
    }
  }, windowMs).unref();

  return async (ctx: Context, next: Next) => {
    const ip = ctx.ip;
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count++;

    // 设置限流相关响应头
    ctx.set('X-RateLimit-Limit', String(max));
    ctx.set('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    ctx.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      ctx.status = 429;
      ctx.body = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests, please try again later`,
      };
      ctx.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return;
    }

    await next();
  };
}
