import { z } from 'zod';
import { router, publicProcedure } from '../index.js';
import { storageService } from '../../services/storageService.js';
import { messageSchema } from '../../../../shared/types.js';

/**
 * 消息相关 tRPC procedures（非 SSE 的操作）
 * 使用 zod schema 明确定义输出类型，确保前端类型推导正确
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
    .output(
      z.object({
        messages: z.array(messageSchema),
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
