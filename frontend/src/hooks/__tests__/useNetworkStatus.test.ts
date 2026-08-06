import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNetworkStatus } from '../useNetworkStatus';

describe('useNetworkStatus', () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    // 默认在线
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
  });

  it('初始状态反映 navigator.onLine', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it('离线时 isOnline 为 false', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('offline 事件触发时更新为离线', () => {
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
  });

  it('online 事件触发时更新为在线', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);

    // 恢复在线状态
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
  });

  it('清理后不再响应事件', () => {
    const { result, unmount } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);

    unmount();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // unmount 后 result.current 仍然是最后一次渲染的值
    expect(result.current.isOnline).toBe(true);
  });
});
