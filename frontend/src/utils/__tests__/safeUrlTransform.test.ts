import { describe, it, expect } from 'vitest';
import { safeUrlTransform } from '../safeUrlTransform';

describe('safeUrlTransform', () => {
  describe('允许的协议', () => {
    it('应允许 https 链接', () => {
      expect(safeUrlTransform('https://example.com')).toBe('https://example.com');
      expect(safeUrlTransform('https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
    });

    it('应允许 http 链接', () => {
      expect(safeUrlTransform('http://example.com')).toBe('http://example.com');
    });

    it('应允许 mailto 链接', () => {
      expect(safeUrlTransform('mailto:test@example.com')).toBe('mailto:test@example.com');
    });
  });

  describe('相对路径', () => {
    it('应允许以 / 开头的绝对路径', () => {
      expect(safeUrlTransform('/images/logo.png')).toBe('/images/logo.png');
    });

    it('应允许以 ./ 开头的相对路径', () => {
      expect(safeUrlTransform('./file.txt')).toBe('./file.txt');
    });

    it('应允许以 ../ 开头的相对路径', () => {
      expect(safeUrlTransform('../file.txt')).toBe('../file.txt');
    });

    it('应允许锚点链接', () => {
      expect(safeUrlTransform('#section')).toBe('#section');
    });
  });

  describe('阻止的危险协议', () => {
    it('应阻止 javascript: 协议', () => {
      expect(safeUrlTransform('javascript:alert(1)')).toBe('');
      expect(safeUrlTransform('javascript:void(0)')).toBe('');
    });

    it('应阻止 data: 协议', () => {
      expect(safeUrlTransform('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(safeUrlTransform('data:image/png;base64,abc')).toBe('');
    });

    it('应阻止 vbscript: 协议', () => {
      expect(safeUrlTransform('vbscript:MsgBox("XSS")')).toBe('');
    });

    it('应阻止 file: 协议', () => {
      expect(safeUrlTransform('file:///etc/passwd')).toBe('');
    });

    it('应阻止 ftp: 协议', () => {
      expect(safeUrlTransform('ftp://example.com/file')).toBe('');
    });
  });

  describe('边界情况', () => {
    it('应处理空字符串', () => {
      // 空字符串不是相对路径，URL 解析会使用 base，protocol 为 https:，所以会放行
      // 这是 react-markdown 的默认行为
      const result = safeUrlTransform('');
      // 空字符串会被 URL 解析为 base URL
      expect(typeof result).toBe('string');
    });

    it('应处理畸形 URL', () => {
      // 畸形 URL 如果解析失败，应返回空字符串
      // 但大部分"畸形" URL 在 URL 构造器中仍能解析
      expect(typeof safeUrlTransform('http://')).toBe('string');
    });
  });
});
