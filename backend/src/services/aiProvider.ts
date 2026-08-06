/**
 * AI Provider 接口
 *
 * 定义 AI 服务的统一抽象，支持多种实现：
 * - MockAiProvider：本地模拟（默认）
 * - OpenAiProvider：OpenAI GPT
 * - ClaudeProvider：Anthropic Claude
 * - 等等...
 *
 * 通过依赖倒置原则（DIP），业务层（chatService）依赖接口而非具体实现，
 * 方便切换 AI 服务而不修改业务代码。
 */

/**
 * AI 提供者接口
 *
 * 接收用户提示和历史消息，返回异步可迭代的文本片段。
 * 每个 yield 返回一个文本片段（通常 1-2 个字符，用于模拟打字效果）。
 */
export interface AiProvider {
  /** 提供者名称（用于日志和诊断） */
  readonly name: string;

  /**
   * 根据用户输入获取 AI 响应
   *
   * @param prompt 当前用户消息
   * @param history 历史消息（可选，未来用于上下文感知）
   * @returns 异步可迭代的文本片段
   */
  generate(
    prompt: string,
    history?: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  ): AsyncIterable<string>;

  /**
   * 从指定位置开始获取响应（用于断点续传）
   *
   * @param prompt 原始用户消息
   * @param startPosition 已生成内容的字符位置
   * @returns 从 startPosition 开始的文本片段
   */
  generateFrom(
    prompt: string,
    startPosition: number
  ): string;
}
