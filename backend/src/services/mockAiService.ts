/**
 * 模拟 AI 服务
 * 提供预设的回复模板
 */

// 预设回复模板
const RESPONSE_TEMPLATES = {
  greeting: [
    '你好！很高兴见到你。我是一个 AI 助手，有什么可以帮助你的吗？',
    '你好！今天过得怎么样？有什么我可以帮助你的吗？',
    '嗨！很高兴和你聊天。有什么想了解的吗？',
  ],
  code: [
    '好的，这是一个示例代码：\n\n```javascript\nfunction hello() {\n  console.log("Hello, World!");\n}\n\nhello();\n```\n\n这段代码定义了一个简单的函数并调用它。',
    '当然可以！这是一个 TypeScript 示例：\n\n```typescript\ninterface User {\n  name: string;\n  age: number;\n}\n\nconst user: User = {\n  name: "Alice",\n  age: 25\n};\n\nconsole.log(user);\n```\n\n希望这对你有帮助！',
  ],
  markdown: [
    '这是一段包含 **Markdown** 格式的文本。\n\n# 标题示例\n\n- 列表项 1\n- 列表项 2\n- 列表项 3\n\n> 这是一段引用文本\n\n你可以使用 `行内代码` 或者代码块。',
  ],
  question: [
    '这是一个很好的问题！让我来为你解答。\n\n首先，我们需要理解问题的核心。然后，我们可以通过以下步骤来解决：\n\n1. 分析问题\n2. 制定方案\n3. 实施解决\n4. 验证结果\n\n希望这个思路对你有帮助！',
    '我理解你的问题。这是一个比较复杂的话题。\n\n简单来说，关键在于找到正确的方法。你可以尝试以下步骤：\n\n- 明确目标\n- 收集信息\n- 分析对比\n- 做出决策\n\n如果需要更详细的说明，请告诉我具体想了解哪方面。',
  ],
  default: [
    '我收到了你的消息。这是一个很有趣的话题。\n\n虽然我是一个模拟的 AI 助手，但我会尽力帮助你。在真实的应用中，这里会连接到像 OpenAI、Claude 这样的 AI 服务，提供更智能的回答。\n\n目前这个 Demo 主要用于学习前后端通信、SSE 流式传输等技术。',
    '感谢你的分享！\n\n作为学习项目，我模拟了 AI 的回复。在实际应用中，后端会连接到真实的 AI API，接收用户的输入，调用 AI 模型生成回复，然后通过 SSE 流式传输给前端。\n\n你可以通过查看代码来了解这个过程的实现细节。',
  ],
};

class MockAiService {
  /**
   * 根据用户输入获取回复
   */
  getResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();

    // 问候语
    if (
      lowerMessage.includes('你好') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('嗨')
    ) {
      return this.randomPick(RESPONSE_TEMPLATES.greeting);
    }

    // 代码相关
    if (
      lowerMessage.includes('代码') ||
      lowerMessage.includes('code') ||
      lowerMessage.includes('编程') ||
      lowerMessage.includes('程序')
    ) {
      return this.randomPick(RESPONSE_TEMPLATES.code);
    }

    // Markdown 相关
    if (lowerMessage.includes('markdown') || lowerMessage.includes('格式')) {
      return this.randomPick(RESPONSE_TEMPLATES.markdown);
    }

    // 问题相关
    if (
      lowerMessage.includes('什么') ||
      lowerMessage.includes('怎么') ||
      lowerMessage.includes('如何') ||
      lowerMessage.includes('为什么') ||
      lowerMessage.includes('?') ||
      lowerMessage.includes('？')
    ) {
      return this.randomPick(RESPONSE_TEMPLATES.question);
    }

    // 默认回复
    return this.randomPick(RESPONSE_TEMPLATES.default);
  }

  /**
   * 从数组中随机选择一个元素
   */
  private randomPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}

export const mockAiService = new MockAiService();
