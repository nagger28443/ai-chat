import React from 'react';
import styles from './ErrorBoundary.module.css';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** 可选的 fallback 渲染函数，允许自定义错误 UI */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 错误边界组件
 *
 * 捕获子组件树中的渲染错误，防止整个应用白屏。
 * 提供"重试"按钮让用户尝试恢复。
 *
 * 用法：
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 *
 * // 或自定义 fallback
 * <ErrorBoundary fallback={(error, reset) => <CustomErrorUI error={error} onRetry={reset} />}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 捕获到渲染错误:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // 允许自定义 fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // 默认 fallback UI
      return (
        <div className={styles.container}>
          <div className={styles.card}>
            <div className={styles.icon}>⚠️</div>
            <h2 className={styles.title}>出了点问题</h2>
            <p className={styles.message}>
              应用遇到了意外错误。你可以尝试刷新页面，或点击下方按钮重试。
            </p>
            <pre className={styles.errorDetail}>
              {this.state.error.message}
            </pre>
            <div className={styles.actions}>
              <button className={styles.retryBtn} onClick={this.handleReset}>
                🔄 重试
              </button>
              <button
                className={styles.reloadBtn}
                onClick={() => window.location.reload()}
              >
                🔁 刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
