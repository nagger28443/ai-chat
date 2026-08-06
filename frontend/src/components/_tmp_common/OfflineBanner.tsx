import styles from './OfflineBanner.module.css';

/**
 * 离线提示横幅
 *
 * 固定在页面顶部，当网络断开时显示。
 * 纯展示组件，不持有状态（由父组件通过 useNetworkStatus 控制显隐）。
 */
export function OfflineBanner() {
  return (
    <div className={styles.banner} role="alert" aria-live="polite">
      <span className={styles.icon}>⚠️</span>
      <span className={styles.text}>网络已断开，请检查网络连接。恢复后将自动重试。</span>
    </div>
  );
}
