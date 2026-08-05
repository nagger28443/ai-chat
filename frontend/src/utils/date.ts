/**
 * 日期格式化工具
 */

/**
 * 格式化相对时间
 * - < 1 分钟：刚刚
 * - < 1 小时：X 分钟前
 * - < 24 小时：X 小时前
 * - < 48 小时：昨天
 * - < 7 天：X 天前
 * - 其他：具体日期（MM/DD 或 YYYY/MM/DD）
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) {
    return '刚刚';
  }
  if (diffMin < 60) {
    return `${diffMin} 分钟前`;
  }
  if (diffHour < 24) {
    return `${diffHour} 小时前`;
  }
  if (diffHour < 48) {
    return '昨天';
  }
  if (diffDay < 7) {
    return `${diffDay} 天前`;
  }

  // 超过 7 天，显示具体日期
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // 如果是同一年，省略年份
  if (year === now.getFullYear()) {
    return `${month}/${day}`;
  }
  return `${year}/${month}/${day}`;
}

/**
 * 获取消息摘要（取最后一条用户消息的前 N 个字符）
 */
export function getMessageSummary(content: string, maxLength: number = 30): string {
  if (!content) return '';
  // 去除换行符
  const clean = content.replace(/\n/g, ' ');
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + '...';
}
