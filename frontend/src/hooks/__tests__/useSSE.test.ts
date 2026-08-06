import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from '../useSSE';
import { api } from '../../services/api';
import { HttpError } from '../../utils/httpError';

// Mock the api module
vi.mock('../../services/api', () => ({
  api: {
    sendMessage: vi.fn(),
    resumeChat: vi.fn(),
    regenerateMessage: vi.fn(),
    editAndResendMessage: vi.fn(),
  },
}));

const mockedApi = vi.mocked(api);

/**
 * 创建一个模拟 SSE 响应的 helper
 * 将 events 编码为 SSE 文本，包装为 ReadableStream
 */
function createSSEResponse(events: Array<{ event: string; data: string }>): Response {
  const sseText = events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join('');
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
  return new Response(body, { status: 200, ok: true });
}

describe('useSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('成功流：应依次调用 onMessage 和 onDone', async () => {
    const response = createSSEResponse([
      { event: 'message', data: JSON.stringify({ content: '你' }) },
      { event: 'message', data: JSON.stringify({ content: '好' }) },
      { event: 'done', data: '{}' },
    ]);
    mockedApi.sendMessage.mockResolvedValue(response);

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.sendMessage('conv-1', '你好');
    });

    expect(onMessage).toHaveBeenCalledTimes(2);
    expect(onMessage).toHaveBeenNthCalledWith(1, '你');
    expect(onMessage).toHaveBeenNthCalledWith(2, '好');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('错误事件：应调用 onError', async () => {
    const response = createSSEResponse([
      { event: 'error', data: JSON.stringify({ message: '生成失败' }) },
    ]);
    mockedApi.sendMessage.mockResolvedValue(response);

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.sendMessage('conv-1', '你好');
    });

    expect(onError).toHaveBeenCalledWith('生成失败');
    expect(onMessage).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('HTTP 错误：api 抛出 HttpError 时应调用 onError', async () => {
    mockedApi.sendMessage.mockRejectedValue(
      new HttpError(400, 'INVALID_INPUT', '输入无效'),
    );

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.sendMessage('conv-1', '你好');
    });

    expect(onError).toHaveBeenCalledWith('输入无效');
    expect(onMessage).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('网络错误：应调用 onError 并给出友好提示', async () => {
    mockedApi.sendMessage.mockRejectedValue(new TypeError('Failed to fetch'));

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.sendMessage('conv-1', '你好');
    });

    // 网络错误应触发 onError（如果有 conversationId 会先尝试重连，最终仍会 onError）
    expect(onError).toHaveBeenCalled();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('resumeStream 应调用 api.resumeChat', async () => {
    const response = createSSEResponse([{ event: 'done', data: '{}' }]);
    mockedApi.resumeChat.mockResolvedValue(response);

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.resumeStream('conv-1');
    });

    expect(mockedApi.resumeChat).toHaveBeenCalledWith('conv-1', expect.any(AbortSignal));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('regenerateStream 应调用 api.regenerateMessage', async () => {
    const response = createSSEResponse([{ event: 'done', data: '{}' }]);
    mockedApi.regenerateMessage.mockResolvedValue(response);

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.regenerateStream('conv-1');
    });

    expect(mockedApi.regenerateMessage).toHaveBeenCalledWith(
      'conv-1',
      expect.any(AbortSignal),
    );
  });

  it('editAndResendStream 应调用 api.editAndResendMessage', async () => {
    const response = createSSEResponse([{ event: 'done', data: '{}' }]);
    mockedApi.editAndResendMessage.mockResolvedValue(response);

    const onMessage = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    const { result } = renderHook(() => useSSE({ onMessage, onDone, onError }));

    await act(async () => {
      await result.current.editAndResendStream('conv-1', 'msg-1', '新内容');
    });

    expect(mockedApi.editAndResendMessage).toHaveBeenCalledWith(
      'conv-1',
      'msg-1',
      '新内容',
      expect.any(AbortSignal),
    );
  });
});
