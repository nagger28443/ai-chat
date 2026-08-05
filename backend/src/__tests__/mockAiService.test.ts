import { describe, it, expect } from 'vitest';
import { mockAiService } from '../services/mockAiService.js';

describe('MockAiService', () => {
  describe('getResponse', () => {
    it('应对问候语返回问候模板', () => {
      const response = mockAiService.getResponse('你好');
      expect(response.length).toBeGreaterThan(0);
      expect(typeof response).toBe('string');
    });

    it('应对代码相关问题返回代码模板', () => {
      const response = mockAiService.getResponse('写一段代码');
      expect(response).toContain('```');
    });

    it('应对问题返回问题模板', () => {
      const response = mockAiService.getResponse('这是什么？');
      expect(response.length).toBeGreaterThan(0);
    });

    it('应对未知输入返回默认模板', () => {
      const response = mockAiService.getResponse('随机内容 abcxyz');
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('确定性响应', () => {
    it('相同输入应返回相同输出', () => {
      const input = '测试确定性';
      const response1 = mockAiService.getResponse(input);
      const response2 = mockAiService.getResponse(input);
      expect(response1).toBe(response2);
    });
  });

  describe('getResponseFrom', () => {
    it('应从指定位置截断响应', () => {
      const full = mockAiService.getResponse('你好');
      const partial = mockAiService.getResponseFrom('你好', 5);
      expect(partial).toBe(full.slice(5));
    });

    it('起始位置超出长度时返回空字符串', () => {
      const result = mockAiService.getResponseFrom('你好', 10000);
      expect(result).toBe('');
    });

    it('起始位置为 0 时返回完整响应', () => {
      const full = mockAiService.getResponse('你好');
      const fromStart = mockAiService.getResponseFrom('你好', 0);
      expect(fromStart).toBe(full);
    });
  });
});
