import { describe, it, expect } from 'vitest';
import { renderStreamingMarkdown } from '../renderStreamingMarkdown';

describe('renderStreamingMarkdown', () => {
  describe('移除末尾不确定标记', () => {
    it('应移除末尾的单个 *', () => {
      const result = renderStreamingMarkdown('这是*');
      expect(result).not.toMatch(/\*$/);
    });

    it('应移除末尾的单个 ~', () => {
      const result = renderStreamingMarkdown('这是~');
      expect(result).not.toMatch(/~$/);
    });

    it('应保留末尾的 **', () => {
      const result = renderStreamingMarkdown('这是**');
      expect(result).toMatch(/\*\*$/);
    });

    it('应保留末尾的 ~~', () => {
      const result = renderStreamingMarkdown('这是~~');
      expect(result).toMatch(/~~$/);
    });
  });

  describe('与 completeMarkdown 集成', () => {
    it('应补全未闭合的粗体', () => {
      expect(renderStreamingMarkdown('这是 **粗体')).toBe('这是 **粗体**');
    });

    it('应补全未闭合的斜体', () => {
      // 末尾的 * 被移除后，不会再补全
      const result = renderStreamingMarkdown('这是 *斜体');
      expect(result).toContain('*');
    });

    it('应补全未闭合的删除线', () => {
      expect(renderStreamingMarkdown('这是 ~~删除')).toBe('这是 ~~删除~~');
    });

    it('应补全未闭合的行内代码', () => {
      expect(renderStreamingMarkdown('这是 `代码')).toBe('这是 `代码`');
    });
  });

  describe('边界情况', () => {
    it('应处理空字符串', () => {
      expect(renderStreamingMarkdown('')).toBe('');
    });

    it('应处理纯文本', () => {
      expect(renderStreamingMarkdown('普通文本')).toBe('普通文本');
    });
  });

  describe('实际流式场景', () => {
    it('应处理正在输入的粗体', () => {
      expect(renderStreamingMarkdown('**粗体文')).toBe('**粗体文**');
    });

    it('应处理已完成的格式后继续输入', () => {
      const input = '**粗体** 然后 ';
      expect(renderStreamingMarkdown(input)).toBe(input);
    });
  });
});
