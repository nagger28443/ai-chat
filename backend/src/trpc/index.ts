import { initTRPC } from '@trpc/server';
import { ZodError } from 'zod';
import type { ApiErrorResponse } from '../../../shared/types.js';

/**
 * tRPC 初始化
 *
 * 配置 errorFormatter 统一错误响应格式为 ApiErrorResponse：
 * { code: string, message: string, details?: unknown }
 *
 * 前端 httpBatchLink 收到的错误将遵循此格式，
 * 可通过 HttpError.fromResponse() 统一解析。
 */
const t = initTRPC.create({
  errorFormatter(opts) {
    const { error } = opts;

    let code: string;
    let message: string;
    let details: unknown;

    if (error.cause instanceof ZodError) {
      // zod 校验错误：提取字段级别的详细信息
      code = 'INVALID_INPUT';
      message = '输入验证失败';
      details = error.cause.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
    } else {
      code = error.code ?? 'INTERNAL_ERROR';
      message = error.message;
    }

    const formatted: ApiErrorResponse = {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    };
    return formatted;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
