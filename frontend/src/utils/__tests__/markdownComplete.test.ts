import { describe, it, expect } from 'vitest';
import { completeMarkdown } from '../markdownComplete';

describe('completeMarkdown', () => {
  describe('代码围栏补全', () => {
    it('应补全未闭合的代码围栏', () => {
      const input = '```js\nconsole.log("hello")';
      const result = completeMarkdown(input);
      expect(result).toBe(input + '\n```');
    });

    it('不应补全已闭合的代码围栏', () => {
      const input = '```js\ncode\n```';
      expect(completeMarkdown(input)).toBe(input);
    });

    it('应处理多个代码围栏', () => {
      const input = '```js\ncode1\n```\n\n```py\ncode2';
      const result = completeMarkdown(input);
      expect(result).toBe(input + '\n```');
    });
  });

  describe('行内代码补全', () => {
    it('应补全未闭合的行内代码', () => {
      const input = '这是 `代码';
      expect(completeMarkdown(input)).toBe('这是 `代码`');
    });

    it('不应补全已闭合的行内代码', () => {
      const input = '这是 `代码`';
      expect(completeMarkdown(input)).toBe(input);
    });
  });

  describe('行内格式补全', () => {
    it('应补全未闭合的粗体', () => {
      const input = '这是 **粗体';
      expect(completeMarkdown(input)).toBe('这是 **粗体**');
    });

    it('应补全未闭合的斜体', () => {
      const input = '这是 *斜体';
      expect(completeMarkdown(input)).toBe('这是 *斜体*');
    });

    it('应补全未闭合的删除线', () => {
      const input = '这是 ~~删除';
      expect(completeMarkdown(input)).toBe('这是 ~~删除~~');
    });

    it('不应补全已闭合的格式', () => {
      expect(completeMarkdown('**粗体**')).toBe('**粗体**');
      expect(completeMarkdown('*斜体*')).toBe('*斜体*');
      expect(completeMarkdown('~~删除~~')).toBe('~~删除~~');
    });
  });

  describe('边界情况', () => {
    it('应处理空字符串', () => {
      expect(completeMarkdown('')).toBe('');
    });

    it('应处理纯文本', () => {
      expect(completeMarkdown('普通文本')).toBe('普通文本');
    });
  });
});
