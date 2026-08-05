import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRelativeTime, getMessageSummary } from '../date';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 设定当前时间为 2026-08-05 12:00:00
    vi.setSystemTime(new Date('2026-08-05T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应返回"刚刚"（< 1 分钟）', () => {
    const now = new Date();
    expect(formatRelativeTime(now.toISOString())).toBe('刚刚');
  });

  it('应返回"X 分钟前"（< 1 小时）', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinAgo.toISOString())).toBe('5 分钟前');
  });

  it('应返回"X 小时前"（< 24 小时）', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeHoursAgo.toISOString())).toBe('3 小时前');
  });

  it('应返回"昨天"（< 48 小时）', () => {
    const yesterday = new Date(Date.now() - 30 * 60 * 60 * 1000);
    expect(formatRelativeTime(yesterday.toISOString())).toBe('昨天');
  });

  it('应返回"X 天前"（< 7 天）', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe('3 天前');
  });

  it('超过 7 天同年应返回 MM/DD', () => {
    const longAgo = new Date('2026-07-01T12:00:00');
    expect(formatRelativeTime(longAgo.toISOString())).toBe('07/01');
  });

  it('跨年应返回 YYYY/MM/DD', () => {
    const lastYear = new Date('2025-06-15T12:00:00');
    expect(formatRelativeTime(lastYear.toISOString())).toBe('2025/06/15');
  });
});

describe('getMessageSummary', () => {
  it('应截取指定长度', () => {
    expect(getMessageSummary('Hello World', 5)).toBe('Hello...');
  });

  it('短文本不截取', () => {
    expect(getMessageSummary('Hi', 30)).toBe('Hi');
  });

  it('空文本返回空', () => {
    expect(getMessageSummary('')).toBe('');
  });

  it('应去除换行符', () => {
    expect(getMessageSummary('Hello\nWorld', 30)).toBe('Hello World');
  });
});
