/**
 * 后端全局常量
 *
 * 集中管理配置值，消除代码中的魔法数字。
 */

// ============ SSE / 缓存 ============
/** 生成任务完成后缓存保留时长（毫秒），给重连的客户端时间获取最终状态 */
export const CACHE_CLEANUP_DELAY_MS = 5_000;
/** yieldFromCache 轮询间隔（毫秒） */
export const CACHE_POLL_INTERVAL_MS = 50;
/** 单个字符生成延迟（毫秒），模拟打字效果 */
export const CHAR_GENERATION_DELAY_MS = 20;
/** 续传最大等待时长（毫秒），防止残留缓存导致无限等待 */
export const RESUME_MAX_WAIT_MS = 60_000;

// ============ 服务器 ============
/** 优雅停机超时（毫秒），超时后强制退出 */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

// ============ 限流 ============
/** 限流时间窗口（毫秒） */
export const RATE_LIMIT_WINDOW_MS = 15_000;
/** 每个窗口内每个 IP 的最大请求数 */
export const RATE_LIMIT_MAX = 100;

// ============ 请求体 ============
/** 请求体大小限制 */
export const BODY_JSON_LIMIT = '1mb';
