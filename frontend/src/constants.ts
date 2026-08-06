/**
 * 前端全局常量
 *
 * 集中管理配置值，消除代码中的魔法数字。
 * 按用途分组，便于调优和维护。
 */

// ============ 分页 ============
/** 每次加载的消息数量 */
export const PAGE_SIZE = 10;

// ============ 滚动 ============
/** 距离底部多少像素内视为"在底部附近"（触发自动滚动） */
export const SCROLL_NEAR_BOTTOM_THRESHOLD = 50;
/** textarea 自动调整高度的最大像素值 */
export const TEXTAREA_MAX_HEIGHT = 200;

// ============ 动画 / UI ============
/** "已复制"提示显示时长（毫秒） */
export const COPIED_INDICATOR_DURATION = 1500;

// ============ SSE / 网络 ============
/** SSE 流读取超时（毫秒） */
export const SSE_READ_TIMEOUT_MS = 60_000;
/** SSE 断线自动重连最大重试次数 */
export const SSE_MAX_RETRIES = 3;
/** SSE 重连基础延迟（毫秒），实际延迟按指数退避：1s, 2s, 4s */
export const SSE_RETRY_BASE_DELAY_MS = 1000;
