import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownSegmenter } from '../markdownSegmenter';

describe('MarkdownSegmenter', () => {
  let segmenter: MarkdownSegmenter;

  beforeEach(() => {
    segmenter = new MarkdownSegmenter();
  });

  describe('基本分段', () => {
    it('应将段落按空行分隔', () => {
      segmenter.push('第一段\n\n第二段');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(2);
      expect(segments[0]).toBe('第一段\n\n');
      expect(segments[1]).toBe('第二段');
    });

    it('应处理多个段落', () => {
      segmenter.push('段落1\n\n段落2\n\n段落3');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(3);
      expect(segments[0]).toBe('段落1\n\n');
      expect(segments[1]).toBe('段落2\n\n');
      expect(segments[2]).toBe('段落3');
    });

    it('应处理逐字符输入', () => {
      const text = 'A\n\nB';
      for (const char of text) {
        segmenter.push(char);
      }
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(2);
      expect(segments[0]).toBe('A\n\n');
      expect(segments[1]).toBe('B');
    });
  });

  describe('代码块处理', () => {
    it('应将代码块作为单个段', () => {
      segmenter.push('```javascript\nconsole.log("hello")\n```');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toContain('```javascript');
      expect(segments[0]).toContain('console.log');
      expect(segments[0]).toContain('```');
    });

    it('应在代码块内保留空行', () => {
      segmenter.push('```js\nline1\n\nline2\n```');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toContain('line1\n\nline2');
    });

    it('应处理代码块前后的内容', () => {
      segmenter.push('前面\n\n```js\ncode\n```\n\n后面');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(3);
      expect(segments[0]).toBe('前面\n\n');
      expect(segments[1]).toContain('```js');
      expect(segments[2]).toContain('后面');
    });
  });

  describe('finalize 方法', () => {
    it('应将剩余 buffer 作为最后一段', () => {
      segmenter.push('段落1\n\n段落2');
      const segments = segmenter.finalize();
      expect(segments).toHaveLength(2);
      expect(segments[0]).toBe('段落1\n\n');
      expect(segments[1]).toBe('段落2');
    });

    it('应重置状态', () => {
      segmenter.push('内容');
      segmenter.finalize();
      expect(segmenter.getSegments()).toHaveLength(0);
    });

    it('应处理未闭合的代码块', () => {
      segmenter.push('```js\ncode');
      const segments = segmenter.finalize();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe('```js\ncode');
    });
  });

  describe('边界情况', () => {
    it('应处理空输入', () => {
      segmenter.push('');
      expect(segmenter.getSegments()).toHaveLength(0);
    });

    it('应处理只有换行的输入', () => {
      segmenter.push('\n\n');
      const segments = segmenter.getSegments();
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe('\n\n');
    });
  });
});
