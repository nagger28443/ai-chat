import { describe, it, expect } from 'vitest';
import {
  sendMessageInputSchema,
  resumeChatInputSchema,
  regenerateMessageInputSchema,
  editAndResendInputSchema,
  MAX_MESSAGE_LENGTH,
  MAX_TITLE_LENGTH,
  PAGINATION_LIMIT_MIN,
  PAGINATION_LIMIT_MAX,
} from '../../types';

describe('输入校验 Schema', () => {
  describe('sendMessageInputSchema', () => {
    it('接受有效输入', () => {
      const result = sendMessageInputSchema.safeParse({
        conversationId: 'conv-1',
        content: '你好',
      });
      expect(result.success).toBe(true);
    });

    it('拒绝空 conversationId', () => {
      const result = sendMessageInputSchema.safeParse({
        conversationId: '',
        content: '你好',
      });
      expect(result.success).toBe(false);
    });

    it('拒绝空 content', () => {
      const result = sendMessageInputSchema.safeParse({
        conversationId: 'conv-1',
        content: '',
      });
      expect(result.success).toBe(false);
    });

    it(`拒绝超过 ${MAX_MESSAGE_LENGTH} 字符的 content`, () => {
      const result = sendMessageInputSchema.safeParse({
        conversationId: 'conv-1',
        content: 'a'.repeat(MAX_MESSAGE_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });

    it(`接受刚好 ${MAX_MESSAGE_LENGTH} 字符的 content`, () => {
      const result = sendMessageInputSchema.safeParse({
        conversationId: 'conv-1',
        content: 'a'.repeat(MAX_MESSAGE_LENGTH),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('resumeChatInputSchema', () => {
    it('接受有效输入', () => {
      expect(
        resumeChatInputSchema.safeParse({ conversationId: 'c1' }).success
      ).toBe(true);
    });

    it('拒绝空 conversationId', () => {
      expect(
        resumeChatInputSchema.safeParse({ conversationId: '' }).success
      ).toBe(false);
    });
  });

  describe('regenerateMessageInputSchema', () => {
    it('接受有效输入', () => {
      expect(
        regenerateMessageInputSchema.safeParse({ conversationId: 'c1' }).success
      ).toBe(true);
    });
  });

  describe('editAndResendInputSchema', () => {
    it('接受有效输入', () => {
      const result = editAndResendInputSchema.safeParse({
        conversationId: 'c1',
        messageId: 'm1',
        newContent: '修改后的内容',
      });
      expect(result.success).toBe(true);
    });

    it('拒绝空 messageId', () => {
      const result = editAndResendInputSchema.safeParse({
        conversationId: 'c1',
        messageId: '',
        newContent: '修改后的内容',
      });
      expect(result.success).toBe(false);
    });

    it(`拒绝超过 ${MAX_MESSAGE_LENGTH} 字符的 newContent`, () => {
      const result = editAndResendInputSchema.safeParse({
        conversationId: 'c1',
        messageId: 'm1',
        newContent: 'x'.repeat(MAX_MESSAGE_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('常量', () => {
    it('MAX_MESSAGE_LENGTH 为 10000', () => {
      expect(MAX_MESSAGE_LENGTH).toBe(10_000);
    });

    it('MAX_TITLE_LENGTH 为 100', () => {
      expect(MAX_TITLE_LENGTH).toBe(100);
    });

    it('分页 limit 范围', () => {
      expect(PAGINATION_LIMIT_MIN).toBe(1);
      expect(PAGINATION_LIMIT_MAX).toBe(100);
    });
  });
});
