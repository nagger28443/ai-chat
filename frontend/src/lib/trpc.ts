import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../backend/src/trpc/routers/_app.js';

/**
 * tRPC React 客户端
 * 提供类型安全的 React hooks（useQuery, useMutation 等）
 */
export const trpc = createTRPCReact<AppRouter>();
