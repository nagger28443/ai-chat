import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

// 用于触发错误的子组件
function ThrowError({ message }: { message: string }): never {
  throw new Error(message);
}

function NormalChild() {
  return <div>正常内容</div>;
}

describe('ErrorBoundary', () => {
  it('无错误时渲染子组件', () => {
    render(
      <ErrorBoundary>
        <NormalChild />
      </ErrorBoundary>
    );

    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });

  it('捕获子组件抛出的错误并显示 fallback UI', () => {
    // 抑制控制台错误输出
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError message="测试错误" />
      </ErrorBoundary>
    );

    expect(screen.getByText('出了点问题')).toBeInTheDocument();
    expect(screen.getByText(/测试错误/)).toBeInTheDocument();
    expect(screen.getByText('🔄 重试')).toBeInTheDocument();
    expect(screen.getByText('🔁 刷新页面')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('重试按钮重置错误状态并重新渲染子组件', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // 使用 key 来强制重新挂载，模拟"修复"了错误
    let shouldThrow = true;

    function ConditionalThrow() {
      if (shouldThrow) throw new Error('boom');
      return <div>已恢复</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    );

    expect(screen.getByText('出了点问题')).toBeInTheDocument();

    // 模拟错误被修复
    shouldThrow = false;

    // 点击重试
    fireEvent.click(screen.getByText('🔄 重试'));

    expect(screen.getByText('已恢复')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('支持自定义 fallback', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>自定义错误: {error.message}</span>
            <button onClick={reset}>自定义重置</button>
          </div>
        )}
      >
        <ThrowError message="自定义测试" />
      </ErrorBoundary>
    );

    expect(screen.getByText('自定义错误: 自定义测试')).toBeInTheDocument();
    expect(screen.getByText('自定义重置')).toBeInTheDocument();

    spy.mockRestore();
  });

  it('componentDidCatch 记录错误到控制台', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError message="日志测试" />
      </ErrorBoundary>
    );

    // console.error 被调用（ErrorBoundary 内部记录错误）
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
