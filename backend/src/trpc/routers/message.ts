import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { storageService } from '../../services/storageService.js';

/**
 * 消息相关 tRPC procedures（非 SSE 的操作）
 */
export const messageRouter = router({
  /**
   * 删除指定消息
   */
  delete: publicProcedure
    .input(
      z.object({
        conversationId: z.string(),
        messageId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { conversationId, messageId } = input;

      const messages = await storageService.deleteMessage(
        conversationId,
        messageId
      );

      return { messages };
    }),
});
