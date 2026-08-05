import { completeMarkdown } from './markdownComplete';

/**
 * 流式渲染专用：对正在输入的 Markdown 内容进行预处理，
 * 做到"检测到格式即补全并渲染"，既不阻塞输出也不闪烁。
 *
 * 策略：
 * 1. 去除尾部模糊标记（单个 * / ~ / `），避免渲染后又被新字符改变语义
 * 2. 对剩余内容调用 completeMarkdown 自动补全未闭合语法
 * 3. 立即返回可渲染内容，无阻塞
 */
export function renderStreamingMarkdown(text: string): string {
  let trimmed = text;

  // 去除尾部模糊标记：
  // 如果末尾是单个 *（但不是 **），它可能是 ** 的前半部分，暂不渲染
  // 如果末尾是单个 ~（但不是 ~~），它可能是 ~~ 的前半部分，暂不渲染
  // 如果末尾是单个 `，它可能是行内代码的开始，暂不渲染
  // 这样后续字符到达时不会导致"先显示再变化"的闪烁

  // 注意：需要从长到短检查，避免 ** 被误判为两个 *
  while (trimmed.length > 0) {
    if (
      trimmed.endsWith('**') ||
      trimmed.endsWith('~~') ||
      trimmed.endsWith('``')
    ) {
      // 双字符标记是完整的，保留
      break;
    }

    if (
      trimmed.endsWith('*') ||
      trimmed.endsWith('~') ||
      trimmed.endsWith('`')
    ) {
      // 单字符标记：可能是双字符标记的前半部分，丢弃
      trimmed = trimmed.slice(0, -1);
      break;
    }

    break;
  }

  // 对剩余内容自动补全未闭合语法
  return completeMarkdown(trimmed);
}
