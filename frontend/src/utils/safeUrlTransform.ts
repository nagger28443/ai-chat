/**
 * Markdown URL 安全过滤
 *
 * 防止通过 Markdown 链接/图片注入 javascript: / data: / vbscript: 等危险协议。
 * 仅允许白名单内的 URL scheme。
 */

/** 允许的 URL 协议白名单 */
const ALLOWED_URL_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * URL 安全转换函数（用于 react-markdown 的 urlTransform）
 *
 * @param url - 原始 URL
 * @returns 安全的 URL，不在白名单时返回空字符串
 *
 * @example
 * safeUrlTransform('https://example.com') // => 'https://example.com'
 * safeUrlTransform('javascript:alert(1)') // => ''
 * safeUrlTransform('/relative/path')      // => '/relative/path'
 */
export function safeUrlTransform(url: string): string {
  try {
    // 相对路径（无 protocol）直接放行
    if (
      url.startsWith('/') ||
      url.startsWith('./') ||
      url.startsWith('../') ||
      url.startsWith('#')
    ) {
      return url;
    }
    const parsed = new URL(url, 'https://placeholder.local');
    if (ALLOWED_URL_SCHEMES.includes(parsed.protocol)) {
      return url;
    }
    // 不在白名单 → 返回空字符串，阻止渲染
    return '';
  } catch {
    // URL 解析失败 → 阻止
    return '';
  }
}
