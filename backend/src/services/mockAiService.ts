/**
 * Mock AI Provider
 *
 * 基于预设模板的模拟 AI 服务，用于开发和演示。
 * 根据用户输入关键词选择模板，使用哈希确保确定性响应（相同输入 = 相同输出）。
 *
 * 实现 AiProvider 接口，方便未来替换为真实 AI 服务。
 */
import type { AiProvider } from './aiProvider.js';

// 预设回复模板 —— 丰富的 Markdown 格式
const RESPONSE_TEMPLATES = {
  greeting: [
    `## 你好！我是 AI 助手 👋

很高兴为你服务。我可以帮你完成以下任务：

- **文本生成**：撰写文章、邮件、报告等
- **代码辅助**：编写、解释、调试代码
- **知识问答**：回答各类问题
- **数据分析**：表格整理、趋势分析

> 💡 有什么我可以帮你的吗？`,

    `### 你好！今天过得怎么样？ 😊

我是一个 **AI 助手**，可以为你提供多种帮助：

1. 📝 写作与编辑
2. 💻 编程与调试
3. 📊 数据分析
4. 🎓 学习辅导

试试问我一个具体问题吧！`,
  ],
  code: [
    `### 好的，这是一个示例代码

以下是一个 JavaScript 函数，实现了 **防抖（debounce）** 功能：

\`\`\`javascript
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}
\`\`\`

#### 使用方式

\`\`\`javascript
const handleSearch = debounce((query) => {
  console.log('搜索:', query);
  fetchResults(query);
}, 500);

input.addEventListener('input', (e) => {
  handleSearch(e.target.value);
});
\`\`\`

#### 关键要点

| 参数 | 说明 | 默认值 |
|------|------|--------|
| \`fn\` | 需要防抖的函数 | 必填 |
| \`delay\` | 延迟毫秒数 | \`300\` |

> **提示**：防抖常用于搜索框输入、窗口 resize 等高频触发场景。`,

    `### 这是一个 TypeScript 示例

下面实现了一个 **泛型栈（Stack）** 数据结构：

\`\`\`typescript
interface StackItem<T> {
  value: T;
  next?: StackItem<T>;
}

class Stack<T> {
  private top?: StackItem<T>;
  private size = 0;

  push(value: T): void {
    const item: StackItem<T> = { value, next: this.top };
    this.top = item;
    this.size++;
  }

  pop(): T | undefined {
    if (!this.top) return undefined;
    const value = this.top.value;
    this.top = this.top.next;
    this.size--;
    return value;
  }

  peek(): T | undefined {
    return this.top?.value;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }
}
\`\`\`

#### 测试代码

\`\`\`typescript
const stack = new Stack<number>();
stack.push(1);
stack.push(2);
stack.push(3);

console.log(stack.pop());    // 3
console.log(stack.peek());   // 2
console.log(stack.isEmpty()); // false
\`\`\`

**时间复杂度**：\`push\` / \`pop\` / \`peek\` 均为 *O(1)*`,
  ],
  markdown: [
    `### Markdown 格式演示

这是一段包含多种 **Markdown** 格式的回复。

#### 文本格式

- **粗体文本**：用于强调
- *斜体文本*：用于术语
- ~~删除线~~：用于修正
- \`行内代码\`：用于代码片段

#### 引用块

> 计算机科学中只有两件难事：
> 缓存失效和命名。
>
> — *Phil Karlit

#### 有序列表

1. 第一步：理解需求
2. 第二步：设计方案
3. 第三步：编码实现
4. 第四步：测试验证

#### 代码块

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """生成前 n 个斐波那契数"""
    if n <= 0:
        return []
    result = [0, 1]
    for i in range(2, n):
        result.append(result[i-1] + result[i-2])
    return result[:n]

# 输出前 10 个
print(fibonacci(10))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
\`\`\`

#### 表格

| 特性 | 支持 | 示例 |
|------|:----:|------|
| 粗体 | ✅ | \`**text**\` |
| 斜体 | ✅ | \`*text*\` |
| 代码 | ✅ | \`\`code\`\` |
| 表格 | ✅ | 见上方 |

---

> 💡 Markdown 让文本既易读又易写。`,
  ],
  question: [
    `### 这是一个很好的问题！

让我从几个角度来解答：

#### 核心概念

首先需要理解**基本概念**。在软件工程中，我们通常关注以下几个维度：

1. **正确性** — 程序是否按预期工作
2. **可读性** — 代码是否易于理解
3. **可维护性** — 是否容易修改和扩展
4. **性能** — 执行效率和资源消耗

#### 实际案例

以 React 组件设计为例：

\`\`\`tsx
// ❌ 不好的写法：职责混杂
function UserPage() {
  const [data, setData] = useState(null);
  // 数据获取、状态管理、渲染逻辑全在一起
  useEffect(() => { fetch('/api/user').then(...) }, []);
  return <div>...</div>;
}

// ✅ 更好的写法：关注点分离
function UserPage() {
  const { data, isLoading } = useUserData();
  if (isLoading) return <Skeleton />;
  return <UserProfile user={data} />;
}
\`\`\`

#### 总结对比

| 维度 | 差 | 好 |
|------|-----|-----|
| 耦合度 | 高 | 低 |
| 可测试性 | 难 | 易 |
| 复用性 | 低 | 高 |

> **关键点**：好的设计不是做一次就完成的，而是在迭代中逐步优化的。`,

    `### 好问题！让我详细说明

#### 同步 vs 异步

这是前端开发中最基础也最重要的概念之一：

| 特性 | 同步 | 异步 |
|------|------|------|
| 执行方式 | 阻塞 | 非阻塞 |
| 代码风格 | 顺序执行 | 回调/Promise/async |
| 适用场景 | CPU 密集 | I/O 密集 |
| 错误处理 | try/catch | catch() / try/catch |

#### 代码示例

\`\`\`javascript
// 同步方式（阻塞）
const data = fs.readFileSync('file.txt', 'utf-8');
console.log(data);

// 异步方式（非阻塞）
const data = await fs.promises.readFile('file.txt', 'utf-8');
console.log(data);
\`\`\`

#### 注意事项

- ⚠️ 避免在**主线程**执行耗时同步操作
- ✅ 使用 \`async/await\` 替代回调地狱
- ✅ 合理使用 \`Promise.all\` 并行处理

---

还有什么想了解的吗？ 🤔`,
  ],
  default: [
    `### 我收到了你的消息

这是一个很有趣的话题。让我分享一下我的理解。

#### 背景

在现代 Web 开发中，我们通常关注以下几个技术栈：

- **前端框架**：React、Vue、Svelte
- **构建工具**：Vite、Webpack、Turbopack
- **状态管理**：Jotai、Zustand、Redux
- **样式方案**：CSS Modules、Tailwind、Styled Components

#### 发展趋势

| 年份 | 趋势 | 代表工具 |
|------|------|----------|
| 2020 | 组件化普及 | React Hooks |
| 2022 | 元框架兴起 | Next.js, Nuxt |
| 2024 | AI 集成 | Vercel AI SDK |
| 2026 | 边缘计算 | Cloudflare Workers |

#### 建议

1. 📚 打好基础：HTML/CSS/JS 是根本
2. 🔧 选对工具：根据项目规模选择
3. 🧪 重视测试：保证代码质量
4. 📖 持续学习：技术迭代很快

> 在实际应用中，这里会连接到真实的 AI 服务（如 OpenAI、Claude 等），提供更智能的回答。

---

*当前为 Demo 模式，主要用于展示前后端通信和 SSE 流式传输技术。*`,

    `### 感谢你的分享！

这个话题涉及多个方面，我来做一个梳理。

#### 核心要点

**前后端通信**是 Web 应用的基础，常见方式包括：

1. **REST API** — 最常用，基于 HTTP 协议
2. **GraphQL** — 灵活查询，减少请求次数
3. **WebSocket** — 双向实时通信
4. **SSE (Server-Sent Events)** — 服务端单向推送

#### SSE 示例

\`\`\`typescript
// 前端：监听 SSE 流
const response = await fetch('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: 'hello' }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const text = decoder.decode(value, { stream: true });
  // 处理流式数据...
}
\`\`\`

#### 方案对比

| 方案 | 方向 | 实时性 | 复杂度 |
|------|------|--------|--------|
| REST | 请求/响应 | 低 | ⭐ |
| SSE | 服务端→客户端 | 中 | ⭐⭐ |
| WebSocket | 双向 | 高 | ⭐⭐⭐ |

> 💡 对于 **AI 聊天场景**，SSE 是最佳选择——实现简单、支持断点续传、HTTP 友好。

你可以通过查看项目代码来了解具体实现细节！ 🚀`,
  ],
};

/**
 * 模拟 AI 服务提供者
 */
class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async *generate(
    prompt: string,
    _history?: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>
  ): AsyncIterable<string> {
    const response = this.getDeterministicResponse(prompt);
    for (const char of response) {
      yield char;
    }
  }

  generateFrom(prompt: string, startPosition: number): string {
    const fullResponse = this.getDeterministicResponse(prompt);
    if (startPosition >= fullResponse.length) {
      return '';
    }
    return fullResponse.slice(startPosition);
  }

  /**
   * 兼容性方法：一次性返回完整响应
   * chatService 内部使用，用于后台生成任务
   */
  getResponse(prompt: string): string {
    return this.getDeterministicResponse(prompt);
  }

  /**
   * 确定性响应：相同输入始终返回相同输出
   * 使用输入字符串的哈希值选择模板
   */
  private getDeterministicResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    const hash = this.simpleHash(userMessage);

    // 问候语
    if (
      lowerMessage.includes('你好') ||
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('嗨')
    ) {
      return RESPONSE_TEMPLATES.greeting[hash % RESPONSE_TEMPLATES.greeting.length];
    }

    // 代码相关
    if (
      lowerMessage.includes('代码') ||
      lowerMessage.includes('code') ||
      lowerMessage.includes('编程') ||
      lowerMessage.includes('程序') ||
      lowerMessage.includes('函数') ||
      lowerMessage.includes('实现')
    ) {
      return RESPONSE_TEMPLATES.code[hash % RESPONSE_TEMPLATES.code.length];
    }

    // Markdown 相关
    if (lowerMessage.includes('markdown') || lowerMessage.includes('格式')) {
      return RESPONSE_TEMPLATES.markdown[hash % RESPONSE_TEMPLATES.markdown.length];
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
      return RESPONSE_TEMPLATES.question[hash % RESPONSE_TEMPLATES.question.length];
    }

    // 默认回复
    return RESPONSE_TEMPLATES.default[hash % RESPONSE_TEMPLATES.default.length];
  }

  /**
   * 简单字符串哈希
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

export const mockAiProvider = new MockAiProvider();

// 兼容旧代码的别名
export const mockAiService = mockAiProvider;
