import { initTRPC } from '@trpc/server';

/**
 * tRPC 初始化
 * 这里可以添加 context、中间件等
 */
const t = initTRPC.create();

export const router = t.router;
export const publicProcedure = t.procedure;
