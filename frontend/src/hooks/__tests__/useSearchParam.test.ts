import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchParam } from '../useSearchParam';

describe('useSearchParam', () => {
  // 每个测试前重置 URL
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    window.history.pushState({}, '', '/');
  });

  it('URL 无参数时返回 null', () => {
    const { result } = renderHook(() => useSearchParam('conversationId'));
    expect(result.current[0]).toBeNull();
  });

  it('读取 URL 中的参数值', () => {
    window.history.pushState({}, '', '/?conversationId=abc123');
    const { result } = renderHook(() => useSearchParam('conversationId'));
    expect(result.current[0]).toBe('abc123');
  });

  it('设置参数后更新 URL', () => {
    const { result } = renderHook(() => useSearchParam('conversationId'));

    act(() => {
      result.current[1]('abc123');
    });

    expect(result.current[0]).toBe('abc123');
    expect(window.location.search).toBe('?conversationId=abc123');
  });

  it('设置 null 后移除参数', () => {
    window.history.pushState({}, '', '/?conversationId=abc123');
    const { result } = renderHook(() => useSearchParam('conversationId'));
    expect(result.current[0]).toBe('abc123');

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('覆盖已有参数值', () => {
    window.history.pushState({}, '', '/?conversationId=first');
    const { result } = renderHook(() => useSearchParam('conversationId'));

    act(() => {
      result.current[1]('second');
    });

    expect(result.current[0]).toBe('second');
    expect(window.location.search).toBe('?conversationId=second');
  });

  it('popstate 事件触发时更新值（浏览器前进/后退）', () => {
    const { result } = renderHook(() => useSearchParam('conversationId'));
    expect(result.current[0]).toBeNull();

    // 模拟浏览器前进/后退
    act(() => {
      window.history.pushState({}, '', '/?conversationId=newValue');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0]).toBe('newValue');
  });

  it('保留 URL 中的其他参数', () => {
    window.history.pushState({}, '', '/?foo=bar&conversationId=abc');
    const { result } = renderHook(() => useSearchParam('conversationId'));

    act(() => {
      result.current[1]('xyz');
    });

    // 应该保留 foo=bar
    expect(window.location.search).toContain('foo=bar');
    expect(window.location.search).toContain('conversationId=xyz');
  });

  it('移除参数时保留其他参数', () => {
    window.history.pushState({}, '', '/?foo=bar&conversationId=abc');
    const { result } = renderHook(() => useSearchParam('conversationId'));

    act(() => {
      result.current[1](null);
    });

    expect(window.location.search).toBe('?foo=bar');
  });

  it('跨组件同步：一个实例 setParam 后，其他实例也更新', () => {
    // 模拟两个组件各自订阅 conversationId
    const hook1 = renderHook(() => useSearchParam('conversationId'));
    const hook2 = renderHook(() => useSearchParam('conversationId'));

    expect(hook1.result.current[0]).toBeNull();
    expect(hook2.result.current[0]).toBeNull();

    // hook1 设置值（比如 Sidebar 点击会话）
    act(() => {
      hook1.result.current[1]('abc123');
    });

    // hook2 应该也同步更新（因为派发了 search-param-change 事件）
    expect(hook1.result.current[0]).toBe('abc123');
    expect(hook2.result.current[0]).toBe('abc123');
  });

  it('跨组件同步：不同 key 的实例也会从 URL 重新读取', () => {
    // hookA 管理 conversationId
    const hookA = renderHook(() => useSearchParam('conversationId'));
    // hookB 只读取 conversationId（不写入）
    const hookB = renderHook(() => useSearchParam('conversationId'));

    act(() => {
      hookA.result.current[1]('newValue');
    });

    expect(hookB.result.current[0]).toBe('newValue');
  });
});
